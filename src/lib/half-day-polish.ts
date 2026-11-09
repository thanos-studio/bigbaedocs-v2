import { z } from 'zod';

/** 대충 적은 칸을 서버의 반일 다듬기 API 로 보내 양식에 맞게 고친다. 실패하면 사람이 읽을 수 있는 메시지로 던진다. */

const planResult = z.object({ purpose: z.string(), place: z.string(), content: z.string() });
const reportResult = z.object({ content: z.string(), feeling: z.string() });

async function post(body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch('/api/agent/half-day-polish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload ? String((payload as { error: unknown }).error) : '';
    throw new Error(message || '문장을 다듬지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  return payload;
}

export async function polishPlanEntry(
  entry: { purpose: string; place: string; content: string },
  model: string
): Promise<{ purpose: string; place: string; content: string }> {
  const result = planResult.safeParse(await post({ kind: 'plan', ...entry, model }));
  if (!result.success) throw new Error('다듬은 결과를 읽지 못했어요.');
  return result.data;
}

export async function polishReport(
  report: { content: string; feeling: string; place?: string; purpose?: string },
  model: string
): Promise<{ content: string; feeling: string }> {
  const result = reportResult.safeParse(await post({ kind: 'report', ...report, model }));
  if (!result.success) throw new Error('다듬은 결과를 읽지 못했어요.');
  return result.data;
}
