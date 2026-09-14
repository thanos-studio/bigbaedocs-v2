import type { CSSProperties } from 'react';

/**
 * Style prop for any component whose hover or selected state lives in CSS.
 *
 * Background is excluded deliberately. An inline `background-color` outranks a
 * class's `:hover` rule, so allowing it here would let a caller silently disable
 * the interaction - a bug that looks fine in a screenshot and only shows up when
 * someone moves the mouse. Use a different variant, or add one to the matching
 * CSS file.
 */
export type LayoutStyle = Omit<
  CSSProperties,
  'background' | 'backgroundColor' | 'backgroundImage'
>;
