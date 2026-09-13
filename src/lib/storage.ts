'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocalStorage } from '@mantine/hooks';
import {
  type ApplicationDraft,
  type Student,
  createEmptyDraft,
} from './types';

export const STORAGE_KEYS = {
  students: 'bigbaedocs:students',
  drafts: 'bigbaedocs:application-drafts',
} as const;

const DEFAULT_STUDENTS: Student[] = [
  { id: '1', name: '김배대', classInfo: '1학년 7반 12번' },
  { id: '2', name: '이서연', classInfo: '2학년 3반 4번' },
  { id: '3', name: '박준호', classInfo: '1학년 2반 21번' },
];

const DEFAULT_DRAFTS: Record<string, ApplicationDraft> = {};

/** 안전한 id 생성. crypto.randomUUID는 보안 컨텍스트에서만 보장되므로 폴백을 둔다. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const noopSubscribe = () => () => {};

/**
 * localStorage 하이드레이션 완료 여부.
 * Mantine의 useLocalStorage는 첫 렌더에서 defaultValue를 반환하므로,
 * 하이드레이션 전에는 저장된 값을 덮어쓰지 않도록 이 플래그로 가드한다.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export function useStudents() {
  return useLocalStorage<Student[]>({
    key: STORAGE_KEYS.students,
    defaultValue: DEFAULT_STUDENTS,
  });
}

export function useDrafts() {
  return useLocalStorage<Record<string, ApplicationDraft>>({
    key: STORAGE_KEYS.drafts,
    defaultValue: DEFAULT_DRAFTS,
  });
}

export type SaveState = 'idle' | 'saving' | 'saved';

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
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draft = drafts[uuid] ?? createEmptyDraft(uuid);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const update = useCallback(
    (patch: Partial<Omit<ApplicationDraft, 'id'>>) => {
      setDrafts((prev) => {
        const base = prev[uuid] ?? createEmptyDraft(uuid);
        return {
          ...prev,
          [uuid]: { ...base, ...patch, id: uuid, updatedAt: Date.now() },
        };
      });

      setSaveState('saving');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setSaveState('saved'), SAVING_DURATION_MS);
    },
    [setDrafts, uuid]
  );

  return { draft, hydrated, saveState, update };
}
