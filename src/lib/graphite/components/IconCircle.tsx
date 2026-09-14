'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { LayoutStyle } from './style';

export type IconCircleTone = 'done' | 'warn' | 'danger' | 'neutral';

/*
 * Tint and glyph colour are paired here so they cannot drift apart - a green
 * circle with a grey icon is the kind of near-miss that survives review.
 */
const TONE: Record<IconCircleTone, { bg: string; fg: string }> = {
  done: { bg: 'var(--g-done-bg)', fg: 'var(--g-done)' },
  warn: { bg: 'var(--g-warn-bg)', fg: 'var(--g-warn)' },
  danger: { bg: 'var(--g-danger-bg)', fg: 'var(--g-danger)' },
  neutral: { bg: 'var(--g-soft)', fg: 'var(--g-sub)' },
};

export type IconCircleProps = {
  /** An icon element. Colour it with `currentColor` so the tone drives it. */
  children: ReactNode;
  tone?: IconCircleTone;
  /** 48 for a feature card, 34 inline, 24 in a list row. */
  size?: number;
  style?: LayoutStyle;
};

/**
 * Circular tinted badge holding one icon. The recurring shape at the left of a
 * feature card or an empty state.
 *
 * Sets `color`, so a child icon using `currentColor` picks up the tone
 * automatically - pass `color="currentColor"` to Tabler icons rather than a
 * literal.
 */
export function IconCircle({ children, tone = 'neutral', size = 48, style }: IconCircleProps) {
  const { bg, fg } = TONE[tone];
  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    /* Without this a circle inside a flex row is the first thing to squash. */
    flexShrink: 0,
    color: fg,
  };
  return <div style={{ ...base, backgroundColor: bg, ...style }}>{children}</div>;
}
