'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocalStorage } from '@mantine/hooks';
import { listChatKeys } from './chat-store';
import { clearPhotos } from './photo-store';
import { type ApplicationDraft, type Student, hydrateDraft } from './types';

export const STORAGE_KEYS = {
  students: 'bigbaedocs:students',
  drafts: 'bigbaedocs:application-drafts',
  preferredModel: 'bigbaedocs:preferred-model',
} as const;

const DEFAULT_STUDENTS: Student[] = [];

const DEFAULT_DRAFTS: Record<string, ApplicationDraft> = {};

/** 안전한 id 생성. crypto.randomUUID는 보안 컨텍스트에서만 보장되므로 폴백을 둔다. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * localStorage 읽기 완료 여부.
 * Mantine의 useLocalStorage는 첫 렌더에서 defaultValue를 반환하고 저장값은 마운트 effect에서 읽는다.
 * 따라서 이 플래그는 마운트 이후 한 렌더 뒤에 true가 되어야 한다.
 * 첫 렌더에 true가 되면 저장된 값을 기본값으로 덮어써 데이터가 사라진다.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}

export function useStudents() {
  return useLocalStorage<Student[]>({
    key: STORAGE_KEYS.students,
    defaultValue: DEFAULT_STUDENTS,
  });
}

// ---------- 신청서 초안 저장소 ----------
// Mantine 의 useLocalStorage 는 쓰기를 state 업데이터 안에서(= 렌더 때) 하고, 쓰기 실패(용량 초과)를 조용히 삼킨다.
// 그러면 화면에는 "저장됨"이 뜨는데 실제로는 아무것도 저장되지 않고, 새로고침하면 그 글이 사라진다.
// 그래서 초안은 직접 관리한다: 바꾸는 즉시 localStorage 에 동기적으로 쓰고, 공간이 모자라면 채팅 기록을 비워서라도
// 초안을 지키며, 그래도 안 되면 실패를 화면에 알린다.

type Drafts = Record<string, ApplicationDraft>;
type DraftsUpdate = Drafts | ((prev: Drafts) => Drafts);

const draftListeners = new Set<() => void>();
let draftCache: Drafts | null = null;
let draftWriteFailed = false;

const emitDrafts = () => draftListeners.forEach((listener) => listener());

function parseDrafts(raw: string | null): Drafts {
  if (!raw) return DEFAULT_DRAFTS;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Drafts) : DEFAULT_DRAFTS;
  } catch {
    return DEFAULT_DRAFTS;
  }
}

function readDrafts(): Drafts {
  try {
    return parseDrafts(window.localStorage.getItem(STORAGE_KEYS.drafts));
  } catch {
    return DEFAULT_DRAFTS;
  }
}

const getDraftsSnapshot = (): Drafts => (draftCache ??= readDrafts());

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22)
  );
}

/**
 * 초안을 쓴다. 공간이 모자라면 큰 채팅 기록부터 하나씩 지우며 다시 시도한다(채팅은 다시 만들 수 있지만 초안은 아니다).
 * 끝내 못 쓰면 false. 이때도 메모리의 값은 유지되므로 탭을 닫기 전까지는 화면이 어긋나지 않는다.
 */
function writeDrafts(value: Drafts): boolean {
  const serialized = JSON.stringify(value);
  const attempt = (): 'ok' | 'quota' | 'blocked' => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.drafts, serialized);
      return 'ok';
    } catch (error) {
      return isQuotaError(error) ? 'quota' : 'blocked';
    }
  };

  let result = attempt();
  if (result === 'quota') {
    const bySize = listChatKeys()
      .map((key) => ({ key, size: (window.localStorage.getItem(key) ?? '').length }))
      .sort((a, b) => b.size - a.size);
    for (const { key } of bySize) {
      window.localStorage.removeItem(key);
      result = attempt();
      if (result !== 'quota') break;
    }
  }
  return result === 'ok';
}

function setDrafts(update: DraftsUpdate): void {
  // 항상 가장 최근 값 위에 쌓는다. 렌더를 기다리지 않으므로 연달아 호출해도 서로 덮어쓰지 않는다.
  const next = typeof update === 'function' ? update(getDraftsSnapshot()) : update;
  draftCache = next;
  draftWriteFailed = !writeDrafts(next);
  emitDrafts();
}

