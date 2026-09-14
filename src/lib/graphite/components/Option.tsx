'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LayoutStyle } from './style';
import { FW, FZ, ICON, INK, R, SP, SUB, TEXT } from '../theme';

type Native = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style' | 'children'>;

export type OptionProps = Native & {
  picked?: boolean;
  children: ReactNode;
  /** Second line, explaining the choice. */
  description?: ReactNode;
  style?: LayoutStyle;
};

/**
 * A row in a list of choices - settings, model pickers, search results.
 *
 * Selection is marked by the border and a weight shift, not a filled
 * background: a long list of picked rows would otherwise become a wall of
 * colour. The check column is always reserved, so selecting a row never shifts
 * its text sideways.
 */
export const Option = forwardRef<HTMLButtonElement, OptionProps>(function Option(
  { picked = false, children, description, style, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className="g-option"
      data-picked={picked}
      aria-pressed={picked}
      {...rest}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: SP.sm,
        width: '100%',
        padding: `11px ${SP.md}px`,
        borderRadius: R.md,
        textAlign: 'left',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: FZ.body,
            color: TEXT,
            fontWeight: picked ? FW.semibold : FW.medium,
          }}
        >
          {children}
        </div>
        {description != null && (
          <div style={{ fontSize: FZ.caption, color: SUB, marginTop: 2 }}>{description}</div>
        )}
      </div>
      <div style={{ width: ICON.inline, flexShrink: 0, marginTop: 2 }}>
        {picked && <CheckMark />}
      </div>
    </button>
  );
});

/*
 * Inline SVG rather than an icon dependency, so Option works in a project that
 * has not installed Tabler.
 */
function CheckMark() {
  return (
    <svg
      width={ICON.inline}
      height={ICON.inline}
      viewBox="0 0 24 24"
      fill="none"
      stroke={INK}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
