import 'server-only';

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

import { parseDateExpression } from '@/lib/parse-date';
import { searchPlaces } from '@/lib/places';
import { sanitizeProse } from './writing';

import {
  applicationPatchSchema,
  reportPatchSchema,
  type ApplicationDraftContext,
  type ApplicationPatch,
  type AvailableStudent,
  type ReportPatch,
} from './schema';

const PATCH_FIELD_LABELS: Record<string, string> = {
  studentIds: '학생',
  step: '단계',
  title: '제목',
  startDate: '시작일',
  endDate: '종료일',
  learningType: '학습 형태',
  destination: '장소',
  placeRegion: '지역',
  placeAddress: '주소',
  purpose: '체험 목적',
  plan: '활동 계획',
};

function describePatch(patch: ApplicationPatch): string {
  return Object.keys(patch)
    .map((field) => PATCH_FIELD_LABELS[field] ?? field)
    .join(', ');
}

function sanitizePatch(patch: ApplicationPatch): ApplicationPatch {
  return {
    ...patch,
    ...(patch.purpose === undefined ? {} : { purpose: sanitizeProse(patch.purpose) }),
    ...(patch.plan === undefined ? {} : { plan: sanitizeProse(patch.plan) }),
  };
}

const REPORT_FIELD_LABELS: Record<string, string> = {
  reportStep: '단계',
  experience: '체험내용',
  reflection: '느낀 점',
  attachmentNote: '첨부자료',
};

export function createReportTools(draft: ApplicationDraftContext) {
  return {
    read_report_draft: tool({
      description:
        'Read the current trip and report draft. The trip fields (students, place, dates, purpose) come from the approved application and must not be changed.',
      inputSchema: z.object({}),
      execute: async () => draft,
    }),
    ask_report_question: tool({
      description:
        'Ask the guardian one focused question when the report needs information only they can provide, such as what they actually did or how the student felt.',
      inputSchema: z.object({
        question: z.string().trim().min(1).max(300),
        field: z.enum(['experience', 'reflection', 'attachmentNote']).optional(),
        choices: z.array(z.string().trim().min(1).max(80)).max(6).optional(),
        freeText: z.boolean().optional(),
        placeholder: z.string().trim().max(80).optional(),
      }),
      execute: async ({ question, field, choices, freeText, placeholder }) => ({
        question,
        field,
        choices: choices ?? [],
        freeText: freeText ?? false,
        placeholder,
      }),
    }),
    update_report_draft: tool({
      description:
        'Propose explicit report changes. Call this whenever the user supplies or approves report content. This returns a patch for the client to apply; it does not persist data itself.',
      inputSchema: reportPatchSchema,
      execute: async (patch) => {
        const sanitized: ReportPatch = {
          ...patch,
          ...(patch.experience === undefined
            ? {}
            : { experience: sanitizeProse(patch.experience) }),
          ...(patch.reflection === undefined
            ? {}
            : { reflection: sanitizeProse(patch.reflection) }),
        };

        return {
          patch: sanitized,
          summary: Object.keys(sanitized)
            .map((field) => REPORT_FIELD_LABELS[field] ?? field)
            .join(', '),
        };
      },
    }),
  } satisfies ToolSet;
}
export function createApplicationTools(
  draft: ApplicationDraftContext,
  availableStudents: AvailableStudent[] = [],
  turbo = false
) {
  return {
    read_application_draft: tool({
      description: 'Read the current application draft before answering questions about its contents.',
      inputSchema: z.object({}),
      execute: async () => draft,
    }),
    list_available_students: tool({
      description:
        'List every student registered in this browser, with id and class info. Call this before selecting students so you use real ids.',
      inputSchema: z.object({}),
      execute: async () => ({ students: availableStudents }),
    }),
    parse_date_expression: tool({
      description:
        'Parse a Korean natural-language date expression into an application start and end date. Use it instead of guessing dates.',
      inputSchema: z.object({ expression: z.string().trim().min(1).max(300) }),
      execute: async ({ expression }) => ({
        expression,
        range: parseDateExpression(expression),
      }),
    }),
    search_application_places: tool({
      description:
        'Search the local application place catalog. The catalog is small, so it often returns nothing. When it does, use propose_place_addresses instead.',
      inputSchema: z.object({
        region: z.enum(['domestic', 'overseas']),
        query: z.string().max(200),
      }),
      execute: async ({ region, query }) => ({
        places: searchPlaces(region, query),
      }),
    }),
    propose_place_addresses: tool({
      description:
        'Offer up to 3 real candidate places with full addresses for the user to pick from, using your own knowledge of Korean places. Use this when search_application_places returns nothing or the user gave a vague place name. Never invent an address you are unsure of.',
      inputSchema: z.object({
        query: z.string().trim().min(1).max(200),
        candidates: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(120),
              address: z.string().trim().min(1).max(300),
            })
          )
          .min(1)
          .max(3),
      }),
      execute: async ({ query, candidates }) => ({ query, candidates }),
    }),
    ask_application_question: tool({
      description:
        'Ask the guardian one focused question when a required field is missing or ambiguous.',
      inputSchema: z.object({
        question: z.string().trim().min(1).max(300),
        field: z
          .enum(['title', 'schedule', 'place', 'learningType', 'purpose', 'plan', 'students'])
          .optional(),
        choices: z.array(z.string().trim().min(1).max(80)).max(6).optional(),
        freeText: z.boolean().optional(),
        placeholder: z.string().trim().max(80).optional(),
      }),
      execute: async ({ question, field, choices, freeText, placeholder }) => ({
        question,
        field,
        choices: choices ?? [],
        freeText: freeText ?? false,
        placeholder,
      }),
    }),
    update_application_draft: tool({
      description:
        'Propose explicit application form changes. Call this whenever the user supplies or approves a field value. This returns a patch for the client to apply; it does not persist data itself.',
      inputSchema: applicationPatchSchema,
      execute: async (patch) => {
        const sanitized = sanitizePatch(patch);

        // turbo는 학생을 묻지 않기로 했으므로, 모델이 studentIds를 빠뜨리면 서버가 전원 선택으로 채운다.
        const needsStudents =
          turbo &&
          draft.studentIds.length === 0 &&
          (sanitized.studentIds ?? []).length === 0 &&
          availableStudents.length > 0;
        const filled = needsStudents
          ? { ...sanitized, studentIds: availableStudents.map((student) => student.id) }
          : sanitized;

        return {
          patch: filled,
          summary: describePatch(filled),
        };
      },
    }),
  } satisfies ToolSet;
}
