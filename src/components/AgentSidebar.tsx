'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkLooseBold } from '@/lib/remark-loose-bold';
import { Collapse, Group, Menu, Popover, Stack, Switch, Text, Textarea, Tooltip, Transition } from '@mantine/core';
import {
  IconSparkles,
  IconArrowUp,
  IconCalendarEvent,
  IconChevronDown,
  IconCheck,
  IconPlus,
  IconAdjustmentsHorizontal,
  IconX,
  IconPaperclip,
  IconSchool,
  IconTextWrap,
  IconBrain,
  IconTool,
  IconMapPin,
  IconAlertCircle,
  IconBolt,
  IconHelpCircle,
  IconArrowRightBar,
  IconPencil,
} from '@tabler/icons-react';
import {
  AGENT_NAME,
  type AgentModel,
  type AgentModelId,
  type ChatAttachment,
  type ChatMessage,
  type ToolCall,
} from '@/lib/types';
import {
  BORDER,
  DARK,
  SUB,
  TEXT,
  LABEL_COLOR,
  SURFACE_SOFT,
  TOOLTIP_PROPS,
  DONE_COLOR,
  DANGER,
} from '@/lib/theme';
import { RAW, FZ, WARN_TEXT } from '@/lib/graphite/theme';
import { Button } from '@/lib/graphite/components';
import { createId } from '@/lib/storage';

export type AgentVariant = 'application' | 'report';

type OnboardStep = { label: string; example?: string };

type VariantCopy = {
  role: string;
  headline: string;
  suggestions: { label: string; icon: typeof IconSparkles }[];
  onboardSteps: OnboardStep[];
};

const VARIANT_COPY: Record<AgentVariant, VariantCopy> = {
  application: {
    role: '신청서 작성 도우미',
    headline: '말로 설명하면 신청서를 채워드려요',
    suggestions: [
      { label: '다음 주 금요일부터 2박 3일 제주도', icon: IconCalendarEvent },
      { label: '경복궁으로 견학 신청서 써줘', icon: IconMapPin },
      { label: '이 내용으로 문장 다듬어줘', icon: IconSparkles },
    ],
    onboardSteps: [
      {
        label: '체험 내용을 자유롭게 말해주세요',
        example: '예: "다음 주 금요일에 제주도 3일 다녀와요"',
      },
      { label: 'AI가 날짜·장소·목적을 채워요' },
      { label: '왼쪽에서 확인하고 고치면 끝' },
    ],
  },
  report: {
    role: '보고서 작성 도우미',
    headline: '다녀온 이야기를 하면 보고서를 채워드려요',
    suggestions: [
      { label: '경복궁 다녀왔어요', icon: IconMapPin },
      { label: '보고서 다 써줘', icon: IconSparkles },
      { label: '이 내용으로 문장 다듬어줘', icon: IconTextWrap },
    ],
    onboardSteps: [
      {
        label: '무엇을 하고 왔는지 말해주세요',
        example: '예: "근정전이랑 박물관 보고 왔어요"',
      },
      { label: 'AI가 체험내용과 느낀 점을 써요' },
      { label: '왼쪽에서 확인하고 고치면 끝' },
    ],
  },
};

const WRITING_OPTIONS = [
  { id: 'formalTone', label: '공문서 말투로 작성', icon: IconSchool },
  { id: 'autoFill', label: '입력한 내용 자동 반영', icon: IconSparkles },
  { id: 'longer', label: '문장을 길게 풀어쓰기', icon: IconTextWrap },
] as const;

type WritingOptionId = (typeof WRITING_OPTIONS)[number]['id'];

export type WritingOptionState = Record<WritingOptionId, boolean> & { turbo: boolean };

