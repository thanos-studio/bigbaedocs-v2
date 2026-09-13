export type Student = { id: string; name: string; classInfo: string };

export type TripStatus = 'in-progress' | 'done' | 'none';

export type Trip = {
  id: string;
  name: string;
  dateRange: string;
  student: string;
  classInfo: string;
  applicationStatus: TripStatus;
  reportStatus: TripStatus;
  reportProgress?: string;
  reportPercent?: number;
  lastEdited: string;
};

/** 신청서 작성 단계. 순서대로 진행된다. */
export type ApplicationStep = 'people' | 'place' | 'schedule' | 'plan' | 'review';

export const APPLICATION_STEPS: { key: ApplicationStep; label: string }[] = [
  { key: 'people', label: '인적사항' },
  { key: 'place', label: '장소' },
  { key: 'schedule', label: '기간' },
  { key: 'plan', label: '체험 계획' },
  { key: 'review', label: '검토' },
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

export const GUARDIAN_RELATIONS = ['부', '모', '조부', '조모', '기타'] as const;

export type ChatRole = 'user' | 'agent' | 'system';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  reasoning?: string[];
  reasoningRaw?: boolean;
  thinkingSeconds?: number;
  toolCalls?: ToolCall[];
};

/** 에이전트가 신청서 폼에 대해 실제로 수행한 동작. 채팅 말풍선 위에 표시된다. */
export type ToolCall = {
  id: string;
  kind: 'tool' | 'skill';
  name: string;
  detail?: string;
  status: 'running' | 'done' | 'error';
  target?: string;
};

export const AGENT_NAME = '빅배';

export type AgentModelId = 'balanced' | 'fast' | 'thorough';

export const AGENT_MODELS: {
  id: AgentModelId;
  label: string;
  description: string;
}[] = [
  { id: 'balanced', label: '기본', description: '속도와 품질의 균형' },
  { id: 'fast', label: '빠르게', description: '간단한 문장 정리에 적합' },
  { id: 'thorough', label: '꼼꼼히', description: '긴 글을 정성껏 작성' },
];

export const DEFAULT_MODEL_ID: AgentModelId = 'balanced';

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
  guardianRelation: string;
  guardianPhone: string;
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

export function formatDateRange(startDate: string, endDate: string): string {
  const days = countDays(startDate, endDate);
  if (days === 0) return '';
  if (startDate === endDate) return `${formatDateNatural(startDate)} (1일)`;
  return `${formatDateNatural(startDate)} ~ ${formatDateNatural(endDate)} (${days}일)`;
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
    guardianRelation: '',
    guardianPhone: '',
    messages: [],
    modelId: DEFAULT_MODEL_ID,
    createdAt: now,
    updatedAt: now,
  };
}
