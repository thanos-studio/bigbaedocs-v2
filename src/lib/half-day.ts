/**
 * 2026학년도 3학년 수능 이후 반일 교외체험학습(개인 진로·직업 체험) 양식.
 * 선린가정통신문 제157호의 일정과 신청서(4쪽)·보고서(5쪽) 서식을 그대로 옮겼다.
 * 이 파일은 순수 데이터와 규칙만 담는다(React, 브라우저 API 없음).
 */

export const HALF_DAY_SCHOOL = '선린인터넷고등학교';
export const HALF_DAY_FORM_TITLE = '2026학년도 3학년 반일 교외체험학습(개인 진로·직업 체험) 신청서';
export const HALF_DAY_REPORT_TITLE = '교외체험학습 결과 보고서';
export const HALF_DAY_DEFAULT_TITLE = '3학년 수능 이후 반일 교외체험학습';
export const HALF_DAY_PERIOD = { start: '2026-11-20', end: '2026-12-11' } as const;

/** 신청서는 실시 최소 2일 전(토·일요일, 공휴일, 휴업일 제외), 보고서는 실시 후 7일 이내. */
export const APPLICATION_LEAD_SCHOOL_DAYS = 2;
export const REPORT_DUE_DAYS = 7;

/** 칸에 들어가는 글자 수 제한. 신청서 한 장에 7일이 모두 들어가도록 표의 줄 수를 기준으로 잡았다. */
export const HALF_DAY_LIMITS = {
  purpose: 20,
  place: 22,
  content: 44,
  reportPlace: 40,
  reportPurpose: 60,
  reportContent: 500,
  reportFeeling: 400,
  reportAttachment: 200,
  /** 보고서 한 장의 첨부자료 칸에 들어가는 사진 수. */
  reportPhotos: 4,
} as const;

export type FieldTripInfo = {
  /** 개요 표의 체험 목적 */
  purpose: string;
  place: string;
  /** 개요 표의 시간 */
  time: string;
  meeting: string;
  /** 개요 표와 세부 안내가 다르게 적힌 집결지 */
  meetingNote?: string;
  content: string;
  transport: string[];
  supplies: string;
  schedule: { time: string; what: string }[];
};

export type HalfDayDay =
  | { date: string; kind: 'personal' }
  | { date: string; kind: 'field-trip'; label: string; info: FieldTripInfo }
  | { date: string; kind: 'short-class'; label: string }
  | { date: string; kind: 'recess'; label: string }
  | { date: string; kind: 'career'; label: string };

const FIELD_TRIP_LABEL = '교외 현장 체험 학습';
const COMMON_SUPPLIES = '대중교통비, 물, 개인 복용약 등';
const ATTENDANCE = '출석 확인 및 안전교육';
const DISMISSAL = '학급 종례, 안전 지도 및 귀가 안내';

