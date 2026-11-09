import 'server-only';

import { getGate } from './limiter';
import { assertToolOk, callMcpTool, guardedCall, McpError, type McpEndpoint } from './mcp';
import type { ReadOptions, SearchHit, SearchOptions, WebPage, WebSubpage } from './types';

/**
 * Exa 제공자.
 * - 키가 없으면(기본) 호스팅 MCP 를 무료 한도로 쓴다: 검색은 web_search_exa / web_search_advanced_exa,
 *   읽기는 web_fetch_exa. web_fetch_exa 는 URL 과 글자 수만 받으므로 신선도·하위 페이지·이미지는 못 한다.
 * - EXA_API_KEY 가 있으면 REST(/search, /contents)로 바로 가서 maxAgeHours, subpages, extras.imageLinks 를 모두 쓴다.
 */

const MCP_URL = 'https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa,web_search_advanced_exa';
const API_URL = 'https://api.exa.ai';
const SNIPPET_CHARS = 1_200;
const MAX_SNIPPETS = 3;
const LIVECRAWL_TIMEOUT_MS = 12_000;

const apiKey = () => process.env.EXA_API_KEY?.trim() || undefined;

/** 무료 한도는 공개되어 있지 않아 보수적으로 잡는다. */
const gate = () => (apiKey() ? getGate('Exa', 60, 5) : getGate('Exa', 20, 3));

const mcpEndpoint = (): McpEndpoint => ({ url: MCP_URL });

type ExaResult = {
  title?: string | null;
  url?: string;
  publishedDate?: string | null;
  highlights?: (string | null)[];
  text?: string | null;
  summary?: string | null;
  image?: string | null;
  favicon?: string | null;
  subpages?: ExaResult[];
  extras?: { imageLinks?: string[] };
};

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);

function toSubpage(result: ExaResult): WebSubpage | null {
  if (!result.url) return null;
  const text = result.text ?? (result.highlights ?? []).filter(Boolean).join('\n\n') ?? '';
  return { url: result.url, title: result.title ?? null, text: clip(text, 3_000) };
}

function toHit(result: ExaResult): SearchHit | null {
  if (!result.url) return null;

  const highlights = (result.highlights ?? []).filter((item): item is string => typeof item === 'string' && item !== '');
  const snippets = (
    highlights.length > 0 ? highlights : [result.text ?? result.summary ?? ''].filter((item) => item !== '')
  )
    .slice(0, MAX_SNIPPETS)
    .map((snippet) => clip(snippet, SNIPPET_CHARS));

  const subpages = (result.subpages ?? []).flatMap((page) => toSubpage(page) ?? []);

  return {
    title: result.title ?? null,
    url: result.url,
    publishedDate: result.publishedDate && result.publishedDate !== 'N/A' ? result.publishedDate : null,
    snippets,
    image: result.image ?? null,
    favicon: result.favicon ?? null,
    ...(subpages.length > 0 ? { subpages } : {}),
  };
}

/** web_search_exa 는 "Title: / URL: / Published: / Author: / Highlights:" 블록의 평문을 돌려준다. */
function parseSearchText(text: string): SearchHit[] {
  return text
    .split(/\n(?=Title: )/)
    .flatMap((block) => {
      const url = /^URL:\s*(\S+)/m.exec(block)?.[1];
      if (!url) return [];
      const title = /^Title:\s*(.*)$/m.exec(block)?.[1]?.trim();
      const published = /^Published:\s*(.*)$/m.exec(block)?.[1]?.trim();
      const body = block.split(/^(?:Highlights|Text|Summary):[ \t]*\n?/m).slice(1).join('\n').trim();
      return toHit({ url, title: title ?? null, publishedDate: published ?? null, highlights: body ? [body] : [] }) ?? [];
    });
}

function isoStart(date: string | undefined): string | undefined {
  if (!date) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00.000Z` : date;
}

function isoEnd(date: string | undefined): string | undefined {
  if (!date) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T23:59:59.999Z` : date;
}