type Attachment = { id: string; name: string; previewUrl: string | null; file: File };

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;
const SUPPORTED_ATTACHMENT_TYPES = new Set([
  'application/pdf',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ANSWER_ROW_HEIGHT = 38;

const ICON_BTN: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: 'none',
  backgroundColor: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: SUB,
  cursor: 'pointer',
  flexShrink: 0,
};

function getComposerError(error: string): { title: string; detail: string } {
  if (error === 'An error occurred.') {
    return {
      title: '응답을 만들지 못했어요.',
      detail: '잠시 후 다시 시도해 주세요.',
    };
  }

  return {
    title: '오류가 발생했어요.',
    detail: error,
  };
}

function ReasoningPanel({
  steps,
  seconds,
  raw,
}: {
  steps: string[];
  seconds: number;
  raw: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        maxWidth: '92%',
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        backgroundColor: SURFACE_SOFT,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="reasoning-toggle"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          width: '100%',
          border: 'none',
          cursor: 'pointer',
          padding: '9px 12px',
          textAlign: 'left',
        }}
      >
        <IconBrain size={15} color={SUB} style={{ flexShrink: 0 }} />
        <Text style={{ fontSize: 13, color: LABEL_COLOR, flex: 1 }}>
          {seconds > 0 ? `${seconds}초 동안 생각함` : '생각 과정'}
          {raw && (
            <Text component="span" style={{ fontSize: 12, color: SUB, marginLeft: 6 }}>
              전체 보기
            </Text>
          )}
        </Text>
        <IconChevronDown
          size={14}
          color={SUB}
          style={{
            flexShrink: 0,
            transition: 'transform 180ms ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      <Collapse expanded={open} transitionDuration={180}>
        {raw ? (
          <Text
            style={{
              fontSize: 12,
              lineHeight: 1.75,
              color: SUB,
              padding: '2px 12px 14px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {steps.join(' ')}
          </Text>
        ) : (
          <Stack gap={8} style={{ padding: '2px 12px 12px' }}>
            {steps.map((step, index) => (
              <div key={`${step}-${index}`} style={{ display: 'flex', gap: 8 }}>
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    backgroundColor: SUB,
                    flexShrink: 0,
                    marginTop: 7,
                  }}
                />
                <Text style={{ fontSize: 12, lineHeight: 1.6, color: SUB }}>{step}</Text>
              </div>
            ))}
          </Stack>
        )}
      </Collapse>
    </div>
  );
}

function MessageAttachments({
  attachments,
  align,
}: {
  attachments: ChatAttachment[];
  align: 'flex-end' | 'flex-start';
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: align,
        maxWidth: '85%',
      }}
    >
      {attachments.map((attachment) =>
        attachment.mediaType.startsWith('image/') ? (
          <img
            key={attachment.id}
            src={attachment.url}
            alt={attachment.name}
            style={{
              width: 108,
              height: 108,
              objectFit: 'cover',
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              display: 'block',
            }}
          />
        ) : (
          <div
            key={attachment.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              maxWidth: 200,
              padding: '8px 10px',
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              backgroundColor: 'white',
            }}
          >
            <IconPaperclip size={14} color={SUB} style={{ flexShrink: 0 }} />
            <Text
              style={{
                fontSize: 13,
                color: LABEL_COLOR,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {attachment.name}
            </Text>
          </div>
        )
      )}
    </div>
  );
}

