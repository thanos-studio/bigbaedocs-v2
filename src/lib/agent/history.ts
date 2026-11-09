import 'server-only';

import { safeValidateUIMessages, type ToolSet, type UIMessage } from 'ai';

type PartLike = { type?: unknown };
type MessageLike = { role?: unknown; parts?: unknown };

/**
 * 저장된 채팅에는 예전 버전의 툴 호출(이름이 바뀌었거나 입력 형식이 달라진 것)이 들어 있을 수 있다.
 * 그걸 검증에서 거르면 사용자는 그 채팅에 아무 말도 보낼 수 없게 되므로, 어시스턴트 메시지에서
 * 텍스트와 파일만 남긴 이력으로 한 번 더 시도한다. 사용자의 메시지는 건드리지 않는다.
 */
export function withoutToolHistory(messages: readonly unknown[]): unknown[] {
  return messages.flatMap((message) => {
    const item = message as MessageLike;
    if (item?.role !== 'assistant' || !Array.isArray(item.parts)) return [message];

    const parts = (item.parts as PartLike[]).filter((part) => part?.type === 'text' || part?.type === 'file');
    return parts.length > 0 ? [{ ...(message as object), parts }] : [];
  });
}

export async function validateChatHistory<TOOLS extends ToolSet>(
  messages: readonly unknown[],
  tools: TOOLS
): Promise<{ success: true; data: UIMessage[] } | { success: false }> {
  const first = await safeValidateUIMessages({ messages, tools });
  if (first.success) return { success: true, data: first.data };

  const retry = await safeValidateUIMessages({ messages: withoutToolHistory(messages), tools });
  return retry.success ? { success: true, data: retry.data } : { success: false };
}
