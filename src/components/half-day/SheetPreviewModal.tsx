'use client';

import { Modal, Group, Text } from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';

import { Button } from '@/lib/graphite/components';
import { SHEET_WIDTH } from '@/lib/half-day-sheets';
import { SUB } from '@/lib/theme';
import SheetPreview from './SheetPreview';

/**
 * 양식 미리보기를 모달 창으로 띄운다.
 * 신청서와 보고서 모두 이 컴포넌트를 쓴다.
 */
export default function SheetPreviewModal({
  opened,
  html,
  label,
  title,
  printLabel,
  onPrint,
  onClose,
}: {
  opened: boolean;
  html: string;
  label: string;
  title: string;
  /** 인쇄/PDF 저장 버튼 글자. 기본: "인쇄 · PDF" */
  printLabel?: string;
  onPrint: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size={Math.round(SHEET_WIDTH * 0.72 + 80)}
      centered
      styles={{
        header: { paddingBottom: 12, borderBottom: '1px solid var(--mantine-color-gray-2)' },
        body: { padding: '16px 20px 20px' },
      }}
    >
      <SheetPreview html={html} label={label} />

      <Group justify="space-between" align="center" mt={16}>
        <Text style={{ fontSize: 13, color: SUB, lineHeight: 1.5 }}>
          인쇄 창에서 &lsquo;PDF로 저장&rsquo;을 고르면 PDF 파일로 받을 수 있어요.
        </Text>
        <Button variant="solid" leftIcon={<IconPrinter size={16} />} onClick={onPrint}>
          {printLabel ?? '인쇄 · PDF'}
        </Button>
      </Group>
    </Modal>
  );
}
