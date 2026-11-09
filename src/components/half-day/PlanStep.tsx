'use client';

import { useMemo, useState } from 'react';
import { Collapse, Group, Switch, Text, TextInput } from '@mantine/core';
import {
  IconBackpack,
  IconCalendarEvent,
  IconCalendarOff,
  IconChevronDown,
  IconClock,
  IconCopy,
  IconMapPin,
  IconRoute,
  IconSchool,
  IconUsers,
} from '@tabler/icons-react';

import {
  HALF_DAY_LIMITS,
  HALF_DAY_SCHEDULE,
  PERSONAL_DATES,
  applicationDeadline,
  appliedDates,
  deadlineTone,
  formatTableDate,
  getEntry,
  weekStartOf,
  type FieldTripInfo,
  type HalfDayData,
  type HalfDayDay,
  type HalfDayEntry,
} from '@/lib/half-day';
import { WARN_BG, WARN_TEXT, R } from '@/lib/graphite/theme';
import { BORDER, DANGER, DARK, INPUT_STYLES, LABEL_COLOR, SUB, SURFACE_SOFT, TEXT } from '@/lib/theme';
import { StepHeader } from '../editor-chrome';
import PolishButton from './PolishButton';

type Week = { start: string; days: HalfDayDay[] };

/** 일정을 월요일 기준 주로 묶는다. 계산은 한 번이면 되므로 모듈에서 미리 해 둔다. */
const WEEKS: Week[] = (() => {
  const groups = new Map<string, HalfDayDay[]>();
  for (const day of HALF_DAY_SCHEDULE) {
    const start = weekStartOf(day.date);
    groups.set(start, [...(groups.get(start) ?? []), day]);
  }
  return [...groups].map(([start, days]) => ({ start, days }));
})();

const weekRange = (week: Week) => {
  const first = week.days[0].date;
  const last = week.days[week.days.length - 1].date;
  const short = (iso: string) => formatTableDate(iso).replace(/\(.\)/, '');
  return first === last ? short(first) : `${short(first)} ~ ${short(last)}`;
};

const FIELD_LABELS: Record<keyof HalfDayEntry & ('purpose' | 'place' | 'content'), string> = {
  purpose: '체험 목적',
  place: '체험 장소',
  content: '체험 내용',
};

const FIELD_PLACEHOLDERS = {
  purpose: '예: 진로 탐색',
  place: '예: 서울 코엑스',
  content: '예: 직업 박람회 관람 및 진로 상담 체험',
} as const;

const FIELDS = ['purpose', 'place', 'content'] as const;

function DeadlineChip({ date, today }: { date: string; today: string }) {
  const deadline = applicationDeadline(date);
  const { tone } = deadlineTone(deadline, today);
  const text =
    tone === 'late' ? `신청 마감이 지났어요 (${formatTableDate(deadline)})` : `${formatTableDate(deadline)}까지 제출`;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: R.pill,
        padding: '3px 9px',
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        color: tone === 'late' ? DANGER : tone === 'soon' ? WARN_TEXT : SUB,
        backgroundColor: tone === 'soon' ? WARN_BG : SURFACE_SOFT,
        border: tone === 'late' ? `1px solid ${DANGER}` : '1px solid transparent',
      }}
    >
      {text}
    </span>
  );
}

