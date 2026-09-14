'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRouter } from 'next/navigation';
import { Group, Modal, Paper, Stack, Text, TextInput, Textarea, Tooltip } from '@mantine/core';
import Image from 'next/image';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconCheck,
  IconPencil,
  IconLoader2,
  IconMapPin,
  IconNotes,
  IconFileText,
  IconAlertCircle,
  IconSparkles,
  IconDownload,
  IconPrinter,
  IconPaperclip,
  IconPhoto,
  IconLock,
} from '@tabler/icons-react';
import { useStudents, useApplicationDraft, usePreferredModel, createId } from '@/lib/storage';
import { HwpxViewer } from './HwpxViewer';
import {
  REPORT_STEPS,
  formatDateRange,
  isReportStepFilled,
  type ApplicationDraft,
  type ChatMessage,
  type ReportStep,
  type Student,
} from '@/lib/types';
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
  INPUT_STYLES,
  LABEL_COLOR,
  TOOLTIP_PROPS,
} from '@/lib/theme';
import { FAINT, FZ, RAW } from '@/lib/graphite/theme';
import { Button, buttonIconSize } from '@/lib/graphite/components';
import AgentSidebar, { type WritingOptionState } from './AgentSidebar';
import {
  agentModelCatalogSchema,
  getReportPatches,
  toApplicationDraftContext,
  toDisplayMessages,
  toUiMessages,
  type AgentModelCatalog,
} from '@/lib/agent/client';

const TITLE_PLACEHOLDER = '제목 없는 보고서';

const PHOTO_MAX_BYTES = 6 * 1024 * 1024;

type GeneratedDocument = {
  studentId: string;
  studentName: string;
  url: string;
  name: string;
  size: number;
  bytes: Uint8Array;
};

const REPORT_CHAT_TRANSPORT = new DefaultChatTransport({
  api: '/api/agent/report-chat',
  prepareSendMessagesRequest: ({ messages, body }) => ({
    body: {
      messages,
      draft: body?.draft,
      model: body?.model,
      options: body?.options,
    },
  }),
});

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
        aria-label="보고서 제목"
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
      aria-label="보고서 제목 수정"
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
          color: value.trim() === '' ? FAINT : TEXT,
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
  icon: typeof IconMapPin;
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
        <Icon size={18} color={RAW.muted} />
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
    <Tooltip label="대충 적은 내용을 보고서 문장으로 다듬어요" {...TOOLTIP_PROPS}>
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
        {loading ? <IconLoader2 size={14} className="spin" /> : <IconSparkles size={14} />}
        AI로 다듬기
      </button>
    </Tooltip>
  );
}

