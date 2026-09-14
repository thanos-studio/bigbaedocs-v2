'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRouter } from 'next/navigation';
import { Collapse, Group, Modal, Paper, Stack, Text, TextInput, Textarea, Tooltip, Transition } from '@mantine/core';
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
  IconDownload,
  IconPrinter,
  IconSearch,
  IconMap,
  IconShare2,
} from '@tabler/icons-react';
import { useStudents, useApplicationDraft, usePreferredModel, createId } from '@/lib/storage';
import StudentModal from './StudentModal';
import { HwpxViewer } from './HwpxViewer';
import {
  APPLICATION_STEPS,
  countDays,
  isStepFilled,
  formatDateRange,
  formatDateWithWeekday,
  type ApplicationDraft,
  type ApplicationStep,
  type ChatMessage,
  type PlaceCandidate,
  type PlaceRegion,
  type PlaceSuggestion,
  type Student,
} from '@/lib/types';
import { searchPlaces } from '@/lib/places';
import { parseDateExpression } from '@/lib/parse-date';
import { z } from 'zod';

const parsedDateRangeShape = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
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
  GREEN_SOFT,
  CARD_RADIUS,
  CARD_SHADOW,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_DISABLED,
  INPUT_STYLES,
  LABEL_COLOR,
  TOOLTIP_PROPS,
} from '@/lib/theme';
import AgentSidebar, { type WritingOptionState } from './AgentSidebar';
import ShareModal from './ShareModal';
import type { SharePayload } from '@/lib/share';
import {
  agentModelCatalogSchema,
  getApplicationPatches,
  toApplicationDraftContext,
  toDisplayMessages,
  toUiMessages,
  type AgentModelCatalog,
} from '@/lib/agent/client';
import { placeCandidateListSchema } from '@/lib/agent/schema';

const TITLE_PLACEHOLDER = '제목 없는 신청서';

type GeneratedDocument = {
  studentId: string;
  studentName: string;
  url: string;
  name: string;
  size: number;
  bytes: Uint8Array;
};
const AGENT_CHAT_TRANSPORT = new DefaultChatTransport({
  api: '/api/agent/chat',
  prepareSendMessagesRequest: ({ messages, body }) => ({
    body: {
      messages,
      draft: body?.draft,
      model: body?.model,
    },
  }),
});

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

function PolishButton({
  onClickAction,
  loading,
  disabled,
}: {
  onClickAction: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <Tooltip label="대충 적은 내용을 신청서 문장으로 다듬어요" {...TOOLTIP_PROPS}>
      <button
        type="button"
        onClick={onClickAction}
        disabled={disabled}
        className="answer-chip"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: 20,
          padding: '7px 14px',
          fontSize: 13,
          fontWeight: 500,
          color: LABEL_COLOR,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? (
          <IconLoader2 size={14} className="spin" />
        ) : (
          <IconSparkles size={14} />
        )}
        AI로 다듬기
      </button>
    </Tooltip>
  );
}

