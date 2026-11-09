'use client';

import { useMemo, useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { Collapse, Group, Paper, Text, TextInput, Textarea } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconFileText,
  IconPrinter,
  IconSparkles,
} from '@tabler/icons-react';

import {
  HALF_DAY_LIMITS,
  appliedDates,
  daysBetween,
  deadlineTone,
  formatTableDate,
  getReport,
  isReportComplete,
  reportDeadline,
  reportPlace,
  reportPurpose,
  type HalfDayData,
  type HalfDayReport,
  type HalfDayStep,
} from '@/lib/half-day';
import { printReports } from '@/lib/half-day-print';
import { buildReportSheet, reportFits, type SheetStudent } from '@/lib/half-day-sheets';
import { Button } from '@/lib/graphite/components';
import { R, WARN_BG, WARN_TEXT } from '@/lib/graphite/theme';
import {
  BORDER,
  CARD_RADIUS,
  CARD_SHADOW,
  DANGER,
  DONE_COLOR,
  GREEN_SOFT,
  INPUT_STYLES,
  SUB,
  SURFACE_SOFT,
  TEXT,
} from '@/lib/theme';
import { StepHeader } from '../editor-chrome';
import PhotoAttachments from './PhotoAttachments';
import PolishButton from './PolishButton';
import SheetPreviewModal from './SheetPreviewModal';

type ReportStatus = 'empty' | 'writing' | 'done';

function statusOf(data: HalfDayData, date: string): ReportStatus {
  if (isReportComplete(data, date)) return 'done';
  const report = getReport(data, date);
  return report.content.trim() !== '' || report.feeling.trim() !== '' ? 'writing' : 'empty';
}

const STATUS_LABEL: Record<ReportStatus, string> = { empty: '작성 전', writing: '작성 중', done: '작성 완료' };

function Counter({ value, limit }: { value: string; limit: number }) {
  return (
    <Text style={{ fontSize: 12, color: value.length >= limit ? DANGER : SUB }}>
      {value.length}/{limit}
    </Text>
  );
}