function QuestionCard({
  call,
  onAnswerAction,
  disabled,
}: {
  call: ToolCall;
  onAnswerAction: (answer: string) => void;
  disabled: boolean;
}) {
  const [draftAnswer, setDraftAnswer] = useState('');
  const candidates = call.candidates ?? [];
  const choices = call.choices ?? [];
  const trimmedAnswer = draftAnswer.trim();
  const [customOpen, setCustomOpen] = useState(choices.length === 0);
  const customRef = useRef<HTMLTextAreaElement>(null);

  const submitFreeText = () => {
    if (disabled || trimmedAnswer === '') return;
    onAnswerAction(trimmedAnswer);
    setDraftAnswer('');
  };

  const openCustom = () => {
    setCustomOpen(true);
    // Collapse가 펼쳐진 뒤에 포커스를 줘야 스크롤이 튀지 않는다.
    requestAnimationFrame(() => customRef.current?.focus());
  };

  return (
    <div
      className="fade-up"
      style={{
        maxWidth: '92%',
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        backgroundColor: 'white',
        padding: '13px 14px',
      }}
    >
      <Group gap={7} wrap="nowrap" align="flex-start" mb={11}>
        <IconHelpCircle size={15} color={SUB} style={{ flexShrink: 0, marginTop: 2 }} />
        <Text style={{ fontSize: 14, lineHeight: 1.5, color: TEXT, flex: 1 }}>
          {call.detail ?? '추가 정보가 필요해요.'}
        </Text>
      </Group>

      {candidates.length > 0 && (
        <Stack gap={6}>
          {candidates.map((candidate) => (
            <button
              key={`${candidate.name}-${candidate.address}`}
              type="button"
              disabled={disabled}
              onClick={() => onAnswerAction(`${candidate.name} (${candidate.address})`)}
              className="answer-chip"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '9px 12px',
                borderRadius: 8,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <Text style={{ fontSize: 14, color: TEXT, fontWeight: 500 }}>
                {candidate.name}
              </Text>
              <Text style={{ fontSize: 13, color: SUB, marginTop: 2 }}>
                {candidate.address}
              </Text>
            </button>
          ))}
        </Stack>
      )}

      {choices.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {choices.map((choice) => (
            <button
              key={choice}
              type="button"
              disabled={disabled}
              onClick={() => onAnswerAction(choice)}
              className="answer-chip"
              style={{
                fontSize: 13,
                padding: '7px 13px',
                borderRadius: 8,
                cursor: disabled ? 'not-allowed' : 'pointer',
                color: LABEL_COLOR,
                textAlign: 'left',
                lineHeight: 1.5,
              }}
            >
              {choice}
            </button>
          ))}

          <Transition mounted={!customOpen} transition="fade" duration={140}>
            {(styles) => (
              <button
                type="button"
                disabled={disabled}
                onClick={openCustom}
                className="suggest-chip"
                style={{
                  ...styles,
                  fontSize: 13,
                  padding: '7px 13px',
                  borderRadius: 8,
                  border: `1px dashed ${BORDER}`,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  color: SUB,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <IconPencil size={13} />
                직접 입력
              </button>
            )}
          </Transition>
        </div>
      )}

      <Collapse expanded={customOpen} transitionDuration={200}>
        <div style={{ marginTop: choices.length > 0 ? 8 : 0 }}>
          <Textarea
            ref={customRef}
            autosize
            minRows={1}
            maxRows={3}
            value={draftAnswer}
            onChange={(e) => setDraftAnswer(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submitFreeText();
              }
            }}
            disabled={disabled}
            placeholder={call.placeholder ?? '직접 입력할게요'}
            aria-label={call.detail ?? '답변 입력'}
            styles={{ input: { fontSize: 14, color: TEXT, minHeight: ANSWER_ROW_HEIGHT } }}
          />
          <Group justify="flex-end" mt={8}>
            <Button
              onClick={submitFreeText}
              disabled={disabled || trimmedAnswer === ''}
              style={{ height: ANSWER_ROW_HEIGHT, padding: '0 15px' }}
            >
              확인
            </Button>
          </Group>
        </div>
      </Collapse>
    </div>
  );
}

