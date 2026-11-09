import 'server-only';

import { assertPublicHttpUrl, fetchDirect } from './direct';
import { exaCapabilities, exaRead, exaSearch } from './exa';
import { firecrawlParse, firecrawlRead, firecrawlSearch } from './firecrawl';
import { RateLimitError } from './limiter';
import type {
  ParsedDocument,
  ParseOptions,
  ReadOptions,
  ReadResult,
  SearchOptions,
  SearchResult,
  WebAttempt,
  WebPage,
  WebProvider,
  WebSubpage,
} from './types';

export type { ParsedDocument, ParseOptions, ReadOptions, ReadResult, SearchOptions, SearchResult } from './types';

const DEFAULT_PAGE_CHARS = 12_000;
const MIN_PAGE_CHARS = 500;
const MAX_PAGE_CHARS = 30_000;
const SUBPAGE_CHARS = 3_000;
const MAX_SUBPAGES = 10;
const MAX_IMAGES = 20;
const MAX_SEARCH_RESULTS = 10;
const MAX_SEARCH_TEXT_CHARS = 5_000;
const SUBPAGE_CONCURRENCY = 2;
const DEFAULT_PARSE_CHARS = 15_000;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** 모델에게 돌려줄 한 줄 오류 설명. */
export function describeWebError(error: unknown): string {
  if (error instanceof RateLimitError) {
    return `${error.message} (${error.retryAfterSeconds}초 뒤 다시 시도할 수 있어요)`;
  }
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return '응답이 너무 늦어서 포기했어요.';
    return error.message.slice(0, 200);
  }
  return '요청에 실패했어요.';
}

/** 모든 제공자가 실패했을 때 던진다. attempts 로 제공자별 이유를 볼 수 있다. */
export class WebProvidersFailed extends Error {
  constructor(
    readonly attempts: WebAttempt[],
    kind: '읽기' | '검색'
  ) {
    super(`웹 ${kind}에 실패했어요. ${attempts.map((a) => `${a.provider}: ${a.error}`).join(' / ')}`);
    this.name = 'WebProvidersFailed';
  }
}

// ---------- 읽기 ----------

function planReaders(options: ReadOptions): { order: WebProvider[]; notes: string[] } {
  const needsFresh = options.maxAgeHours !== undefined && options.maxAgeHours >= 0;
  const needsImages = (options.images ?? 0) > 0;
  // 키 없는 Exa 읽기(web_fetch_exa)는 URL 과 글자 수만 받는다. 신선도나 이미지를 정하려면 처음부터 Firecrawl 로 간다.
  const exaFull = exaCapabilities().keyed || (!needsFresh && !needsImages);

  return exaFull
    ? { order: ['exa', 'firecrawl', 'direct'], notes: [] }
    : {
        order: ['firecrawl', 'direct', 'exa'],
        notes: ['신선도·이미지 지정은 키 없는 Exa 읽기가 지원하지 않아 Firecrawl을 먼저 썼어요.'],
      };
}

function runReader(provider: WebProvider, options: ReadOptions): Promise<WebPage> {
  switch (provider) {
    case 'exa':
      return exaRead(options);
    case 'firecrawl':
      return firecrawlRead(options);
    case 'direct':
      return fetchDirect(options.url, { images: options.images });
  }
}

async function readFirst(options: ReadOptions): Promise<{ page: WebPage; attempts: WebAttempt[]; notes: string[] }> {
  assertPublicHttpUrl(options.url);

  const { order, notes } = planReaders(options);
  const attempts: WebAttempt[] = [];

  for (const provider of order) {
    try {
      const page = await runReader(provider, options);
      if (attempts.length > 0) {
        notes.push(`${attempts.map((a) => a.provider).join(', ')} 대신 ${provider}로 읽었어요.`);
      }
      return { page, attempts, notes };
    } catch (error) {
      attempts.push({ provider, error: describeWebError(error) });
    }
  }

  throw new WebProvidersFailed(attempts, '읽기');
}

const SKIPPED_EXTENSIONS = /\.(?:jpe?g|png|gif|webp|svg|ico|css|js|zip|rar|7z|mp3|mp4|avi|mov|exe)$/i;

function pickSubpageLinks(page: WebPage, options: ReadOptions, limit: number): string[] {
  let base: URL;
  try {
    base = new URL(page.url);
  } catch {
    return [];
  }

  const targets = (options.subpageTarget ?? []).map((target) => target.toLowerCase());
  const seen = new Set<string>([`${base.origin}${base.pathname}${base.search}`]);

  const scored = (page.links ?? []).flatMap((link) => {
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      return [];
    }
    const key = `${url.origin}${url.pathname}${url.search}`;
    if (url.origin !== base.origin || seen.has(key) || SKIPPED_EXTENSIONS.test(url.pathname)) return [];
    seen.add(key);

    const haystack = decodeURIComponent(`${url.pathname}${url.search}`).toLowerCase();
    const matched = targets.filter((target) => haystack.includes(target)).length;
    const depth = url.pathname.split('/').filter(Boolean).length;
    return [{ link: url.toString(), score: matched * 10 - depth }];
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.link);
}