export const HALF_DAY_SCHEDULE: readonly HalfDayDay[] = [
  { date: '2026-11-20', kind: 'personal' },
  { date: '2026-11-23', kind: 'personal' },
  {
    date: '2026-11-24',
    kind: 'field-trip',
    label: FIELD_TRIP_LABEL,
    info: {
      purpose: '역사교육활동',
      place: '전쟁기념관',
      time: '9:00~12:00',
      meeting: '전쟁기념관 평화광장 (09:30까지 집합)',
      content: '전쟁사 관련 전시 및 무기·장비 관람',
      transport: [
        '개별 이동(버스 및 지하철 이용)',
        '지하철 4호선·6호선 삼각지역 하차 후 12번 출구 이용',
        '지하철 1호선 남영역 하차 후 도보 이동',
        '버스 이용 시 [전쟁기념관], [삼각지역] 정류장 하차 후 도보 이동',
      ],
      supplies: COMMON_SUPPLIES,
      schedule: [
        { time: '09:00 ~ 10:00', what: ATTENDANCE },
        { time: '10:00 ~ 11:30', what: '전쟁기념관 관람' },
        { time: '11:30 ~ 12:00', what: DISMISSAL },
      ],
    },
  },
  { date: '2026-11-25', kind: 'short-class', label: '단축수업(6교시)' },
  { date: '2026-11-26', kind: 'recess', label: '재량휴업일' },
  { date: '2026-11-27', kind: 'personal' },
  { date: '2026-11-30', kind: 'personal' },
  {
    date: '2026-12-01',
    kind: 'field-trip',
    label: FIELD_TRIP_LABEL,
    info: {
      purpose: '문화예술활동',
      place: '롯데월드',
      time: '9:00~14:30',
      meeting: '잠실역광장 트레비분수 앞 (09:30까지 집합) — 잠실역 3, 4번 출구 나가기 직전 지하 1층',
      meetingNote: '개요 표에는 집결지가 "잠실 롯데월드 연간 이용 센터 앞"으로 적혀 있어요. 학교에 한 번 더 확인하세요.',
      content: '롯데월드 놀이기구 이용, 공연 및 퍼레이드 참가, 민속박물관 관람',
      transport: [
        '개별 이동(버스 및 지하철 이용)',
        '2호선, 8호선 잠실역 하차 - 3, 4번 출구 나가기 직전 지하 1층 잠실역광장의 트레비분수 앞까지 걷기',
      ],
      supplies: '대중교통비, 물, 개인 복용약, 점심 도시락(매식 시 현금 준비) 등',
      schedule: [
        { time: '09:00 ~ 09:50', what: ATTENDANCE },
        { time: '09:50 ~ 10:00', what: '롯데월드 이동' },
        { time: '10:00 ~ 11:30', what: '놀이기구 이용, 공연 및 퍼레이드 참가, 민속박물관 관람' },
        { time: '11:30 ~ 12:30', what: '점심식사' },
        { time: '12:30 ~ 14:30', what: '놀이기구 이용, 공연 및 퍼레이드 참가, 민속박물관 관람' },
        { time: '14:30 ~', what: DISMISSAL },
      ],
    },
  },
  { date: '2026-12-02', kind: 'personal' },
  {
    date: '2026-12-03',
    kind: 'field-trip',
    label: FIELD_TRIP_LABEL,
    info: {
      purpose: '문화예술활동',
      place: '롯데시네마 용산점',
      time: '9:00~12:00',
      meeting: '용산 전자랜드 매표소 앞(4층) (09:30까지 집합)',
      content: '영화 관람을 통한 문화예술 체험 및 여가활동',
      transport: [
        '개별 이동(버스 및 지하철 이용)',
        '지하철 1호선·경의중앙선 용산역 하차, 3번 출구 이용 후 용산전자상가 방향으로 도보 이동',
        '버스 이용 시 [용산전자상가·전자랜드] 정류장 하차 후 도보 이동',
      ],
      supplies: COMMON_SUPPLIES,
      schedule: [
        { time: '09:00 ~ 09:50', what: ATTENDANCE },
        { time: '10:00 ~ 11:30', what: '영화 관람' },
        { time: '11:30 ~ 12:00', what: DISMISSAL },
      ],
    },
  },
  { date: '2026-12-04', kind: 'personal' },
  { date: '2026-12-07', kind: 'personal' },
  {
    date: '2026-12-08',
    kind: 'field-trip',
    label: FIELD_TRIP_LABEL,
    info: {
      purpose: '진로진학활동',
      place: '용산구청(명사특강)',
      time: '9:00~12:00',
      meeting: '용산구청 내 용산아트홀 지하 1층 <문화셔틀버스 대기장소> 앞 (09:00까지 집합)',
      content: '명사 오현호 특강 (열아홉, 새로운 페이지를 열다)',
      transport: [
        '개별 이동(버스 및 지하철 이용)',
        '지하철 6호선 녹사평역(용산구청) 하차, 3번 출구 이용 용산구청 방향 도보 이동',
        '버스 이용 시 [용산구청·이태원시장] 정류장 하차 후 도보 이동',
      ],
      supplies: COMMON_SUPPLIES,
      schedule: [
        { time: '09:00 ~ 09:30', what: ATTENDANCE },
        { time: '09:30 ~ 11:00', what: '명사 특강' },
        { time: '11:00 ~ 11:30', what: '체험부스 참여' },
        { time: '11:30 ~ 12:00', what: DISMISSAL },
      ],
    },
  },
  { date: '2026-12-09', kind: 'career', label: '진로(전일 3교시)' },
  { date: '2026-12-10', kind: 'career', label: '진로(전일 3교시)' },
  { date: '2026-12-11', kind: 'career', label: '진로(전일 3교시)' },
];

/** 학생이 직접 신청하는 날. 신청서에서 체험 목적·장소·내용을 채우는 7일. */
export const PERSONAL_DATES: readonly string[] = HALF_DAY_SCHEDULE.flatMap((day) =>
  day.kind === 'personal' ? [day.date] : []
);

// ---------- 날짜 ----------

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function parseDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const weekdayOf = (iso: string): string => WEEKDAYS[parseDate(iso).getDay()];

/** 신청서 표의 날짜 칸. 예: 11/20(금) */
export function formatTableDate(iso: string): string {
  const date = parseDate(iso);
  return `${date.getMonth() + 1}/${date.getDate()}(${weekdayOf(iso)})`;
}