function ThinkingPanel({
  steps,
  elapsed,
  raw,
}: {
  steps: string[];
  elapsed: number;
  raw: boolean;
}) {
  return (
    <div
      className="fade-up"
      style={{
        maxWidth: '92%',
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        backgroundColor: SURFACE_SOFT,
        padding: '10px 12px',
      }}
    >
      <Group gap={7} wrap="nowrap">
        <IconBrain size={15} color={SUB} className="brain-pulse" />
        <Text fw={600} style={{ fontSize: 13, color: LABEL_COLOR }}>
          생각 중
        </Text>
        <Text style={{ fontSize: 12, color: SUB }}>{elapsed}초</Text>
      </Group>

      {steps.length > 0 &&
        (raw ? (
          <Text
            className="fade-up"
            style={{ fontSize: 12, lineHeight: 1.75, color: SUB, marginTop: 9 }}
          >
            {steps.join(' ')}
          </Text>
        ) : (
          <Stack gap={4} mt={9}>
            {steps.map((step, index) => (
              <Text
                key={`${step}-${index}`}
                className="fade-up"
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: index === steps.length - 1 ? LABEL_COLOR : SUB,
                }}
              >
                {step}
              </Text>
            ))}
          </Stack>
        ))}
    </div>
  );
}

const TOOL_ICONS = {
  skill: IconSparkles,
  navigate: IconArrowRightBar,
  question: IconHelpCircle,
  tool: IconTool,
} as const;

