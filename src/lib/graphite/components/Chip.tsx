'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import type { LayoutStyle } from './style';
import { FW, FZ, R, SP } from '../theme';

const BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: SP.sm,
  padding: '7px 14px',
  borderRadius: R.pill,
  boxSizing: 'border-box',
};

type Native = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style' | 'children'>;

export type ChipProps = Native & {
  /** Drives both data-picked (CSS) and aria-pressed (screen readers). */
  picked?: boolean;
  children: ReactNode;
  /** Secondary text, recessed automatically when picked. */
  meta?: ReactNode;
  /** Escape hatch for layout only - margin, flex. Never colour. */
  style?: LayoutStyle;
};

/**
 * Toggles a value on or off. Filled ink when picked.
 *
 * `data-picked` and `aria-pressed` are set from one prop, so they can never
 * disagree - the visual state and the announced state stay in sync by
 * construction.
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { picked = false, children, meta, style, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className="g-chip"
      data-picked={picked}
      aria-pressed={picked}
      {...rest}
      style={{ ...BASE, ...style }}
    >
      {/* Colour comes from chip.css via data-picked, including the recessed
        * meta line - keeping it there means the label and the fill can never
        * disagree about whether the chip is selected. */}
      <span style={{ fontSize: FZ.body, fontWeight: FW.semibold }}>{children}</span>
      {meta != null && (
        <span className="g-chip-meta" style={{ fontSize: FZ.body }}>
          {meta}
        </span>
      )}
    </button>
  );
});

export type ChipAddProps = Native & {
  children: ReactNode;
  style?: LayoutStyle;
};

/** Opens a form to create a new entity. Dashed border reads as an empty slot. */
export const ChipAdd = forwardRef<HTMLButtonElement, ChipAddProps>(function ChipAdd(
  { children, style, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className="g-chip-add"
      {...rest}
      style={{
        ...BASE,
        gap: SP.xs,
        padding: '7px 16px',
        fontSize: FZ.body,
        fontWeight: FW.medium,
        ...style,
      }}
    >
      {children}
    </button>
  );
});

export type ChipActionProps = Native & {
  children: ReactNode;
  style?: LayoutStyle;
};

/** Fires a one-shot action. Squared, so it never reads as a selected value. */
export const ChipAction = forwardRef<HTMLButtonElement, ChipActionProps>(function ChipAction(
  { children, style, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className="g-chip-action"
      {...rest}
      style={{
        ...BASE,
        gap: SP.xs,
        padding: '7px 12px',
        borderRadius: R.md,
        fontSize: FZ.caption,
        fontWeight: FW.medium,
        ...style,
      }}
    >
      {children}
    </button>
  );
});

/** Wraps a set of chips with the standard flex-wrap gap. */
export function ChipGroup({ children, style }: { children: ReactNode; style?: LayoutStyle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: SP.sm, ...style }}>{children}</div>
  );
}