/** 안내문 문구용. 예: 11월 20일(금) */
export function formatKoreanDate(iso: string): string {
  const date = parseDate(iso);
  return `${date.getMonth() + 1}월 ${date.getDate()}일(${weekdayOf(iso)})`;
}

const RECESS_DATES = new Set(HALF_DAY_SCHEDULE.flatMap((day) => (day.kind === 'recess' ? [day.date] : [])));

/** 그 날이 속한 주의 월요일. */
export function weekStartOf(iso: string): string {
  const date = parseDate(iso);
  return shiftDays(iso, -((date.getDay() + 6) % 7));
}

/** 수업일: 토·일요일과 휴업일(재량휴업일)을 뺀 날. 공휴일은 이 기간에 없다. */
export function isSchoolDay(iso: string): boolean {
  const weekday = parseDate(iso).getDay();
  return weekday !== 0 && weekday !== 6 && !RECESS_DATES.has(iso);
}

function shiftDays(iso: string, days: number): string {
  const date = parseDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** 신청서 제출 마감: 실시일로부터 수업일 기준 2일 전. */
export function applicationDeadline(iso: string): string {
  let cursor = iso;
  let remaining = APPLICATION_LEAD_SCHOOL_DAYS;
  while (remaining > 0) {
    cursor = shiftDays(cursor, -1);
    if (isSchoolDay(cursor)) remaining -= 1;
  }
  return cursor;
}

/** 보고서 제출 마감: 실시 후 7일 이내. */
export function reportDeadline(iso: string): string {
  return shiftDays(iso, REPORT_DUE_DAYS);
}

/** 두 ISO 날짜 사이의 일수(b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

// ---------- 사용자 입력 ----------

export type HalfDayEntry = {
  applied: boolean;
  purpose: string;
  place: string;
  content: string;
};

/**
 * 첨부 사진의 참조. 사진 데이터는 용량 때문에 localStorage 가 아니라 IndexedDB(photo-store)에 두고,
 * 초안에는 어떤 사진이 있는지만 남긴다.
 */
export type PhotoRef = { id: string; name: string; width: number; height: number };

/** place 와 purpose 는 신청서 내용을 기본값으로 쓰고, 고쳤을 때만 값이 생긴다. */
export type HalfDayReport = {
  place?: string;
  purpose?: string;
  content: string;
  feeling: string;
  attachmentNote: string;
  photos?: PhotoRef[];
};

export type HalfDayStep = 'people' | 'plan' | 'review' | 'reports';

export const HALF_DAY_STEPS: { key: HalfDayStep; label: string }[] = [
  { key: 'people', label: '인적사항' },
  { key: 'plan', label: '날짜별 신청' },
  { key: 'review', label: '검토·주의사항' },
  { key: 'reports', label: '보고서' },
];

export type HalfDayData = {
  step: HalfDayStep;
  entries: Record<string, HalfDayEntry>;
  reports: Record<string, HalfDayReport>;
  /** 6쪽 안전교육(주의사항)을 읽고 "확인했어요"를 눌렀는지. */
  safetyAcknowledged: boolean;
};

export function createEmptyHalfDay(): HalfDayData {
  return { step: 'people', entries: {}, reports: {}, safetyAcknowledged: false };
}

export const emptyEntry = (): HalfDayEntry => ({ applied: false, purpose: '', place: '', content: '' });
export const emptyReport = (): HalfDayReport => ({ content: '', feeling: '', attachmentNote: '' });

export function getEntry(data: HalfDayData, date: string): HalfDayEntry {
  return data.entries[date] ?? emptyEntry();
}

export function getReport(data: HalfDayData, date: string): HalfDayReport {
  return data.reports[date] ?? emptyReport();
}

/** 보고서의 장소·목적: 직접 고친 값이 있으면 그것, 없으면 신청서 내용. */
export function reportPlace(data: HalfDayData, date: string): string {
  return getReport(data, date).place ?? getEntry(data, date).place;
}

export function reportPurpose(data: HalfDayData, date: string): string {
  return getReport(data, date).purpose ?? getEntry(data, date).purpose;
}

const filled = (text: string) => text.trim() !== '';

export function isEntryComplete(entry: HalfDayEntry): boolean {
  return entry.applied && filled(entry.purpose) && filled(entry.place) && filled(entry.content);
}

/** 신청한 날짜(신청 체크가 켜진 날), 날짜순. */
export function appliedDates(data: HalfDayData): string[] {
  return PERSONAL_DATES.filter((date) => data.entries[date]?.applied === true);
}

export function isReportComplete(data: HalfDayData, date: string): boolean {
  const report = getReport(data, date);
  return filled(reportPlace(data, date)) && filled(reportPurpose(data, date)) && filled(report.content) && filled(report.feeling);
}

export type PlanIssue = { date: string; missing: ('purpose' | 'place' | 'content')[] };

/** 신청했는데 비어 있는 칸. */
export function planIssues(data: HalfDayData): PlanIssue[] {
  return appliedDates(data).flatMap((date) => {
    const entry = getEntry(data, date);
    const missing = (['purpose', 'place', 'content'] as const).filter((field) => !filled(entry[field]));
    return missing.length > 0 ? [{ date, missing }] : [];
  });
}

export const isPlanReady = (data: HalfDayData): boolean => appliedDates(data).length > 0 && planIssues(data).length === 0;

export type HalfDayStepStatus = Record<HalfDayStep, boolean>;

export function halfDayStepStatus(data: HalfDayData, studentCount: number): HalfDayStepStatus {
  const dates = appliedDates(data);
  return {
    people: studentCount > 0,
    plan: isPlanReady(data),
    review: isPlanReady(data) && data.safetyAcknowledged,
    reports: dates.length > 0 && dates.every((date) => isReportComplete(data, date)),
  };
}

// ---------- 에이전트 변경 반영 ----------

export type PlanPatchInput = {
  entries: { date: string; applied?: boolean; purpose?: string; place?: string; content?: string }[];
  step?: HalfDayStep;
};

export type ReportPatchInput = {
  reports: { date: string; place?: string; purpose?: string; content?: string; feeling?: string; attachmentNote?: string }[];
  step?: HalfDayStep;
};

const isPersonalDate = (date: string) => PERSONAL_DATES.includes(date);

/**
 * 날짜별 신청 변경을 반영한다. 학교가 정한 날은 도구 스키마가 이미 막지만, 저장된 대화를 되살렸을 때를 대비해
 * 여기서도 한 번 더 거른다. 칸을 채우면서 신청 여부를 빠뜨렸다면 신청한 것으로 본다.
 */
export function applyPlanPatch(data: HalfDayData, patch: PlanPatchInput): HalfDayData {
  const entries = { ...data.entries };

  for (const item of patch.entries) {
    if (!isPersonalDate(item.date)) continue;
    const current = getEntry({ ...data, entries }, item.date);
    const next: HalfDayEntry = {
      applied: item.applied ?? current.applied,
      purpose: item.purpose ?? current.purpose,
      place: item.place ?? current.place,
      content: item.content ?? current.content,
    };
    const wroteSomething = item.purpose !== undefined || item.place !== undefined || item.content !== undefined;
    entries[item.date] = item.applied === undefined && wroteSomething ? { ...next, applied: true } : next;
  }

  return { ...data, entries, step: patch.step ?? data.step };
}

/** 날짜별 보고서 변경을 반영한다. 신청하지 않은 날의 보고서는 만들지 않는다. */
export function applyReportPatch(data: HalfDayData, patch: ReportPatchInput): HalfDayData {
  const reports = { ...data.reports };

  for (const item of patch.reports) {
    if (!isPersonalDate(item.date) || data.entries[item.date]?.applied !== true) continue;
    const current = getReport({ ...data, reports }, item.date);
    reports[item.date] = {
      ...current,
      ...(item.place === undefined ? {} : { place: item.place }),
      ...(item.purpose === undefined ? {} : { purpose: item.purpose }),
      ...(item.content === undefined ? {} : { content: item.content }),
      ...(item.feeling === undefined ? {} : { feeling: item.feeling }),
      ...(item.attachmentNote === undefined ? {} : { attachmentNote: item.attachmentNote }),
    };
  }

  return { ...data, reports, step: patch.step ?? data.step };
}

// ---------- 인적사항 ----------

export function parseClassInfo(classInfo: string): { grade: string; classNo: string; number: string } {
  const match = classInfo.match(/(\d+)학년\s*(\d+)반\s*(\d+)번/);
  return { grade: match?.[1] ?? '', classNo: match?.[2] ?? '', number: match?.[3] ?? '' };
}

// ---------- 시간 ----------

/** 신청서 한 줄 안내. 예: "11/18(수)까지 제출" */
export function describeApplicationDeadline(date: string): string {
  return `${formatTableDate(applicationDeadline(date))}까지 제출`;
}

export function describeReportDeadline(date: string): string {
  return `${formatTableDate(reportDeadline(date))}까지 제출`;
}

export type DeadlineTone = 'ok' | 'soon' | 'late';

/** 마감까지 남은 일수로 상태를 정한다. today 는 호출하는 쪽이 정해 준다(순수성 유지). */
export function deadlineTone(deadline: string, today: string): { tone: DeadlineTone; days: number } {
  const days = daysBetween(today, deadline);
  return { tone: days < 0 ? 'late' : days <= 2 ? 'soon' : 'ok', days };
}
