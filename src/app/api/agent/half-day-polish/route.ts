import { generateText } from 'ai';
import { z } from 'zod';

import { AgentConfigurationError } from '@/lib/agent/config';
import { getAgentModel } from '@/lib/agent/model';
import { halfDayPolishRequestSchema } from '@/lib/agent/schema';
import {
  PROSE_FORMAT_RULES,
  antiSlopRules,
  experienceRules,
  reflectionRules,
  sanitizeCell,
  sanitizeProse,
} from '@/lib/agent/writing';
import { HALF_DAY_LIMITS } from '@/lib/half-day';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLISH_TIMEOUT_MS = 40_000;

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/** 모델이 코드펜스나 설명을 붙여도 첫 { 부터 마지막 } 까지만 읽는다. */
function readJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const planResultSchema = z.object({ purpose: z.string(), place: z.string(), content: z.string() });
const reportResultSchema = z.object({ content: z.string(), feeling: z.string() });

const PLAN_SYSTEM = [
  '너는 한국 고등학교 3학년 "반일 교외체험학습(개인 진로·직업 체험) 신청서"의 표 칸을 정리하는 도구다.',
  '학생이 대충 적은 메모(오타, 반말, 칸이 뒤바뀐 입력 포함)를 신청서 표에 바로 쓸 수 있는 말로 고친다.',
  `체험 목적: ${HALF_DAY_LIMITS.purpose}자 이내의 명사구. 예: 진로 탐색, 직업 체험, 대학 탐방, 직무 이해, 현장 탐방.`,
  `체험 장소: ${HALF_DAY_LIMITS.place}자 이내. 장소 이름만 쓴다. 주소와 설명은 쓰지 않는다.`,
  `체험 내용: ${HALF_DAY_LIMITS.content}자 이내의 한 줄. 명사형으로 끝낸다. 예: 직업 박람회 관람 및 진로 상담 체험.`,
  '문장 끝에 마침표를 찍지 않는다. 마크다운, 이모지, 따옴표, 번호를 쓰지 않는다.',
  '학생이 적은 것에서 알 수 있는 사실만 쓴다. 적지 않은 기관, 프로그램, 사람, 시간, 직업을 만들어 넣지 않는다.',
  '목적 칸에 장소나 활동을 적었다면 알맞은 칸으로 옮긴다.',
  '입력이 비어 있는 칸은 빈 문자열로 둔다. 목적은 학생이 적은 활동이 분명할 때만 그 활동에서 바로 읽히는 짧은 말(예: 현장 탐방)로 채운다. 장소만 적혀 있다면 목적과 내용은 비워 둔다.',
  '글자가 깨진 입력(예: "수우ㅓㄴ역")은 문맥으로 분명할 때만 바로잡는다. 확실하지 않으면 그대로 둔다.',
  '반드시 JSON 객체 하나만 출력한다. 키는 purpose, place, content 이고 값은 모두 문자열이다. 다른 글은 붙이지 않는다.',
].join('\n');

