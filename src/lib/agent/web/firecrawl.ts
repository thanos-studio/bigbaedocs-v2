import 'server-only';

import { getGate } from './limiter';
import { assertToolOk, callMcpTool, guardedCall, type McpEndpoint } from './mcp';
import type { ParsedDocument, ParseOptions, ReadOptions, SearchHit, SearchOptions, WebPage } from './types';

/**
 * Firecrawl 제공자: 호스팅 MCP(https://mcp.firecrawl.dev/v2/mcp)의 firecrawl_scrape / firecrawl_search / firecrawl_parse.
 * 키리스는 이 세 툴만 열려 있고 IP 당 하루 요청·크레딧 한도가 있다(https://docs.firecrawl.dev/rate-limits.md).
 * FIRECRAWL_API_KEY 가 있으면 같은 주소에 Bearer 로 붙어 한도가 플랜 기준으로 올라간다.
 *
 * 무료 플랜 한도: /scrape·/search 10회/분, 동시 브라우저 2개. 키가 있으면 넉넉히 잡는다.
 */

/** 자체 호스팅 Firecrawl MCP 를 쓰거나 로컬에서 모의 서버로 시험할 때만 FIRECRAWL_MCP_URL 로 바꾼다. */
const MCP_URL = process.env.FIRECRAWL_MCP_URL?.trim() || 'https://mcp.firecrawl.dev/v2/mcp';
const TOOL_TIMEOUT_MS = 45_000;
const CACHE_ONLY_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const SNIPPET_CHARS = 1_200;

const apiKey = () => process.env.FIRECRAWL_API_KEY?.trim() || undefined;
const gate = () => (apiKey() ? getGate('Firecrawl', 100, 5) : getGate('Firecrawl', 10, 2));
const endpoint = (): McpEndpoint => {
  const key = apiKey();
  return { url: MCP_URL, headers: key ? { authorization: `Bearer ${key}` } : undefined };
};

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const asString = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);

/** 응답은 {success, data:{...}} 로 오기도 하고 data 만 오기도 한다. */
function unwrap(json: unknown): Json {
  if (!isRecord(json)) return {};
  return isRecord(json.data) || Array.isArray(json.data) ? (json.data as Json) : json;
}

function urlsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const url = typeof item === 'string' ? item : isRecord(item) ? asString(item.url) : undefined;
    return url ? [url] : [];
  });
}

/** Exa 식 maxAgeHours 를 Firecrawl 의 maxAge(밀리초)로 옮긴다. */
function maxAgeMs(hours: number | undefined): number | undefined {
  if (hours === undefined) return undefined;
  if (hours < 0) return CACHE_ONLY_MAX_AGE_MS;
  return Math.round(hours * 60 * 60 * 1000);
}

export async function firecrawlRead(options: ReadOptions): Promise<WebPage> {
  const formats = ['markdown', 'links', ...((options.images ?? 0) > 0 ? ['images'] : [])];
  const maxAge = maxAgeMs(options.maxAgeHours);

  const result = await guardedCall(gate(), async () =>
    assertToolOk(
      gate(),
      await callMcpTool(
        endpoint(),
        'firecrawl_scrape',
        { url: options.url, formats, onlyMainContent: true, ...(maxAge === undefined ? {} : { maxAge }) },
        TOOL_TIMEOUT_MS
      )
    )
  );

  const data = unwrap(result.json);
  const markdown = asString(data.markdown) ?? (result.json === undefined ? result.text.trim() : '');
  if (markdown === '') throw new Error('본문이 비어 있어요.');

  const metadata = isRecord(data.metadata) ? data.metadata : {};
  const cacheState = asString(metadata.cacheState);
  const images = urlsOf(data.images).slice(0, options.images ?? 0);

  return {
    url: asString(metadata.sourceURL) ?? asString(metadata.url) ?? options.url,
    title: asString(metadata.title) ?? asString(metadata.ogTitle) ?? null,
    text: markdown,
    provider: 'firecrawl',
    publishedDate: asString(metadata.publishedTime) ?? asString(metadata['article:published_time']) ?? null,
    image: asString(metadata.ogImage) ?? null,
    favicon: asString(metadata.favicon) ?? null,
    images: images.length > 0 ? images : undefined,
    freshness: cacheState === 'hit' ? 'cached' : cacheState === 'miss' ? 'live' : options.maxAgeHours === 0 ? 'live' : 'unknown',
    truncated: false,
    links: urlsOf(data.links),
  };
}

const COUNTRY_NAMES: Record<string, string> = {
  KR: 'South Korea',
  US: 'United States',
  JP: 'Japan',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  CN: 'China',
};

/** Firecrawl 은 경로 없는 호스트 이름만 받는다("anthropic.com/news" → "anthropic.com"). */
function toHostnames(domains: string[] | undefined): string[] {
  return (domains ?? []).flatMap((domain) => {
    const host = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^\*\./, '').split('/')[0];
    return /^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/.test(host) ? [host] : [];
  });
}