function subscribeDrafts(listener: () => void): () => void {
  draftListeners.add(listener);

  // 다른 탭에서 바뀐 값을 가져온다.
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea !== window.localStorage || (event.key !== null && event.key !== STORAGE_KEYS.drafts)) return;
    draftCache = event.key === null ? DEFAULT_DRAFTS : parseDrafts(event.newValue);
    listener();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    draftListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** 저장 공간을 비운 뒤(설정의 전체 삭제) 메모리에 남은 초안도 함께 지운다. */
function resetDraftCache(): void {
  draftCache = DEFAULT_DRAFTS;
  draftWriteFailed = false;
  emitDrafts();
}

export function useDrafts(): [Drafts, (update: DraftsUpdate) => void] {
  const drafts = useSyncExternalStore(subscribeDrafts, getDraftsSnapshot, () => DEFAULT_DRAFTS);
  return [drafts, setDrafts];
}

/** 마지막 초안 저장이 실패했는지. 실패하면 새로고침 시 최근 변경이 사라질 수 있다. */
export function useDraftWriteFailed(): boolean {
  return useSyncExternalStore(
    subscribeDrafts,
    () => draftWriteFailed,
    () => false
  );
}

export function usePreferredModel() {
  return useLocalStorage<string>({
    key: STORAGE_KEYS.preferredModel,
    defaultValue: '',
  });
}

export function measureStoredBytes(): { key: string; label: string; bytes: number }[] {
  if (typeof window === 'undefined') return [];

  const labels: Record<string, string> = {
    [STORAGE_KEYS.students]: '학생 정보',
    [STORAGE_KEYS.drafts]: '신청서 초안',
    [STORAGE_KEYS.preferredModel]: '기본 모델',
  };

  const fixed = Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    bytes: new Blob([window.localStorage.getItem(key) ?? '']).size,
  }));

  // 채팅 기록은 대화마다 키가 따로 있다. 사용량은 한 줄로 합쳐서 보여준다.
  const chatBytes = listChatKeys().reduce(
    (sum, key) => sum + new Blob([window.localStorage.getItem(key) ?? '']).size,
    0
  );
  return [...fixed, { key: 'bigbaedocs:chat:*', label: '채팅 기록', bytes: chatBytes }];
}

export function clearStoredData(): void {
  if (typeof window === 'undefined') return;

  Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
  listChatKeys().forEach((key) => window.localStorage.removeItem(key));
  void clearPhotos();
  resetDraftCache();
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

export type DraftController = {
  draft: ApplicationDraft;
  /** localStorage 값을 읽어온 뒤에만 true. false면 아직 저장된 값이 아닐 수 있다. */
  hydrated: boolean;
  saveState: SaveState;
  update: (patch: Partial<Omit<ApplicationDraft, 'id'>>) => void;
};

const SAVING_DURATION_MS = 450;

/** uuid에 해당하는 신청서 초안을 읽고 쓴다. 없으면 빈 초안을 반환한다. */
export function useApplicationDraft(uuid: string): DraftController {
  const [drafts, setDrafts] = useDrafts();
  const hydrated = useHydrated();
  const writeFailed = useDraftWriteFailed();
  const [progress, setProgress] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveState: SaveState = writeFailed ? 'failed' : progress;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 이전 버전에서 저장된 초안에는 없는 필드가 있으므로 빈 초안 위에 덮어쓴다.
  const draft = hydrateDraft(uuid, drafts[uuid]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const update = useCallback(
    (patch: Partial<Omit<ApplicationDraft, 'id'>>) => {
      setDrafts((prev) => {
        const base = hydrateDraft(uuid, prev[uuid]);
        return {
          ...prev,
          [uuid]: { ...base, ...patch, id: uuid, updatedAt: Date.now() },
        };
      });

      setProgress('saving');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setProgress('saved'), SAVING_DURATION_MS);
    },
    [setDrafts, uuid]
  );

  return { draft, hydrated, saveState, update };
}
