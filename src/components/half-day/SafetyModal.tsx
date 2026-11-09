'use client';

import { Group, Modal, ScrollArea, Stack, Text } from '@mantine/core';
import { IconCheck, IconShieldCheck } from '@tabler/icons-react';

import { Button } from '@/lib/graphite/components';
import { MODAL_TRANSITION, R } from '@/lib/graphite/theme';
import { BORDER, DONE_COLOR, GREEN_SOFT, SUB, TEXT } from '@/lib/theme';

/** 가정통신문 6쪽(개인 진로·직업 체험 안전교육)을 이미지 그대로 보여준다. */
export const SAFETY_IMAGE = { src: '/half-day/safety.png', width: 1190, height: 1658 } as const;

export default function SafetyModal({
  opened,
  acknowledged,
  onClose,
  onAcknowledge,
}: {
  opened: boolean;
  acknowledged: boolean;
  onClose: () => void;
  onAcknowledge: () => void;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      radius="lg"
      size={680}
      padding={0}
      withCloseButton
      overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
      transitionProps={MODAL_TRANSITION}
      title={
        <Group gap={10} wrap="nowrap" pl={8}>
          <IconShieldCheck size={18} color={SUB} />
          <Text fw={700} style={{ fontSize: 15, color: TEXT }}>
            체험 안전교육 · 주의사항
          </Text>
        </Group>
      }
      styles={{ header: { padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }, body: { padding: 0 } }}
    >
      <Stack gap={0}>
        <ScrollArea.Autosize mah="min(68vh, 760px)" type="auto" offsetScrollbars>
          <div style={{ padding: 18 }}>
            {/* 정적 이미지. 가정통신문 원본이라 next/image 최적화 대상이 아니다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SAFETY_IMAGE.src}
              width={SAFETY_IMAGE.width}
              height={SAFETY_IMAGE.height}
              alt="2026학년도 개인 진로·직업 체험 안전교육. 체험 활동 시 주의 사항과 성폭력 예방 행동 요령."
              style={{ display: 'block', width: '100%', height: 'auto', borderRadius: R.md, border: `1px solid ${BORDER}` }}
            />
          </div>
        </ScrollArea.Autosize>

        <Group
          justify="space-between"
          wrap="nowrap"
          gap={12}
          style={{ padding: '14px 18px', borderTop: `1px solid ${BORDER}` }}
        >
          {acknowledged ? (
            <Group gap={6} wrap="nowrap">
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: GREEN_SOFT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconCheck size={13} color={DONE_COLOR} stroke={3} />
              </div>
              <Text style={{ fontSize: 13, color: SUB }}>이미 확인했어요</Text>
            </Group>
          ) : (
            <Text style={{ fontSize: 13, color: SUB }}>끝까지 읽고 확인했다면 눌러 주세요.</Text>
          )}
          <Group gap={8} wrap="nowrap">
            <Button variant="outline" onClick={onClose}>
              닫기
            </Button>
            {!acknowledged && (
              <Button
                variant="solid"
                onClick={() => {
                  onAcknowledge();
                  onClose();
                }}
              >
                확인했어요
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
