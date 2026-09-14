'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import type { LayoutStyle } from './style';
import { FW, FZ, ICON, R, SP } from '../theme';

export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'danger' | 'dangerGhost';
export type ButtonSize = 'md' | 'sm';

const CLASS: Record<ButtonVariant, string> = {
  solid: 'g-btn-solid',
  outline: 'g-btn-outline',
  ghost: 'g-btn-ghost',
  danger: 'g-btn-danger',
  dangerGhost: 'g-btn-danger-ghost',
};

/*
 * Only weight differs per variant. Background, colour and border all live in
 * button.css, because each changes on :hover and an inline value would outrank
 * the rule - measured: an inline `color` stopped ghost labels from darkening.
 */
const WEIGHT: Record<ButtonVariant, number> = {
  solid: FW.semibold,
  outline: FW.medium,
  ghost: FW.medium,
  danger: FW.semibold,
  dangerGhost: FW.medium,
};

const SIZE: Record<ButtonSize, CSSProperties> = {
  md: { height: 38, padding: '0 18px', fontSize: FZ.body },
  sm: { height: 30, padding: '0 11px', fontSize: FZ.caption },
};

const ICON_BOX: Record<ButtonSize, CSSProperties> = {
  md: { width: 36, height: 36, padding: 0 },
  sm: { width: 30, height: 30, padding: 0 },
};

/*
 * Geometry only. height and lineHeight: 1 are load-bearing - without an explicit
 * height a `border: none` and a `border: 1px` button differ by 2px and sit
 * misaligned in the same row, and without lineHeight: 1 an inherited
 * line-height changes the height at identical font sizes.
 *
 * `cursor` is absent for the same reason as colour: it flips to not-allowed when
 * disabled, and an inline value would win.
 */
const BASE: CSSProperties = {
  borderRadius: R.md,
  lineHeight: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: SP.xs,
  boxSizing: 'border-box',
  whiteSpace: 'nowrap',
};

type Native = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style' | 'children'>;

type Common = Native & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Rendered before the label. Size it with buttonIconSize(size). */
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /**
   * Layout only - margin, flex, alignSelf, width. Background is not accepted:
   * an inline background outranks the class's :hover rule and would leave the
   * button visually inert. Change the variant, or add one to button.css.
   */
  style?: LayoutStyle;
};

/*
 * The union is what turns an unlabelled icon button from an accessibility bug
 * found in review into a compile error: `iconOnly` requires `aria-label`,
 * because a square button whose only content is a glyph has no accessible name
 * otherwise. Children are still allowed - that is where the glyph goes.
 */
export type ButtonProps =
  | (Common & { iconOnly?: false; children: ReactNode })
  | (Common & { iconOnly: true; children: ReactNode; 'aria-label': string });

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'solid', size = 'md', iconOnly, leftIcon, rightIcon, children, style, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className={CLASS[variant]}
      {...rest}
      style={{
        ...BASE,
        ...SIZE[size],
        fontWeight: WEIGHT[variant],
        ...(iconOnly ? ICON_BOX[size] : null),
        ...style,
      }}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
});

/** Matching icon size for a given button size. */
export const buttonIconSize = (size: ButtonSize = 'md') =>
  size === 'sm' ? ICON.chip : ICON.inline;