/** 키가 있을 때 쓰는 REST 호출. 429 는 관문이 쿨다운으로 처리하도록 McpError 로 올린다. */
async function restPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey() ?? '' },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    throw new McpError('HTTP 429', 429, Number(response.headers.get('retry-after')) || undefined);
  }
  if (response.status === 401) throw new Error('Exa API 키가 올바르지 않아요.');
  if (!response.ok) throw new Error(`Exa HTTP ${response.status}`);
  return response.json();
}

/** lite 는 신선도·하위 페이지 같은 옵션을 받지 않는다. 그런 옵션이 있으면 auto 로 올린다. */
function searchType(options: SearchOptions): 'auto' | 'lite' {
  const needsAuto =
    options.maxAgeHours !== undefined || (options.subpages ?? 0) > 0 || (options.subpageTarget ?? []).length > 0;
  return options.type === 'lite' && !needsAuto ? 'lite' : 'auto';
}

async function restSearch(options: SearchOptions): Promise<SearchHit[]> {
  const type = searchType(options);
  const contents: Record<string, unknown> =
    options.textMaxCharacters === undefined ? { highlights: true } : { text: { maxCharacters: options.textMaxCharacters } };
  if (type === 'auto') {
    if (options.maxAgeHours !== undefined) contents.maxAgeHours = options.maxAgeHours;
    if ((options.subpages ?? 0) > 0) contents.subpages = options.subpages;
    if ((options.subpageTarget ?? []).length > 0) contents.subpageTarget = options.subpageTarget;
  }

  const payload = (await restPost('/search', {
    query: options.query,
    objective: options.objective,
    type,
    numResults: options.numResults,
    category: options.category,
    includeDomains: options.includeDomains,
    excludeDomains: options.excludeDomains,
    startPublishedDate: isoStart(options.startPublishedDate),
    endPublishedDate: isoEnd(options.endPublishedDate),
    userLocation: options.country,
    contents,
  })) as { results?: ExaResult[] };

  return (payload.results ?? []).flatMap((result) => toHit(result) ?? []);
}

async function mcpSearch(options: SearchOptions): Promise<SearchHit[]> {
  const needsAdvanced =
    options.type === 'lite' ||
    options.category !== undefined ||
    (options.includeDomains ?? []).length > 0 ||
    (options.excludeDomains ?? []).length > 0 ||
    options.startPublishedDate !== undefined ||
    options.endPublishedDate !== undefined ||
    options.country !== undefined ||
    options.maxAgeHours !== undefined ||
    options.textMaxCharacters !== undefined ||
    (options.subpages ?? 0) > 0;

  if (!needsAdvanced) {
    const result = assertToolOk(
      gate(),
      await callMcpTool(mcpEndpoint(), 'web_search_exa', {
        query: options.query,
        objective: options.objective,
        ...(options.numResults === undefined ? {} : { numResults: options.numResults }),
      })
    );
    return parseSearchText(result.text);
  }

  const type = searchType(options);
  const result = assertToolOk(
    gate(),
    await callMcpTool(mcpEndpoint(), 'web_search_advanced_exa', {
      query: options.query,
      type,
      numResults: options.numResults,
      category: options.category,
      includeDomains: options.includeDomains,
      excludeDomains: options.excludeDomains,
      startPublishedDate: options.startPublishedDate,
      endPublishedDate: options.endPublishedDate,
      userLocation: options.country,
      ...(options.textMaxCharacters === undefined
        ? { enableHighlights: true, highlightsQuery: options.objective }
        : { textMaxCharacters: options.textMaxCharacters }),
      ...(type === 'auto'
        ? {
            maxAgeHours: options.maxAgeHours,
            livecrawlTimeout: options.maxAgeHours === undefined ? undefined : LIVECRAWL_TIMEOUT_MS,
            subpages: options.subpages,
            subpageTarget: options.subpageTarget,
          }
        : {}),
    })
  );

  const json = result.json as { results?: ExaResult[] } | undefined;
  return json?.results ? json.results.flatMap((item) => toHit(item) ?? []) : parseSearchText(result.text);
}

