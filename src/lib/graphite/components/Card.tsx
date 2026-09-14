'use client';

import type { ReactNode } from 'react';
import type { LayoutStyle } from './style';
import { LAYOUT } from '../theme';

export type CardTone = 'plain' | 'done' | 'warn' | 'danger';

/*
 * Tone is applied as a data attribute, not inline. Inline background, border and
 * box-shadow all outrank the :hover rules in surface.css, so writing the surface
 * here would leave CardLink unable to lift - which it silently did until a
 * computed-style check caught it.
 *
 * The fixed set is also what keeps green meaning "done" rather than becoming a
 * decorative choice.
 */

export type CardProps = {
  children: ReactNode;
  /** 16 by default; 24 for a card that stands alone on the page. */
  padding?: number;
  /** Status tint. Only for a banner or a completed row - never decoration. */
  tone?: CardTone;
  style?: LayoutStyle;
};

export function Card({ children, padding = LAYOUT.cardPadding, tone = 'plain', style }: CardProps) {
  return (
    <div className="g-card" data-tone={tone} style={{ padding, ...style }}>
      {children}
    </div>
  );
}

export type CardLinkProps = CardProps & {
  onClick: () => void;
  /** Accessible name when the card's visible content is not descriptive enough. */
  'aria-label'?: string;
};

/**
 * A card that navigates or acts. Renders a real button, so keyboard and screen
 * reader support come for free.
 *
 * The hover lift is why this is separate from Card: putting it on a static card
 * is a lie about interactivity. Only reach for this when a click does something.
 */
export function CardLink({
  children,
  onClick,
  padding = LAYOUT.cardPadding,
  style,
  ...rest
}: CardLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="g-card g-card-link"
      {...rest}
      style={{
        padding,
        /* A native button centres its content and shrink-wraps; both need
         * resetting or the card collapses to its text width. */
        textAlign: 'left',
        width: '100%',
        font: 'inherit',
        color: 'inherit',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/**
 * Row inside a card, separated by a hairline. Pass `last` to the final row to
 * drop its border - a trailing divider above a card edge reads as a mistake.
 */
export function CardRow({
  children,
  last = false,
  padding = '16px 16px 14px',
  style,
}: {
  children: ReactNode;
  last?: boolean;
  padding?: string | number;
  style?: LayoutStyle;
}) {
  return (
    <div
      style={{
        padding,
        borderBottom: last ? undefined : '1px solid var(--g-border-soft)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