function StepProgress({
  step,
  draft,
  onSelect,
}: {
  step: ApplicationStep;
  draft: ApplicationDraft;
  onSelect: (step: ApplicationStep) => void;
}) {
  const currentIndex = APPLICATION_STEPS.findIndex((s) => s.key === step);
  return (
    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflowX: 'auto' }} className="agent-scroll">
      {APPLICATION_STEPS.map((s, index) => {
        const isCurrent = index === currentIndex;
        const isDone = !isCurrent && isStepFilled(s.key, draft);
        const isClickable = index <= currentIndex || isDone;
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

type MessageExtras = Pick<ChatMessage, 'reasoning' | 'toolCalls'>;

function withRestoredExtras(
  messages: ChatMessage[],
  extras: Map<string, MessageExtras>
): ChatMessage[] {
  if (extras.size === 0) return messages;

  return messages.map((message) => {
    const saved = extras.get(message.id);
    if (!saved) return message;

    return {
      ...message,
      reasoning: message.reasoning ?? saved.reasoning,
      toolCalls: message.toolCalls ?? saved.toolCalls,
    };
  });
}

type ModelNotice = { id: string; content: string; afterMessageId: string };

function withModelNotices(messages: ChatMessage[], notices: ModelNotice[]): ChatMessage[] {
  if (notices.length === 0) return messages;

  return messages.flatMap((message) => [
    message,
    ...notices
      .filter((notice) => notice.afterMessageId === message.id)
      .map((notice) => ({
        id: notice.id,
        role: 'system' as const,
        content: notice.content,
        createdAt: 0,
      })),
  ]);
}

export default function ApplicationEditor({ uuid }: { uuid: string }) {
  const router = useRouter();
  const [students, setStudents] = useStudents();
  const { draft, hydrated, saveState, update } = useApplicationDraft(uuid);
  const [preferredModel] = usePreferredModel();
  const [studentModalOpened, { open: openStudentModal, close: closeStudentModal }] =
    useDisclosure(false);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const [agentCatalog, setAgentCatalog] = useState<AgentModelCatalog | null>(null);
  const [agentCatalogError, setAgentCatalogError] = useState<string | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSearching, setPlaceSearching] = useState<'osm' | 'agent' | null>(null);
  const [placeSearchError, setPlaceSearchError] = useState<string | null>(null);
  const [remoteResults, setRemoteResults] = useState<PlaceCandidate[]>([]);
  const [polishing, setPolishing] = useState<'purpose' | 'plan' | null>(null);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [shareOpened, { open: openShare, close: closeShare }] = useDisclosure(false);
  const [printing, setPrinting] = useState<string | null>(null);
  const [doneOpened, { open: openDone, close: closeDone }] = useDisclosure(false);
  const [dateText, setDateText] = useState('');
  const [dateParseFailed, setDateParseFailed] = useState(false);
  const [dateConverting, setDateConverting] = useState(false);
  const [modelNotices, setModelNotices] = useState<ModelNotice[]>([]);
  const [pendingModelLabel, setPendingModelLabel] = useState<string | null>(null);
  const [lastSentModelId, setLastSentModelId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const documentUrlsRef = useRef<string[]>([]);
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(
    () => () => {
      documentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );
  const restoredChatRef = useRef(false);
  const savedMessagesRef = useRef('');
  const restoredExtrasRef = useRef(new Map<string, Pick<ChatMessage, 'reasoning' | 'toolCalls'>>());
  const appliedPatchIdsRef = useRef(new Set<string>());
  const { clearError, error, messages, sendMessage, setMessages, status } = useChat({
    transport: AGENT_CHAT_TRANSPORT,
    throttle: 50,
  });
  const thinking = status === 'submitted' || status === 'streaming';

  const placeResults = searchPlaces(draft.placeRegion ?? 'domestic', placeQuery);

  const runPlaceSearch = async (source: 'osm' | 'agent') => {
    const query = placeQuery.trim();
    if (query === '' || placeSearching !== null) return;

    setPlaceSearching(source);
    setPlaceSearchError(null);
    setRemoteResults([]);
    try {
      const response = await fetch('/api/agent/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          region: draft.placeRegion ?? 'domestic',
          source,
          ...(source === 'agent' && draft.modelId !== '' ? { model: draft.modelId } : {}),
        }),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String((payload as { error: unknown }).error)
            : '장소를 찾지 못했어요.';
        throw new Error(message);
      }

      const parsed = placeCandidateListSchema.safeParse(payload);
      if (!parsed.success) throw new Error('장소 검색 응답 형식이 올바르지 않아요.');

      if (parsed.data.candidates.length === 0) {
        setPlaceSearchError('검색 결과가 없어요. 다른 이름으로 찾거나 직접 입력해 주세요.');
      }
      setRemoteResults(parsed.data.candidates);
    } catch (cause) {
      setPlaceSearchError(cause instanceof Error ? cause.message : '장소를 찾지 못했어요.');
    } finally {
      setPlaceSearching(null);
    }
  };

  const selectPlace = (place: PlaceSuggestion) => {
    update({
      destination: place.name,
      placeAddress: place.address,
    });
    setPlaceQuery('');
    setRemoteResults([]);
    setPlaceSearchError(null);
  };

  const clearPlace = () => {
    update({ destination: '', placeAddress: '' });
    setPlaceQuery('');
    setRemoteResults([]);
    setPlaceSearchError(null);
  };

  const handleRegionChange = (region: PlaceRegion) => {
    if (region === draft.placeRegion) return;
    update({ placeRegion: region, destination: '', placeAddress: '' });
    setPlaceQuery('');
    setRemoteResults([]);
    setPlaceSearchError(null);
  };

  const handlePolish = async (target: 'purpose' | 'plan') => {
    const source = target === 'purpose' ? draft.purpose : draft.plan;
    if (source.trim() === '' || polishing !== null) return;

    setPolishing(target);
    setPolishError(null);
    try {
      const response = await fetch('/api/agent/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          text: source,
          ...(draft.destination !== '' ? { destination: draft.destination } : {}),
          ...(target === 'plan' && draft.purpose.trim() !== ''
            ? { purpose: draft.purpose }
            : {}),
          ...(draft.modelId !== '' ? { model: draft.modelId } : {}),
        }),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String((payload as { error: unknown }).error)
            : '문장을 다듬지 못했어요.';
        throw new Error(message);
      }

      const polished =
        typeof payload === 'object' && payload !== null && 'text' in payload
          ? String((payload as { text: unknown }).text)
          : '';
      if (polished === '') throw new Error('문장을 다듬지 못했어요.');

      update(target === 'purpose' ? { purpose: polished } : { plan: polished });
    } catch (cause) {
      setPolishError(cause instanceof Error ? cause.message : '문장을 다듬지 못했어요.');
    } finally {
      setPolishing(null);
    }
  };

  const buildSharePayload = (): SharePayload | null => {
    if (selectedStudents.length === 0) return null;
    if (draft.destination.trim() === '') return null;
    if (formatDateRange(draft.startDate, draft.endDate) === '') return null;

    return {
      version: 2,
      title: draft.title,
      startDate: draft.startDate,
      endDate: draft.endDate,
      learningType: draft.learningType,
      destination: draft.destination,
      placeRegion: draft.placeRegion,
      placeAddress: draft.placeAddress,
      purpose: draft.purpose,
      plan: draft.plan,
      studentCount: selectedStudents.length,
    };
  };

  const handleConvertDate = async () => {
    const text = dateText.trim();
    if (text === '' || dateConverting) return;

    setDateConverting(true);
    setDateParseFailed(false);
    try {
      const response = await fetch('/api/agent/parse-date', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        const data: unknown = await response.json();
        const range = parsedDateRangeShape.safeParse(data);
        if (range.success) {
          update({ startDate: range.data.startDate, endDate: range.data.endDate });
          setDateText('');
          return;
        }
      }

      const local = parseDateExpression(text);
      if (local) {
        update({ startDate: local.startDate, endDate: local.endDate });
        setDateText('');
        return;
      }
      setDateParseFailed(true);
    } catch {
      const local = parseDateExpression(text);
      if (local) {
        update({ startDate: local.startDate, endDate: local.endDate });
        setDateText('');
        return;
      }
      setDateParseFailed(true);
    } finally {
      setDateConverting(false);
    }
  };

  useEffect(() => {
    if (!hydrated || restoredChatRef.current) return;

    draft.messages.forEach((message) => {
      if (message.reasoning || message.toolCalls) {
        restoredExtrasRef.current.set(message.id, {
          reasoning: message.reasoning,
          toolCalls: message.toolCalls,
        });
      }
    });

    const savedMessages = toUiMessages(draft.messages);
    savedMessagesRef.current = JSON.stringify(
      withRestoredExtras(toDisplayMessages(savedMessages), restoredExtrasRef.current)
    );
    setMessages(savedMessages);
    restoredChatRef.current = true;
  }, [draft.messages, hydrated, setMessages]);

  useEffect(() => {
    if (!hydrated || !restoredChatRef.current) return;

    const displayMessages = withRestoredExtras(
      toDisplayMessages(messages),
      restoredExtrasRef.current
    );

    displayMessages.forEach((message) => {
      if (message.reasoning || message.toolCalls) {
        restoredExtrasRef.current.set(message.id, {
          reasoning: message.reasoning,
          toolCalls: message.toolCalls,
        });
      }
    });

    const serialized = JSON.stringify(displayMessages);
    if (serialized === savedMessagesRef.current) return;

    savedMessagesRef.current = serialized;
    update({ messages: displayMessages });
  }, [hydrated, messages, update]);

  useEffect(() => {
    const patches = getApplicationPatches(messages).filter(
      ({ id }) => !appliedPatchIdsRef.current.has(id)
    );
    if (patches.length === 0) return;

    patches.forEach(({ id }) => appliedPatchIdsRef.current.add(id));
    update(Object.assign({}, ...patches.map(({ patch }) => patch)));
  }, [messages, update]);

  useEffect(() => {
    if (!thinking) return;

    const timer = setInterval(() => setThinkingElapsed((seconds) => seconds + 1), 1_000);

    return () => clearInterval(timer);
  }, [thinking]);

  useEffect(() => {
    let cancelled = false;

    async function loadAgentCatalog() {
      try {
        const response = await fetch('/api/agent/models');
        if (!response.ok) {
          throw new Error('에이전트 모델 목록을 불러오지 못했어요.');
        }

        const parsed = agentModelCatalogSchema.safeParse(await response.json());
        if (!parsed.success) {
          throw new Error('에이전트 모델 목록 형식이 올바르지 않아요.');
        }
        if (cancelled) return;

        setAgentCatalog(parsed.data);
        setAgentCatalogError(null);
        if (!parsed.data.models.some((model) => model.id === draft.modelId)) {
          const preferred = parsed.data.models.some((model) => model.id === preferredModel)
            ? preferredModel
            : parsed.data.defaultModelId;
          update({ modelId: preferred });
        }
      } catch (cause) {
        if (cancelled) return;
        setAgentCatalogError(
          cause instanceof Error ? cause.message : '에이전트 모델 목록을 불러오지 못했어요.'
        );
      }
    }

    void loadAgentCatalog();
    return () => {
      cancelled = true;
    };
  }, [draft.modelId, preferredModel, update]);

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
          : draft.step === 'review'
            ? false
            : true;

  const selectedStudents = draft.studentIds
    .map((id) => students.find((s) => s.id === id))
    .filter((s): s is Student => Boolean(s));

  const previewStudent =
    selectedStudents.find((student) => student.id === previewStudentId) ?? selectedStudents[0];

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
  ];

  const missingRequired = [
    selectedStudents.length === 0 ? '학생' : null,
    draft.destination.trim() === '' ? '장소' : null,
    dateRangeLabel === '' ? '기간' : null,
    draft.purpose.trim() === '' ? '체험 목적' : null,
    draft.plan.trim() === '' ? '활동 계획' : null,
    selectedStudents.some((student) => (draft.guardianNames[student.id] ?? '').trim() === '')
      ? '보호자 이름'
      : null,
  ].filter((v): v is string => v !== null);

  const previewReady = draft.step === 'review' && missingRequired.length === 0 && !!previewStudent;
  const previewKey = previewReady
    ? JSON.stringify([
        previewStudent.id,
        draft.startDate,
        draft.endDate,
        draft.destination,
        draft.placeAddress,
        draft.placeRegion,
        draft.purpose,
        draft.plan,
        draft.guardianNames[previewStudent.id] ?? '',
        draft.companionRelation,
        draft.companionPhone,
      ])
    : '';

  useEffect(() => {
    if (!previewReady) return;

    let cancelled = false;
    const controller = new AbortController();

    const timer = setTimeout(() => {
      setPreviewBytes(null);
      setPreviewLoading(true);
      setPreviewError(null);

      void (async () => {
        try {
          const response = await fetch('/api/document', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              draft: toApplicationDraftContext(draft),
              student: previewStudent,
              guardian: {
                name: (draft.guardianNames[previewStudent.id] ?? '').trim(),
                relation: draft.companionRelation.trim(),
                phone: draft.companionPhone.trim(),
              },
            }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error('preview failed');

          const bytes = new Uint8Array(await response.arrayBuffer());
          if (!cancelled) setPreviewBytes(bytes);
        } catch (cause) {
          if (cancelled || (cause instanceof DOMException && cause.name === 'AbortError')) return;
          setPreviewError('미리보기를 만들지 못했어요.');
          setPreviewBytes(null);
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
    // previewKey에 미리보기에 영향을 주는 값이 모두 들어 있다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewReady, previewKey]);

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

  const handleGenerate = async () => {
    if (generating || missingRequired.length > 0 || selectedStudents.length === 0) return;

    setGenerating(true);
    setGenerateError(null);

    const baseTitle = draft.title.trim() || '체험학습 신청서';

    try {
      const built = await Promise.all(
        selectedStudents.map(async (student) => {
          const response = await fetch('/api/document', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              draft: toApplicationDraftContext(draft),
              student,
              guardian: {
                name: (draft.guardianNames[student.id] ?? '').trim(),
                relation: draft.companionRelation.trim(),
                phone: draft.companionPhone.trim(),
              },
            }),
          });
          if (!response.ok) throw new Error(`document failed for ${student.id}`);

          const bytes = new Uint8Array(await response.arrayBuffer());
          const url = URL.createObjectURL(
            new Blob([bytes], { type: 'application/vnd.hancom.hwpx' })
          );
          return {
            studentId: student.id,
            studentName: student.name,
            url,
            name: `${baseTitle}_${student.name}.hwpx`,
            size: bytes.byteLength,
            bytes,
          };
        })
      );

      documentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      documentUrlsRef.current = built.map((item) => item.url);
      setDocuments(built);
      update({ step: 'document' });
    } catch {
      setGenerateError('문서를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintPdf = async (document: GeneratedDocument) => {
    if (printing !== null) return;

    setPrinting(document.name);
    setGenerateError(null);
    try {
      const { renderHwpxPages, printPages } = await import('@/lib/hwpx-render');
      const { pages, width, height } = await renderHwpxPages(document.bytes);
      printPages(document.name.replace(/\.hwpx$/, ''), pages, width, height);
    } catch (cause) {
      console.error('[document] pdf print failed:', cause);
      setGenerateError('인쇄 창을 열지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setPrinting(null);
    }
  };

  const handleDownloadAll = async () => {
    for (const document of documents) {
      const link = window.document.createElement('a');
      link.href = document.url;
      link.download = document.name;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      // 브라우저가 연속 다운로드를 한 번으로 합치지 않도록 간격을 둔다.
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  };

  /** 여러 명을 각각 인쇄하면 창이 여러 번 뜨므로, 모든 페이지를 한 문서로 모아 한 번만 띄운다. */
  const handlePrintAll = async () => {
    if (documents.length === 0 || printing !== null) return;

    setPrinting('__all__');
    setGenerateError(null);
    try {
      const { renderHwpxPages, printPages } = await import('@/lib/hwpx-render');
      const rendered = await Promise.all(
        documents.map((document) => renderHwpxPages(document.bytes))
      );
      const pages = rendered.flatMap((item) => item.pages);
      const first = rendered[0];
      printPages(draft.title.trim() || '체험학습 신청서', pages, first.width, first.height);
    } catch (cause) {
      console.error('[document] print all failed:', cause);
      setGenerateError('인쇄 창을 열지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setPrinting(null);
    }
  };

  const handleSend = (text: string, files: File[], options: WritingOptionState) => {
    if (thinking || !agentCatalog || draft.modelId === '') return;

    clearError();

    const lastMessageId = messages.at(-1)?.id;
    if (pendingModelLabel !== null && lastMessageId !== undefined) {
      setModelNotices((prev) => [
        ...prev,
        {
          id: createId(),
          content: `${pendingModelLabel} 모델로 변경했어요`,
          afterMessageId: lastMessageId,
        },
      ]);
    }
    setPendingModelLabel(null);
    setLastSentModelId(draft.modelId);

    setThinkingElapsed(0);
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    void sendMessage(
      files.length > 0 ? { text, files: transfer.files } : { text },
      {
        body: {
          draft: toApplicationDraftContext(draft),
          model: draft.modelId,
          options,
          availableStudents: students.map((student) => ({
            id: student.id,
            name: student.name,
            classInfo: student.classInfo,
          })),
        },
      }
    );
  };

  const handleModelChange = (nextModelId: string) => {
    if (nextModelId === draft.modelId || thinking) return;
    clearError();

    const nextLabel = agentCatalog?.models.find((model) => model.id === nextModelId)?.label;
    const backToSent = lastSentModelId !== null && nextModelId === lastSentModelId;
    setPendingModelLabel(backToSent ? null : (nextLabel ?? null));
    update({ modelId: nextModelId });
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
                <StepProgress step={draft.step} draft={draft} onSelect={goToStep} />
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

                  {students.length === 0 && (
                    <Text style={{ fontSize: 14, color: SUB, marginTop: 14, lineHeight: 1.55 }}>
                      등록한 학생이 없어요. 학생을 추가하면 신청서를 만들 수 있어요.
                    </Text>
                  )}
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              void runPlaceSearch('osm');
                            }
                          }}
                          radius="md"
                          size="md"
                          styles={INPUT_STYLES}
                          leftSection={<IconSearch size={16} color={SUB} />}
                        />

                        <Group gap={8} mt={10} wrap="nowrap">
                          <Tooltip label="지도 데이터에서 정확한 주소를 찾아요" {...TOOLTIP_PROPS}>
                            <button
                              type="button"
                              onClick={() => void runPlaceSearch('osm')}
                              disabled={placeQuery.trim() === '' || placeSearching !== null}
                              className="solid-btn"
                              style={{
                                ...BTN_OUTLINE,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                opacity: placeQuery.trim() === '' || placeSearching !== null ? 0.5 : 1,
                                cursor:
                                  placeQuery.trim() === '' || placeSearching !== null
                                    ? 'not-allowed'
                                    : 'pointer',
                              }}
                            >
                              {placeSearching === 'osm' ? (
                                <IconLoader2 size={15} className="spin" />
                              ) : (
                                <IconMap size={15} />
                              )}
                              지도에서 찾기
                            </button>
                          </Tooltip>

                          <Tooltip label="AI가 후보 주소를 추려줘요" {...TOOLTIP_PROPS}>
                            <button
                              type="button"
                              onClick={() => void runPlaceSearch('agent')}
                              disabled={placeQuery.trim() === '' || placeSearching !== null}
                              className="solid-btn"
                              style={{
                                ...BTN_OUTLINE,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                opacity: placeQuery.trim() === '' || placeSearching !== null ? 0.5 : 1,
                                cursor:
                                  placeQuery.trim() === '' || placeSearching !== null
                                    ? 'not-allowed'
                                    : 'pointer',
                              }}
                            >
                              {placeSearching === 'agent' ? (
                                <IconLoader2 size={15} className="spin" />
                              ) : (
                                <IconSparkles size={15} />
                              )}
                              AI로 찾기
                            </button>
                          </Tooltip>
                        </Group>

                        <Transition
                          mounted={placeSearchError !== null}
                          transition="fade"
                          duration={160}
                          timingFunction="ease"
                        >
                          {(styles) => (
                            <Text
                              style={{
                                ...styles,
                                fontSize: 13,
                                color: DANGER,
                                marginTop: 10,
                                lineHeight: 1.5,
                              }}
                            >
                              {placeSearchError}
                            </Text>
                          )}
                        </Transition>

                        <Stack gap={6} mt={12}>
                          {remoteResults.map((place) => (
                            <button
                              key={`${place.name}-${place.address}`}
                              type="button"
                              onClick={() =>
                                selectPlace({
                                  name: place.name,
                                  category: '',
                                  address: place.address,
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
                          ))}

                          {remoteResults.length === 0 &&
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
                            ))}

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
                          disabled={dateText.trim() === '' || dateConverting}
                          className={
                            dateText.trim() === '' || dateConverting ? undefined : 'solid-btn'
                          }
                          style={{
                            ...(dateText.trim() === '' || dateConverting
                              ? BTN_DISABLED
                              : BTN_PRIMARY),
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            height: 42,
                            padding: '0 18px',
                            flexShrink: 0,
                          }}
                        >
                          {dateConverting ? (
                            <>
                              <IconLoader2 size={15} className="spin" />
                              변환 중
                            </>
                          ) : (
                            <>
                              <IconSparkles size={15} />
                              변환
                            </>
                          )}
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
                    <div>
                      <Textarea
                        label="체험 목적"
                        placeholder="대충 적어도 됩니다. 예: 박물관 가서 조선시대 생활 보기"
                        value={draft.purpose}
                        onChange={(e) => update({ purpose: e.currentTarget.value })}
                        autosize
                        minRows={3}
                        maxRows={6}
                        radius="md"
                        size="md"
                        styles={INPUT_STYLES}
                      />
                      <Group justify="flex-end" mt={8}>
                        <PolishButton
                          onClickAction={() => void handlePolish('purpose')}
                          loading={polishing === 'purpose'}
                          disabled={draft.purpose.trim() === '' || polishing !== null}
                        />
                      </Group>
                    </div>

                    <div>
                      <Textarea
                        label="활동 계획"
                        placeholder={'대충 적어도 됩니다. 예: 박물관 관람, 전시 해설 듣기, 체험 프로그램 참여'}
                        value={draft.plan}
                        onChange={(e) => update({ plan: e.currentTarget.value })}
                        autosize
                        minRows={4}
                        maxRows={10}
                        radius="md"
                        size="md"
                        styles={INPUT_STYLES}
                      />
                      <Group justify="flex-end" mt={8}>
                        <PolishButton
                          onClickAction={() => void handlePolish('plan')}
                          loading={polishing === 'plan'}
                          disabled={draft.plan.trim() === '' || polishing !== null}
                        />
                      </Group>
                    </div>

                    <Transition
                      mounted={polishError !== null}
                      transition="fade"
                      duration={160}
                      timingFunction="ease"
                    >
                      {(styles) => (
                        <Text
                          style={{ ...styles, fontSize: 13, color: DANGER, lineHeight: 1.5 }}
                        >
                          {polishError}
                        </Text>
                      )}
                    </Transition>
                  </Stack>
                </Paper>
              ) : draft.step === 'review' ? (
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

                  <div
                    style={{
                      marginTop: 22,
                      paddingTop: 20,
                      borderTop: `1px solid ${BORDER_SOFT}`,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>보호자 이름</Text>
                    <Text style={{ fontSize: 13, color: SUB, marginTop: 4, marginBottom: 12 }}>
                      학생마다 따로 입력해요. 신청서 하단 신청인 칸에 들어갑니다.
                    </Text>
                    <Stack gap={10}>
                      {selectedStudents.map((student) => (
                        <TextInput
                          key={student.id}
                          label={`${student.name} 학생의 보호자`}
                          value={draft.guardianNames[student.id] ?? ''}
                          onChange={(event) =>
                            update({
                              guardianNames: {
                                ...draft.guardianNames,
                                [student.id]: event.currentTarget.value,
                              },
                            })
                          }
                          placeholder="예: 김민수"
                          maxLength={50}
                          size="md"
                          radius="md"
                          styles={INPUT_STYLES}
                        />
                      ))}
                    </Stack>

                    <Collapse expanded={draft.placeRegion === 'overseas'} transitionDuration={220}>
                      <div style={{ paddingTop: 18 }}>
                        <Text style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>
                          동행하는 보호자
                        </Text>
                        <Text style={{ fontSize: 13, color: SUB, marginTop: 4, marginBottom: 10 }}>
                          해외로 나가는 경우에만 적어요. 학생과 함께 가는 보호자예요.
                        </Text>
                        <Group gap={10} grow align="flex-start">
                          <TextInput
                            label="관계"
                            value={draft.companionRelation}
                            onChange={(event) =>
                              update({ companionRelation: event.currentTarget.value })
                            }
                            placeholder="예: 모"
                            maxLength={20}
                            size="md"
                            styles={{
                              input: { fontSize: 14 },
                              label: { fontSize: 13, color: SUB, marginBottom: 6 },
                            }}
                          />
                          <TextInput
                            label="휴대폰"
                            value={draft.companionPhone}
                            onChange={(event) =>
                              update({ companionPhone: event.currentTarget.value })
                            }
                            placeholder="예: 010-1234-5678"
                            maxLength={30}
                            size="md"
                            styles={{
                              input: { fontSize: 14 },
                              label: { fontSize: 13, color: SUB, marginBottom: 6 },
                            }}
                          />
                        </Group>
                      </div>
                    </Collapse>
                  </div>

                  <div
                    style={{
                      marginTop: 22,
                      paddingTop: 20,
                      borderTop: `1px solid ${BORDER_SOFT}`,
                    }}
                  >
                    <Group justify="space-between" align="center" mb={10} wrap="nowrap">
                      <div>
                        <Text style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>미리보기</Text>
                        <Text style={{ fontSize: 13, color: SUB, marginTop: 4 }}>
                          {previewStudent
                            ? `${previewStudent.name} 학생의 신청서예요.`
                            : '학생을 선택하면 미리 볼 수 있어요.'}
                        </Text>
                      </div>
                      {selectedStudents.length > 1 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {selectedStudents.map((student) => (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => setPreviewStudentId(student.id)}
                              className="pick-chip"
                              data-picked={student.id === previewStudent?.id}
                              aria-pressed={student.id === previewStudent?.id}
                              style={{
                                fontSize: 13,
                                padding: '6px 12px',
                                borderRadius: 8,
                                cursor: 'pointer',
                                color: student.id === previewStudent?.id ? 'white' : LABEL_COLOR,
                              }}
                            >
                              {student.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </Group>

                    {!previewReady || previewBytes === null ? (
                      <div
                        style={{
                          border: `1px dashed ${BORDER}`,
                          borderRadius: 10,
                          padding: '30px 0',
                          textAlign: 'center',
                        }}
                      >
                        {previewLoading ? (
                          <Group gap={7} justify="center">
                            <IconLoader2 size={15} className="spin" color={SUB} />
                            <Text style={{ fontSize: 13, color: SUB }}>
                              신청서를 그리고 있어요
                            </Text>
                          </Group>
                        ) : (
                          <Text style={{ fontSize: 13, color: SUB }}>
                            {previewError ?? '필수 항목을 채우면 미리보기가 나와요.'}
                          </Text>
                        )}
                      </div>
                    ) : (
                      <HwpxViewer bytes={previewBytes} />
                    )}
                  </div>

                  {missingRequired.length > 0 && (
                    <Group gap={6} mt={18} wrap="nowrap" align="flex-start">
                      <IconAlertCircle size={15} color={DANGER} style={{ flexShrink: 0, marginTop: 2 }} />
                      <Text style={{ fontSize: 13, color: DANGER }}>
                        {missingRequired.join(', ')}을 아직 입력하지 않았어요.
                      </Text>
                    </Group>
                  )}

                  {generateError !== null && (
                    <Group gap={6} mt={16} wrap="nowrap" align="flex-start">
                      <IconAlertCircle size={15} color={DANGER} style={{ flexShrink: 0, marginTop: 2 }} />
                      <Text style={{ fontSize: 13, color: DANGER }}>{generateError}</Text>
                    </Group>
                  )}

                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={missingRequired.length > 0 || generating}
                    className={
                      missingRequired.length === 0 && !generating ? 'solid-btn' : undefined
                    }
                    style={{
                      ...(missingRequired.length === 0 && !generating
                        ? BTN_PRIMARY
                        : BTN_DISABLED),
                      width: '100%',
                      marginTop: 20,
                      padding: '11px 0',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                    }}
                  >
                    {generating ? (
                      <>
                        <IconLoader2 size={16} className="spin" />
                        문서를 만들고 있어요
                      </>
                    ) : (
                      '신청서 만들기'
                    )}
                  </button>
                </Paper>
              ) : (
                <Paper withBorder radius={CARD_RADIUS} p={24} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
                  <StepHeader
                    icon={IconFileText}
                    title="문서"
                    description={
                      documents.length > 1
                        ? `학생 ${documents.length}명의 신청서를 각각 만들었어요.`
                        : '신청서가 만들어졌어요. 내려받아 확인하세요.'
                    }
                  />

                  {documents.length === 0 ? (
                    <Stack gap={14}>
                      <Text style={{ fontSize: 14, color: SUB, lineHeight: 1.6 }}>
                        만들어 둔 문서가 없어요. 문서는 저장되지 않으니 다시 만들어야 해요.
                      </Text>
                      <Group>
                        <button
                          type="button"
                          onClick={() => update({ step: 'review' })}
                          className="solid-btn"
                          style={{ ...BTN_PRIMARY, padding: '0 18px' }}
                        >
                          검토로 가서 다시 만들기
                        </button>
                      </Group>
                    </Stack>
                  ) : (
                    <Stack gap={16}>
                      <Stack gap={10}>
                        {documents.map((document) => (
                          <Group
                            key={document.studentId}
                            justify="space-between"
                            wrap="nowrap"
                            gap={12}
                            className="fade-up"
                            style={{
                              border: `1px solid ${BORDER}`,
                              borderRadius: 12,
                              backgroundColor: SURFACE_SOFT,
                              padding: '14px 16px',
                            }}
                          >
                            <Group gap={12} wrap="nowrap" style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 8,
                                  backgroundColor: 'white',
                                  border: `1px solid ${BORDER}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <IconFileText size={19} color={DARK} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <Text
                                  fw={700}
                                  style={{
                                    fontSize: 14,
                                    color: TEXT,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {document.name}
                                </Text>
                                <Text style={{ fontSize: 13, color: SUB, marginTop: 2 }}>
                                  HWPX · {Math.max(1, Math.round(document.size / 1024))}KB
                                </Text>
                              </div>
                            </Group>

                            <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
                              <IconCheck
                                size={18}
                                color={DONE_COLOR}
                                stroke={3}
                                style={{ marginRight: 6 }}
                              />
                              <Tooltip label="HWPX 내려받기" {...TOOLTIP_PROPS}>
                                <a
                                  href={document.url}
                                  download={document.name}
                                  aria-label={`${document.studentName} 신청서 HWPX 내려받기`}
                                  className="answer-chip"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    fontSize: 13,
                                    color: TEXT,
                                    padding: '7px 12px',
                                    borderRadius: 8,
                                    textDecoration: 'none',
                                  }}
                                >
                                  <IconDownload size={15} />
                                  HWPX
                                </a>
                              </Tooltip>
                              <Tooltip label="인쇄하거나 PDF로 저장" {...TOOLTIP_PROPS}>
                                <button
                                  type="button"
                                  onClick={() => void handlePrintPdf(document)}
                                  disabled={printing !== null}
                                  aria-label={`${document.studentName} 신청서 인쇄 또는 PDF로 저장`}
                                  className="answer-chip"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    fontSize: 13,
                                    color: TEXT,
                                    padding: '7px 12px',
                                    borderRadius: 8,
                                    cursor: printing !== null ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  {printing === document.name ? (
                                    <IconLoader2 size={15} className="spin" />
                                  ) : (
                                    <IconPrinter size={15} />
                                  )}
                                  인쇄 · PDF
                                </button>
                              </Tooltip>
                            </Group>
                          </Group>
                        ))}
                      </Stack>

                      <Group gap={8}>
                        {documents.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleDownloadAll()}
                              className="solid-btn"
                              style={{
                                ...BTN_PRIMARY,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 7,
                                padding: '0 18px',
                              }}
                            >
                              <IconDownload size={16} />
                              HWPX {documents.length}개 받기
                            </button>
                            <button
                              type="button"
                              onClick={() => void handlePrintAll()}
                              disabled={printing !== null}
                              data-outline
                              style={{
                                ...BTN_OUTLINE,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 7,
                                padding: '0 18px',
                                opacity: printing !== null ? 0.5 : 1,
                                cursor: printing !== null ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {printing === '__all__' ? (
                                <IconLoader2 size={16} className="spin" />
                              ) : (
                                <IconPrinter size={16} />
                              )}
                              모두 인쇄 · PDF
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={openShare}
                          data-outline
                          style={{
                            ...BTN_OUTLINE,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 7,
                            padding: '0 18px',
                          }}
                        >
                          <IconShare2 size={16} />
                          링크로 공유
                        </button>
                        <button
                          type="button"
                          onClick={() => update({ step: 'review' })}
                          data-outline
                          style={{ ...BTN_OUTLINE, padding: '0 18px' }}
                        >
                          다시 만들기
                        </button>
                      </Group>

                      <Text style={{ fontSize: 13, color: SUB, lineHeight: 1.6 }}>
                        한글(HWP)에서 열어 서명란을 채우면 제출할 수 있어요.
                        <br />
                        &lsquo;인쇄 · PDF&rsquo;를 누르면 인쇄 창이 바로 열려요. 그대로 인쇄하거나
                        대상에서 &lsquo;PDF로 저장&rsquo;을 고르면 됩니다.
                      </Text>
                    </Stack>
                  )}
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
                {isLastStep ? (
                  <button
                    type="button"
                    onClick={openDone}
                    className="solid-btn"
                    style={{
                      ...BTN_PRIMARY,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                    }}
                  >
                    <IconCheck size={16} stroke={2.5} />
                    완료
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canAdvance}
                    style={canAdvance ? BTN_PRIMARY : BTN_DISABLED}
                  >
                    다음
                  </button>
                )}
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
            messages={withModelNotices(
              withRestoredExtras(toDisplayMessages(messages), restoredExtrasRef.current),
              modelNotices
            )}
            onSendAction={handleSend}
            models={agentCatalog?.models ?? []}
            modelId={draft.modelId}
            onModelChangeAction={handleModelChange}
            thinking={thinking}
            thinkingSteps={[]}
            thinkingElapsed={thinkingElapsed}
            errorMessage={error?.message ?? agentCatalogError}
          />
        </Paper>
      </div>

      <StudentModal
        opened={studentModalOpened}
        onClose={closeStudentModal}
        onSubmit={handleAddStudent}
      />

      <ShareModal
        opened={shareOpened}
        onCloseAction={closeShare}
        buildPayloadAction={buildSharePayload}
      />

      <Modal
        opened={doneOpened}
        onClose={closeDone}
        centered
        radius="lg"
        size={400}
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
        transitionProps={{
          transition: 'pop',
          duration: 220,
          timingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        padding={24}
      >
        <Stack gap={18}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: GREEN_SOFT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconCheck size={22} color={DONE_COLOR} stroke={2.5} />
          </div>
          <div>
            <Text fw={700} style={{ fontSize: 17, color: TEXT }}>
              체험학습 신청서를 모두 완료했어요
            </Text>
            <Text style={{ fontSize: 14, color: SUB, marginTop: 6, lineHeight: 1.6 }}>
              다녀온 뒤에는 보고서도 제출해야 해요.
              <br />
              지금 미리 만들어 둘까요?
            </Text>
          </div>

          <Stack gap={8}>
            <button
              type="button"
              onClick={() => {
                closeDone();
                router.push(`/r/${uuid}`);
              }}
              className="setting-option"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '13px 14px',
                borderRadius: 10,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <IconNotes size={17} color={SUB} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text fw={600} style={{ fontSize: 14, color: TEXT }}>
                  보고서까지 미리 만들기
                </Text>
                <Text style={{ fontSize: 13, color: SUB, marginTop: 2 }}>
                  다녀온 내용을 나중에 채우면 돼요.
                </Text>
              </div>
            </button>
          </Stack>

          <Group justify="flex-end" gap={8}>
            <button
              type="button"
              onClick={closeDone}
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
              계속 보기
            </button>
            <button
              type="button"
              onClick={() => {
                closeDone();
                router.push('/');
              }}
              className="solid-btn"
              style={{ ...BTN_PRIMARY, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <IconArrowLeft size={15} />
              나가기
            </button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
