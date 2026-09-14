'use client';

import { useEffect, useState } from 'react';
import { Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { IconCheck, IconCopy, IconLink, IconLoader2, IconShare2 } from '@tabler/icons-react';

import { Button } from '@/lib/graphite/components';
import { FZ } from '@/lib/graphite/theme';
import { shareCreateResponseSchema, type SharePayload } from '@/lib/share';
import { BORDER, DANGER, DONE_COLOR, LABEL_COLOR, SUB, SURFACE_SOFT, TEXT } from '@/lib/theme';

const SHARED_ITEMS = ['제목', '장소와 주소', '기간', '학습 형태', '체험 목적', '활동 계획'];
const WITHHELD_ITEMS = ['학생 이름', '학년·반·번호', '보호자 이름'];

export default function ShareModal({
  opened,
  onCloseAction,
  buildPayloadAction,
}: {
  opened: boolean;
  onCloseAction: () => void;
  buildPayloadAction: () => SharePayload | null;
}) {
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setShareUrl('');
    setError(null);
    setCopied(false);
  }, [opened]);

  const handleCreate = async () => {
    if (creating) return;

    const payload = buildPayloadAction();
    if (payload === null) {
      setError('공유할 내용이 부족해요. 장소와 기간을 먼저 채워주세요.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });

      const body: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof body === 'object' && body !== null && 'error' in body
            ? String((body as { error: unknown }).error)
            : '공유 링크를 만들지 못했어요.';
        throw new Error(message);
      }

      const parsed = shareCreateResponseSchema.safeParse(body);
      if (!parsed.success) throw new Error('공유 응답 형식이 올바르지 않아요.');

      setShareUrl(`${window.location.origin}/s/${parsed.data.id}#${parsed.data.key}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '공유 링크를 만들지 못했어요.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (shareUrl === '') return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_800);
    } catch {
      setError('클립보드에 복사하지 못했어요. 링크를 직접 선택해 주세요.');
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onCloseAction}
      centered
      radius="lg"
      size={440}
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
            <IconShare2 size={18} color={SUB} />
          </div>
          <div>
            <Text fw={700} style={{ fontSize: FZ.section, color: TEXT }}>
              링크로 공유
            </Text>
            <Text style={{ fontSize: 14, color: SUB, marginTop: 1 }}>
              여행 계획만 공유하고 개인정보는 담지 않아요.
            </Text>
          </div>
        </Group>

        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px' }}>
            <Text fw={600} style={{ fontSize: 13, color: LABEL_COLOR, marginBottom: 8 }}>
              공유되는 내용
            </Text>
            <Stack gap={5}>
              {SHARED_ITEMS.map((item) => (
                <Group key={item} gap={7} wrap="nowrap">
                  <IconCheck size={13} color={DONE_COLOR} stroke={2.5} style={{ flexShrink: 0 }} />
                  <Text style={{ fontSize: 13, color: LABEL_COLOR }}>{item}</Text>
                </Group>
              ))}
            </Stack>
          </div>
          <div
            style={{
              padding: '12px 14px',
              borderTop: `1px solid ${BORDER}`,
              backgroundColor: SURFACE_SOFT,
            }}
          >
            <Text fw={600} style={{ fontSize: 13, color: LABEL_COLOR, marginBottom: 8 }}>
              공유되지 않는 내용
            </Text>
            <Group gap={6}>
              {WITHHELD_ITEMS.map((item) => (
                <span
                  key={item}
                  style={{
                    fontSize: 12,
                    color: SUB,
                    padding: '3px 9px',
                    borderRadius: R.pill,
                    backgroundColor: 'white',
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  {item}
                </span>
              ))}
            </Group>
            <Text style={{ fontSize: 12, color: SUB, marginTop: 9, lineHeight: 1.55 }}>
              받는 사람이 자기 학생 정보를 직접 채워 신청서를 받습니다.
            </Text>
          </div>
        </div>

        {error !== null && (
          <Text className="fade-up" style={{ fontSize: 13, color: DANGER, lineHeight: 1.5 }}>
            {error}
          </Text>
        )}

        {shareUrl !== '' && (
          <div className="fade-up">
            <Text fw={600} style={{ fontSize: 14, color: LABEL_COLOR, marginBottom: 8 }}>
              공유 링크
            </Text>
            <Group gap={8} wrap="nowrap" align="center">
              <TextInput
                value={shareUrl}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                aria-label="공유 링크"
                radius="md"
                size="md"
                style={{ flex: 1 }}
                styles={{ input: { fontSize: 13, color: TEXT } }}
                leftSection={<IconLink size={15} color={SUB} />}
              />
              <Button variant="outline" onClick={() => void handleCopy()}>
                {copied ? (
                  <IconCheck size={15} color={DONE_COLOR} stroke={2.5} />
                ) : (
                  <IconCopy size={15} />
                )}
                {copied ? '복사했어요' : '복사'}
              </Button>
            </Group>
          </div>
        )}

        <Group justify="flex-end" gap={8}>
          <button
            type="button"
            onClick={onCloseAction}
            className="text-btn"
            style={{
              background: 'none',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              color: SUB,
              fontSize: 14,
              padding: '8px 12px',
            }}
          >
            닫기
          </button>
          <Button variant="solid" onClick={() => void handleCreate()} disabled={creating}>
            {creating && <IconLoader2 size={15} className="spin" />}
            {shareUrl === '' ? '링크 만들기' : '새 링크 만들기'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