function PersonalDayRow({
  date,
  entry,
  today,
  canCopy,
  polishing,
  polishError,
  canPolish,
  onChange,
  onCopyPrevious,
  onPolish,
}: {
  date: string;
  entry: HalfDayEntry;
  today: string;
  canCopy: boolean;
  polishing: boolean;
  polishError: string | null;
  canPolish: boolean;
  onChange: (patch: Partial<HalfDayEntry>) => void;
  onCopyPrevious: () => void;
  onPolish: () => void;
}) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const anyEmpty = FIELDS.some((field) => entry[field].trim() === '');
  const anyFilled = FIELDS.some((field) => entry[field].trim() !== '');

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderLeft: `3px solid ${entry.applied ? DARK : 'transparent'}`,
        transition: 'border-color 180ms ease',
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={entry.applied}
        aria-label={`${formatTableDate(date)} 반일 체험학습 신청`}
        className="hd-day-head"
        onClick={() => onChange({ applied: !entry.applied })}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px 13px 13px' }}
      >
        <Text fw={700} style={{ fontSize: 15, color: TEXT, width: 78, flexShrink: 0 }}>
          {formatTableDate(date)}
        </Text>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, color: entry.applied ? TEXT : SUB, fontWeight: entry.applied ? 600 : 400 }}>
            {entry.applied ? '반일 체험학습 신청' : '신청 안 함 · 정상 수업'}
          </Text>
          <div style={{ marginTop: 5 }}>
            <DeadlineChip date={date} today={today} />
          </div>
        </div>
        <Switch
          size="sm"
          color="dark"
          checked={entry.applied}
          readOnly
          tabIndex={-1}
          aria-hidden
          styles={{ root: { pointerEvents: 'none' } }}
        />
      </button>

      <Collapse expanded={entry.applied} transitionDuration={200}>
        <div style={{ padding: '2px 16px 16px 16px' }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
            {(['purpose', 'place'] as const).map((field) => (
              <TextInput
                key={field}
                label={FIELD_LABELS[field]}
                placeholder={FIELD_PLACEHOLDERS[field]}
                value={entry[field]}
                maxLength={HALF_DAY_LIMITS[field]}
                error={touched[field] === true && entry[field].trim() === ''}
                onBlur={() => setTouched((prev) => ({ ...prev, [field]: true }))}
                onChange={(event) => onChange({ [field]: event.currentTarget.value })}
                rightSection={
                  <Text style={{ fontSize: 11, color: SUB }}>
                    {entry[field].length}/{HALF_DAY_LIMITS[field]}
                  </Text>
                }
                rightSectionWidth={44}
                styles={INPUT_STYLES}
              />
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <TextInput
              label={FIELD_LABELS.content}
              placeholder={FIELD_PLACEHOLDERS.content}
              value={entry.content}
              maxLength={HALF_DAY_LIMITS.content}
              error={touched.content === true && entry.content.trim() === ''}
              onBlur={() => setTouched((prev) => ({ ...prev, content: true }))}
              onChange={(event) => onChange({ content: event.currentTarget.value })}
              rightSection={
                <Text style={{ fontSize: 11, color: SUB }}>
                  {entry.content.length}/{HALF_DAY_LIMITS.content}
                </Text>
              }
              rightSectionWidth={52}
              styles={INPUT_STYLES}
            />
          </div>

          {((canCopy && anyEmpty) || anyFilled) && (
            <Group gap={8} mt={12} wrap="wrap">
              {anyFilled && (
                <PolishButton
                  tooltip="대충 적은 내용을 신청서 칸에 맞는 길이와 말투로 다듬어요"
                  loading={polishing}
                  disabled={!canPolish}
                  onClick={onPolish}
                />
              )}
              {canCopy && anyEmpty && (
                <button
                  type="button"
                  className="answer-chip"
                  onClick={onCopyPrevious}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: R.pill,
                    padding: '6px 12px',
                    fontSize: 13,
                    color: LABEL_COLOR,
                  }}
                >
                  <IconCopy size={14} />
                  앞 날짜와 같게 채우기
                </button>
              )}
            </Group>
          )}
          {polishError && (
            <Text role="alert" style={{ fontSize: 13, color: DANGER, marginTop: 8 }}>
              {polishError}
            </Text>
          )}
        </div>
      </Collapse>
    </div>
  );
}

