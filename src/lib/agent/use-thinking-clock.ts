'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChatMessage } from '@/lib/types';

/**
 * 한 턴의 "생각 시간"을 잰다.
 * - begin(): 메시지를 보낼 때 부른다. 시계를 0부터 다시 시작한다.
 * - finish(id): 스트림이 끝나면(useChat onFinish) 부른다. 어느 답변이 몇 초 걸렸는지 남겨 둬서,
 *   턴이 끝난 뒤에도 "N초 동안 생각함"이 그 답변에 붙어 있게 한다.
 */
export function useThinkingClock() {
  const startedAtRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [secondsById, setSecondsById] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!running) return;

    const timer = setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt !== null) setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    return () => clearInterval(timer);
  }, [running]);

  const begin = useCallback(() => {
    startedAtRef.current = Date.now();
    setElapsed(0);
    setRunning(true);
  }, []);

  const finish = useCallback((messageId: string) => {
    const startedAt = startedAtRef.current;
    startedAtRef.current = null;
    setRunning(false);
    if (startedAt === null) return;

    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    setSecondsById((prev) => ({ ...prev, [messageId]: seconds }));
  }, []);

  /** 저장된 기록을 불러올 때: 저장본의 값을 깔고, 이번 화면에서 이미 잰 값은 그대로 둔다. */
  const restore = useCallback((saved: Record<string, number>) => {
    setSecondsById((prev) => ({ ...saved, ...prev }));
  }, []);

  return { elapsed, secondsById, begin, finish, restore };
}

export function withThinkingSeconds(
  messages: ChatMessage[],
  secondsById: Record<string, number>
): ChatMessage[] {
  if (Object.keys(secondsById).length === 0) return messages;

  return messages.map((message) =>
    secondsById[message.id] === undefined
      ? message
      : { ...message, thinkingSeconds: secondsById[message.id] }
  );
}
