'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalStorage } from '@mantine/hooks';
import {
  type ApplicationDraft,
  type Student,
  createEmptyDraft,
} from './types';

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

export function useDrafts() {
  return useLocalStorage<Record<string, ApplicationDraft>>({
    key: STORAGE_KEYS.drafts,
    defaultValue: DEFAULT_DRAFTS,
  });
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

  return Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    bytes: new Blob([window.localStorage.getItem(key) ?? '']).size,
  }));
}

export function clearStoredData(): void {
  if (typeof window === 'undefined') return;

  Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
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
  // 이전 버전에서 저장된 초안에는 없는 필드가 있으므로 빈 초안 위에 덮어쓴다.
  const draft = { ...createEmptyDraft(uuid), ...drafts[uuid], id: uuid };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const update = useCallback(
    (patch: Partial<Omit<ApplicationDraft, 'id'>>) => {
      setDrafts((prev) => {
        const base = { ...createEmptyDraft(uuid), ...prev[uuid] };
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
