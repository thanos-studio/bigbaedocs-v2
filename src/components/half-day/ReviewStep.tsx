'use client';

import { useMemo, useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { Group, Text } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconChecklist,
  IconPrinter,
  IconShieldCheck,
} from '@tabler/icons-react';

import {
  appliedDates,
  formatTableDate,
  getEntry,
  planIssues,
  type HalfDayData,
  type HalfDayStep,
} from '@/lib/half-day';
import { printApplications } from '@/lib/half-day-print';
import { buildApplicationSheet, type SheetStudent } from '@/lib/half-day-sheets';
import { Button } from '@/lib/graphite/components';
import { R, WARN_BG, WARN_TEXT } from '@/lib/graphite/theme';
import { BORDER, CARD_RADIUS, CARD_SHADOW, DONE_COLOR, GREEN_SOFT, SUB, SURFACE_SOFT, TEXT } from '@/lib/theme';
import { Paper } from '@mantine/core';
import { StepHeader } from '../editor-chrome';
import SheetPreviewModal from './SheetPreviewModal';

const CARD = { backgroundColor: 'white', boxShadow: CARD_SHADOW } as const;

export default function ReviewStep({
  students,
  data,
  onOpenSafety,
  onGoTo,
}: {
  students: SheetStudent[];
  data: HalfDayData;
  onOpenSafety: () => void;
  onGoTo: (step: HalfDayStep) => void;
}) {
  const dates = appliedDates(data);
  const issues = planIssues(data);
  const [studentIndex, setStudentIndex] = useState(0);
  const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);
  const current = students[Math.min(studentIndex, Math.max(students.length - 1, 0))];
  const html = useMemo(() => (current ? buildApplicationSheet(current, data) : ''), [current, data]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Paper withBorder radius={CARD_RADIUS} p={24} style={CARD}>
        <StepHeader
          icon={IconChecklist}
          title="신청 내용 확인"
          description="신청한 날짜와 적은 내용을 한 번 더 확인하세요."
        />

        {dates.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ fontSize: 14, color: SUB }}>아직 신청한 날이 없어요.</Text>
            <Button variant="outline" onClick={() => onGoTo('plan')}>
              날짜 고르러 가기
            </Button>
          </div>
        ) : (
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: R.panel, overflow: 'hidden' }}>
            {dates.map((date, index) => {
              const entry = getEntry(data, date);
              const missing = issues.find((issue) => issue.date === date);
              return (
                <div
                  key={date}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 14px',
                    borderTop: index === 0 ? 'none' : `1px solid ${BORDER}`,
                  }}
                >
                  <Text fw={700} style={{ fontSize: 14, color: TEXT, width: 78, flexShrink: 0, paddingTop: 1 }}>
                    {formatTableDate(date)}
                  </Text>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {missing ? (
                      <Text style={{ fontSize: 14, color: WARN_TEXT }}>
                        비어 있는 칸이 있어요: {missing.missing.map((field) => ({ purpose: '체험 목적', place: '체험 장소', content: '체험 내용' })[field]).join(', ')}
                      </Text>
                    ) : (
                      <>
                        <Text style={{ fontSize: 14, color: TEXT, fontWeight: 600 }}>
                          {entry.place} · {entry.purpose}
                        </Text>
                        <Text style={{ fontSize: 13, color: SUB, marginTop: 1, lineHeight: 1.5 }}>{entry.content}</Text>
                      </>
                    )}
                  </div>
                  {missing ? (
                    <IconAlertTriangle size={16} color={WARN_TEXT} style={{ flexShrink: 0, marginTop: 2 }} />
                  ) : (
                    <IconCheck size={16} color={DONE_COLOR} stroke={3} style={{ flexShrink: 0, marginTop: 2 }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {issues.length > 0 && (
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              backgroundColor: WARN_BG,
              borderRadius: R.md,
              padding: '10px 12px',
            }}
          >
            <Text style={{ fontSize: 13, color: WARN_TEXT }}>빈칸이 있으면 신청서에 그대로 빈 칸으로 나와요.</Text>
            <Button variant="outline" onClick={() => onGoTo('plan')}>
              고치러 가기
            </Button>
          </div>
        )}
      </Paper>

      <Paper withBorder radius={CARD_RADIUS} p={24} style={CARD}>
        <Group justify="space-between" align="center" wrap="nowrap" gap={16}>
          <Group gap="sm" wrap="nowrap">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: data.safetyAcknowledged ? GREEN_SOFT : SURFACE_SOFT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background-color 180ms ease',
              }}
            >
              {data.safetyAcknowledged ? (
                <IconCheck size={18} color={DONE_COLOR} stroke={2.5} />
              ) : (
                <IconShieldCheck size={18} color={SUB} />
              )}
            </div>
            <div>
              <Text fw={700} style={{ fontSize: 15, color: TEXT }}>
                체험 안전교육 · 주의사항
              </Text>
              <Text style={{ fontSize: 14, color: SUB, marginTop: 2 }}>
                {data.safetyAcknowledged ? '확인했어요.' : '체험 전에 꼭 읽고 확인해 주세요.'}
              </Text>
            </div>
          </Group>
          <Button variant={data.safetyAcknowledged ? 'outline' : 'solid'} onClick={onOpenSafety}>
            주의사항 확인하기
          </Button>
        </Group>
      </Paper>

      <Paper withBorder radius={CARD_RADIUS} p={24} style={CARD}>
        <Group justify="space-between" align="center" wrap="nowrap" gap={12} mb={16}>
          <div>
            <Text fw={700} style={{ fontSize: 15, color: TEXT }}>
              신청서 미리보기
            </Text>
            <Text style={{ fontSize: 14, color: SUB, marginTop: 2 }}>
              인쇄하거나 PDF로 저장해서 서명 후 담임 선생님께 내세요.
            </Text>
          </div>
        </Group>

        {students.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {students.map((student, index) => {
              const picked = index === studentIndex;
              return (
                <button
                  key={`${student.name}-${student.classNo}-${student.number}`}
                  type="button"
                  className="pick-chip"
                  data-picked={picked}
                  aria-pressed={picked}
                  onClick={() => setStudentIndex(index)}
                  style={{ borderRadius: R.pill, padding: '6px 14px', fontSize: 14, color: picked ? 'white' : TEXT }}
                >
                  {student.name}
                </button>
              );
            })}
          </div>
        )}

        <Group gap={8} wrap="wrap">
          <Button variant="outline" leftIcon={<IconPrinter size={16} />} disabled={!current} onClick={openPreview}>
            미리보기 · 인쇄 · PDF
          </Button>
          {students.length > 1 && (
            <Button variant="outline" leftIcon={<IconPrinter size={16} />} onClick={() => printApplications(students, data)}>
              전체 학생 인쇄
            </Button>
          )}
        </Group>

        {current && (
          <SheetPreviewModal
            opened={previewOpened}
            html={html}
            label={`${current.name} 학생의 반일 교외체험학습 신청서 미리보기`}
            title={`신청서 미리보기 · ${current.name}`}
            onPrint={() => printApplications([current], data)}
            onClose={closePreview}
          />
        )}
      </Paper>
    </div>
  );
}