function ToolCallRow({ call, isLast }: { call: ToolCall; isLast: boolean }) {
  const Icon = TOOL_ICONS[call.kind];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 9,
        padding: '9px 12px',
        borderBottom: isLast ? 'none' : `1px solid ${BORDER}`,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          backgroundColor: 'white',
          border: `1px solid ${BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <Icon size={12} color={SUB} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text fw={600} style={{ fontSize: 13, color: LABEL_COLOR }}>
            {call.name}
          </Text>
          {call.target && (
            <Text style={{ fontSize: 13, color: SUB }}>→ {call.target}</Text>
          )}
        </div>

        {call.fields && call.fields.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
            {call.fields.map((field) => (
              <span
                key={field}
                style={{
                  fontSize: 12,
                  color: SUB,
                  padding: '2px 7px',
                  borderRadius: 5,
                  backgroundColor: 'white',
                  border: `1px solid ${BORDER}`,
                }}
              >
                {field}
              </span>
            ))}
          </div>
        )}

        {call.detail && (
          <Text style={{ fontSize: 13, lineHeight: 1.5, color: SUB, marginTop: 3 }}>
            {call.detail}
          </Text>
        )}
      </div>

      <div style={{ flexShrink: 0, marginTop: 3 }}>
        {call.status === 'running' && <span className="tool-run-dot" />}
        {call.status === 'done' && <IconCheck size={14} color={DONE_COLOR} stroke={3} />}
        {call.status === 'error' && <IconX size={14} color={DANGER} stroke={3} />}
      </div>
    </div>
  );
}

function ToolCallList({ calls }: { calls: ToolCall[] }) {
  const visible = calls.filter((call) => call.kind !== 'question');
  if (visible.length === 0) return null;

  return (
    <div
      style={{
        maxWidth: '92%',
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        backgroundColor: SURFACE_SOFT,
        overflow: 'hidden',
      }}
    >
      {visible.map((call, index) => (
        <ToolCallRow key={call.id} call={call} isLast={index === visible.length - 1} />
      ))}
    </div>
  );
}

export default function AgentSidebar({
  messages,
  onSendAction,
  models,
  modelId,
  onModelChangeAction,
  thinking,
  thinkingSteps,
  thinkingElapsed,
  errorMessage,
  variant = 'application',
}: {
  messages: ChatMessage[];
  onSendAction: (text: string, files: File[], options: WritingOptionState) => void;
  models: AgentModel[];
  modelId: AgentModelId;
  onModelChangeAction: (id: AgentModelId) => void;
  thinking: boolean;
  thinkingSteps: string[];
  thinkingElapsed: number;
  errorMessage: string | null;
  variant?: AgentVariant;
}) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [leavingIds, setLeavingIds] = useState<string[]>([]);
  const [optionsOpened, setOptionsOpened] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [options, setOptions] = useState<Record<WritingOptionId, boolean>>({
    formalTone: true,
    autoFill: true,
    longer: false,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, thinking, thinkingSteps.length]);

  const copy = VARIANT_COPY[variant];
  const trimmed = input.trim();
  const activeModel = models.find((model) => model.id === modelId) ?? null;
  const canSend = (trimmed !== '' || attachments.length > 0) && !thinking && activeModel !== null;
  const composerError = attachmentError ?? errorMessage;

  const lastMessage = messages.at(-1);
  const pendingQuestion =
    lastMessage?.role === 'agent' && !thinking
      ? lastMessage.toolCalls?.findLast(
          (call) =>
            call.kind === 'question' &&
            (call.freeText === true ||
              (call.choices?.length ?? 0) > 0 ||
              (call.candidates?.length ?? 0) > 0)
        )
      : undefined;

  const handleAnswer = (answer: string) => {
    if (thinking || activeModel === null) return;
    onSendAction(answer, [], { ...options, turbo });
  };

  /** createObjectURL로 만든 URL은 명시적으로 해제해야 메모리에 남지 않는다. */
  const releasePreviews = (items: Attachment[]) => {
    items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  };

  const removeAttachment = (id: string) => {
    setLeavingIds((prev) => [...prev, id]);
    setTimeout(() => {
      setAttachments((prev) => {
        const target = prev.find((item) => item.id === id);
        if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
        return prev.filter((item) => item.id !== id);
      });
      setLeavingIds((prev) => prev.filter((item) => item !== id));
    }, 170);
  };

  const handleSend = () => {
    if (!canSend) return;
    onSendAction(
      trimmed,
      attachments.map((attachment) => attachment.file),
      { ...options, turbo }
    );
    setInput('');
    setAttachments((prev) => {
      releasePreviews(prev);
      return [];
    });
  };

  const handleFiles = (files: File[]) => {
    const supported = files.filter((file) => SUPPORTED_ATTACHMENT_TYPES.has(file.type));
    const oversized = supported.some((file) => file.size > MAX_ATTACHMENT_BYTES);
    const availableSlots = MAX_ATTACHMENTS - attachments.length;

    if (supported.length !== files.length) {
      setAttachmentError('PNG, JPEG, GIF, WebP 이미지와 PDF만 첨부할 수 있어요.');
      return;
    }
    if (oversized) {
      setAttachmentError('파일 하나의 크기는 5MB까지예요.');
      return;
    }
    if (availableSlots <= 0 || supported.length > availableSlots) {
      setAttachmentError(`파일은 최대 ${MAX_ATTACHMENTS}개까지 첨부할 수 있어요.`);
      return;
    }

    const picked = supported.map((file) => ({
      id: createId(),
      name: file.name,
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));
    setAttachmentError(null);
    setAttachments((prev) => [...prev, ...picked]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '16px 18px',
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            backgroundColor: SURFACE_SOFT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconSparkles size={17} color={SUB} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700} style={{ fontSize: 14, color: TEXT }}>
            {AGENT_NAME}
          </Text>
          <Text style={{ fontSize: 13, color: SUB }}>막히는 부분을 물어보세요.</Text>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="agent-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: 18,
          gap: 10,
        }}
      >
        {messages.length === 0 ? (
          <div className="fade-up" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: SURFACE_SOFT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <IconSparkles size={14} color={SUB} />
              </div>
              <div>
                <Text fw={700} style={{ fontSize: 13, color: TEXT, lineHeight: 1.2 }}>
                  {AGENT_NAME}
                </Text>
                <Text style={{ fontSize: 12, color: SUB, lineHeight: 1.2 }}>
                  {copy.role}
                </Text>
              </div>
            </div>

            <div>
              <Text fw={700} style={{ fontSize: FZ.section, color: TEXT, lineHeight: 1.4 }}>
                {copy.headline}
              </Text>
              <Text style={{ fontSize: 14, color: SUB, marginTop: 4 }}>
                왼쪽 양식을 직접 고칠 수도 있어요.
              </Text>
            </div>

            <Stack gap={10}>
              {copy.onboardSteps.map((step, index) => (
                <div
                  key={step.label}
                  className="onboard-step"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    animationDelay: `${index * 60}ms`,
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: SURFACE_SOFT,
                      color: SUB,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Text style={{ fontSize: 14, color: LABEL_COLOR, lineHeight: 1.4 }}>
                      {step.label}
                    </Text>
                    {step.example && (
                      <Text style={{ fontSize: 13, color: SUB, marginTop: 2 }}>
                        {step.example}
                      </Text>
                    )}
                  </div>
                </div>
              ))}
            </Stack>

            <Stack gap={8}>
              {copy.suggestions.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  className="suggest-chip"
                  disabled={thinking || activeModel === null}
                  onClick={() => onSendAction(label, [], { ...options, turbo })}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    alignSelf: 'flex-start',
                    borderRadius: 20,
                    padding: '8px 14px',
                    fontSize: 13,
                    color: LABEL_COLOR,
                  }}
                >
                  <Icon size={14} color={SUB} />
                  {label}
                </button>
              ))}
            </Stack>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              if (message.role === 'system') {
                return (
                  <div
                    key={message.id}
                    className="fade-up"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}
                  >
                    <div style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
                    <Text style={{ fontSize: 12, color: SUB, whiteSpace: 'nowrap' }}>
                      {message.content}
                    </Text>
                    <div style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
                  </div>
                );
              }

              const isUser = message.role === 'user';
              const isStreamingTail = thinking && !isUser && index === messages.length - 1;
              return (
                <div
                  key={message.id}
                  className="fade-up"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    gap: 6,
                  }}
                >
                  {!isUser && message.reasoning && message.reasoning.length > 0 && (
                    <ReasoningPanel
                      steps={message.reasoning}
                      seconds={message.thinkingSeconds ?? 0}
                      raw={message.reasoningRaw ?? false}
                    />
                  )}
                  {isStreamingTail && (
                    <ThinkingPanel
                      steps={thinkingSteps}
                      elapsed={thinkingElapsed}
                      raw={false}
                    />
                  )}
                  {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
                    <ToolCallList calls={message.toolCalls} />
                  )}
                  {message.attachments && message.attachments.length > 0 && (
                    <MessageAttachments
                      attachments={message.attachments}
                      align={isUser ? 'flex-end' : 'flex-start'}
                    />
                  )}
                  {message.content !== '' && (
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: '9px 13px',
                      fontSize: 14,
                      lineHeight: 1.55,
                      whiteSpace: isUser ? 'pre-wrap' : 'normal',
                      borderRadius: 14,
                      ...(isUser
                        ? {
                            backgroundColor: DARK,
                            color: 'white',
                            borderBottomRightRadius: 4,
                          }
                        : {
                            backgroundColor: 'white',
                            border: `1px solid ${BORDER}`,
                            color: LABEL_COLOR,
                            borderBottomLeftRadius: 4,
                          }),
                    }}
                  >
                    {isUser ? (
                      message.content
                    ) : (
                      <div className="md">
                        <Markdown remarkPlugins={[remarkGfm, remarkLooseBold]}>
                          {message.content}
                        </Markdown>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              );
            })}

            {pendingQuestion && (
              <QuestionCard
                call={pendingQuestion}
                onAnswerAction={handleAnswer}
                disabled={thinking || activeModel === null}
              />
            )}

            {thinking && messages.at(-1)?.role !== 'agent' && (
              <ThinkingPanel steps={thinkingSteps} elapsed={thinkingElapsed} raw={false} />
            )}
          </>
        )}
      </div>

      <div style={{ padding: 18, paddingTop: 0, flexShrink: 0 }}>
        <div
          className="agent-composer"
          data-turbo={turbo}
          style={{
            borderRadius: 12,
            backgroundColor: 'white',
            padding: 10,
          }}
        >
          <div
            className="turbo-banner"
            data-on={turbo}
            aria-hidden={!turbo}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  paddingBottom: 10,
                }}
              >
                <IconBolt size={15} color={RAW.warnText} fill={RAW.warn} style={{ flexShrink: 0 }} />
                <Text fw={600} style={{ fontSize: 13, color: WARN_TEXT }}>
                  에이전트가 불필요한 질문하지 않고 빠르게 다 작성해요
                </Text>
              </div>
            </div>
          </div>

          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {attachments.map((item) => (
                <div
                  key={item.id}
                  className="attach-item"
                  data-leaving={leavingIds.includes(item.id)}
                  style={{ position: 'relative' }}
                >
                  {item.previewUrl ? (
                    // next/image는 blob: URL을 최적화할 수 없다. 로컬 미리보기이므로 img를 쓴다.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      style={{
                        width: 60,
                        height: 60,
                        objectFit: 'cover',
                        borderRadius: 10,
                        border: `1px solid ${BORDER}`,
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        height: 60,
                        maxWidth: 190,
                        backgroundColor: SURFACE_SOFT,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 10,
                        padding: '0 10px',
                        fontSize: 12,
                        color: LABEL_COLOR,
                      }}
                    >
                      <IconPaperclip size={13} color={SUB} style={{ flexShrink: 0 }} />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.name}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label={`${item.name} 첨부 제거`}
                    onClick={() => removeAttachment(item.id)}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 18,
                      height: 18,
                      border: `1px solid ${BORDER}`,
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      color: LABEL_COLOR,
                      padding: 0,
                    }}
                  >
                    <IconX size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Transition mounted={composerError !== null} transition="fade" duration={160} timingFunction="ease">
            {(styles) => {
              const error = composerError ? getComposerError(composerError) : null;
              return (
                <div
                  role="alert"
                  className="fade-up"
                  style={{
                    ...styles,
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    border: `1px solid ${DANGER}`,
                    borderRadius: 8,
                    color: DANGER,
                    padding: '9px 10px',
                    marginBottom: 10,
                  }}
                >
                  <IconAlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <Text fw={700} style={{ fontSize: 13, color: DANGER }}>
                      {error?.title}
                    </Text>
                    <Text style={{ fontSize: 12, lineHeight: 1.45, color: LABEL_COLOR, marginTop: 2 }}>
                      {error?.detail}
                    </Text>
                  </div>
                </div>
              );
            }}
          </Transition>

          <Textarea
            variant="unstyled"
            autosize
            minRows={1}
            maxRows={5}
            placeholder="메시지를 입력하세요"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            aria-label={`${AGENT_NAME}에게 메시지 보내기`}
            styles={{ input: { fontSize: 14, color: TEXT, padding: 0 } }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Tooltip label="파일 첨부" {...TOOLTIP_PROPS}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="파일 첨부"
                className="ghost-btn"
                style={ICON_BTN}
              >
                <IconPlus size={17} />
              </button>
            </Tooltip>

            <Popover
              position="top-start"
              radius="md"
              shadow="md"
              width={252}
              withinPortal
              opened={optionsOpened}
              onChange={setOptionsOpened}
              onDismiss={() => setOptionsOpened(false)}
              closeOnEscape
              closeOnClickOutside
              trapFocus
              transitionProps={{ transition: 'pop-bottom-left', duration: 160 }}
            >
              <Tooltip label="작성 옵션" {...TOOLTIP_PROPS} disabled={optionsOpened}>
                <Popover.Target>
                  <button
                    type="button"
                    aria-label="작성 옵션"
                    aria-expanded={optionsOpened}
                    onClick={() => setOptionsOpened((prev) => !prev)}
                    className="ghost-btn"
                    data-active={optionsOpened}
                    style={ICON_BTN}
                  >
                    <IconAdjustmentsHorizontal size={17} />
                  </button>
                </Popover.Target>
              </Tooltip>
              <Popover.Dropdown p={14}>
                <Text fw={700} style={{ fontSize: 13, color: TEXT, marginBottom: 12 }}>
                  작성 옵션
                </Text>
                <Stack gap={12}>
                  {WRITING_OPTIONS.map((option) => (
                    <div
                      key={option.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      <option.icon size={16} color={SUB} style={{ flexShrink: 0 }} />
                      <Text style={{ fontSize: 13, color: LABEL_COLOR, flex: 1 }}>
                        {option.label}
                      </Text>
                      <Switch
                        size="sm"
                        color="dark"
                        checked={options[option.id]}
                        onChange={(e) => {
                          const { checked } = e.currentTarget;
                          setOptions((prev) => ({ ...prev, [option.id]: checked }));
                        }}
                        aria-label={option.label}
                      />
                    </div>
                  ))}
                </Stack>
              </Popover.Dropdown>
            </Popover>

            <Tooltip
              label={turbo ? '빠르게 작성하기: 켜짐' : '빠르게 작성하기'}
              {...TOOLTIP_PROPS}
            >
              <button
                type="button"
                onClick={() => setTurbo((prev) => !prev)}
                aria-label="빠르게 작성하기"
                aria-pressed={turbo}
                className="turbo-btn"
                data-on={turbo}
                style={ICON_BTN}
              >
                <IconBolt size={17} />
              </button>
            </Tooltip>

            <div style={{ flex: 1 }} />

            <Menu position="top-end" radius="md" shadow="md" withinPortal>
              <Menu.Target>
                <button
                  type="button"
                  aria-label={`모델 선택, 현재 ${activeModel?.label ?? '준비 중'}`}
                  disabled={thinking || models.length === 0}
                  className="ghost-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    border: 'none',
                    borderRadius: 8,
                    backgroundColor: 'transparent',
                    padding: '6px 8px',
                    fontSize: 13,
                    color: SUB,
                    cursor: 'pointer',
                  }}
                >
                  {activeModel?.label ?? '모델 준비 중'}
                  <IconChevronDown size={14} color={SUB} />
                </button>
              </Menu.Target>
              <Menu.Dropdown style={{ padding: 6, width: 'max-content', maxWidth: 300 }}>
                <Menu.Label style={{ fontSize: 12, color: SUB, padding: '4px 8px 6px' }}>
                  모델
                </Menu.Label>
                {models.map((model) => (
                  <Menu.Item
                    key={model.id}
                    onClick={() => onModelChangeAction(model.id)}
                    style={{ padding: '8px 8px', borderRadius: 8 }}
                  >
                    <Group gap={8} align="flex-start" wrap="nowrap">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            lineHeight: 1.35,
                            color: TEXT,
                            fontWeight: model.id === modelId ? 600 : 500,
                          }}
                        >
                          {model.label}
                        </Text>
                        <Text style={{ fontSize: 13, lineHeight: 1.45, color: SUB, marginTop: 2 }}>
                          {model.description}
                        </Text>
                      </div>
                      <div style={{ width: 14, flexShrink: 0, marginTop: 2 }}>
                        {model.id === modelId && <IconCheck size={14} color={DARK} />}
                      </div>
                    </Group>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>

            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              aria-label="메시지 보내기"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                backgroundColor: canSend ? DARK : SURFACE_SOFT,
                color: canSend ? 'white' : RAW.faint,
                cursor: canSend ? 'pointer' : 'not-allowed',
              }}
            >
              <IconArrowUp size={16} />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
            onChange={(e) => {
              const input = e.currentTarget;
              handleFiles(Array.from(input.files ?? []));
              input.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
}