export function exaSearch(options: SearchOptions): Promise<SearchHit[]> {
  return guardedCall(gate(), () => (apiKey() ? restSearch(options) : mcpSearch(options)));
}

function freshnessOf(source: unknown): WebPage['freshness'] {
  if (typeof source !== 'string') return 'unknown';
  if (/cache/i.test(source)) return 'cached';
  if (/live|crawl|fresh|fetch/i.test(source)) return 'live';
  return 'unknown';
}

async function restRead(options: ReadOptions): Promise<WebPage> {
  const maxCharacters = options.maxCharacters;
  const live = options.maxAgeHours !== undefined && options.maxAgeHours >= 0;

  const payload = (await restPost('/contents', {
    ids: [options.url],
    ...(options.query
      ? { highlights: { query: options.query, ...(maxCharacters ? { maxCharacters } : {}) } }
      : { text: maxCharacters ? { maxCharacters } : true }),
    ...(options.maxAgeHours === undefined ? {} : { maxAgeHours: options.maxAgeHours }),
    ...(live ? { livecrawlTimeout: LIVECRAWL_TIMEOUT_MS } : {}),
    ...((options.subpages ?? 0) > 0 ? { subpages: options.subpages } : {}),
    ...((options.subpageTarget ?? []).length > 0 ? { subpageTarget: options.subpageTarget } : {}),
    ...((options.images ?? 0) > 0 ? { extras: { imageLinks: options.images } } : {}),
  })) as {
    results?: ExaResult[];
    statuses?: { status?: string; source?: string; error?: { tag?: string } }[];
  };

  const status = payload.statuses?.[0];
  const result = payload.results?.[0];
  if (status?.status === 'error' || !result) {
    throw new Error(`Exa가 페이지를 가져오지 못했어요${status?.error?.tag ? ` (${status.error.tag})` : ''}.`);
  }

  const text = result.text ?? (result.highlights ?? []).filter(Boolean).join('\n\n');
  if (!text) throw new Error('본문이 비어 있어요.');

  const subpages = (result.subpages ?? []).flatMap((page) => toSubpage(page) ?? []);
  return {
    url: result.url ?? options.url,
    title: result.title ?? null,
    text,
    provider: 'exa',
    publishedDate: result.publishedDate ?? null,
    image: result.image ?? null,
    favicon: result.favicon ?? null,
    images: result.extras?.imageLinks,
    freshness: freshnessOf(status?.source),
    truncated: false,
    ...(subpages.length > 0 ? { subpages } : {}),
  };
}

/** web_fetch_exa 응답: "# 제목\nURL: ...\n\n본문" */
async function mcpRead(options: ReadOptions): Promise<WebPage> {
  const result = assertToolOk(
    gate(),
    await callMcpTool(mcpEndpoint(), 'web_fetch_exa', {
      urls: [options.url],
      ...(options.maxCharacters ? { maxCharacters: options.maxCharacters } : {}),
    })
  );

  const text = result.text.trim();
  if (text === '') throw new Error('본문이 비어 있어요.');

  const title = /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? null;
  const url = /^URL:\s*(\S+)/m.exec(text)?.[1] ?? options.url;
  const body = text
    .replace(/^#\s+.+\n?/m, '')
    .replace(/^URL:\s*\S+\n?/m, '')
    .trim();

  return { url, title, text: body === '' ? text : body, provider: 'exa', freshness: 'unknown', truncated: false };
}

export function exaRead(options: ReadOptions): Promise<WebPage> {
  return guardedCall(gate(), () => (apiKey() ? restRead(options) : mcpRead(options)));
}

/** 키 없이도 제한 없이 되는 기능과 키가 필요한 기능을 호출부가 구분할 수 있게 알려준다. */
export function exaCapabilities(): { keyed: boolean } {
  return { keyed: apiKey() !== undefined };
}