function ReportCard({
  date,
  data,
  today,
  open,
  students,
  canAsk,
  polishing,
  polishError,
  photoUrls,
  photoBusy,
  photoError,
  onToggle,
  onChange,
  onAsk,
  onPolish,
  onAddPhotos,
  onRemovePhoto,
}: {
  date: string;
  data: HalfDayData;
  today: string;
  open: boolean;
  students: SheetStudent[];
  canAsk: boolean;
  polishing: boolean;
  polishError: string | null;
  photoUrls: Record<string, string>;
  photoBusy: boolean;
  photoError: string | null;
  onToggle: () => void;
  onChange: (patch: Partial<HalfDayReport>) => void;
  onAsk: () => void;
  onPolish: () => void;
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (id: string) => void;
}) {
  const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);
  const report = getReport(data, date);
  const status = statusOf(data, date);
  const deadline = reportDeadline(date);
  const { tone } = deadlineTone(deadline, today);
  const future = daysBetween(today, date) > 0;
  const photos = report.photos ?? [];
  const fits = reportFits(report, photos.filter((photo) => photoUrls[photo.id] !== undefined));
  const html = useMemo(
    () => (previewOpened && students[0] ? buildReportSheet(students[0], data, date, photoUrls) : ''),
    [previewOpened, students, data, date, photoUrls]
  );

  return (
    // data-photo-scope: 이 카드 안에 포커스가 있을 때 붙여넣은 이미지는 이 보고서의 사진으로 들어간다.
    <div
      data-photo-scope
      style={{ border: `1px solid ${BORDER}`, borderRadius: R.panel, overflow: 'hidden', backgroundColor: 'white' }}
    >
      <button
        type="button"
        className="hd-day-head"
        aria-expanded={open}
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}
      >
        <Text fw={700} style={{ fontSize: 15, color: TEXT, width: 78, flexShrink: 0 }}>
          {formatTableDate(date)}
        </Text>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, color: TEXT, fontWeight: 600 }} lineClamp={1}>
            {reportPlace(data, date) || '장소 미입력'}
          </Text>
          <Group gap={6} mt={5} wrap="wrap">
            <span
              style={{
                borderRadius: R.pill,
                padding: '3px 9px',
                fontSize: 12,
                fontWeight: 500,
                color: status === 'done' ? DONE_COLOR : SUB,
                backgroundColor: status === 'done' ? GREEN_SOFT : SURFACE_SOFT,
              }}
            >
              {STATUS_LABEL[status]}
            </span>
            <span
              style={{
                borderRadius: R.pill,
                padding: '3px 9px',
                fontSize: 12,
                fontWeight: 500,
                color: tone === 'late' && status !== 'done' ? DANGER : tone === 'soon' && status !== 'done' ? WARN_TEXT : SUB,
                backgroundColor: tone === 'soon' && status !== 'done' ? WARN_BG : SURFACE_SOFT,
                border: tone === 'late' && status !== 'done' ? `1px solid ${DANGER}` : '1px solid transparent',
              }}
            >
              {tone === 'late' && status !== 'done'
                ? `제출 기한이 지났어요 (${formatTableDate(deadline)})`
                : `${formatTableDate(deadline)}까지 제출`}
            </span>
            {future && (
              <span style={{ fontSize: 12, color: SUB }}>아직 진행 전이에요. 다녀온 뒤에 써도 돼요.</span>
            )}
          </Group>
        </div>
        <IconChevronDown
          size={16}
          color={SUB}
          style={{ flexShrink: 0, transition: 'transform 180ms ease', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      <Collapse expanded={open} transitionDuration={200}>
        <div style={{ padding: '4px 16px 18px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <TextInput
              label="장소"
              value={reportPlace(data, date)}
              maxLength={HALF_DAY_LIMITS.reportPlace}
              onChange={(event) => onChange({ place: event.currentTarget.value })}
              rightSection={<Counter value={reportPlace(data, date)} limit={HALF_DAY_LIMITS.reportPlace} />}
              rightSectionWidth={52}
              styles={INPUT_STYLES}
            />
            <TextInput
              label="목적"
              value={reportPurpose(data, date)}
              maxLength={HALF_DAY_LIMITS.reportPurpose}
              onChange={(event) => onChange({ purpose: event.currentTarget.value })}
              rightSection={<Counter value={reportPurpose(data, date)} limit={HALF_DAY_LIMITS.reportPurpose} />}
              rightSectionWidth={52}
              styles={INPUT_STYLES}
            />
          </div>

          <Textarea
            label="체험내용"
            description="무엇을 보고 했는지 구체적으로, 다녀온 뒤의 말투로 적어요."
            autosize
            minRows={4}
            maxRows={10}
            value={report.content}
            maxLength={HALF_DAY_LIMITS.reportContent}
            onChange={(event) => onChange({ content: event.currentTarget.value })}
            styles={INPUT_STYLES}
          />
          <Group justify="flex-end" mt={-6}>
            <Counter value={report.content} limit={HALF_DAY_LIMITS.reportContent} />
          </Group>

          <Textarea
            label="느낀 점"
            autosize
            minRows={3}
            maxRows={8}
            value={report.feeling}
            maxLength={HALF_DAY_LIMITS.reportFeeling}
            onChange={(event) => onChange({ feeling: event.currentTarget.value })}
            styles={INPUT_STYLES}
          />
          <Group justify="flex-end" mt={-6}>
            <Counter value={report.feeling} limit={HALF_DAY_LIMITS.reportFeeling} />
          </Group>

          <TextInput
            label="첨부자료"
            description="사진, 입장권처럼 함께 낼 증빙을 적어 두면 보고서 칸에 들어가요."
            placeholder="예: 입장권 사진, 상담 확인증"
            value={report.attachmentNote}
            maxLength={HALF_DAY_LIMITS.reportAttachment}
            onChange={(event) => onChange({ attachmentNote: event.currentTarget.value })}
            rightSection={<Counter value={report.attachmentNote} limit={HALF_DAY_LIMITS.reportAttachment} />}
            rightSectionWidth={56}
            styles={INPUT_STYLES}
          />

          <PhotoAttachments
            photos={photos}
            urls={photoUrls}
            busy={photoBusy}
            error={photoError}
            active={open}
            onAdd={onAddPhotos}
            onRemove={onRemovePhoto}
          />

          {!fits && (
            <div
              role="alert"
              style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: WARN_BG, borderRadius: R.md, padding: '9px 12px' }}
            >
              <IconAlertTriangle size={16} color={WARN_TEXT} style={{ flexShrink: 0 }} />
              <Text style={{ fontSize: 13, color: WARN_TEXT }}>
                글이 너무 길어서 인쇄하면 일부가 잘릴 수 있어요. 조금 줄여 주세요.
              </Text>
            </div>
          )}

          <Group gap={8} wrap="wrap" mt={4}>
            <Button variant="outline" leftIcon={<IconSparkles size={16} />} disabled={!canAsk} onClick={onAsk}>
              AI로 쓰기
            </Button>
            {(report.content.trim() !== '' || report.feeling.trim() !== '') && (
              <PolishButton
                tooltip="대충 적은 체험내용과 느낀 점을 보고서 문장으로 다듬어요"
                appearance="button"
                loading={polishing}
                disabled={!canAsk}
                onClick={onPolish}
              />
            )}
            <Button variant="outline" onClick={openPreview}>
              미리보기
            </Button>
            <Button
              variant="solid"
              leftIcon={<IconPrinter size={16} />}
              disabled={students.length === 0}
              onClick={() => void printReports(students, data, [date], photoUrls)}
            >
              이 날 보고서 인쇄
            </Button>
          </Group>

          {polishError && (
            <Text role="alert" style={{ fontSize: 13, color: DANGER }}>
              {polishError}
            </Text>
          )}

          <SheetPreviewModal
            opened={previewOpened}
            html={html}
            label={`${formatTableDate(date)} 결과 보고서 미리보기`}
            title={`보고서 미리보기 · ${formatTableDate(date)}`}
            onPrint={() => void printReports(students, data, [date], photoUrls)}
            onClose={closePreview}
          />
        </div>
      </Collapse>
    </div>
  );
}