function ReportProgress({
  step,
  draft,
  onSelect,
}: {
  step: ReportStep;
  draft: ApplicationDraft;
  onSelect: (step: ReportStep) => void;
}) {
  const currentIndex = REPORT_STEPS.findIndex((s) => s.key === step);
  return (
    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflowX: 'auto' }} className="agent-scroll">
      {REPORT_STEPS.map((s, index) => {
        const isCurrent = index === currentIndex;
        const isDone = !isCurrent && isReportStepFilled(s.key, draft);
        const isClickable = index <= currentIndex || isDone;
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: index === REPORT_STEPS.length - 1 ? '0 0 auto' : 1 }}>
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
            {index < REPORT_STEPS.length - 1 && (
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

export default function ReportEditor({ uuid }: { uuid: string }) {
  const router = useRouter();
  const [students] = useStudents();
  const { draft, hydrated, saveState, update } = useApplicationDraft(uuid);
  const [preferredModel] = usePreferredModel();
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const [agentCatalog, setAgentCatalog] = useState<AgentModelCatalog | null>(null);
  const [agentCatalogError, setAgentCatalogError] = useState<string | null>(null);
  const [polishing, setPolishing] = useState<'experience' | 'reflection' | null>(null);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [doneOpened, { open: openDone, close: closeDone }] = useDisclosure(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [printing, setPrinting] = useState<string | null>(null);
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
    transport: REPORT_CHAT_TRANSPORT,
    throttle: 50,
  });
  const thinking = status === 'submitted' || status === 'streaming';

  const photoPayload =
    draft.attachmentPhoto === null
      ? undefined
      : {
          dataUrl: draft.attachmentPhoto.dataUrl,
          naturalWidth: draft.attachmentPhoto.naturalWidth,
          naturalHeight: draft.attachmentPhoto.naturalHeight,
        };

  const handlePhotoPick = async (file: File) => {
    setPhotoError(null);

    if (!file.type.startsWith('image/')) {
      setPhotoError('사진 파일만 넣을 수 있어요.');
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setPhotoError('사진이 너무 커요. 6MB보다 작은 파일로 넣어주세요.');
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });

      const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const probe = new window.Image();
        probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
        probe.onerror = () => reject(new Error('decode failed'));
        probe.src = dataUrl;
      });

      update({
        attachmentPhoto: {
          dataUrl,
          naturalWidth: size.width,
          naturalHeight: size.height,
          name: file.name,
        },
      });
    } catch {
      setPhotoError('사진을 읽지 못했어요. 다른 파일로 시도해 주세요.');
    }
  };

  const handlePolish = async (target: 'experience' | 'reflection') => {
    const source = target === 'experience' ? draft.experience : draft.reflection;
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

      update(target === 'experience' ? { experience: polished } : { reflection: polished });
    } catch (cause) {
      setPolishError(cause instanceof Error ? cause.message : '문장을 다듬지 못했어요.');
    } finally {
      setPolishing(null);
    }
  };

  useEffect(() => {
    if (!hydrated || restoredChatRef.current) return;

    draft.reportMessages.forEach((message) => {
      if (message.reasoning || message.toolCalls) {
        restoredExtrasRef.current.set(message.id, {
          reasoning: message.reasoning,
          toolCalls: message.toolCalls,
        });
      }
    });

    const savedMessages = toUiMessages(draft.reportMessages);
    savedMessagesRef.current = JSON.stringify(
      withRestoredExtras(toDisplayMessages(savedMessages), restoredExtrasRef.current)
    );
    setMessages(savedMessages);
    restoredChatRef.current = true;
  }, [draft.reportMessages, hydrated, setMessages]);

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
    update({ reportMessages: displayMessages });
  }, [hydrated, messages, update]);

  useEffect(() => {
    const patches = getReportPatches(messages).filter(
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

  const currentStepIndex = REPORT_STEPS.findIndex((s) => s.key === draft.reportStep);
  const isFirstStep = currentStepIndex <= 0;
  const isLastStep = currentStepIndex === REPORT_STEPS.length - 1;

  const dateRangeLabel = formatDateRange(draft.startDate, draft.endDate);

  const canAdvance =
    draft.reportStep === 'experience'
      ? draft.experience.trim() !== ''
      : draft.reportStep === 'reflection'
        ? draft.reflection.trim() !== ''
        : draft.reportStep === 'review'
          ? false
          : true;

  const selectedStudents = draft.studentIds
    .map((id) => students.find((s) => s.id === id))
    .filter((s): s is Student => Boolean(s));

  const previewStudent =
    selectedStudents.find((student) => student.id === previewStudentId) ?? selectedStudents[0];

  const missingRequired = [
    selectedStudents.length === 0 ? '학생' : null,
    draft.destination.trim() === '' ? '장소' : null,
    dateRangeLabel === '' ? '기간' : null,
    draft.experience.trim() === '' ? '체험내용' : null,
    draft.reflection.trim() === '' ? '느낀 점' : null,
  ].filter((v): v is string => v !== null);

  const previewReady = draft.reportStep === 'review' && missingRequired.length === 0 && !!previewStudent;
  const previewKey = previewReady
    ? JSON.stringify([
        previewStudent.id,
        draft.startDate,
        draft.endDate,
        draft.destination,
        draft.placeAddress,
        draft.experience,
        draft.reflection,
        draft.attachmentNote,
        draft.attachmentPhoto?.dataUrl.length ?? 0,
        draft.attachmentPhoto?.name ?? '',
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
          const response = await fetch('/api/report', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              draft: toApplicationDraftContext(draft),
              student: previewStudent,
              ...(photoPayload ? { photo: photoPayload } : {}),
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

  const goToStep = (reportStep: ReportStep) => {
    update({ reportStep });
  };

  const handlePrev = () => {
    if (isFirstStep) return;
    update({ reportStep: REPORT_STEPS[currentStepIndex - 1].key });
  };

  const handleNext = () => {
    if (isLastStep || !canAdvance) return;
    update({ reportStep: REPORT_STEPS[currentStepIndex + 1].key });
  };

  const handleGenerate = async () => {
    if (generating || missingRequired.length > 0 || selectedStudents.length === 0) return;

    setGenerating(true);
    setGenerateError(null);

    const baseTitle = draft.title.trim() || '체험학습 보고서';

    try {
      const built = await Promise.all(
        selectedStudents.map(async (student) => {
          const response = await fetch('/api/report', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              draft: toApplicationDraftContext(draft),
              student,
              ...(photoPayload ? { photo: photoPayload } : {}),
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
      update({ reportStep: 'document' });
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
      console.error('[report] pdf print failed:', cause);
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
      printPages(draft.title.trim() || '체험학습 보고서', pages, first.width, first.height);
    } catch (cause) {
      console.error('[report] print all failed:', cause);
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
        <Text fw={800} style={{ fontSize: FZ.heading, letterSpacing: -0.4, color: TEXT, lineHeight: 1.2 }}>
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
              <ReportProgress step={draft.reportStep} draft={draft} onSelect={goToStep} />
            </div>

            <div style={{ marginTop: 24 }} key={draft.reportStep} className="step-panel">
              {draft.reportStep === 'confirm' ? (
                <Paper withBorder radius={CARD_RADIUS} p={24} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
                  <StepHeader
                    icon={IconLock}
                    title="다녀온 내용"
                    description="신청서 내용을 그대로 가져왔어요. 여기서는 고칠 수 없어요."
                  />

                  <Stack gap={0}>
                    <div style={{ display: 'flex', gap: 16, padding: '13px 0' }}>
                      <Text style={{ fontSize: 13, color: SUB, width: 92, flexShrink: 0, paddingTop: 1 }}>
                        학생
                      </Text>
                      <Text style={{ fontSize: 14, color: TEXT, whiteSpace: 'pre-wrap', flex: 1 }}>
                        {selectedStudents.length > 0
                          ? selectedStudents.map((s) => `${s.name} (${s.classInfo})`).join('\n')
                          : '미입력'}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', gap: 16, padding: '13px 0', borderTop: `1px solid ${BORDER_SOFT}` }}>
                      <Text style={{ fontSize: 13, color: SUB, width: 92, flexShrink: 0, paddingTop: 1 }}>
                        장소
                      </Text>
                      <Text style={{ fontSize: 14, color: TEXT, whiteSpace: 'pre-wrap', flex: 1 }}>
                        {[draft.destination, draft.placeAddress].filter((v) => v.trim() !== '').join(' · ') || '미입력'}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', gap: 16, padding: '13px 0', borderTop: `1px solid ${BORDER_SOFT}` }}>
                      <Text style={{ fontSize: 13, color: SUB, width: 92, flexShrink: 0, paddingTop: 1 }}>
                        기간
                      </Text>
                      <Text style={{ fontSize: 14, color: TEXT, whiteSpace: 'pre-wrap', flex: 1 }}>
                        {dateRangeLabel || '미입력'}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', gap: 16, padding: '13px 0', borderTop: `1px solid ${BORDER_SOFT}` }}>
                      <Text style={{ fontSize: 13, color: SUB, width: 92, flexShrink: 0, paddingTop: 1 }}>
                        체험 목적
                      </Text>
                      <Text style={{ fontSize: 14, color: draft.purpose.trim() ? TEXT : FAINT, whiteSpace: 'pre-wrap', flex: 1 }}>
                        {draft.purpose.trim() || '미입력'}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', gap: 16, padding: '13px 0', borderTop: `1px solid ${BORDER_SOFT}` }}>
                      <Text style={{ fontSize: 13, color: SUB, width: 92, flexShrink: 0, paddingTop: 1 }}>
                        활동 계획
                      </Text>
                      <Text style={{ fontSize: 14, color: draft.plan.trim() ? TEXT : FAINT, whiteSpace: 'pre-wrap', flex: 1 }}>
                        {draft.plan.trim() || '미입력'}
                      </Text>
                    </div>
                  </Stack>

                  <Group
                    gap={8}
                    mt={20}
                    wrap="nowrap"
                    align="flex-start"
                    style={{
                      borderTop: `1px solid ${BORDER_SOFT}`,
                      paddingTop: 18,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: SUB, lineHeight: 1.6, flex: 1 }}>
                      신청서 내용을 그대로 가져왔어요. 인적사항·장소·기간·계획을 고치려면
                      신청서로 돌아가야 해요.
                    </Text>
                    <button
                      type="button"
                      onClick={() => router.push(`/c/${uuid}`)}
                      className="ghost-btn"
                      style={{
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        cursor: 'pointer',
                        color: LABEL_COLOR,
                        fontSize: 13,
                        fontWeight: 500,
                        padding: '7px 12px',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      신청서 고치기
                    </button>
                  </Group>
                </Paper>
              ) : draft.reportStep === 'experience' ? (
                <Paper withBorder radius={CARD_RADIUS} p={24} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
                  <StepHeader
                    icon={IconNotes}
                    title="체험내용"
                    description="실제로 다녀온 내용을 과거형으로 적으면 빅배가 문장을 다듬어드려요."
                  />

                  <Stack gap={18}>
                    <div>
                      <Textarea
                        label="체험내용"
                        placeholder="대충 적어도 됩니다. 예: 박물관에서 조선시대 생활사 전시를 관람하고 체험 프로그램에 참여했다"
                        value={draft.experience}
                        onChange={(e) => update({ experience: e.currentTarget.value })}
                        autosize
                        minRows={5}
                        maxRows={10}
                        radius="md"
                        size="md"
                        styles={INPUT_STYLES}
                      />
                      <Text style={{ fontSize: 13, color: SUB, marginTop: 8, lineHeight: 1.55 }}>
                        실제로 있었던 일을 과거형으로 써주세요. 계획이 아니라 다녀온 뒤의 기록이에요.
                      </Text>
                      <Group justify="flex-end" mt={8}>
                        <PolishButton
                          onClickAction={() => void handlePolish('experience')}
                          loading={polishing === 'experience'}
                          disabled={draft.experience.trim() === '' || polishing !== null}
                        />
                      </Group>
                    </div>

                    {polishError !== null && (
                      <Text style={{ fontSize: 13, color: DANGER, lineHeight: 1.5 }}>
                        {polishError}
                      </Text>
                    )}
                  </Stack>
                </Paper>
              ) : draft.reportStep === 'reflection' ? (
                <Paper withBorder radius={CARD_RADIUS} p={24} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
                  <StepHeader
                    icon={IconNotes}
                    title="느낀 점"
                    description="다녀와서 느낀 점과 배운 점을 적어주세요."
                  />

                  <Stack gap={18}>
                    <div>
                      <Textarea
                        label="느낀 점"
                        placeholder="대충 적어도 됩니다. 예: 유물을 직접 보면서 역사를 더 생생하게 느낄 수 있었다"
                        value={draft.reflection}
                        onChange={(e) => update({ reflection: e.currentTarget.value })}
                        autosize
                        minRows={5}
                        maxRows={10}
                        radius="md"
                        size="md"
                        styles={INPUT_STYLES}
                      />
                      <Group justify="flex-end" mt={8}>
                        <PolishButton
                          onClickAction={() => void handlePolish('reflection')}
                          loading={polishing === 'reflection'}
                          disabled={draft.reflection.trim() === '' || polishing !== null}
                        />
                      </Group>
                    </div>

                    <div>
                      <TextInput
                        label="첨부자료"
                        placeholder="입장권, 현장 사진 3장"
                        value={draft.attachmentNote}
                        onChange={(e) => update({ attachmentNote: e.currentTarget.value })}
                        leftSection={<IconPaperclip size={16} color={SUB} />}
                        radius="md"
                        size="md"
                        styles={INPUT_STYLES}
                      />
                      <Text style={{ fontSize: 13, color: SUB, marginTop: 8, lineHeight: 1.55 }}>
                        어떤 자료를 붙이는지 글로 적고, 사진은 아래에서 한 장 넣을 수 있어요.
                      </Text>
                    </div>

                    <div>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: LABEL_COLOR,
                          marginBottom: 6,
                        }}
                      >
                        증빙 사진
                      </Text>

                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        onChange={(e) => {
                          const file = e.currentTarget.files?.[0];
                          e.currentTarget.value = '';
                          if (file) void handlePhotoPick(file);
                        }}
                        style={{ display: 'none' }}
                      />

                      {draft.attachmentPhoto === null ? (
                        <button
                          type="button"
                          className="photo-drop"
                          onClick={() => photoInputRef.current?.click()}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            width: '100%',
                            padding: '22px 16px',
                            borderRadius: 8,
                            border: `1px dashed ${BORDER}`,
                            backgroundColor: 'white',
                            cursor: 'pointer',
                            color: SUB,
                            fontSize: 14,
                          }}
                        >
                          <IconPhoto size={17} color={SUB} />
                          사진 고르기
                        </button>
                      ) : (
                        <div
                          className="photo-card"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: 12,
                            borderRadius: 8,
                            border: `1px solid ${BORDER}`,
                            backgroundColor: 'white',
                          }}
                        >
                          <Image
                            src={draft.attachmentPhoto.dataUrl}
                            alt="첨부한 증빙 사진"
                            width={72}
                            height={72}
                            unoptimized
                            style={{
                              width: 72,
                              height: 72,
                              objectFit: 'cover',
                              borderRadius: 6,
                              border: `1px solid ${BORDER_SOFT}`,
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              fw={600}
                              style={{
                                fontSize: 14,
                                color: TEXT,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {draft.attachmentPhoto.name}
                            </Text>
                            <Text style={{ fontSize: 13, color: SUB, marginTop: 2 }}>
                              {draft.attachmentPhoto.naturalWidth} ×{' '}
                              {draft.attachmentPhoto.naturalHeight}
                            </Text>
                          </div>
                          <Group gap={6} style={{ flexShrink: 0 }}>
                            <Tooltip label="다른 사진으로 바꿔요" {...TOOLTIP_PROPS}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => photoInputRef.current?.click()}
                              >
                                바꾸기
                              </Button>
                            </Tooltip>
                            <Tooltip label="사진을 빼요" {...TOOLTIP_PROPS}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => update({ attachmentPhoto: null })}
                              >
                                빼기
                              </Button>
                            </Tooltip>
                          </Group>
                        </div>
                      )}

                      <Text style={{ fontSize: 13, color: SUB, marginTop: 8, lineHeight: 1.55 }}>
                        사진은 첨부자료 칸에 한 장 들어가요. 여러 장이면 한글에서 더 붙이면 돼요.
                      </Text>

                      {photoError !== null && (
                        <Text style={{ fontSize: 13, color: DANGER, marginTop: 6, lineHeight: 1.5 }}>
                          {photoError}
                        </Text>
                      )}
                    </div>

                    {polishError !== null && (
                      <Text style={{ fontSize: 13, color: DANGER, lineHeight: 1.5 }}>
                        {polishError}
                      </Text>
                    )}
                  </Stack>
                </Paper>
              ) : draft.reportStep === 'review' ? (
                <Paper withBorder radius={CARD_RADIUS} p={24} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
                  <StepHeader
                    icon={IconFileText}
                    title="검토"
                    description="입력한 내용을 확인하고 보고서를 만들어보세요."
                  />

                  <Stack gap={0}>
                    {(
                      [
                        {
                          label: '학생',
                          value: selectedStudents.map((s) => `${s.name} (${s.classInfo})`).join('\n'),
                          step: 'confirm' as ReportStep,
                        },
                        {
                          label: '장소',
                          value: [draft.destination, draft.placeAddress].filter((v) => v.trim() !== '').join(' · '),
                          step: 'confirm' as ReportStep,
                        },
                        { label: '기간', value: dateRangeLabel, step: 'confirm' as ReportStep },
                        { label: '체험내용', value: draft.experience.trim(), step: 'experience' as ReportStep },
                        { label: '느낀 점', value: draft.reflection.trim(), step: 'reflection' as ReportStep },
                        { label: '첨부자료', value: draft.attachmentNote.trim(), step: 'reflection' as ReportStep },
                        {
                          label: '증빙 사진',
                          value: draft.attachmentPhoto?.name ?? '',
                          step: 'reflection' as ReportStep,
                        },
                      ]
                    ).map((row, index) => (
                      <div
                        key={row.label}
                        style={{
                          display: 'flex',
                          gap: 16,
                          padding: '13px 0',
                          borderTop: index === 0 ? undefined : `1px solid ${BORDER_SOFT}`,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: SUB, width: 92, flexShrink: 0, paddingTop: 1 }}>
                          {row.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: row.value ? TEXT : FAINT,
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
                    <Group justify="space-between" align="center" mb={10} wrap="nowrap">
                      <div>
                        <Text style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>미리보기</Text>
                        <Text style={{ fontSize: 13, color: SUB, marginTop: 4 }}>
                          {previewStudent
                            ? `${previewStudent.name} 학생의 보고서예요.`
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
                            <Text style={{ fontSize: 13, color: SUB }}>보고서를 그리고 있어요</Text>
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

                  <Button
                    onClick={handleGenerate}
                    disabled={missingRequired.length > 0 || generating}
                    style={{ width: '100%', marginTop: 20 }}
                  >
                    {generating ? (
                      <>
                        <IconLoader2 size={16} className="spin" />
                        문서를 만들고 있어요
                      </>
                    ) : (
                      '문서 만들기'
                    )}
                  </Button>
                </Paper>
              ) : (
                <Paper withBorder radius={CARD_RADIUS} p={24} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
                  <StepHeader
                    icon={IconFileText}
                    title="문서"
                    description={
                      documents.length === 0
                        ? '보고서를 다시 만들어 주세요.'
                        : documents.length > 1
                          ? `학생 ${documents.length}명의 보고서를 각각 만들었어요.`
                          : '보고서가 만들어졌어요. 내려받아 확인하세요.'
                    }
                  />

                  {documents.length === 0 ? (
                    <Stack gap={14}>
                      <Text style={{ fontSize: 14, color: SUB, lineHeight: 1.6 }}>
                        만들어 둔 문서가 없어요. 문서는 저장되지 않으니 다시 만들어야 해요.
                      </Text>
                      <Group>
                        <Button onClick={() => update({ reportStep: 'review' })}>
                          검토로 가서 다시 만들기
                        </Button>
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
                              <IconCheck size={18} color={DONE_COLOR} stroke={3} style={{ marginRight: 6 }} />
                              <Tooltip label="HWPX 내려받기" {...TOOLTIP_PROPS}>
                                <a
                                  href={document.url}
                                  download={document.name}
                                  aria-label={`${document.studentName} 보고서 HWPX 내려받기`}
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
                                  aria-label={`${document.studentName} 보고서 인쇄 또는 PDF로 저장`}
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
                            <Button
                              onClick={() => void handleDownloadAll()}
                              leftIcon={<IconDownload size={buttonIconSize()} />}
                            >
                              HWPX {documents.length}개 받기
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => void handlePrintAll()}
                              disabled={printing !== null}
                              leftIcon={
                                printing === '__all__' ? (
                                  <IconLoader2 size={buttonIconSize()} className="spin" />
                                ) : (
                                  <IconPrinter size={buttonIconSize()} />
                                )
                              }
                            >
                              모두 인쇄 · PDF
                            </Button>
                          </>
                        )}
                        <Button variant="outline" onClick={() => update({ reportStep: 'review' })}>
                          다시 만들기
                        </Button>
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
                <Button variant="outline" onClick={handlePrev}>
                  이전
                </Button>
              ) : (
                <span />
              )}
              {draft.reportStep === 'review' ? (
                <Button onClick={handleGenerate} disabled={missingRequired.length > 0 || generating}>
                  {generating ? '만드는 중...' : '문서 만들기'}
                </Button>
              ) : isLastStep ? (
                <Button onClick={openDone} disabled={documents.length === 0}>
                  완료
                </Button>
              ) : (
                <Button onClick={handleNext} disabled={!canAdvance}>
                  다음
                </Button>
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
            variant="report"
          />
        </Paper>
      </div>

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
            <Text fw={700} style={{ fontSize: FZ.section, color: TEXT }}>
              체험학습 보고서를 모두 완료했어요
            </Text>
            <Text style={{ fontSize: 14, color: SUB, marginTop: 6, lineHeight: 1.6 }}>
              문서를 받아서 학교에 제출하면 끝이에요.
              <br />
              증빙자료는 잊지 말고 함께 첨부해 주세요.
            </Text>
          </div>

          <Stack gap={8}>
            <button
              type="button"
              onClick={() => void handleDownloadAll()}
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
              <IconDownload size={17} color={SUB} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text fw={600} style={{ fontSize: 14, color: TEXT }}>
                  {documents.length > 1
                    ? `HWPX ${documents.length}개 모두 받기`
                    : 'HWPX 받아두기'}
                </Text>
                <Text style={{ fontSize: 13, color: SUB, marginTop: 2 }}>
                  한글에서 열어 서명란을 채우면 제출할 수 있어요.
                </Text>
              </div>
            </button>

            <button
              type="button"
              onClick={() => void handlePrintAll()}
              disabled={printing !== null}
              className="setting-option"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '13px 14px',
                borderRadius: 10,
                cursor: printing !== null ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                opacity: printing !== null ? 0.55 : 1,
              }}
            >
              {printing === '__all__' ? (
                <IconLoader2 size={17} className="spin" color={SUB} style={{ flexShrink: 0 }} />
              ) : (
                <IconPrinter size={17} color={SUB} style={{ flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text fw={600} style={{ fontSize: 14, color: TEXT }}>
                  바로 인쇄하거나 PDF로 저장
                </Text>
                <Text style={{ fontSize: 13, color: SUB, marginTop: 2 }}>
                  인쇄 창에서 &lsquo;PDF로 저장&rsquo;을 고르면 돼요.
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
            <Button
              onClick={() => {
                closeDone();
                router.push('/');
              }}
              leftIcon={<IconArrowLeft size={buttonIconSize()} />}
            >
              홈으로 가기
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
