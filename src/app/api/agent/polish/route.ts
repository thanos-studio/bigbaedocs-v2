import { generateText } from 'ai';

import { AgentConfigurationError } from '@/lib/agent/config';
import { getAgentModel } from '@/lib/agent/model';
import { polishRequestSchema } from '@/lib/agent/schema';
import {
  PROSE_FORMAT_RULES,
  antiSlopRules,
  experienceRules,
  planRules,
  purposeRules,
  reflectionRules,
  sanitizeProse,
} from '@/lib/agent/writing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLISH_TIMEOUT_MS = 40_000;

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  const parsed = polishRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Request body must include a target and the text to polish.', 400);
  }

  const { target, text, destination, purpose, model } = parsed.data;
  const formalTone = parsed.data.formalTone ?? true;

  const isReport = target === 'experience' || target === 'reflection';
  const targetRules = {
    purpose: () => purposeRules(formalTone),
    plan: () => planRules(formalTone),
    experience: () => experienceRules(formalTone),
    reflection: () => reflectionRules(formalTone),
  }[target];

  const system = [
    `너는 한국 학교 체험학습 ${isReport ? '결과 보고서' : '신청서'}의 문장을 다듬는 도구다.`,
    `사용자가 대충 적은 메모를 ${isReport ? '보고서' : '신청서'}에 바로 쓸 수 있는 문장으로 고쳐라.`,
    ...targetRules(),
    ...antiSlopRules(),
    ...PROSE_FORMAT_RULES,
    '사실을 새로 만들지 마라. 사용자가 적지 않은 장소, 기관, 인물, 날짜를 추가하지 마라.',
    '장소 정보는 참고용이다. 사용자 메모에 없는 지역명을 문장에 끼워 넣지 마라.',
    '인사말, 설명, 따옴표, 코드펜스를 붙이지 마라. 다듬은 본문만 출력하라.',
  ].join('\n');

  const targetLabel = {
    purpose: '목적',
    plan: '계획',
    experience: '체험내용',
    reflection: '느낀 점',
  }[target];

  const context = [
    destination ? `장소: ${destination}` : null,
    target !== 'purpose' && purpose ? `목적: ${purpose}` : null,
    `${targetLabel} 메모: ${text}`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  try {
    const result = await generateText({
      model: getAgentModel(model),
      abortSignal: AbortSignal.timeout(POLISH_TIMEOUT_MS),
      system,
      prompt: context,
    });

    const polished = sanitizeProse(result.text);
    if (polished === '') {
      return jsonError('문장을 다듬지 못했어요. 잠시 후 다시 시도해 주세요.', 502);
    }

    return Response.json({ target, text: polished });
  } catch (error) {
    if (error instanceof AgentConfigurationError) {
      return jsonError(error.message, 503);
    }

    console.error('[agent/polish] failed:', error);
    return jsonError('문장을 다듬지 못했어요. 잠시 후 다시 시도해 주세요.', 502);
  }
}
