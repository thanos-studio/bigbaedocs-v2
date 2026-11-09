'use client';

import type { UIMessage } from 'ai';
import { useCallback, useEffect, useRef, useState } from 'react';

import { toUiMessages } from '@/lib/agent/client';
import type { ChatMessage } from '@/lib/types';

/**
 * 채팅 기록 저장소.
 *
 * useChat 의 UIMessage[] 를 있는 그대로(reasoning, 툴 입력·출력, 파일, provider 메타데이터까지) 채팅별 키에 저장한다.
 * 표시용으로 줄인 형식(ChatMessage)으로 바꿔 저장하던 예전 방식은 툴 결과와 생각 원문이 빠지고,
 * 복원 뒤 모델에게 돌려주는 이력에서 툴 호출이 통째로 사라졌다.
 *
 * 초안 blob(bigbaedocs:application-drafts)과 따로 두는 이유: 스트리밍 중에는 메시지가 초당 수십 번 바뀌는데,
 * 같은 blob 에 넣으면 그때마다 모든 초안과 모든 채팅을 다시 직렬화해 쓰게 된다.
 */

export type ChatKind = 'application' | 'report' | 'half-day';

const KEY_PREFIX = 'bigbaedocs:chat:';
const FLUSH_DELAY_MS = 200;

export const chatStorageKey = (kind: ChatKind, uuid: string) => `${KEY_PREFIX}${kind}:${uuid}`;

export const CHAT_SAVE_FAILED_MESSAGE =
  '채팅 기록을 저장하지 못했어요. 브라우저 저장 공간이 가득 찼을 수 있어요. 설정에서 저장된 데이터를 정리해 주세요.';

type StoredChat = {
  v: 1;
  savedAt: number;
  messages: UIMessage[];
  /** 답변(메시지 id)별 "N초 동안 생각함" */
  thinkingSeconds: Record<string, number>;
};

type PartLike = { type?: unknown; state?: unknown; url?: unknown; filename?: unknown; text?: unknown } & Record<
  string,
  unknown
>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isToolPart = (part: PartLike) => typeof part.type === 'string' && (part.type.startsWith('tool-') || part.type === 'dynamic-tool');

// ---------- 줄이기 ----------

type Budget = {
  /** 문자열 하나의 최대 길이. 툴 입출력의 긴 본문(페이지 텍스트 등)에 적용한다. */
  text: number;
  /** 이 길이(data URL 글자 수)까지의 첨부는 데이터째 저장한다. 0 이면 첨부 데이터는 저장하지 않는다. */
  file: number;
  /** 남길 최근 메시지 수. */
  keep: number;
  /** false 면 툴 호출과 생각을 빼고 대화 텍스트만 남긴다. 저장 공간이 거의 없을 때의 마지막 수단. */
  tools: boolean;
};

/** 위에서부터 시도하고, 저장 공간이 모자라면 한 단계씩 더 줄인다. */
const BUDGETS: Budget[] = [
  { text: 6_000, file: 350_000, keep: Number.POSITIVE_INFINITY, tools: true },
  { text: 1_500, file: 0, keep: Number.POSITIVE_INFINITY, tools: true },
  { text: 400, file: 0, keep: 30, tools: true },
  { text: 400, file: 0, keep: 12, tools: false },
];

function clip(value: unknown, limit: number, depth = 0): unknown {
  if (typeof value === 'string') {
    return value.length > limit ? `${value.slice(0, limit)}…(저장 시 잘림)` : value;
  }
  if (depth >= 6) return value;
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => clip(item, limit, depth + 1));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clip(item, limit, depth + 1)]));
  }
  return value;
}

function compactPart(part: PartLike, budget: Budget): PartLike {
  if (part.type === 'file' && typeof part.url === 'string' && part.url.startsWith('data:')) {
    if (budget.file > 0 && part.url.length <= budget.file) return part;
    // 큰 첨부는 저장하지 않고 자리만 남긴다. 복원된 대화에서 무엇을 보냈는지는 알 수 있다.
    const name = typeof part.filename === 'string' && part.filename !== '' ? part.filename : String(part.mediaType ?? '파일');
    return { type: 'text', text: `[첨부 파일: ${name}]` };
  }

  if (isToolPart(part)) {
    return {
      ...part,
      ...(part.input === undefined ? {} : { input: clip(part.input, budget.text) }),
      ...(part.output === undefined ? {} : { output: clip(part.output, budget.text) }),
      ...(typeof part.errorText === 'string' ? { errorText: clip(part.errorText, budget.text) } : {}),
    };
  }

  return part;
}

