'use client';

import { useEffect, useRef, useState } from 'react';
import { Group, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconLoader2, IconPencil, IconUsers } from '@tabler/icons-react';

import type { SaveState } from '@/lib/storage';
import { BORDER, DANGER, DARK, DONE_COLOR, SUB, SURFACE_SOFT, TEXT, TOOLTIP_PROPS } from '@/lib/theme';
import { FAINT, RAW } from '@/lib/graphite/theme';

/**
 * 신청서 편집 화면들(일반 체험학습, 반일 교외체험학습)이 함께 쓰는 틀: 제목 편집, 단계 머리말, 단계 표시기.
 */

/** 편집 화면 오른쪽 위의 저장 상태. 저장이 실패하면 "저장됨" 대신 이유를 알려 준다. */
export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;

  const failed = state === 'failed';
  return (
    <Tooltip
      label={
        failed
          ? '브라우저 저장 공간이 가득 차서 최근 변경을 저장하지 못했어요. 필요 없는 신청서를 지우거나 설정에서 저장 공간을 비워 주세요. 탭을 닫으면 이 변경은 사라져요.'
          : '서버에 저장되지 않고 브라우저에만 저장됩니다'
      }
      {...TOOLTIP_PROPS}
      position="top-end"
      multiline
      maw={280}
    >
      <Group gap={5} style={{ cursor: 'default' }} role={failed ? 'alert' : undefined}>
        {state === 'saving' ? (
          <>
            <IconLoader2 size={14} color={SUB} className="spin" />
            <Text style={{ fontSize: 13, color: SUB }}>저장 중…</Text>
          </>
        ) : failed ? (
          <>
            <IconAlertTriangle size={14} color={DANGER} />
            <Text style={{ fontSize: 13, color: DANGER, fontWeight: 500 }}>저장하지 못했어요</Text>
          </>
        ) : (
          <>
            <IconCheck size={14} color={DONE_COLOR} stroke={3} />
            <Text style={{ fontSize: 13, color: SUB }}>저장됨</Text>
          </>
        )}
      </Group>
    </Tooltip>
  );
}

export function DraftTitle({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
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
        placeholder={placeholder}
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
          color: value.trim() === '' ? FAINT : TEXT,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value.trim() === '' ? placeholder : value}
      </Text>
      <IconPencil size={15} color={SUB} style={{ flexShrink: 0 }} />
    </button>
  );
}

export function StepHeader({
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

export type StepperItem = { key: string; label: string; done: boolean };

/** 단계 표시기. 지나온 단계와 채워진 단계는 눌러서 돌아갈 수 있고, 아직 안 채운 앞 단계는 막는다. */
export function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: StepperItem[];
  current: string;
  onSelect: (key: string) => void;
}) {
  const currentIndex = steps.findIndex((step) => step.key === current);

  return (
    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflowX: 'auto' }} className="agent-scroll">
      {steps.map((step, index) => {
        const isCurrent = index === currentIndex;
        const isDone = !isCurrent && step.done;
        const isClickable = index <= currentIndex || isDone;
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: index === steps.length - 1 ? '0 0 auto' : 1 }}>
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => onSelect(step.key)}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`${step.label} 단계로 이동`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: isClickable ? 'pointer' : 'default',
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
                  transition: 'background-color 180ms ease, color 180ms ease',
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
                {step.label}
              </Text>
            </button>
            {index < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, backgroundColor: BORDER, margin: '0 12px' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