function TripDetail({ info }: { info: FieldTripInfo }) {
  const rows: { icon: typeof IconClock; label: string; body: React.ReactNode }[] = [
    { icon: IconClock, label: '시간', body: info.time },
    {
      icon: IconUsers,
      label: '집합 장소',
      body: (
        <>
          {info.meeting}
          {info.meetingNote && <span style={{ display: 'block', color: SUB, fontSize: 13, marginTop: 3 }}>{info.meetingNote}</span>}
        </>
      ),
    },
    { icon: IconSchool, label: '체험 내용', body: info.content },
    {
      icon: IconRoute,
      label: '이동 수단',
      body: (
        <>
          {info.transport.map((line) => (
            <span key={line} style={{ display: 'block' }}>
              {line}
            </span>
          ))}
        </>
      ),
    },
    { icon: IconBackpack, label: '준비물', body: info.supplies },
  ];

  return (
    <div style={{ padding: '4px 16px 16px 16px' }}>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '92px minmax(0, 1fr)', alignItems: 'start' }}>
        {rows.map(({ icon: Icon, label, body }) => (
          <div key={label} style={{ display: 'contents' }}>
            <Group gap={6} wrap="nowrap" style={{ color: SUB, fontSize: 13, paddingTop: 1 }}>
              <Icon size={14} />
              <span>{label}</span>
            </Group>
            <div style={{ fontSize: 14, color: TEXT, lineHeight: 1.55 }}>{body}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
        <Text style={{ fontSize: 13, color: SUB, marginBottom: 8 }}>일정</Text>
        <div style={{ display: 'grid', gap: 6, gridTemplateColumns: '112px minmax(0, 1fr)' }}>
          {info.schedule.map((item) => (
            <div key={`${item.time}-${item.what}`} style={{ display: 'contents' }}>
              <span style={{ fontSize: 13, color: SUB, fontVariantNumeric: 'tabular-nums' }}>{item.time}</span>
              <span style={{ fontSize: 14, color: TEXT, lineHeight: 1.5 }}>{item.what}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FixedDayRow({ day }: { day: Exclude<HalfDayDay, { kind: 'personal' }> }) {
  const [open, setOpen] = useState(false);
  const detailed = day.kind === 'field-trip';
  const Icon = day.kind === 'field-trip' ? IconMapPin : day.kind === 'recess' ? IconCalendarOff : IconSchool;
  const title = day.kind === 'field-trip' ? `${day.label} · ${day.info.place}` : day.label;
  const subtitle = day.kind === 'field-trip' ? `${day.info.purpose} · ${day.info.time}` : '학교 일정 · 신청서에 이미 적혀 있어요';

  const head = (
    <>
      <Text fw={700} style={{ fontSize: 15, color: SUB, width: 78, flexShrink: 0 }}>
        {formatTableDate(day.date)}
      </Text>
      <Icon size={16} color={SUB} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, color: TEXT, fontWeight: 600 }}>{title}</Text>
        <Text style={{ fontSize: 13, color: SUB, marginTop: 1 }}>{subtitle}</Text>
      </div>
      {detailed && (
        <IconChevronDown
          size={16}
          color={SUB}
          style={{ flexShrink: 0, transition: 'transform 180ms ease', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      )}
    </>
  );

  return (
    <div style={{ backgroundColor: SURFACE_SOFT, borderLeft: '3px solid transparent' }}>
      {detailed ? (
        <button
          type="button"
          className="hd-day-head"
          aria-expanded={open}
          aria-label={`${formatTableDate(day.date)} ${title} 자세히 보기`}
          onClick={() => setOpen((prev) => !prev)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px 12px 13px' }}
        >
          {head}
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px 12px 13px' }}>{head}</div>
      )}
      {detailed && (
        <Collapse expanded={open} transitionDuration={200}>
          <TripDetail info={day.info} />
        </Collapse>
      )}
    </div>
  );
}

export default function PlanStep({
  data,
  today,
  polishing,
  polishError,
  canPolish,
  onEntryChange,
  onApplyAll,
  onCopyPrevious,
  onPolish,
}: {
  data: HalfDayData;
  today: string;
  /** 지금 다듬는 중인 날짜. 없으면 null. */
  polishing: string | null;
  polishError: { date: string; message: string } | null;
  canPolish: boolean;
  onEntryChange: (date: string, patch: Partial<HalfDayEntry>) => void;
  onApplyAll: (applied: boolean) => void;
  onCopyPrevious: (date: string) => void;
  onPolish: (date: string) => void;
}) {
  const applied = appliedDates(data);
  const allApplied = applied.length === PERSONAL_DATES.length;
  const firstWithContent = useMemo(
    () => PERSONAL_DATES.filter((date) => FIELDS.some((field) => getEntry(data, date)[field].trim() !== '')),
    [data]
  );

  return (
    <div>
      <StepHeader
        icon={IconCalendarEvent}
        title="날짜별 신청"
        description="학교가 정한 일정은 그대로 두고, 직접 체험할 날만 켜서 적어요."
      />

      <Group justify="space-between" align="center" wrap="nowrap" gap={12} mb={14}>
        <Group gap={5} wrap="nowrap" aria-label={`${applied.length}일 신청, 전체 ${PERSONAL_DATES.length}일`}>
          {PERSONAL_DATES.map((date) => (
            <span
              key={date}
              aria-hidden
              style={{
                width: 22,
                height: 6,
                borderRadius: R.pill,
                backgroundColor: getEntry(data, date).applied ? DARK : BORDER,
                transition: 'background-color 180ms ease',
              }}
            />
          ))}
          <Text style={{ fontSize: 13, fontWeight: 600, color: applied.length > 0 ? TEXT : SUB, marginLeft: 8 }}>
            신청 {applied.length}일 / {PERSONAL_DATES.length}일
          </Text>
        </Group>
        <button
          type="button"
          className="text-btn"
          onClick={() => onApplyAll(!allApplied)}
          style={{ border: 'none', cursor: 'pointer', color: SUB, fontSize: 13, padding: '5px 9px', borderRadius: 8, whiteSpace: 'nowrap' }}
        >
          {allApplied ? '전체 해제' : '전체 신청'}
        </button>
      </Group>

      <div style={{ display: 'grid', gap: 18 }}>
        {WEEKS.map((week, index) => (
          <section key={week.start} aria-label={`${index + 1}주차`}>
            <Group gap={8} mb={7} px={2}>
              <Text fw={700} style={{ fontSize: 13, color: LABEL_COLOR }}>
                {index + 1}주차
              </Text>
              <Text style={{ fontSize: 13, color: SUB }}>{weekRange(week)}</Text>
            </Group>
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: R.panel, overflow: 'hidden' }}>
              {week.days.map((day, rowIndex) => (
                <div key={day.date} style={{ borderTop: rowIndex === 0 ? 'none' : `1px solid ${BORDER}` }}>
                  {day.kind === 'personal' ? (
                    <PersonalDayRow
                      date={day.date}
                      entry={getEntry(data, day.date)}
                      today={today}
                      canCopy={firstWithContent.some((other) => other < day.date)}
                      polishing={polishing === day.date}
                      polishError={polishError?.date === day.date ? polishError.message : null}
                      canPolish={canPolish && polishing === null}
                      onChange={(patch) => onEntryChange(day.date, patch)}
                      onCopyPrevious={() => onCopyPrevious(day.date)}
                      onPolish={() => onPolish(day.date)}
                    />
                  ) : (
                    <FixedDayRow day={day} />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Text style={{ fontSize: 13, color: SUB, lineHeight: 1.6, marginTop: 16 }}>
        신청하지 않은 날은 정상 수업이에요. 신청서는 체험 최소 2일 전(수업일 기준)까지 담임 선생님께 내야 해요.
      </Text>
    </div>
  );
}
