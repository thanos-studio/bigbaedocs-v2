export type Student = { id: string; name: string; classInfo: string };

export type TripStatus = 'in-progress' | 'done' | 'none';

export type Trip = {
  id: string;
  name: string;
  dateRange: string;
  student: string;
  applicationStatus: TripStatus;
  reportStatus: TripStatus;
  reportProgress?: string;
  reportPercent?: number;
  lastEdited: string;
};

/** 신청서 작성 단계. 순서대로 진행된다. */
export type ApplicationStep = 'people' | 'place' | 'schedule' | 'plan' | 'review' | 'document';

export const APPLICATION_STEPS: { key: ApplicationStep; label: string }[] = [
  { key: 'people', label: '인적사항' },
  { key: 'place', label: '장소' },
  { key: 'schedule', label: '기간' },
  { key: 'plan', label: '체험 계획' },
  { key: 'review', label: '검토' },
  { key: 'document', label: '문서' },
];

export type AttachmentPhotoData = {
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  name: string;
};

/** 보고서 작성 단계. 인적사항·장소·기간은 신청서 값을 그대로 쓰므로 확인만 한다. */
export type ReportStep = 'confirm' | 'experience' | 'reflection' | 'review' | 'document';

export const REPORT_STEPS: { key: ReportStep; label: string }[] = [
  { key: 'confirm', label: '다녀온 내용' },
  { key: 'experience', label: '체험내용' },
  { key: 'reflection', label: '느낀 점' },
  { key: 'review', label: '검토' },
  { key: 'document', label: '문서' },
];

export type PlaceRegion = 'domestic' | 'overseas';

export type PlaceSuggestion = {
  name: string;
  category: string;
  address: string;
};

export const LEARNING_TYPES = [
  '가족동반 여행',
  '친인척 방문',
  '견학·체험 활동',
  '문화·예술 활동',
  '봉사 활동',
  '진로 체험',
] as const;

export type ChatRole = 'user' | 'agent' | 'system';

export type ChatAttachment = {
  id: string;
  name: string;
  mediaType: string;
  url: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  reasoning?: string[];
  reasoningRaw?: boolean;
  thinkingSeconds?: number;
  toolCalls?: ToolCall[];
  attachments?: ChatAttachment[];
};

/** 에이전트가 신청서 폼에 대해 실제로 수행한 동작. 채팅 말풍선 위에 표시된다. */
export type PlaceCandidate = { name: string; address: string };

export type ToolCall = {
  id: string;
  kind: 'tool' | 'skill' | 'navigate' | 'question';
  name: string;
  detail?: string;
  status: 'running' | 'done' | 'error';
  target?: string;
  fields?: string[];
  choices?: string[];
  freeText?: boolean;
  placeholder?: string;
  candidates?: PlaceCandidate[];
};

export const AGENT_NAME = '빅배';

export type AgentModelId = string;

export type AgentModel = {
  readonly id: AgentModelId;
  readonly label: string;
  readonly description: string;
};

/** localStorage에 저장되는 신청서 초안 1건. */
export type ApplicationDraft = {
  id: string;
  /** 선택된 학생 id 목록. 여러 명의 신청서를 한 번에 작성할 수 있다. */
  studentIds: string[];
  step: ApplicationStep;
  title: string;
  startDate: string;
  endDate: string;
  learningType: string;
  destination: string;
  placeRegion: PlaceRegion;
  placeAddress: string;
  purpose: string;
  plan: string;
  /** 학생 id별 보호자 이름. 학생마다 보호자가 다르므로 하나로 묶지 않는다. */
  guardianNames: Record<string, string>;
  /** 동행 보호자 정보. 해외 여행일 때만 신청서에 기재한다. */
  companionRelation: string;
  companionPhone: string;
  reportStep: ReportStep;
  /** 보고서 체험내용. 신청서 plan과 달리 다녀온 뒤 과거형으로 쓴다. */
  experience: string;
  reflection: string;
  attachmentNote: string;
  attachmentPhoto: AttachmentPhotoData | null;
  reportMessages: ChatMessage[];
  messages: ChatMessage[];
  modelId: AgentModelId;
  createdAt: number;
  updatedAt: number;
};

/** 시작일과 종료일을 포함한 일수. 형식이 올바르지 않으면 0. */
export function countDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = end.getTime() - start.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / 86_400_000) + 1;
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return '방금';

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

