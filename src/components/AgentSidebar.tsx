'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Collapse, Group, Menu, Popover, Stack, Switch, Text, Textarea, Tooltip } from '@mantine/core';
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
} from '@tabler/icons-react';
import {
  AGENT_MODELS,
  AGENT_NAME,
  type AgentModelId,
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
import { createId } from '@/lib/storage';

const SUGGESTIONS = [
  { label: '다음 주 금요일부터 2박 3일 제주도', icon: IconCalendarEvent },
  { label: '경복궁으로 견학 신청서 써줘', icon: IconMapPin },
  { label: '이 내용으로 문장 다듬어줘', icon: IconSparkles },
];

const ONBOARD_STEPS = [
  {
    label: '체험 내용을 자유롭게 말해주세요',
    example: '예: "다음 주 금요일에 제주도 3일 다녀와요"',
  },
  { label: 'AI가 날짜·장소·목적을 채워요' },
  { label: '왼쪽에서 확인하고 고치면 끝' },
];

const WRITING_OPTIONS = [
  { id: 'formalTone', label: '공문서 말투로 작성', icon: IconSchool },
  { id: 'autoFill', label: '입력한 내용 자동 반영', icon: IconSparkles },
  { id: 'longer', label: '문장을 길게 풀어쓰기', icon: IconTextWrap },
] as const;

type WritingOptionId = (typeof WRITING_OPTIONS)[number]['id'];

type Attachment = { id: string; name: string; previewUrl: string | null };

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
          background: 'none',
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

function ToolCallRow({ call, isLast }: { call: ToolCall; isLast: boolean }) {
  const Icon = call.kind === 'skill' ? IconSparkles : IconTool;

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
            <Text style={{ fontSize: 12, color: SUB }}>→ {call.target}</Text>
          )}
        </div>
        {call.detail && (
          <Text style={{ fontSize: 12, color: SUB, marginTop: 2 }}>{call.detail}</Text>
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
  if (calls.length === 0) return null;

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
      {calls.map((call, index) => (
        <ToolCallRow key={call.id} call={call} isLast={index === calls.length - 1} />
      ))}
    </div>
  );
}

export default function AgentSidebar({
  messages,
  onSend,
  modelId,
  onModelChange,
  thinking,
  thinkingSteps,
  thinkingElapsed,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  modelId: AgentModelId;
  onModelChange: (id: AgentModelId) => void;
  thinking: boolean;
  thinkingSteps: string[];
  thinkingElapsed: number;
}) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [leavingIds, setLeavingIds] = useState<string[]>([]);
  const [optionsOpened, setOptionsOpened] = useState(false);
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

  const trimmed = input.trim();
  const activeModel = AGENT_MODELS.find((m) => m.id === modelId) ?? AGENT_MODELS[0];

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
    if (trimmed === '') return;
    onSend(trimmed);
    setInput('');
    setAttachments((prev) => {
      releasePreviews(prev);
      return [];
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
                  신청서 작성 도우미
                </Text>
              </div>
            </div>

            <div>
              <Text fw={700} style={{ fontSize: 17, color: TEXT, lineHeight: 1.4 }}>
                말로 설명하면 신청서를 채워드려요
              </Text>
              <Text style={{ fontSize: 14, color: SUB, marginTop: 4 }}>
                왼쪽 양식을 직접 고칠 수도 있어요.
              </Text>
            </div>

            <Stack gap={10}>
              {ONBOARD_STEPS.map((step, index) => (
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
              {SUGGESTIONS.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  className="suggest-chip"
                  onClick={() => onSend(label)}
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
            {messages.map((message) => {
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
                  {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
                    <ToolCallList calls={message.toolCalls} />
                  )}
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: '9px 13px',
                      fontSize: 14,
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
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
                    {message.content}
                  </div>
                </div>
              );
            })}

            {thinking && (
              <div className="fade-up" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
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
                    <Text style={{ fontSize: 12, color: SUB }}>
                      {thinkingElapsed}초
                    </Text>
                    {modelId === 'fast' && (
                      <Text style={{ fontSize: 11, color: SUB, opacity: 0.8 }}>
                        · 전체 표시
                      </Text>
                    )}
                  </Group>

                  {thinkingSteps.length > 0 &&
                    (modelId === 'fast' ? (
                      <Text
                        className="fade-up"
                        style={{
                          fontSize: 12,
                          lineHeight: 1.75,
                          color: SUB,
                          marginTop: 9,
                        }}
                      >
                        {thinkingSteps.join(' ')}
                      </Text>
                    ) : (
                      <Stack gap={4} mt={9}>
                        {thinkingSteps.map((step, index) => (
                          <Text
                            key={`${step}-${index}`}
                            className="fade-up"
                            style={{
                              fontSize: 12,
                              lineHeight: 1.5,
                              color: index === thinkingSteps.length - 1 ? LABEL_COLOR : SUB,
                            }}
                          >
                            {step}
                          </Text>
                        ))}
                      </Stack>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ padding: 18, paddingTop: 0, flexShrink: 0 }}>
        <div
          className="agent-composer"
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            backgroundColor: 'white',
            padding: 10,
          }}
        >
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

            <div style={{ flex: 1 }} />

            <Menu position="top-end" radius="md" shadow="md" width={210} withinPortal>
              <Menu.Target>
                <button
                  type="button"
                  aria-label={`모델 선택, 현재 ${activeModel.label}`}
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
                  {activeModel.label}
                  <IconChevronDown size={14} color={SUB} />
                </button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>모델</Menu.Label>
                {AGENT_MODELS.map((model) => (
                  <Menu.Item
                    key={model.id}
                    onClick={() => onModelChange(model.id)}
                    rightSection={
                      model.id === modelId ? <IconCheck size={14} color={DARK} /> : null
                    }
                  >
                    <Text style={{ fontSize: 14, color: TEXT }}>{model.label}</Text>
                    <Text style={{ fontSize: 12, color: SUB }}>{model.description}</Text>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>

            <button
              type="button"
              onClick={handleSend}
              disabled={trimmed === ''}
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
                backgroundColor: trimmed === '' ? SURFACE_SOFT : DARK,
                color: trimmed === '' ? '#adb5bd' : 'white',
                cursor: trimmed === '' ? 'not-allowed' : 'pointer',
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
            accept="image/*,.pdf,.hwp,.hwpx,.doc,.docx"
            onChange={(e) => {
              const input = e.currentTarget;
              const picked: Attachment[] = Array.from(input.files ?? []).map((file) => ({
                id: createId(),
                name: file.name,
                previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
              }));
              if (picked.length > 0) setAttachments((prev) => [...prev, ...picked]);
              input.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
}
