'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Stack, Group, Paper, Text, TextInput, Textarea, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconCheck,
  IconUsers,
  IconPencil,
  IconLoader2,
  IconPlus,
  IconMapPin,
  IconCalendarEvent,
  IconNotes,
  IconFileText,
  IconAlertCircle,
  IconWorld,
  IconSparkles,
  IconSearch,
} from '@tabler/icons-react';
import { useStudents, useApplicationDraft, createId } from '@/lib/storage';
import StudentModal from './StudentModal';
import {
  APPLICATION_STEPS,
  AGENT_MODELS,
  DEFAULT_MODEL_ID,
  GUARDIAN_RELATIONS,
  countDays,
  formatDateRange,
  formatDateWithWeekday,
  type AgentModelId,
  type ApplicationDraft,
  type ApplicationStep,
  type ChatMessage,
  type PlaceRegion,
  type PlaceSuggestion,
  type Student,
  type ToolCall,
} from '@/lib/types';
import { searchPlaces } from '@/lib/places';
import { parseDateExpression } from '@/lib/parse-date';
import {
  PAGE_BG,
  TEXT,
  SUB,
  BORDER,
  BORDER_SOFT,
  DANGER,
  SURFACE_SOFT,
  ACCENT,
  DARK,
  DONE_COLOR,
  CARD_RADIUS,
  CARD_SHADOW,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_DISABLED,
  INPUT_STYLES,
  LABEL_COLOR,
  TOOLTIP_PROPS,
} from '@/lib/theme';
import AgentSidebar from './AgentSidebar';

const TITLE_PLACEHOLDER = '제목 없는 신청서';

const REGION_OPTIONS: { id: PlaceRegion; label: string; icon: typeof IconMapPin }[] = [
  { id: 'domestic', label: '국내', icon: IconMapPin },
  { id: 'overseas', label: '해외', icon: IconWorld },
];

function DraftTitle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEditing = () => {
    setText(value);
    setEditing(true);
  };

  const commit = () => {
    onChange(text.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={text}
        autoFocus
        placeholder={TITLE_PLACEHOLDER}
        aria-label="신청서 제목"
        onChange={(e) => setText(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') {
            setText(value);
            setEditing(false);
          }
        }}
        style={{
          width: '100%',
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: -0.4,
          color: TEXT,
          border: 'none',
          borderBottom: `2px solid ${DARK}`,
          borderRadius: 0,
          outline: 'none',
          background: 'transparent',
          padding: '2px 0',
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      aria-label="신청서 제목 수정"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: '100%',
        background: 'none',
        border: 'none',
        borderBottom: '2px solid transparent',
        cursor: 'text',
        padding: '2px 0',
        textAlign: 'left',
      }}
      className="draft-title"
    >
      <Text
        fw={700}
        style={{
          fontSize: 24,
          letterSpacing: -0.4,
          color: value.trim() === '' ? '#9aa3af' : TEXT,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value.trim() === '' ? TITLE_PLACEHOLDER : value}
      </Text>
      <IconPencil size={15} color={SUB} style={{ flexShrink: 0 }} />
    </button>
  );
}

function StepHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof IconUsers;
  title: string;
  description: string;
}) {
  return (
    <Group gap="sm" wrap="nowrap" mb={20}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: SURFACE_SOFT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={18} color="#555e6b" />
      </div>
      <div>
        <Text fw={700} style={{ fontSize: 15, color: TEXT }}>
          {title}
        </Text>
        <Text style={{ fontSize: 14, color: SUB, marginTop: 2 }}>{description}</Text>
      </div>
    </Group>
  );
}