export default function ReportsStep({
  students,
  data,
  today,
  canAsk,
  polishing,
  polishError,
  photoUrls,
  photoBusy,
  photoError,
  onChangeReport,
  onAskAgent,
  onPolish,
  onAddPhotos,
  onRemovePhoto,
  onGoTo,
}: {
  students: SheetStudent[];
  data: HalfDayData;
  today: string;
  canAsk: boolean;
  polishing: string | null;
  polishError: { date: string; message: string } | null;
  photoUrls: Record<string, string>;
  /** 사진을 처리 중인 날짜. 없으면 null. */
  photoBusy: string | null;
  photoError: { date: string; message: string } | null;
  onChangeReport: (date: string, patch: Partial<HalfDayReport>) => void;
  onAskAgent: (date: string) => void;
  onPolish: (date: string) => void;
  onAddPhotos: (date: string, files: File[]) => void;
  onRemovePhoto: (date: string, id: string) => void;
  onGoTo: (step: HalfDayStep) => void;
}) {
  const dates = appliedDates(data);
  const firstUnfinished = dates.find((date) => statusOf(data, date) !== 'done') ?? null;
  const [openDate, setOpenDate] = useState<string | null>(firstUnfinished);
  const doneCount = dates.filter((date) => statusOf(data, date) === 'done').length;

  return (
    <Paper withBorder radius={CARD_RADIUS} p={24} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
      <StepHeader
        icon={IconFileText}
        title="결과 보고서"
        description="체험을 신청한 날마다 보고서를 한 장씩 내야 해요. 실시 후 7일 이내예요."
      />

      {dates.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Text style={{ fontSize: 14, color: SUB }}>신청한 날이 있어야 보고서를 쓸 수 있어요.</Text>
          <Button variant="outline" onClick={() => onGoTo('plan')}>
            날짜 고르러 가기
          </Button>
        </div>
      ) : (
        <>
          <Group justify="space-between" align="center" mb={14} wrap="nowrap" gap={12}>
            <Group gap={5} wrap="nowrap" aria-label={`보고서 ${doneCount}/${dates.length} 작성 완료`}>
              {dates.map((date) => (
                <span
                  key={date}
                  aria-hidden
                  style={{
                    width: 22,
                    height: 6,
                    borderRadius: R.pill,
                    backgroundColor: statusOf(data, date) === 'done' ? DONE_COLOR : BORDER,
                    transition: 'background-color 180ms ease',
                  }}
                />
              ))}
              <Text style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginLeft: 8 }}>
                보고서 {doneCount}/{dates.length}
              </Text>
            </Group>
            <Button
              variant="outline"
              leftIcon={<IconPrinter size={16} />}
              disabled={students.length === 0}
              onClick={() => void printReports(students, data, undefined, photoUrls)}
            >
              전체 인쇄
            </Button>
          </Group>

          <div style={{ display: 'grid', gap: 10 }}>
            {dates.map((date) => (
              <ReportCard
                key={date}
                date={date}
                data={data}
                today={today}
                open={openDate === date}
                students={students}
                canAsk={canAsk && polishing === null}
                polishing={polishing === date}
                polishError={polishError?.date === date ? polishError.message : null}
                onToggle={() => setOpenDate((prev) => (prev === date ? null : date))}
                onChange={(patch) => onChangeReport(date, patch)}
                onAsk={() => onAskAgent(date)}
                onPolish={() => onPolish(date)}
                photoUrls={photoUrls}
                photoBusy={photoBusy === date}
                photoError={photoError?.date === date ? photoError.message : null}
                onAddPhotos={(files) => onAddPhotos(date, files)}
                onRemovePhoto={(id) => onRemovePhoto(date, id)}
              />
            ))}
          </div>

          <Text style={{ fontSize: 13, color: SUB, lineHeight: 1.6, marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <IconCheck size={14} style={{ marginTop: 3, flexShrink: 0 }} />
            <span>보고서를 내지 않으면 그 날은 미인정 결석으로 처리돼요. 사진이나 입장권 같은 증빙은 인쇄한 보고서에 붙여 내세요.</span>
          </Text>
        </>
      )}
    </Paper>
  );
}
