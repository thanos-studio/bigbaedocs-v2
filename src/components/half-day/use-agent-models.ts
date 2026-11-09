'use client';

import { useEffect, useState } from 'react';

import { agentModelCatalogSchema, type AgentModelCatalog } from '@/lib/agent/client';
import { usePreferredModel } from '@/lib/storage';

/**
 * 에이전트 모델 목록을 한 번 불러오고, 초안에 모델이 없거나 목록에 없으면 선호 모델(없으면 기본 모델)로 채운다.
 * onResolve 는 useCallback 으로 안정시킨 함수여야 한다(바뀔 때마다 목록을 다시 불러온다).
 */
export function useAgentModels(modelId: string, onResolve: (modelId: string) => void) {
  const [preferredModel] = usePreferredModel();
  const [catalog, setCatalog] = useState<AgentModelCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/agent/models');
        if (!response.ok) throw new Error('에이전트 모델 목록을 불러오지 못했어요.');

        const parsed = agentModelCatalogSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error('에이전트 모델 목록 형식이 올바르지 않아요.');
        if (cancelled) return;

        setCatalog(parsed.data);
        setError(null);
        if (!parsed.data.models.some((model) => model.id === modelId)) {
          const preferred = parsed.data.models.some((model) => model.id === preferredModel)
            ? preferredModel
            : parsed.data.defaultModelId;
          onResolve(preferred);
        }
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : '에이전트 모델 목록을 불러오지 못했어요.');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [modelId, preferredModel, onResolve]);

  return { catalog, error };
}