export function compactForStorage(messages: UIMessage[], budget: Budget): UIMessage[] {
  return messages.slice(-budget.keep).flatMap((message) => {
    const parts = (message.parts as PartLike[])
      .filter((part) => budget.tools || (!isToolPart(part) && part.type !== 'reasoning'))
      .map((part) => compactPart(part, budget));

    // 툴과 생각을 뺐더니 비어 버린 어시스턴트 메시지는 남길 이유가 없다.
    return parts.length > 0 ? [{ ...message, parts: parts as UIMessage['parts'] }] : [];
  });
}

// ---------- 읽기 ----------

/**
 * 복원할 때 끊긴 상태를 정리한다.
 * 새로고침이 스트리밍 도중이었다면 결과가 없는 툴 호출이 남아 있는데, 그대로 두면 화면에서 계속 "실행 중"으로
 * 보이고, 다음 메시지를 보낼 때 모델 쪽에서 "툴 결과가 없다"며 실패한다.
 */
export function sanitizeRestored(messages: UIMessage[]): UIMessage[] {
  return messages.flatMap((message) => {
    if (message.role !== 'assistant') return [message];

    const parts = (message.parts as PartLike[]).flatMap((part): PartLike[] => {
      if (isToolPart(part)) {
        return part.state === 'output-available' || part.state === 'output-error' ? [part] : [];
      }
      if ((part.type === 'text' || part.type === 'reasoning') && part.state === 'streaming') {
        return [{ ...part, state: 'done' }];
      }
      return [part];
    });

    return parts.length > 0 ? [{ ...message, parts: parts as UIMessage['parts'] }] : [];
  });
}

function isStoredMessage(value: unknown): value is UIMessage {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.role === 'user' || value.role === 'assistant' || value.role === 'system') &&
    Array.isArray(value.parts)
  );
}

export function readChat(key: string): { messages: UIMessage[]; thinkingSeconds: Record<string, number> } | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.v !== 1 || !Array.isArray(parsed.messages)) return null;

    const seconds = isRecord(parsed.thinkingSeconds) ? parsed.thinkingSeconds : {};
    return {
      messages: sanitizeRestored(parsed.messages.filter(isStoredMessage)),
      thinkingSeconds: Object.fromEntries(
        Object.entries(seconds).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
      ),
    };
  } catch {
    // 깨진 JSON 은 없는 것으로 본다. 다음 저장이 덮어쓴다.
    return null;
  }
}

// ---------- 쓰기 ----------

export type WriteResult = 'ok' | 'trimmed' | 'failed';

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22)
  );
}

export function writeChat(key: string, messages: UIMessage[], thinkingSeconds: Record<string, number>): WriteResult {
  for (const [level, budget] of BUDGETS.entries()) {
    const kept = compactForStorage(messages, budget);
    const keptIds = new Set(kept.map((message) => message.id));
    const record: StoredChat = {
      v: 1,
      savedAt: Date.now(),
      messages: kept,
      thinkingSeconds: Object.fromEntries(Object.entries(thinkingSeconds).filter(([id]) => keptIds.has(id))),
    };

    try {
      window.localStorage.setItem(key, JSON.stringify(record));
      return level === 0 ? 'ok' : 'trimmed';
    } catch (error) {
      if (!isQuotaError(error)) {
        console.error('[chat-store] 저장하지 못했어요:', error);
        return 'failed';
      }
    }
  }

  console.error('[chat-store] 저장 공간이 가득 차서 채팅 기록을 저장하지 못했어요.');
  return 'failed';
}

export function removeChat(kind: ChatKind, uuid: string): void {
  try {
    window.localStorage.removeItem(chatStorageKey(kind, uuid));
  } catch {
    // 저장소가 막혀 있으면 지울 것도 없다.
  }
}

/** 신청서를 지울 때 그 신청서에 딸린 채팅(신청서·보고서·반일)도 함께 지운다. */
export function removeChatsOf(uuid: string): void {
  removeChat('application', uuid);
  removeChat('report', uuid);
  removeChat('half-day', uuid);
}

/** 모든 채팅 기록. 설정 화면의 사용량 표시와 전체 삭제에서 쓴다. */
export function listChatKeys(): string[] {
  try {
    return Object.keys(window.localStorage).filter((key) => key.startsWith(KEY_PREFIX));
  } catch {
    return [];
  }
}

// ---------- 예전 형식 이전 ----------

