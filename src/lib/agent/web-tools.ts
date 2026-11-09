import 'server-only';

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

import type { PdfAttachment } from './attachments';
import { getSkill, SKILL_NAMES } from './skills';
import { describeWebError, parseDocument, readWebPage, searchWeb } from './web';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .optional();

/** 모델이 빈 배열이나 0 을 "지정 안 함"으로 보내도 받아들이도록, 값이 비면 undefined 로 바꾼다. */
const nonEmpty = <T>(items: T[] | undefined): T[] | undefined => (items && items.length > 0 ? items : undefined);

/**
 * 웹과 스킬 툴. 모두 키 없이 동작한다(Exa 호스팅 MCP + Firecrawl 호스팅 MCP + 직접 fetch).
 * 툴 목록은 요청마다 같아야 한다: 이전 턴의 tool 파트가 메시지 이력에 남아 있어 검증에 쓰이기 때문이다.
 */
export function createWebTools(attachments: PdfAttachment[] = []) {
  return {
    load_skill: tool({
      description:
        'Load the full instructions of a skill listed in the system prompt. Call it before using the tools the skill explains. Returns the skill body as markdown.',
      inputSchema: z.object({ name: z.enum(SKILL_NAMES) }),
      execute: async ({ name }) => {
        const skill = getSkill(name);
        return skill
          ? { name: skill.name, instructions: skill.body }
          : { name, error: `Unknown skill. Available: ${SKILL_NAMES.join(', ')}` };
      },
    }),

    read_web_page: tool({
      description:
        'Read a web page you already have the URL for and return its text as markdown. Use it when the user shares a link (facility, program, booking or notice page) so the form is filled from what the page says. Options: maxAgeHours for content freshness, subpages/subpageTarget to also read linked pages, images for image URLs. Load the web-reading skill first if you need any option beyond url. Returns provider, freshness, notes and attempts so you can see fallbacks.',
      inputSchema: z.object({
        url: z.string().trim().min(1).max(2000),
        query: z.string().trim().max(300).optional().describe('Question to focus extraction on. Only used when Exa has an API key.'),
        maxCharacters: z.number().int().min(500).max(30_000).optional().describe('Max characters of page text. Default 12000.'),
        maxAgeHours: z
          .number()
          .int()
          .min(-1)
          .max(24 * 365)
          .optional()
          .describe('Content freshness. Omit for default. 0 = always fetch live, -1 = cache only, N = reuse cache newer than N hours.'),
        subpages: z.number().int().min(1).max(10).optional().describe('How many linked same-site pages to read as well.'),
        subpageTarget: z.array(z.string().trim().min(1).max(40)).max(8).optional().describe('Keywords that make matching subpage links win.'),
        images: z.number().int().min(1).max(20).optional().describe('How many image URLs to return.'),
      }),
      execute: async ({ url, query, maxCharacters, maxAgeHours, subpages, subpageTarget, images }) => {
        try {
          const page = await readWebPage({
            url,
            query,
            maxCharacters,
            maxAgeHours,
            subpages,
            subpageTarget: nonEmpty(subpageTarget),
            images,
          });
          return { ...page, attempts: nonEmpty(page.attempts), notes: nonEmpty(page.notes) };
        } catch (error) {
          return { url, error: describeWebError(error) };
        }
      },
    }),

    web_search: tool({
      description:
        'Search the public web when you are missing real-world facts the user did not provide and no link was shared (a facility\'s official name, address, reservation rules, hours). Tries Exa, then Firecrawl. Pass a natural-language query and an objective. Leave every optional filter out unless the task needs it; load the web-search skill first if you do. Never present results as user-supplied facts.',
      inputSchema: z.object({
        query: z.string().trim().min(1).max(300),
        objective: z
          .string()
          .trim()
          .min(1)
          .max(1000)
          .describe('Goal for this search turn; say which documents should rank first, which should be excluded, and what specific facts or figures to pull from them.'),
        numResults: z.number().int().min(1).max(10).optional(),
        type: z.enum(['auto', 'lite']).optional(),
        category: z
          .enum(['company', 'publication', 'news', 'pdf', 'github', 'personal site', 'people', 'financial report'])
          .optional(),
        includeDomains: z.array(z.string().trim().min(1).max(120)).max(10).optional(),
        excludeDomains: z.array(z.string().trim().min(1).max(120)).max(10).optional(),
        startPublishedDate: isoDate,
        endPublishedDate: isoDate,
        country: z.string().trim().length(2).optional().describe('Two-letter country code, e.g. KR.'),
        maxAgeHours: z.number().int().min(0).max(24 * 365).optional(),
        textMaxCharacters: z.number().int().min(200).max(5_000).optional(),
        subpages: z.number().int().min(1).max(5).optional(),
        subpageTarget: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
      }),
      execute: async (input) => {
        try {
          return await searchWeb({
            ...input,
            includeDomains: nonEmpty(input.includeDomains),
            excludeDomains: nonEmpty(input.excludeDomains),
            subpageTarget: nonEmpty(input.subpageTarget),
            country: input.country?.toUpperCase(),
          });
        } catch (error) {
          return { query: input.query, error: describeWebError(error) };
        }
      },
    }),

    parse_attachment: tool({
      description:
        'Read a PDF the user attached to this conversation and return clean text (Firecrawl parse). The model can already see attached PDFs, so call this only for long or scanned documents, or to mask personal data with redactPII. Pass the file name exactly as listed under "Attached documents" in the system prompt; it may be omitted when only one PDF is attached.',
      inputSchema: z.object({
        name: z.string().trim().min(1).max(200).optional(),
        maxPages: z.number().int().min(1).max(200).optional().describe('Max PDF pages to read.'),
        maxCharacters: z.number().int().min(500).max(60_000).optional(),
        redactPII: z.boolean().optional().describe('Mask personal information such as names and contact details.'),
      }),
      execute: async ({ name, maxPages, maxCharacters, redactPII }) => {
        const file =
          attachments.find((item) => item.name === name) ??
          attachments.find((item) => item.name.toLowerCase() === name?.toLowerCase()) ??
          (name === undefined && attachments.length === 1 ? attachments[0] : undefined);

        if (!file) {
          return {
            error:
              attachments.length === 0
                ? '대화에 첨부된 PDF가 없어요.'
                : `이름이 맞는 PDF를 찾지 못했어요. 첨부된 파일: ${attachments.map((item) => item.name).join(', ')}`,
          };
        }

        try {
          return await parseDocument(file, { maxPages, maxCharacters, redactPII });
        } catch (error) {
          return { name: file.name, error: describeWebError(error) };
        }
      },
    }),
  } satisfies ToolSet;
}
