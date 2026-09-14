import { generateText } from 'ai';

import { AgentConfigurationError } from '@/lib/agent/config';
import { getAgentModel } from '@/lib/agent/model';
import { parseDateRequestSchema, parsedDateRangeSchema } from '@/lib/agent/schema';
import { countDays } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  const parsed = parseDateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Request body must include a short natural-language date text.', 400);
  }

  const { text } = parsed.data;
  const today = parsed.data.today ?? todayISO();
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][
    new Date(`${today}T00:00:00`).getDay()
  ];

  try {
    const result = await generateText({
      model: getAgentModel(parsed.data.model),
      system: [
        '너는 한국 학교의 체험학습 신청서에서 기간 표현을 해석하는 도구다.',
        `오늘은 ${today} (${weekday}요일)이다.`,
        '사용자의 한국어 표현을 시작일과 종료일로 바꿔라.',
        '규칙:',
        '- 주는 월요일에 시작한다. "다음주"는 다음 월요일이 속한 주다.',
        '- 요일만 말하면 오늘 이후의 가장 가까운 날로 본다. 과거로 해석하지 않는다.',
        '- "2박 3일"처럼 숙박/일수를 말하면 총 일수에 맞춰 종료일을 잡는다.',
        '- 하루짜리면 endDate를 startDate와 같게 한다.',
        '- 월 정보가 없으면 오늘 이후 가장 가까운 날짜로 본다.',
        '- endDate는 startDate보다 앞설 수 없다.',
        '',
        '반드시 아래 형태의 JSON만 출력한다. 설명이나 코드펜스를 붙이지 마라.',
        '{"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD"}',
      ].join('\n'),
      prompt: text,
    });

    const range = parsedDateRangeSchema.safeParse(extractJsonObject(result.text));
    if (!range.success) {
      return jsonError('The model did not return a usable date range.', 422);
    }

    const { startDate, endDate } = range.data;
    if (countDays(startDate, endDate) === 0) {
      return jsonError('The model returned an invalid date range.', 422);
    }

    return Response.json({ startDate, endDate });
  } catch (error) {
    if (error instanceof AgentConfigurationError) {
      return jsonError(error.message, 503);
    }

    console.error('[agent/parse-date] failed:', error);
    return jsonError('Unable to interpret the date expression.', 502);
  }
}