function reportSystem(formalTone = true): string {
  return [
    '너는 한국 고등학교 "교외체험학습 결과 보고서"의 체험내용과 느낀 점을 다듬는 도구다.',
    '학생이 대충 적은 메모를 보고서에 바로 쓸 수 있는 문장으로 고친다.',
    `체험내용은 ${HALF_DAY_LIMITS.reportContent}자 이내, 느낀 점은 ${HALF_DAY_LIMITS.reportFeeling}자 이내로 쓴다.`,
    ...experienceRules(formalTone).map((rule) => `체험내용: ${rule}`),
    ...reflectionRules(formalTone).map((rule) => `느낀 점: ${rule}`),
    ...antiSlopRules(),
    ...PROSE_FORMAT_RULES,
    '사실을 새로 만들지 마라. 학생이 적지 않은 장소, 기관, 인물, 활동, 감정을 추가하지 마라.',
    '메모에 없는 행동을 덧붙이지 마라. "설명을 들었다", "질문했다", "준비된 프로그램", "사진을 찍었다" 같은 말은 메모에 있을 때만 쓴다.',
    '입력이 비어 있는 항목은 빈 문자열로 둔다.',
    '반드시 JSON 객체 하나만 출력한다. 키는 content, feeling 이고 값은 모두 문자열이다. 다른 글은 붙이지 않는다.',
  ].join('\n');
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  const parsed = halfDayPolishRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Request body has an invalid half-day polish shape.', 400);
  }

  const input = parsed.data;
  const isPlan = input.kind === 'plan';

  const prompt = isPlan
    ? [`체험 목적: ${input.purpose}`, `체험 장소: ${input.place}`, `체험 내용: ${input.content}`].join('\n')
    : [
        input.place ? `장소: ${input.place}` : null,
        input.purpose ? `목적: ${input.purpose}` : null,
        `체험내용 메모: ${input.content}`,
        `느낀 점 메모: ${input.feeling}`,
      ]
        .filter((line): line is string => line !== null)
        .join('\n');

  const run = async (extra = '') => {
    const result = await generateText({
      model: getAgentModel(input.model),
      abortSignal: AbortSignal.timeout(POLISH_TIMEOUT_MS),
      system: isPlan ? PLAN_SYSTEM : reportSystem(),
      prompt: extra === '' ? prompt : `${prompt}\n\n${extra}`,
    });
    return readJsonObject(result.text);
  };

  /** 상한을 넘은 칸이 있으면 한 번만 더 줄여 달라고 한다. 그래도 넘으면 실패로 돌려, 잘린 문장이 신청서에 들어가지 않게 한다. */
  type Finished = { ok: true; cells: Record<string, string> } | { ok: false; tooLong: string[] };

  const finish = (raw: unknown): Finished | null => {
    if (isPlan) {
      const result = planResultSchema.safeParse(raw);
      if (!result.success) return null;
      const cells = {
        purpose: sanitizeCell(result.data.purpose),
        place: sanitizeCell(result.data.place),
        content: sanitizeCell(result.data.content),
      };
      const tooLong = (['purpose', 'place', 'content'] as const).filter((key) => cells[key].length > HALF_DAY_LIMITS[key]);
      return tooLong.length > 0 ? { ok: false, tooLong } : { ok: true, cells };
    }

    const result = reportResultSchema.safeParse(raw);
    if (!result.success) return null;
    const cells = { content: sanitizeProse(result.data.content), feeling: sanitizeProse(result.data.feeling) };
    const tooLong = (
      [
        ['content', HALF_DAY_LIMITS.reportContent],
        ['feeling', HALF_DAY_LIMITS.reportFeeling],
      ] as const
    ).flatMap(([key, limit]) => (cells[key].length > limit ? [key] : []));
    return tooLong.length > 0 ? { ok: false, tooLong } : { ok: true, cells };
  };

  try {
    let outcome = finish(await run());
    if (outcome && !outcome.ok) {
      const limits = isPlan
        ? `${HALF_DAY_LIMITS.purpose}/${HALF_DAY_LIMITS.place}/${HALF_DAY_LIMITS.content}`
        : `${HALF_DAY_LIMITS.reportContent}/${HALF_DAY_LIMITS.reportFeeling}`;
      outcome = finish(
        await run(`방금 결과에서 ${outcome.tooLong.join(', ')} 칸이 글자 수 상한(${limits})을 넘었다. 의미를 유지한 채 더 짧게 다시 써라.`)
      );
    }

    if (!outcome || !outcome.ok || Object.values(outcome.cells).every((value) => value === '')) {
      return jsonError('칸에 맞게 다듬지 못했어요. 내용을 조금 줄여서 다시 시도해 주세요.', 502);
    }

    return Response.json({ kind: input.kind, ...outcome.cells });
  } catch (error) {
    if (error instanceof AgentConfigurationError) {
      return jsonError(error.message, 503);
    }

    console.error('[agent/half-day-polish] failed:', error);
    return jsonError('문장을 다듬지 못했어요. 잠시 후 다시 시도해 주세요.', 502);
  }
}