function StepProgress({
  step,
  onSelect,
}: {
  step: ApplicationStep;
  onSelect: (step: ApplicationStep) => void;
}) {
  const currentIndex = APPLICATION_STEPS.findIndex((s) => s.key === step);
  return (
    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflowX: 'auto' }} className="agent-scroll">
      {APPLICATION_STEPS.map((s, index) => {
        const isCurrent = index === currentIndex;
        const isDone = index < currentIndex;
        const isClickable = index <= currentIndex;
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: index === APPLICATION_STEPS.length - 1 ? '0 0 auto' : 1 }}>
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => onSelect(s.key)}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`${s.label} 단계로 이동`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: isClickable ? 'pointer' : 'default',
                opacity: 1,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  flexShrink: 0,
                  backgroundColor: isCurrent ? DARK : isDone ? DONE_COLOR : SURFACE_SOFT,
                  color: isCurrent || isDone ? 'white' : SUB,
                }}
              >
                {isDone ? <IconCheck size={13} color="white" stroke={3} /> : index + 1}
              </div>
              <Text
                style={{
                  fontSize: 14,
                  color: isCurrent ? TEXT : SUB,
                  fontWeight: isCurrent ? 600 : 400,
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </Text>
            </button>
            {index < APPLICATION_STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, backgroundColor: BORDER, margin: '0 12px' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const AGENT_REPLIES_WITH_STUDENTS = [
  '네, 선택하신 학생 정보를 바탕으로 도와드릴게요. 다음 단계인 기간과 유형을 먼저 정해볼까요?',
  '좋아요. 체험 목적을 한두 문장으로 정리해드릴게요. 어디로, 며칠간 다녀오시나요?',
];

const AGENT_REPLY_NO_STUDENTS =
  '먼저 신청서를 작성할 학생을 선택해 주세요. 학생을 고르면 이어서 도와드릴게요.';

function buildReasoningSteps(draft: ApplicationDraft, modelId: AgentModelId): string[] {
  const stepLabel =
    APPLICATION_STEPS.find((s) => s.key === draft.step)?.label ?? '신청서';

  if (modelId === 'fast') {
    const raw = [
      `사용자가 '${stepLabel}' 단계에 있다. 화면 맥락부터 확인하자.`,
      draft.destination !== ''
        ? `장소는 ${draft.destination}. 견학·관람 계열 표현이 자연스럽다.`
        : '장소가 아직 비어 있다. 장소를 전제로 한 문장은 피해야 한다.',
      draft.startDate !== '' && draft.endDate !== ''
        ? `기간은 ${draft.startDate} ~ ${draft.endDate}. 일자 수에 맞춰 활동을 배분해야 분량이 맞는다.`
        : '기간이 없다. 일정 분량은 단정하지 말고 열어두자.',
      draft.studentIds.length > 1
        ? `학생이 ${draft.studentIds.length}명이다. 주어를 복수로 쓰고 개별 이름 반복은 줄이자.`
        : '학생 1명 기준이라 단수 주어로 간다.',
      '학교 제출 문서라 구어체와 감탄은 걷어내고, 목적-활동-기대효과 순서로 정리한다.',
      '초안을 한 번 더 읽고 중복 표현을 정리한 뒤 답하자.',
    ];
    return raw;
  }

  const steps = [`'${stepLabel}' 단계 맥락을 확인했어요.`];
  if (draft.destination !== '') {
    steps.push(`장소가 ${draft.destination}이라 관련 표현을 골랐어요.`);
  }
  if (draft.startDate !== '' && draft.endDate !== '') {
    steps.push('입력한 기간에 맞춰 일정 분량을 가늠했어요.');
  }
  if (draft.studentIds.length > 1) {
    steps.push(`학생 ${draft.studentIds.length}명 기준으로 문장을 맞췄어요.`);
  }
  steps.push('학교 제출용 말투로 문장을 다듬었어요.');
  return steps;
}

/** 사용자 문장에 등록된 장소 이름이 들어있으면 해당 PlaceSuggestion을 반환한다. */
function findMentionedPlace(text: string): PlaceSuggestion | null {
  const pools = [...searchPlaces('domestic', '', 100), ...searchPlaces('overseas', '', 100)];
  const found = pools.find((place) => text.includes(place.name));
  return found ?? null;
}

const WORDING_HELP_PATTERN = /다듬|정리해|문장.*(고쳐|손봐)/;

export default function ApplicationEditor({ uuid }: { uuid: string }) {
  const router = useRouter();
  const [students, setStudents] = useStudents();
  const { draft, hydrated, saveState, update } = useApplicationDraft(uuid);
  const [studentModalOpened, { open: openStudentModal, close: closeStudentModal }] =
    useDisclosure(false);
  const [thinking, setThinking] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const [pendingModelNotice, setPendingModelNotice] = useState<ChatMessage | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [dateText, setDateText] = useState('');
  const [dateParseFailed, setDateParseFailed] = useState(false);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearThinkingTimers = () => {
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    stepTimersRef.current.forEach(clearTimeout);
    stepTimersRef.current = [];
  };

  const placeResults = searchPlaces(draft.placeRegion ?? 'domestic', placeQuery);

  const selectPlace = (place: PlaceSuggestion) => {
    update({
      destination: place.name,
      placeAddress: place.address,
    });
    setPlaceQuery('');
  };

  const clearPlace = () => {
    update({ destination: '', placeAddress: '' });
    setPlaceQuery('');
  };

  const handleRegionChange = (region: PlaceRegion) => {
    if (region === draft.placeRegion) return;
    update({ placeRegion: region, destination: '', placeAddress: '' });
    setPlaceQuery('');
  };

  const handleConvertDate = () => {
    const parsed = parseDateExpression(dateText);
    if (!parsed) {
      setDateParseFailed(true);
      return;
    }
    setDateParseFailed(false);
    update({ startDate: parsed.startDate, endDate: parsed.endDate });
    setDateText('');
  };

  useEffect(() => clearThinkingTimers, []);

  const handleAddStudent = (
    name: string,
    grade: string,
    classNum: string,
    studentNum: string
  ) => {
    const created = {
      id: createId(),
      name,
      classInfo: `${grade}학년 ${classNum}반 ${studentNum}번`,
    };
    setStudents((prev) => [...prev, created]);
    update({ studentIds: [...draft.studentIds, created.id] });
  };

  const currentStepIndex = APPLICATION_STEPS.findIndex((s) => s.key === draft.step);
  const isFirstStep = currentStepIndex <= 0;
  const isLastStep = currentStepIndex === APPLICATION_STEPS.length - 1;

  const dateRangeLabel = formatDateRange(draft.startDate, draft.endDate);
  const hasInvalidRange =
    draft.startDate !== '' && draft.endDate !== '' && dateRangeLabel === '';

  const canAdvance =
    draft.step === 'people'
      ? draft.studentIds.length > 0
      : draft.step === 'place'
        ? draft.destination.trim() !== ''
        : draft.step === 'schedule'
          ? dateRangeLabel !== ''
          : true;

  const selectedStudents = draft.studentIds
    .map((id) => students.find((s) => s.id === id))
    .filter((s): s is Student => Boolean(s));

  const reviewRows: { label: string; value: string; step: ApplicationStep }[] = [
    {
      label: '학생',
      value: selectedStudents.map((s) => `${s.name} (${s.classInfo})`).join('\n'),
      step: 'people',
    },
    {
      label: '장소',
      value: [draft.destination, draft.placeAddress]
        .filter((v) => v.trim() !== '')
        .join(' · '),
      step: 'place',
    },
    {
      label: '기간',
      value: dateRangeLabel,
      step: 'schedule',
    },
    {
      label: '유형',
      value: draft.learningType !== '' ? draft.learningType : 'AI가 내용을 보고 판단해요',
      step: 'schedule',
    },
    { label: '체험 목적', value: draft.purpose.trim(), step: 'plan' },
    { label: '활동 계획', value: draft.plan.trim(), step: 'plan' },
    {
      label: '보호자',
      value: [draft.guardianRelation, draft.guardianPhone]
        .filter((v) => v.trim() !== '')
        .join(' · '),
      step: 'plan',
    },
  ];

  const missingRequired = [
    selectedStudents.length === 0 ? '학생' : null,
    draft.destination.trim() === '' ? '장소' : null,
    dateRangeLabel === '' ? '기간' : null,
    draft.purpose.trim() === '' ? '체험 목적' : null,
    draft.plan.trim() === '' ? '활동 계획' : null,
  ].filter((v): v is string => v !== null);

  const toggleStudent = (id: string) => {
    const next = draft.studentIds.includes(id)
      ? draft.studentIds.filter((existing) => existing !== id)
      : [...draft.studentIds, id];
    update({ studentIds: next });
  };

  const goToStep = (step: ApplicationStep) => {
    update({ step });
  };

  const handlePrev = () => {
    if (isFirstStep) return;
    update({ step: APPLICATION_STEPS[currentStepIndex - 1].key });
  };

  const handleNext = () => {
    if (isLastStep || !canAdvance) return;
    update({ step: APPLICATION_STEPS[currentStepIndex + 1].key });
  };

  const handleSend = (text: string) => {
    if (thinking) return;

    const startedAt = Date.now();
    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: text,
      createdAt: startedAt,
    };

    const pendingNotice = pendingModelNotice;
    const history = [
      ...draft.messages,
      ...(pendingNotice ? [pendingNotice] : []),
      userMessage,
    ];
    setPendingModelNotice(null);

    const toolCalls: ToolCall[] = [];
    const draftPatch: Partial<ApplicationDraft> = { messages: history };

    const parsedDate = parseDateExpression(text);
    if (parsedDate) {
      draftPatch.startDate = parsedDate.startDate;
      draftPatch.endDate = parsedDate.endDate;
      toolCalls.push({
        id: createId(),
        kind: 'tool',
        name: '날짜 인식',
        target: '기간',
        detail: formatDateRange(parsedDate.startDate, parsedDate.endDate),
        status: 'done',
      });
    }

    const mentionedPlace = findMentionedPlace(text);
    if (mentionedPlace) {
      draftPatch.destination = mentionedPlace.name;
      draftPatch.placeAddress = mentionedPlace.address;
      toolCalls.push({
        id: createId(),
        kind: 'tool',
        name: '장소 검색',
        target: '장소',
        detail: mentionedPlace.name,
        status: 'done',
      });
    }

    if (toolCalls.length === 0 && WORDING_HELP_PATTERN.test(text)) {
      toolCalls.push({
        id: createId(),
        kind: 'skill',
        name: '문장 다듬기',
        status: 'done',
      });
    }

    update(draftPatch);

    const activeModelId = draft.modelId ?? DEFAULT_MODEL_ID;
    const isRawThinking = activeModelId === 'fast';
    const steps = buildReasoningSteps(draft, activeModelId);
    setThinking(true);
    setThinkingSteps([]);
    setThinkingElapsed(0);

    elapsedTimerRef.current = setInterval(() => {
      setThinkingElapsed(Math.round((Date.now() - startedAt) / 1000));
    }, 1000);

    const stepInterval = isRawThinking ? 420 : 700;

    steps.forEach((step, index) => {
      const timer = setTimeout(
        () => setThinkingSteps((prev) => [...prev, step]),
        450 + index * stepInterval
      );
      stepTimersRef.current.push(timer);
    });

    const answered = history.filter((m) => m.role === 'agent').length;
    const replyPool =
      draft.studentIds.length > 0 ? AGENT_REPLIES_WITH_STUDENTS : [AGENT_REPLY_NO_STUDENTS];

    replyTimerRef.current = setTimeout(() => {
      const agentMessage: ChatMessage = {
        id: createId(),
        role: 'agent',
        content: replyPool[answered % replyPool.length],
        createdAt: Date.now(),
        reasoning: steps,
        reasoningRaw: isRawThinking,
        thinkingSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
      update({ messages: [...history, agentMessage] });
      clearThinkingTimers();
      setThinking(false);
      setThinkingSteps([]);
    }, 450 + steps.length * stepInterval + 500);
  };

  const handleModelChange = (nextModelId: AgentModelId) => {
    if (nextModelId === draft.modelId) return;

    const label = AGENT_MODELS.find((m) => m.id === nextModelId)?.label ?? nextModelId;
    update({ modelId: nextModelId });
    setPendingModelNotice({
      id: createId(),
      role: 'system',
      content: `모델을 '${label}'로 변경했어요`,
      createdAt: Date.now(),
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: PAGE_BG }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 18 }}>
        <Text
          fw={800}
          style={{ fontSize: 19, letterSpacing: -0.4, color: TEXT, lineHeight: 1.2 }}
        >
          BigBaeDocs
        </Text>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 40,
          maxWidth: 1280,
          margin: '0 auto',
          padding: '22px 28px 64px',
        }}
      >
        <div style={{ flex: '1 1 auto', width: '100%', maxWidth: 720, minWidth: 0, paddingRight: 4 }}>
          <Stack gap={0} px={4}>
              <Group justify="space-between" align="center">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="ghost-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    color: SUB,
                    fontSize: 14,
                    padding: '6px 10px 6px 8px',
                    marginLeft: -8,
                  }}
                >
                  <IconArrowLeft size={16} />
                  나가기
                </button>
                {hydrated && saveState !== 'idle' && (
                  <Tooltip
                    label="서버에 저장되지 않고 브라우저에만 저장됩니다"
                    {...TOOLTIP_PROPS}
                    position="top-end"
                  >
                    <Group gap={5} style={{ cursor: 'default' }}>
                      {saveState === 'saving' ? (
                        <>
                          <IconLoader2 size={14} color={SUB} className="spin" />
                          <Text style={{ fontSize: 13, color: SUB }}>저장 중…</Text>
                        </>
                      ) : (
                        <>
                          <IconCheck size={14} color={DONE_COLOR} stroke={3} />
                          <Text style={{ fontSize: 13, color: SUB }}>저장됨</Text>
                        </>
                      )}
                    </Group>
                  </Tooltip>
                )}
              </Group>

              <div style={{ marginTop: 18 }}>
                <DraftTitle value={draft.title} onChange={(title) => update({ title })} />
              </div>

              <div style={{ marginTop: 28 }}>
                <StepProgress step={draft.step} onSelect={goToStep} />
              </div>

              <div style={{ marginTop: 24 }} key={draft.step} className="step-panel">
              {draft.step === 'people' ? (
                <Paper withBorder radius={CARD_RADIUS} p={24} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
                  <Group justify="space-between" align="flex-start" wrap="nowrap" gap={20} mb={20}>
                    <Group gap="sm" wrap="nowrap">
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: SURFACE_SOFT,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconUsers size={18} color="#555e6b" />
                      </div>
                      <div>
                        <Text fw={700} style={{ fontSize: 15, color: TEXT }}>
                          인적사항
                        </Text>
                        <Text style={{ fontSize: 14, color: SUB, marginTop: 2 }}>
                          신청서를 작성할 학생을 선택하세요. 여러 명을 함께 고를 수 있어요.
                        </Text>
                      </div>
                    </Group>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: draft.studentIds.length > 0 ? ACCENT : SUB,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        marginTop: 9,
                      }}
                    >
                      {draft.studentIds.length}명 선택
                    </Text>
                  </Group>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {students.map((s) => {
                      const isPicked = draft.studentIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className="pick-chip"
                          data-picked={isPicked}
                          aria-pressed={isPicked}
                          onClick={() => toggleStudent(s.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            borderRadius: 20,
                            padding: '7px 14px',
                          }}
                        >
                          <Text fw={600} style={{ fontSize: 14, color: isPicked ? 'white' : TEXT }}>
                            {s.name}
                          </Text>
                          <Text style={{ fontSize: 14, color: isPicked ? 'rgba(255,255,255,0.72)' : SUB }}>
                            {s.classInfo}
                          </Text>
                          {isPicked && <IconCheck size={14} color="white" />}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={openStudentModal}
                      className="suggest-chip"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        border: '1px dashed #cbd5e1',
                        borderRadius: 20,
                        padding: '7px 16px',
                        backgroundColor: 'transparent',
                        fontSize: 14,
                        fontWeight: 500,
                        color: SUB,
                      }}
                    >
                      <IconPlus size={14} />
                      학생 추가
                    </button>
                  </div>
                </Paper>
              ) : draft.step === 'place' ? (
                <Paper withBorder radius={CARD_RADIUS} p={24} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
                  <StepHeader
                    icon={IconMapPin}
                    title="체험 장소"
                    description="국내·해외를 고르고 장소를 검색해 선택하세요."
                  />

                  <Stack gap={18}>
                    <div>
                      <Text style={{ fontSize: 14, fontWeight: 500, color: LABEL_COLOR, marginBottom: 8 }}>
                        지역 구분
                      </Text>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {REGION_OPTIONS.map((option) => {
                          const isPicked = draft.placeRegion === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className="pick-chip"
                              data-picked={isPicked}
                              aria-pressed={isPicked}
                              onClick={() => handleRegionChange(option.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 7,
                                borderRadius: 20,
                                padding: '8px 16px',
                                fontSize: 14,
                                fontWeight: 500,
                                color: isPicked ? 'white' : LABEL_COLOR,
                              }}
                            >
                              <option.icon size={15} color={isPicked ? 'white' : SUB} />
                              {option.label}
                              {isPicked && <IconCheck size={13} color="white" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {draft.destination !== '' ? (
                      <div>
                        <Text style={{ fontSize: 14, fontWeight: 500, color: LABEL_COLOR, marginBottom: 8 }}>
                          선택한 장소
                        </Text>
                        <Group
                          justify="space-between"
                          wrap="nowrap"
                          gap={12}
                          style={{
                            border: `1px solid ${DARK}`,
                            borderRadius: 12,
                            padding: '13px 14px',
                            backgroundColor: SURFACE_SOFT,
                          }}
                        >
                          <Group gap={10} wrap="nowrap">
                            <IconMapPin size={17} color={DARK} style={{ flexShrink: 0 }} />
                            <div>
                              <Text fw={600} style={{ fontSize: 14, color: TEXT }}>
                                {draft.destination}
                              </Text>
                              {draft.placeAddress !== '' && (
                                <Text style={{ fontSize: 13, color: SUB, marginTop: 1 }}>
                                  {draft.placeAddress}
                                </Text>
                              )}
                            </div>
                          </Group>
                          <button
                            type="button"
                            onClick={clearPlace}
                            className="ghost-btn"
                            aria-label="선택한 장소 지우기"
                            style={{
                              border: 'none',
                              background: 'none',
                              borderRadius: 8,
                              cursor: 'pointer',
                              color: SUB,
                              fontSize: 13,
                              padding: '5px 9px',
                              flexShrink: 0,
                            }}
                          >
                            변경
                          </button>
                        </Group>
                      </div>
                    ) : (
                      <div>
                        <TextInput
                          label="장소 검색"
                          placeholder={
                            draft.placeRegion === 'domestic'
                              ? '국립중앙박물관, 경주, 과학관…'
                              : '도쿄, 싱가포르, 파리…'
                          }
                          value={placeQuery}
                          onChange={(e) => setPlaceQuery(e.currentTarget.value)}
                          radius="md"
                          size="md"
                          styles={INPUT_STYLES}
                          leftSection={<IconSearch size={16} color={SUB} />}
                        />

                        <Stack gap={6} mt={12}>
                          {placeResults.length === 0 ? (
                            <Text style={{ fontSize: 13, color: SUB, padding: '8px 2px' }}>
                              검색 결과가 없어요. 아래에서 직접 입력할 수 있어요.
                            </Text>
                          ) : (
                            placeResults.map((place) => (
                              <button
                                key={`${place.name}-${place.address}`}
                                type="button"
                                onClick={() => selectPlace(place)}
                                className="place-result"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 11,
                                  width: '100%',
                                  textAlign: 'left',
                                  borderRadius: 10,
                                  padding: '10px 12px',
                                  cursor: 'pointer',
                                }}
                              >
                                <IconMapPin size={16} color={SUB} style={{ flexShrink: 0 }} />
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  <Text fw={600} style={{ fontSize: 14, color: TEXT }}>
                                    {place.name}
                                  </Text>
                                  <Text style={{ fontSize: 13, color: SUB, marginTop: 1 }}>
                                    {place.address}
                                  </Text>
                                </span>
                              </button>
                            ))
                          )}

                          {placeQuery.trim() !== '' && (
                            <button
                              type="button"
                              onClick={() =>
                                selectPlace({
                                  name: placeQuery.trim(),
                                  category: '',
                                  address: '',
                                })
                              }
                              className="place-result"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 11,
                                width: '100%',
                                textAlign: 'left',
                                borderRadius: 10,
                                padding: '10px 12px',
                                cursor: 'pointer',
                              }}
                            >
                              <IconPlus size={16} color={SUB} style={{ flexShrink: 0 }} />
                              <Text style={{ fontSize: 14, color: LABEL_COLOR }}>
                                &lsquo;{placeQuery.trim()}&rsquo; 직접 입력
                              </Text>
                            </button>
                          )}
                        </Stack>
                      </div>
                    )}

                    {draft.destination !== '' && (
                      <TextInput
                        label="주소"
                        placeholder="서울 용산구 서빙고로 137"
                        value={draft.placeAddress}
                        onChange={(e) => update({ placeAddress: e.currentTarget.value })}
                        radius="md"
                        size="md"
                        styles={INPUT_STYLES}
                      />
                    )}
                  </Stack>
                </Paper>
              ) : draft.step === 'schedule' ? (
                <Paper withBorder radius={CARD_RADIUS} p={24} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
                  <StepHeader
                    icon={IconCalendarEvent}
                    title="기간"
                    description="언제 다녀오는지 알려주세요. 유형은 빅배가 내용을 보고 판단해요."
                  />

                  <Stack gap={16}>
                    <div>
                      <Text style={{ fontSize: 14, fontWeight: 500, color: LABEL_COLOR, marginBottom: 8 }}>
                        자연어로 입력하면 날짜로 바꿔드려요
                      </Text>
                      <Group gap={8} align="center" wrap="nowrap">
                        <TextInput
                          placeholder="예: 다음주 수요일부터 목요일, 7월 15일부터 16일…"
                          aria-label="기간 자연어 입력"
                          value={dateText}
                          onChange={(e) => {
                            setDateText(e.currentTarget.value);
                            setDateParseFailed(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleConvertDate();
                            }
                          }}
                          radius="md"
                          size="md"
                          styles={INPUT_STYLES}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={handleConvertDate}
                          disabled={dateText.trim() === ''}
                          className={dateText.trim() === '' ? undefined : 'solid-btn'}
                          style={{
                            ...(dateText.trim() === '' ? BTN_DISABLED : BTN_PRIMARY),
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            height: 42,
                            padding: '0 18px',
                            flexShrink: 0,
                          }}
                        >
                          <IconSparkles size={15} />
                          변환
                        </button>
                      </Group>
                      {dateParseFailed && (
                        <Text style={{ fontSize: 13, color: DANGER, marginTop: 8 }}>
                          날짜를 알아듣지 못했어요. 아래 칸에 직접 입력해 주세요.
                        </Text>
                      )}
                    </div>

                    {dateRangeLabel !== '' && (
                      <Group
                        className="fade-up"
                        justify="space-between"
                        wrap="nowrap"
                        gap={12}
                        style={{
                          border: `1px solid ${DARK}`,
                          borderRadius: 12,
                          backgroundColor: SURFACE_SOFT,
                          padding: '13px 15px',
                        }}
                      >
                        <Group gap={11} wrap="nowrap">
                          <IconCalendarEvent size={18} color={DARK} style={{ flexShrink: 0 }} />
                          <div>
                            <Text fw={700} style={{ fontSize: 15, color: TEXT }}>
                              {draft.startDate === draft.endDate
                                ? formatDateWithWeekday(draft.startDate)
                                : `${formatDateWithWeekday(draft.startDate)} ~ ${formatDateWithWeekday(draft.endDate)}`}
                            </Text>
                            <Text style={{ fontSize: 13, color: SUB, marginTop: 2 }}>
                              총 {countDays(draft.startDate, draft.endDate)}일로 확정되었습니다
                            </Text>
                          </div>
                        </Group>
                        <IconCheck size={19} color={DONE_COLOR} stroke={3} style={{ flexShrink: 0 }} />
                      </Group>
                    )}

                    <Group gap={12} grow align="flex-start">
                      <TextInput
                        type="date"
                        label="시작일"
                        value={draft.startDate}
                        max={draft.endDate || undefined}
                        onChange={(e) => update({ startDate: e.currentTarget.value })}
                        radius="md"
                        size="md"
                        styles={INPUT_STYLES}
                      />
                      <TextInput
                        type="date"
                        label="종료일"
                        value={draft.endDate}
                        min={draft.startDate || undefined}
                        onChange={(e) => update({ endDate: e.currentTarget.value })}
                        radius="md"
                        size="md"
                        styles={INPUT_STYLES}
                      />
                    </Group>

                    {hasInvalidRange && (
                      <Text style={{ fontSize: 13, color: DANGER }}>
                        종료일이 시작일보다 앞설 수 없어요.
                      </Text>
                    )}
                  </Stack>
                </Paper>
              ) : draft.step === 'plan' ? (
                <Paper withBorder radius={CARD_RADIUS} p={24} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
                  <StepHeader
                    icon={IconNotes}
                    title="체험 계획"
                    description="목적과 활동 내용을 적으면 빅배가 문장을 다듬어드려요."
                  />

                  <Stack gap={18}>
                    <Textarea
                      label="체험 목적"
                      placeholder="박물관 관람을 통해 조선시대 생활문화를 이해하고자 합니다."
                      value={draft.purpose}
                      onChange={(e) => update({ purpose: e.currentTarget.value })}
                      autosize
                      minRows={3}
                      maxRows={6}
                      radius="md"
                      size="md"
                      styles={INPUT_STYLES}
                    />
                    <Textarea
                      label="활동 계획"
                      placeholder={'1일차: 상설전시관 관람\n2일차: 체험 프로그램 참여'}
                      value={draft.plan}
                      onChange={(e) => update({ plan: e.currentTarget.value })}
                      autosize
                      minRows={4}
                      maxRows={10}
                      radius="md"
                      size="md"
                      styles={INPUT_STYLES}
                    />

                    <div>
                      <Text style={{ fontSize: 14, fontWeight: 500, color: LABEL_COLOR, marginBottom: 8 }}>
                        보호자
                      </Text>
                      <Group gap={12} grow align="flex-start">
                        <TextInput
                          placeholder="010-0000-0000"
                          aria-label="보호자 연락처"
                          value={draft.guardianPhone}
                          onChange={(e) => update({ guardianPhone: e.currentTarget.value })}
                          radius="md"
                          size="md"
                          styles={INPUT_STYLES}
                        />
                      </Group>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                        {GUARDIAN_RELATIONS.map((relation) => {
                          const isPicked = draft.guardianRelation === relation;
                          return (
                            <button
                              key={relation}
                              type="button"
                              className="pick-chip"
                              data-picked={isPicked}
                              aria-pressed={isPicked}
                              onClick={() =>
                                update({ guardianRelation: isPicked ? '' : relation })
                              }
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                borderRadius: 20,
                                padding: '6px 14px',
                                fontSize: 13,
                                color: isPicked ? 'white' : LABEL_COLOR,
                              }}
                            >
                              {relation}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </Stack>
                </Paper>
              ) : (
                <Paper withBorder radius={CARD_RADIUS} p={24} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
                  <StepHeader
                    icon={IconFileText}
                    title="검토"
                    description="입력한 내용을 확인하고 문서를 만들어보세요."
                  />

                  <Stack gap={0}>
                    {reviewRows.map((row, index) => (
                      <div
                        key={row.label}
                        style={{
                          display: 'flex',
                          gap: 16,
                          padding: '13px 0',
                          borderTop: index === 0 ? undefined : `1px solid ${BORDER_SOFT}`,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            color: SUB,
                            width: 92,
                            flexShrink: 0,
                            paddingTop: 1,
                          }}
                        >
                          {row.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: row.value ? TEXT : '#9aa3af',
                            whiteSpace: 'pre-wrap',
                            flex: 1,
                          }}
                        >
                          {row.value || '미입력'}
                        </Text>
                        <button
                          type="button"
                          onClick={() => goToStep(row.step)}
                          className="ghost-btn"
                          style={{
                            border: 'none',
                            background: 'none',
                            borderRadius: 8,
                            cursor: 'pointer',
                            color: ACCENT,
                            fontSize: 13,
                            fontWeight: 500,
                            padding: '4px 8px',
                            flexShrink: 0,
                            alignSelf: 'flex-start',
                          }}
                        >
                          수정
                        </button>
                      </div>
                    ))}
                  </Stack>

                  {missingRequired.length > 0 && (
                    <Group gap={6} mt={18} wrap="nowrap" align="flex-start">
                      <IconAlertCircle size={15} color={DANGER} style={{ flexShrink: 0, marginTop: 2 }} />
                      <Text style={{ fontSize: 13, color: DANGER }}>
                        {missingRequired.join(', ')}을 아직 입력하지 않았어요.
                      </Text>
                    </Group>
                  )}

                  <button
                    type="button"
                    disabled={missingRequired.length > 0}
                    className={missingRequired.length === 0 ? 'solid-btn' : undefined}
                    style={{
                      ...(missingRequired.length === 0 ? BTN_PRIMARY : BTN_DISABLED),
                      width: '100%',
                      marginTop: 20,
                      padding: '11px 0',
                    }}
                  >
                    신청서 만들기
                  </button>
                </Paper>
              )}
              </div>

              <Group justify="space-between" mt={24}>
                {!isFirstStep ? (
                  <button type="button" data-outline onClick={handlePrev} style={BTN_OUTLINE}>
                    이전
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canAdvance || isLastStep}
                  style={canAdvance && !isLastStep ? BTN_PRIMARY : BTN_DISABLED}
                >
                  다음
                </button>
              </Group>
          </Stack>
        </div>

        <Paper
          withBorder
          radius={CARD_RADIUS}
          className="hidden-mobile"
          style={{
            width: 440,
            flexShrink: 0,
            backgroundColor: 'white',
            boxShadow: CARD_SHADOW,
            position: 'sticky',
            top: 64,
            height: 'calc(100vh - 128px)',
            minHeight: 600,
            overflow: 'hidden',
            flexDirection: 'column',
          }}
        >
          <AgentSidebar
            messages={draft.messages}
            onSend={handleSend}
            modelId={draft.modelId ?? DEFAULT_MODEL_ID}
            onModelChange={handleModelChange}
            thinking={thinking}
            thinkingSteps={thinkingSteps}
            thinkingElapsed={thinkingElapsed}
          />
        </Paper>
      </div>

      <StudentModal
        opened={studentModalOpened}
        onClose={closeStudentModal}
        onSubmit={handleAddStudent}
      />
    </div>
  );
}