/** 발행일 범위를 Google 식 tbs(cdr)로 바꾼다. */
function dateRangeTbs(start: string | undefined, end: string | undefined): string | undefined {
  if (!start && !end) return undefined;
  const format = (date: Date) => `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
  const min = start ? new Date(start) : new Date('2000-01-01');
  const max = end ? new Date(end) : new Date();
  if (Number.isNaN(min.getTime()) || Number.isNaN(max.getTime())) return undefined;
  return `cdr:1,cd_min:${format(min)},cd_max:${format(max)}`;
}

export async function firecrawlSearch(options: SearchOptions): Promise<SearchHit[]> {
  const includeDomains = toHostnames(options.includeDomains);
  const excludeDomains = toHostnames(options.excludeDomains);
  const tbs = dateRangeTbs(options.startPublishedDate, options.endPublishedDate);
  const location = options.country ? (COUNTRY_NAMES[options.country.toUpperCase()] ?? options.country) : undefined;

  const result = await guardedCall(gate(), async () =>
    assertToolOk(
      gate(),
      await callMcpTool(
        endpoint(),
        'firecrawl_search',
        {
          query: options.query,
          limit: options.numResults ?? 5,
          highlights: true,
          ...(tbs ? { tbs } : {}),
          ...(location ? { location } : {}),
          ...(options.category === 'pdf' ? { categories: ['pdf'] } : {}),
          // includeDomains 와 excludeDomains 는 함께 보낼 수 없다.
          ...(includeDomains.length > 0
            ? { includeDomains }
            : excludeDomains.length > 0
              ? { excludeDomains }
              : {}),
        },
        TOOL_TIMEOUT_MS
      )
    )
  );

  const data = unwrap(result.json);
  const items = Array.isArray(data.web) ? data.web : Array.isArray(result.json) ? result.json : [];

  return items.flatMap((item): SearchHit[] => {
    if (!isRecord(item)) return [];
    const url = asString(item.url);
    if (!url) return [];
    const snippet = asString(item.description) ?? asString(item.snippet) ?? asString(item.markdown);
    return [
      {
        title: asString(item.title) ?? null,
        url,
        publishedDate: asString(item.publishedDate) ?? asString(item.date) ?? null,
        snippets: snippet ? [snippet.slice(0, SNIPPET_CHARS)] : [],
      },
    ];
  });
}

type UploadTarget = {
  uploadUrl?: string;
  uploadRef?: string;
  method?: string;
  headers?: Record<string, string>;
  fields?: Record<string, string>;
};

/**
 * 호스팅 firecrawl_parse 는 서버가 파일을 읽지 못해 두 번에 나눠 부른다.
 *  1) 파일 이름으로 호출 → 업로드 주소(uploadUrl)와 uploadRef 를 받는다.
 *  2) 파일 바이트를 그 주소로 올린 뒤, uploadRef 로 다시 호출해 내용을 받는다.
 * 채팅에 붙은 첨부파일은 이미 서버 메모리에 바이트로 있으므로 1~2 를 서버에서 모두 처리한다.
 */
export async function firecrawlParse(
  file: { name: string; contentType: string; bytes: Uint8Array },
  options: ParseOptions = {}
): Promise<ParsedDocument> {
  const first = await guardedCall(gate(), async () =>
    assertToolOk(
      gate(),
      await callMcpTool(
        endpoint(),
        'firecrawl_parse',
        { filePath: file.name, contentType: file.contentType, declaredSizeBytes: file.bytes.byteLength },
        TOOL_TIMEOUT_MS
      )
    )
  );

  const upload = isRecord(first.json) && isRecord(first.json.upload) ? (first.json.upload as UploadTarget) : undefined;
  if (!upload?.uploadUrl || !upload.uploadRef) {
    const reason = isRecord(first.json) ? asString(first.json.message) : undefined;
    throw new Error(reason ?? '업로드 주소를 받지 못했어요.');
  }

  const isPost = (upload.method ?? 'PUT').toUpperCase() === 'POST';
  const blob = new Blob([new Uint8Array(file.bytes)], { type: file.contentType });
  const uploadResponse = await fetch(upload.uploadUrl, {
    method: isPost ? 'POST' : 'PUT',
    signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
    headers: upload.headers,
    body: isPost
      ? (() => {
          const form = new FormData();
          Object.entries(upload.fields ?? {}).forEach(([key, value]) => form.append(key, value));
          form.append('file', blob, file.name);
          return form;
        })()
      : blob,
  });
  if (!uploadResponse.ok) throw new Error(`파일 업로드에 실패했어요 (HTTP ${uploadResponse.status}).`);

  const isPdf = file.contentType === 'application/pdf';
  const second = await guardedCall(gate(), async () =>
    assertToolOk(
      gate(),
      await callMcpTool(
        endpoint(),
        'firecrawl_parse',
        {
          uploadRef: upload.uploadRef,
          formats: ['markdown'],
          ...(options.redactPII ? { redactPII: true } : {}),
          ...(isPdf && options.maxPages ? { parsers: ['pdf'], pdfOptions: { maxPages: options.maxPages } } : {}),
        },
        TOOL_TIMEOUT_MS * 2
      )
    )
  );

  const data = unwrap(second.json);
  const markdown = asString(data.markdown) ?? (second.json === undefined ? second.text.trim() : '');
  if (markdown === '') throw new Error('문서에서 읽은 내용이 없어요.');

  const metadata = isRecord(data.metadata) ? data.metadata : {};
  const pages = typeof metadata.numPages === 'number' ? metadata.numPages : undefined;
  return { name: file.name, text: markdown, provider: 'firecrawl', truncated: false, pages };
}

export function firecrawlKeyed(): boolean {
  return apiKey() !== undefined;
}