export function toTrip(draft: ApplicationDraft, students: Student[]): Trip {
  const picked = draft.studentIds
    .map((id) => students.find((student) => student.id === id))
    .filter((student): student is Student => student !== undefined);
  const first = picked[0];
  const extra = picked.length > 1 ? ` 외 ${picked.length - 1}명` : '';
  const done = draft.step === 'document';
  const reportFilled = REPORT_STEPS.filter((step) => isReportStepFilled(step.key, draft)).length;
  const reportStatus: TripStatus =
    draft.reportStep === 'document' ? 'done' : reportFilled > 0 ? 'in-progress' : 'none';

  return {
    id: draft.id,
    name: draft.title.trim() !== '' ? draft.title : '제목 없는 신청서',
    dateRange: formatDateRangeShort(draft.startDate, draft.endDate) || '기간 미정',
    student: first ? `${first.name}${extra}` : '학생 미선택',
    applicationStatus: done ? 'done' : 'in-progress',
    reportStatus,
    lastEdited: formatRelativeTime(draft.updatedAt),
  };
}

export function formatDateRange(startDate: string, endDate: string): string {
  const days = countDays(startDate, endDate);
  if (days === 0) return '';
  if (startDate === endDate) return `${formatDateNatural(startDate)} (1일)`;
  return `${formatDateNatural(startDate)} ~ ${formatDateNatural(endDate)} (${days}일)`;
}

/** 카드처럼 좁은 자리에 쓰는 짧은 기간 표기. 연도와 일수를 빼서 한 줄에 들어가게 한다. */
export function formatDateRangeShort(startDate: string, endDate: string): string {
  if (countDays(startDate, endDate) === 0) return '';

  const short = (date: string) => {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return `${parsed.getMonth() + 1}월 ${parsed.getDate()}일`;
  };

  return startDate === endDate ? short(startDate) : `${short(startDate)} ~ ${short(endDate)}`;
}

export function formatDateNatural(date: string): string {
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월 ${parsed.getDate()}일`;
}

export function formatDateWithWeekday(date: string): string {
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][parsed.getDay()];
  return `${formatDateNatural(date)} ${weekday}요일`;
}

export function isStepFilled(step: ApplicationStep, draft: ApplicationDraft): boolean {
  switch (step) {
    case 'people':
      return draft.studentIds.length > 0;
    case 'place':
      return draft.destination.trim() !== '';
    case 'schedule':
      return formatDateRange(draft.startDate, draft.endDate) !== '';
    case 'plan':
      return draft.purpose.trim() !== '' && draft.plan.trim() !== '';
    case 'review':
      // 필수 항목이 모두 채워지면 검토를 끝낸 것으로 본다.
      return (
        draft.studentIds.length > 0 &&
        draft.destination.trim() !== '' &&
        formatDateRange(draft.startDate, draft.endDate) !== '' &&
        draft.purpose.trim() !== '' &&
        draft.plan.trim() !== '' &&
        draft.studentIds.every((id) => (draft.guardianNames[id] ?? '').trim() !== '')
      );
    case 'document':
      return false;
  }
}

export function isReportStepFilled(step: ReportStep, draft: ApplicationDraft): boolean {
  switch (step) {
    case 'confirm':
      return draft.studentIds.length > 0 && draft.destination.trim() !== '';
    case 'experience':
      return draft.experience.trim() !== '';
    case 'reflection':
      return draft.reflection.trim() !== '';
    case 'review':
      return (
        draft.studentIds.length > 0 &&
        draft.destination.trim() !== '' &&
        formatDateRange(draft.startDate, draft.endDate) !== '' &&
        draft.experience.trim() !== '' &&
        draft.reflection.trim() !== ''
      );
    case 'document':
      return false;
  }
}

export function createEmptyDraft(id: string): ApplicationDraft {
  const now = Date.now();
  return {
    id,
    studentIds: [],
    step: 'people',
    title: '',
    startDate: '',
    endDate: '',
    learningType: '',
    destination: '',
    placeRegion: 'domestic',
    placeAddress: '',
    purpose: '',
    plan: '',
    guardianNames: {},
    companionRelation: '',
    companionPhone: '',
    reportStep: 'confirm',
    experience: '',
    reflection: '',
    attachmentNote: '',
    attachmentPhoto: null,
    reportMessages: [],
    messages: [],
    modelId: '',
    createdAt: now,
    updatedAt: now,
  };
}
