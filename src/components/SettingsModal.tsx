'use client';

import { useEffect, useState } from 'react';
import { Group, Modal, Stack, Text } from '@mantine/core';
import { IconCheck, IconDatabase, IconSettings, IconTrash } from '@tabler/icons-react';

import { clearStoredData, measureStoredBytes, usePreferredModel } from '@/lib/storage';
import { agentModelCatalogSchema } from '@/lib/agent/client';
import { Button } from '@/lib/graphite/components';
import { FZ } from '@/lib/graphite/theme';
import { BORDER, DANGER, DARK, LABEL_COLOR, SUB, SURFACE_SOFT, TEXT } from '@/lib/theme';

type StorageEntry = { key: string; label: string; bytes: number };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SettingsModal({
  opened,
  onCloseAction,
}: {
  opened: boolean;
  onCloseAction: () => void;
}) {
  const [preferredModel, setPreferredModel] = usePreferredModel();
  const [models, setModels] = useState<{ id: string; label: string; description: string }[]>([]);
  const [defaultModelId, setDefaultModelId] = useState('');
  const [entries, setEntries] = useState<StorageEntry[]>([]);
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    if (!opened) return;

    setEntries(measureStoredBytes());
    setConfirmingClear(false);

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/agent/models');
        if (!response.ok) return;

        const parsed = agentModelCatalogSchema.safeParse(await response.json());
        if (!parsed.success || cancelled) return;

        setModels(parsed.data.models);
        setDefaultModelId(parsed.data.defaultModelId);
      } catch {
        setModels([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [opened]);

  const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  const activeModelId = preferredModel !== '' ? preferredModel : defaultModelId;

  const handleClear = () => {
    clearStoredData();
    setEntries(measureStoredBytes());
    setConfirmingClear(false);
    window.location.reload();
  };

  return (
    <Modal
      opened={opened}
      onClose={onCloseAction}
      centered
      radius="lg"
      size={460}
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
      transitionProps={{
        transition: 'pop',
        duration: 220,
        timingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      padding={24}
    >
      <Stack gap={22}>
        <Group gap={10} wrap="nowrap">
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor: SURFACE_SOFT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconSettings size={18} color={SUB} />
          </div>
          <div>
            <Text fw={700} style={{ fontSize: FZ.section, color: TEXT }}>
              설정
            </Text>
            <Text style={{ fontSize: 14, color: SUB, marginTop: 1 }}>
              기본 모델과 저장된 데이터를 관리해요.
            </Text>
          </div>
        </Group>

        {models.length > 0 && (
          <div>
            <Text fw={600} style={{ fontSize: 14, color: LABEL_COLOR, marginBottom: 10 }}>
              기본 모델
            </Text>
            <Stack gap={6}>
              {models.map((model) => {
                const isPicked = model.id === activeModelId;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setPreferredModel(model.id)}
                    aria-pressed={isPicked}
                    className="setting-option"
                    data-picked={isPicked}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      width: '100%',
                      padding: '11px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{ fontSize: 14, color: TEXT, fontWeight: isPicked ? 600 : 500 }}
                      >
                        {model.label}
                      </Text>
                      <Text style={{ fontSize: 13, color: SUB, marginTop: 2 }}>
                        {model.description}
                      </Text>
                    </div>
                    <div style={{ width: 15, flexShrink: 0, marginTop: 2 }}>
                      {isPicked && <IconCheck size={15} color={DARK} stroke={2.5} />}
                    </div>
                  </button>
                );
              })}
            </Stack>
          </div>
        )}

        <div>
          <Text fw={600} style={{ fontSize: 14, color: LABEL_COLOR, marginBottom: 10 }}>
            저장된 데이터
          </Text>
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
            {entries.map((entry, index) => (
              <div
                key={entry.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  borderBottom: index === entries.length - 1 ? 'none' : `1px solid ${BORDER}`,
                }}
              >
                <Text style={{ fontSize: 14, color: LABEL_COLOR }}>{entry.label}</Text>
                <Text style={{ fontSize: 13, color: SUB }}>{formatBytes(entry.bytes)}</Text>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 12px',
                borderTop: `1px solid ${BORDER}`,
                backgroundColor: SURFACE_SOFT,
              }}
            >
              <Group gap={7} wrap="nowrap">
                <IconDatabase size={14} color={SUB} />
                <Text fw={600} style={{ fontSize: 14, color: LABEL_COLOR }}>
                  전체
                </Text>
              </Group>
              <Text fw={600} style={{ fontSize: 13, color: LABEL_COLOR }}>
                {formatBytes(totalBytes)}
              </Text>
            </div>
          </div>
          <Text style={{ fontSize: 13, color: SUB, marginTop: 8, lineHeight: 1.5 }}>
            모든 데이터는 이 브라우저에만 저장되며 서버로 전송되지 않아요.
          </Text>
        </div>

        {confirmingClear ? (
          <div
            style={{
              border: `1px solid ${DANGER}`,
              borderRadius: 8,
              padding: '12px 14px',
            }}
          >
            <Text fw={700} style={{ fontSize: 14, color: DANGER }}>
              모든 데이터를 지울까요?
            </Text>
            <Text style={{ fontSize: 13, color: SUB, marginTop: 3, lineHeight: 1.5 }}>
              학생 정보와 작성 중인 신청서가 모두 사라져요. 되돌릴 수 없어요.
            </Text>
            <Group gap={8} justify="flex-end" mt={12}>
              <Button variant="ghost" onClick={() => setConfirmingClear(false)}>
                취소
              </Button>
              <Button variant="danger" onClick={handleClear}>
                전부 삭제
              </Button>
            </Group>
          </div>
        ) : (
          <Group justify="space-between">
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="danger-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                color: DANGER,
                fontSize: 14,
                padding: '8px 12px',
              }}
            >
              <IconTrash size={15} />
              데이터 초기화
            </button>
            <Button variant="outline" onClick={onCloseAction}>
              닫기
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}
