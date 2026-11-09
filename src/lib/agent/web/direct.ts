import 'server-only';

import type { WebPage } from './types';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;

/**
 * 사용자가 붙여넣은 URL 을 서버가 직접 열기도 하고 외부 서비스에 넘기기도 하므로, 내부망 주소는 막는다(SSRF 방지).
 * 호스트 이름만 보는 검사라서 DNS 로 내부 IP 를 가리키는 도메인까지는 막지 못한다.
 */
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }
  if (host === '0.0.0.0') return true;
  // IPv6 리터럴: 루프백, 미지정, 고유 로컬(fc/fd), 링크 로컬(fe80~febf), IPv4 매핑은 모두 내부망으로 본다.
  if (host.includes(':')) return /^(::1?$|fc|fd|fe[89ab]|::ffff:)/.test(host);
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

export function assertPublicHttpUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    throw new Error('URL 형식이 올바르지 않아요.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('http 또는 https 링크만 열 수 있어요.');
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error('열 수 없는 주소예요.');
  }
  return url;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** 정규식 기반 HTML → 본문 텍스트. 가볍게 쓰는 마지막 수단이라 정밀 추출은 Exa/Firecrawl 이 맡는다. */
export function extractHtmlText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|iframe|head)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|section|article|li|h[1-6]|tr|blockquote|figcaption)>/gi, '\n')
      .replace(/<(br|hr)\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function metaContent(html: string, property: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i'
  );
  const match = html.match(pattern);
  const value = match?.[1] ?? match?.[2];
  return value ? decodeEntities(value).trim() : null;
}

function extractTitle(html: string): string | null {
  const title = metaContent(html, 'og:title') ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (!title) return null;
  const cleaned = decodeEntities(title).replace(/\s+/g, ' ').trim();
  return cleaned === '' ? null : cleaned.slice(0, 300);
}

function resolveHttp(href: string, base: string): string | null {
  try {
    const url = new URL(decodeEntities(href.trim()), base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** 같은 사이트 링크가 앞에 오도록 정렬해 중복 없이 돌려준다. */
export function extractLinks(html: string, baseUrl: string): string[] {
  const origin = new URL(baseUrl).origin;
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\s[^>]*?href=["']([^"']+)["']/gi)) {
    const link = resolveHttp(match[1], baseUrl);
    if (link) seen.add(link);
  }
  const links = [...seen];
  return [...links.filter((link) => link.startsWith(origin)), ...links.filter((link) => !link.startsWith(origin))];
}

export function extractImages(html: string, baseUrl: string, limit: number): string[] {
  const seen = new Set<string>();
  const og = metaContent(html, 'og:image');
  const ogUrl = og ? resolveHttp(og, baseUrl) : null;
  if (ogUrl) seen.add(ogUrl);
  for (const match of html.matchAll(/<img\s[^>]*?src=["']([^"']+)["']/gi)) {
    if (seen.size >= limit) break;
    const image = match[1].startsWith('data:') ? null : resolveHttp(match[1], baseUrl);
    if (image) seen.add(image);
  }
  return [...seen].slice(0, limit);
}

function extractFavicon(html: string, baseUrl: string): string | null {
  const href = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)?.[1];
  return resolveHttp(href ?? '/favicon.ico', baseUrl);
}

/** Content-Type 이나 <meta charset> 으로 인코딩을 찾는다. 국내 공공기관 사이트에는 EUC-KR 이 아직 많다. */
function decodeBody(bytes: Uint8Array, contentType: string): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 2048));
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  const label = (fromHeader ?? fromMeta ?? 'utf-8').toLowerCase();
  try {
    return new TextDecoder(label, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

async function readLimited(response: Response): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array(await response.arrayBuffer()).subarray(0, MAX_PAGE_BYTES);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_PAGE_BYTES) {
      void reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(Math.min(received, MAX_PAGE_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset + chunk.byteLength > merged.byteLength) break;
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

/** 리다이렉트를 직접 따라가며 매 단계마다 주소를 다시 검사한다(공개 주소가 내부망으로 돌리는 우회 방지). */
async function fetchFollowingRedirects(first: URL): Promise<Response> {
  let url = first;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // 기본 fetch UA를 막는 국내 사이트가 있어 실제 브라우저처럼 보낸다.
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
        'accept-language': 'ko,en;q=0.8',
      },
    });

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      url = assertPublicHttpUrl(new URL(location, url).toString());
      continue;
    }
    return response;
  }
  throw new Error('리다이렉트가 너무 많아요.');
}

export async function fetchDirect(rawUrl: string, options: { images?: number } = {}): Promise<WebPage> {
  const response = await fetchFollowingRedirects(assertPublicHttpUrl(rawUrl));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType && !/html|text|json|xml/i.test(contentType)) {
    throw new Error(`지원하지 않는 형식이에요 (${contentType.split(';')[0]})`);
  }

  const finalUrl = response.url || rawUrl;
  const body = decodeBody(await readLimited(response), contentType);
  const isHtml = !/json/i.test(contentType);
  const text = isHtml ? extractHtmlText(body) : body.trim();
  if (text === '') throw new Error('본문이 비어 있어요.');

  return {
    url: finalUrl,
    title: isHtml ? extractTitle(body) : null,
    text,
    provider: 'direct',
    freshness: 'live',
    truncated: false,
    image: isHtml ? (extractImages(body, finalUrl, 1)[0] ?? null) : null,
    favicon: isHtml ? extractFavicon(body, finalUrl) : null,
    images: isHtml && (options.images ?? 0) > 0 ? extractImages(body, finalUrl, options.images ?? 0) : undefined,
    links: isHtml ? extractLinks(body, finalUrl) : [],
  };
}
