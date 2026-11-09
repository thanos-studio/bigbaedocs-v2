import 'server-only';

import { detectRateLimit, RateLimitError, type ProviderGate } from './limiter';

/**
 * 원격 MCP 서버(Streamable HTTP)에 툴 호출만 보내는 가벼운 클라이언트.
 * 두 서버(mcp.exa.ai, mcp.firecrawl.dev)는 상태를 저장하지 않으므로 initialize 없이 바로 tools/call 을 보낸다.
 * 서버가 세션을 요구하면(400/404 + initialize/session 언급) 한 번 초기화하고 다시 보낸다.
 */

export type McpEndpoint = { url: string; headers?: Record<string, string> };
export type McpToolResult = { text: string; json: unknown; isError: boolean };

export class McpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'McpError';
  }
}

type JsonRpcReply = {
  result?: { content?: { type?: string; text?: string }[]; structuredContent?: unknown; isError?: boolean };
  error?: { code?: number; message?: string };
};

const sessions = new Map<string, string>();
let nextId = 1;

function parseReplies(contentType: string, body: string): JsonRpcReply[] {
  if (contentType.includes('text/event-stream')) {
    return body
      .split(/\r?\n\r?\n/)
      .map((event) =>
        event
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
      )
      .filter((data) => data !== '')
      .flatMap((data) => {
        try {
          return [JSON.parse(data) as JsonRpcReply];
        } catch {
          return [];
        }
      });
  }

  try {
    const parsed = JSON.parse(body) as JsonRpcReply | JsonRpcReply[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function tryJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function retryAfterOf(response: Response, body: string): number | undefined {
  const header = Number(response.headers.get('retry-after'));
  if (Number.isFinite(header) && header > 0) return header;
  const fromBody = /retry[_-]?after[_a-z]*["']?\s*[:=]\s*(\d+)/i.exec(body)?.[1];
  return fromBody === undefined ? undefined : Number(fromBody);
}

async function post(
  endpoint: McpEndpoint,
  payload: unknown,
  timeoutMs: number,
  sessionId: string | undefined
): Promise<{ response: Response; body: string }> {
  const response = await fetch(endpoint.url, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
      ...endpoint.headers,
    },
    body: JSON.stringify(payload),
  });
  return { response, body: await response.text() };
}

async function initialize(endpoint: McpEndpoint, timeoutMs: number): Promise<string | undefined> {
  const { response } = await post(
    endpoint,
    {
      jsonrpc: '2.0',
      id: nextId++,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'bigbaedocs', version: '1.0.0' },
      },
    },
    timeoutMs,
    undefined
  );
  const sessionId = response.headers.get('mcp-session-id') ?? undefined;
  if (sessionId) {
    sessions.set(endpoint.url, sessionId);
    await post(endpoint, { jsonrpc: '2.0', method: 'notifications/initialized' }, timeoutMs, sessionId).catch(
      () => undefined
    );
  }
  return sessionId;
}

const NEEDS_INIT = /not initialized|initialize|session/i;

/** 관문을 거쳐 호출하고, HTTP 429 는 쿨다운으로 바꿔 RateLimitError 로 던진다. */
export async function guardedCall<T>(gate: ProviderGate, task: () => Promise<T>): Promise<T> {
  try {
    return await gate.run(task);
  } catch (error) {
    if (error instanceof McpError && error.status === 429) {
      const wait = gate.cooldown(error.retryAfterSeconds);
      throw new RateLimitError(`${gate.name} 요청 한도를 넘었어요.`, wait);
    }
    throw error;
  }
}

/** 툴이 오류로 끝났으면 한도 초과인지 가려 던진다. 정상이면 텍스트를 돌려준다. */
export function assertToolOk(gate: ProviderGate, result: McpToolResult): McpToolResult {
  if (!result.isError) return result;

  const limit = detectRateLimit(result.text);
  if (limit.hit) {
    const wait = gate.cooldown(limit.retryAfterSeconds ?? (limit.daily ? 60 * 60 : undefined));
    throw new RateLimitError(
      limit.daily ? `${gate.name} 오늘 무료 한도를 다 썼어요.` : `${gate.name} 요청 한도를 넘었어요.`,
      wait
    );
  }
  throw new Error(result.text.slice(0, 300) || `${gate.name} 툴 오류`);
}

export async function callMcpTool(
  endpoint: McpEndpoint,
  name: string,
  args: Record<string, unknown>,
  timeoutMs = 30_000
): Promise<McpToolResult> {
  const send = (sessionId: string | undefined) =>
    post(
      endpoint,
      { jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args } },
      timeoutMs,
      sessionId
    );

  let { response, body } = await send(sessions.get(endpoint.url));

  if (response.status !== 429 && response.status >= 400 && NEEDS_INIT.test(body)) {
    sessions.delete(endpoint.url);
    const sessionId = await initialize(endpoint, timeoutMs);
    ({ response, body } = await send(sessionId));
  }

  if (response.status === 429) {
    throw new McpError('HTTP 429', 429, retryAfterOf(response, body));
  }
  if (!response.ok) {
    throw new McpError(`HTTP ${response.status} ${body.slice(0, 200)}`.trim(), response.status);
  }

  const reply = parseReplies(response.headers.get('content-type') ?? '', body).find(
    (message) => message.result !== undefined || message.error !== undefined
  );
  if (!reply) throw new McpError('MCP 서버가 비어 있는 응답을 돌려줬어요.');
  if (reply.error) throw new McpError(reply.error.message ?? 'MCP 오류');

  const result = reply.result ?? {};
  const text = (result.content ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('\n');

  return {
    text,
    json: result.structuredContent ?? tryJson(text),
    isError: result.isError === true,
  };
}