/** 예전 버전이 초안 안에 표시용(ChatMessage)으로 저장해 둔 채팅을 새 형식으로 옮긴다. 툴 호출 행은 옮길 수 없어 빠진다. */
export function fromLegacyMessages(legacy: ChatMessage[]): {
  messages: UIMessage[];
  thinkingSeconds: Record<string, number>;
} {
  const messages = toUiMessages(legacy).map((message) => {
    const original = legacy.find((item) => item.id === message.id);
    const reasoning = original?.reasoning?.join('\n').trim();
    if (message.role !== 'assistant' || !reasoning) return message;
    return {
      ...message,
      parts: [{ type: 'reasoning' as const, text: reasoning, state: 'done' as const }, ...message.parts],
    };
  });

  return {
    messages,
    thinkingSeconds: Object.fromEntries(
      legacy.flatMap((message) => (message.thinkingSeconds ? [[message.id, message.thinkingSeconds] as const] : []))
    ),
  };
}

// ---------- 훅 ----------

type PersistenceOptions = {
  storageKey: string;
  messages: UIMessage[];
  setMessages: (messages: UIMessage[]) => void;
  /** 답변이 생성되는 중인가. 끝나는 순간에는 기다리지 않고 바로 저장한다. */
  busy: boolean;
  secondsById: Record<string, number>;
  restoreSeconds: (seconds: Record<string, number>) => void;
  /** 예전 형식의 채팅. localStorage 에서 초안을 읽은 뒤(hydrated)에만 믿을 수 있다. */
  legacy: { messages: ChatMessage[]; hydrated: boolean };
  /** 복원한 메시지를 화면에 올리기 직전에 부른다. 이미 적용된 폼 변경을 표시해 두는 데 쓴다. */
  onRestored?: (messages: UIMessage[]) => void;
  /** 예전 형식을 새 형식으로 안전하게 저장한 뒤 부른다. 초안에서 옛 사본을 지우는 데 쓴다. */
  onLegacyMigrated?: () => void;
};

export function useChatPersistence({
  storageKey,
  messages,
  setMessages,
  busy,
  secondsById,
  restoreSeconds,
  legacy,
  onRestored,
  onLegacyMigrated,
}: PersistenceOptions): { saveFailed: boolean } {
  const [saveFailed, setSaveFailed] = useState(false);
  const restoredRef = useRef(false);
  const migratedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ messages, secondsById });

  // 최신 값은 타이머와 pagehide 처럼 렌더 밖에서 읽는다.
  useEffect(() => {
    latestRef.current = { messages, secondsById };
  }, [messages, secondsById]);

  // 한 번만 복원한다. 새 저장본이 없을 때만 예전 형식을 옮긴다.
  useEffect(() => {
    if (restoredRef.current || !legacy.hydrated) return;
    restoredRef.current = true;

    const stored = readChat(storageKey);
    const source =
      stored ??
      (legacy.messages.length > 0
        ? (() => {
            migratedRef.current = true;
            const converted = fromLegacyMessages(legacy.messages);
            return { messages: sanitizeRestored(converted.messages), thinkingSeconds: converted.thinkingSeconds };
          })()
        : null);
    if (!source || source.messages.length === 0) return;

    onRestored?.(source.messages);
    restoreSeconds(source.thinkingSeconds);
    setMessages(source.messages);
  }, [legacy.hydrated, legacy.messages, storageKey, onRestored, restoreSeconds, setMessages]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const { messages: current, secondsById: seconds } = latestRef.current;
    // 복원이 끝나기 전이거나 비어 있으면 쓰지 않는다. 비어 있는 상태로 저장본을 덮어쓰는 일이 없도록.
    if (!restoredRef.current || current.length === 0) return;

    const result = writeChat(storageKey, current, seconds);
    setSaveFailed(result === 'failed');

    if (result !== 'failed' && migratedRef.current) {
      migratedRef.current = false;
      onLegacyMigrated?.();
    }
  }, [storageKey, onLegacyMigrated]);

  // 변경될 때마다 저장한다. 생성 중에는 200ms 로 묶고, 끝나면 바로 쓴다.
  useEffect(() => {
    if (!restoredRef.current || messages.length === 0) return;

    if (!busy) {
      flush();
    } else if (timerRef.current === null) {
      timerRef.current = setTimeout(flush, FLUSH_DELAY_MS);
    }
  }, [messages, secondsById, busy, flush]);

  // 탭을 닫거나 새로고침하거나 숨기거나 컴포넌트가 사라질 때, 아직 못 쓴 것을 마저 쓴다.
  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', flushWhenHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', flushWhenHidden);
      flush();
    };
  }, [flush]);

  return { saveFailed };
}
