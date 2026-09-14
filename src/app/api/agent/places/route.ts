import { generateText } from 'ai';

import { AgentConfigurationError } from '@/lib/agent/config';
import { getAgentModel } from '@/lib/agent/model';
import {
  placeCandidateListSchema,
  placeSearchRequestSchema,
  type PlaceSearchRequest,
} from '@/lib/agent/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OSM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const OSM_TIMEOUT_MS = 8_000;
const AGENT_TIMEOUT_MS = 30_000;

type Candidate = { name: string; address: string };

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(source: unknown, key: string): string {
  if (!isRecord(source)) return '';
  const value = source[key];
  return typeof value === 'string' ? value.trim() : '';
}

async function searchOsm(query: string, region: PlaceSearchRequest['region']): Promise<Candidate[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
    'accept-language': 'ko',
  });
  if (region === 'domestic') params.set('countrycodes', 'kr');

  const response = await fetch(`${OSM_ENDPOINT}?${params.toString()}`, {
    headers: {
      'User-Agent': 'BigBaeDocs/1.0 (school application assistant)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(OSM_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`OSM responded with ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) return [];

  return payload.flatMap((entry) => {
    const displayName = readString(entry, 'display_name');
    if (displayName === '') return [];

    const segments = displayName.split(',').map((part) => part.trim());
    const name = readString(entry, 'name') || segments[0] || '';
    if (name === '') return [];

    const address = segments
      .filter((segment) => segment !== name && !/^\d{5}$/.test(segment))
      .reverse()
      .join(' ');

    return [{ name, address: address === '' ? displayName : address }];
  });
}

/** 모델이 코드펜스나 설명을 덧붙여도 첫 JSON 객체만 뽑아낸다. */
function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function searchAgent(
  query: string,
  region: PlaceSearchRequest['region'],
  model: string | undefined
): Promise<Candidate[]> {
  const scope =
    region === 'domestic'
      ? '대한민국 안에 실제로 있는 장소만 찾아라. 한국에 없는 이름이면 한국에 있는 가장 비슷한 장소를 찾아라.'
      : '해외에 실제로 있는 장소를 찾아라.';

  const result = await generateText({
    model: getAgentModel(model),
    abortSignal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
    system: [
      '너는 학교 체험학습 신청서에 쓸 장소의 정확한 명칭과 주소를 찾는 도구다.',
      scope,
      '확실하지 않은 주소는 만들어내지 마라. 모르면 후보에서 빼라.',
      'name은 공식 명칭, address는 우편번호 없는 전체 주소로 써라.',
      '최대 3개까지만 제시하라.',
      '{"candidates":[{"name":"...","address":"..."}]} 형식의 JSON만 출력하라.',
      '인사말, 설명, 코드펜스, 추가 질문은 절대 금지한다.',
    ].join('\n'),
    prompt: query,
  });

  const parsed = placeCandidateListSchema.safeParse(extractJsonObject(result.text));
  return parsed.success ? parsed.data.candidates.slice(0, 3) : [];
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  const parsed = placeSearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Request body must include a query, region, and source.', 400);
  }

  const { query, region, source, model } = parsed.data;

  try {
    const candidates =
      source === 'osm' ? await searchOsm(query, region) : await searchAgent(query, region, model);

    return Response.json({ source, candidates });
  } catch (error) {
    if (error instanceof AgentConfigurationError) {
      return jsonError(error.message, 503);
    }

    console.error('[agent/places] search failed:', error);
    return jsonError(
      source === 'osm'
        ? '지도 검색에 실패했어요. 잠시 후 다시 시도해 주세요.'
        : 'AI 주소 검색에 실패했어요. 잠시 후 다시 시도해 주세요.',
      502
    );
  }
}