/** 제공자가 하위 페이지를 직접 주지 않을 때: 시작 페이지의 링크 중 고른 것들을 하나씩 읽는다. */
async function crawlSubpages(page: WebPage, options: ReadOptions, limit: number): Promise<WebSubpage[]> {
  let source = page;
  if ((source.links ?? []).length === 0) {
    // Exa 읽기는 링크를 주지 않는다. 링크만 얻으려고 직접 한 번 가져온다.
    source = await fetchDirect(page.url).catch(() => page);
  }

  const urls = pickSubpageLinks(source, options, limit);
  const pages: WebSubpage[] = [];

  for (let start = 0; start < urls.length; start += SUBPAGE_CONCURRENCY) {
    const batch = urls.slice(start, start + SUBPAGE_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((url) =>
        readFirst({ url, maxCharacters: SUBPAGE_CHARS, maxAgeHours: options.maxAgeHours, subpages: 0, images: 0 })
      )
    );
    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue;
      const { page: subpage } = outcome.value;
      pages.push({ url: subpage.url, title: subpage.title, text: subpage.text.slice(0, SUBPAGE_CHARS) });
    }
  }

  return pages;
}

export async function readWebPage(options: ReadOptions): Promise<ReadResult> {
  const limit = clamp(options.maxCharacters ?? DEFAULT_PAGE_CHARS, MIN_PAGE_CHARS, MAX_PAGE_CHARS);
  const subpageCount = clamp(options.subpages ?? 0, 0, MAX_SUBPAGES);
  const normalized: ReadOptions = {
    ...options,
    maxCharacters: limit,
    subpages: subpageCount,
    images: clamp(options.images ?? 0, 0, MAX_IMAGES),
  };

  const { page, attempts, notes } = await readFirst(normalized);

  let subpages = page.subpages;
  if (subpageCount > 0 && (subpages ?? []).length === 0) {
    subpages = await crawlSubpages(page, normalized, subpageCount);
    if (subpages.length === 0) notes.push('따라갈 만한 같은 사이트 링크를 찾지 못했어요.');
  }

  const truncated = page.text.length > limit;
  return {
    ...page,
    text: page.text.slice(0, limit),
    truncated,
    subpages: subpages && subpages.length > 0 ? subpages : undefined,
    links: undefined,
    notes,
    attempts,
  };
}

// ---------- 검색 ----------

function unsupportedOnFirecrawl(options: SearchOptions): string[] {
  const ignored: string[] = [];
  if (options.category !== undefined && options.category !== 'pdf') ignored.push('category');
  if (options.maxAgeHours !== undefined) ignored.push('maxAgeHours');
  if ((options.subpages ?? 0) > 0) ignored.push('subpages');
  if (options.textMaxCharacters !== undefined) ignored.push('textMaxCharacters');
  if ((options.includeDomains ?? []).length > 0 && (options.excludeDomains ?? []).length > 0) {
    ignored.push('excludeDomains');
  }
  return ignored;
}

export async function searchWeb(options: SearchOptions): Promise<SearchResult> {
  const normalized: SearchOptions = {
    ...options,
    numResults: clamp(options.numResults ?? 5, 1, MAX_SEARCH_RESULTS),
    subpages: options.subpages === undefined ? undefined : clamp(options.subpages, 0, MAX_SUBPAGES),
    textMaxCharacters:
      options.textMaxCharacters === undefined ? undefined : clamp(options.textMaxCharacters, 200, MAX_SEARCH_TEXT_CHARS),
  };

  const attempts: WebAttempt[] = [];
  const notes: string[] = [];

  for (const provider of ['exa', 'firecrawl'] as const) {
    try {
      const results = await (provider === 'exa' ? exaSearch(normalized) : firecrawlSearch(normalized));
      if (results.length === 0) {
        attempts.push({ provider, error: '검색 결과가 없어요.' });
        continue;
      }

      if (attempts.length > 0) notes.push(`${attempts.map((a) => a.provider).join(', ')} 대신 ${provider}로 검색했어요.`);
      if (provider === 'firecrawl') {
        const ignored = unsupportedOnFirecrawl(normalized);
        if (ignored.length > 0) notes.push(`Firecrawl 검색은 ${ignored.join(', ')} 옵션을 적용하지 못했어요.`);
      }
      return { query: normalized.query, provider, results: results.slice(0, normalized.numResults), notes, attempts };
    } catch (error) {
      attempts.push({ provider, error: describeWebError(error) });
    }
  }

  // 오류 없이 결과만 비었다면 실패가 아니라 "없음"으로 돌려준다.
  const onlyEmpty = attempts.every((attempt) => attempt.error === '검색 결과가 없어요.');
  if (onlyEmpty) return { query: normalized.query, provider: 'exa', results: [], notes, attempts };

  throw new WebProvidersFailed(attempts, '검색');
}

// ---------- 문서 파싱 ----------

/** 채팅에 첨부된 PDF 를 Firecrawl parse 로 읽는다. 파싱은 Firecrawl 만 지원한다. */
export async function parseDocument(
  file: { name: string; contentType: string; bytes: Uint8Array },
  options: ParseOptions = {}
): Promise<ParsedDocument> {
  const limit = clamp(options.maxCharacters ?? DEFAULT_PARSE_CHARS, MIN_PAGE_CHARS, 60_000);
  const parsed = await firecrawlParse(file, options);
  return { ...parsed, text: parsed.text.slice(0, limit), truncated: parsed.text.length > limit };
}
