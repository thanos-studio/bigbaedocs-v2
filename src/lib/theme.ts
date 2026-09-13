import type { CSSProperties } from 'react';

/** 메인 페이지(GeneratorForm)와 공유하는 디자인 토큰. */
export const PAGE_BG = '#f0f2f5';
export const TEXT = '#111827';
export const SUB = '#404a57';
export const LABEL_COLOR = '#374151';
export const MUTED = '#4b5563';
export const BORDER = '#e5e7eb';
export const BORDER_SOFT = '#f3f4f6';
export const SURFACE_SOFT = '#f1f3f5';
export const ACCENT = '#4c6ef5';
export const DARK = '#212529';
export const DANGER = '#e03131';
export const GREEN = '#16a34a';
export const GREEN_SOFT = '#e8f8ee';
export const DONE_COLOR = '#15803d';

export const CARD_RADIUS = 'lg' as const;
export const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.04)';

export const TOOLTIP_PROPS = {
  position: 'top' as const,
  withArrow: true,
  openDelay: 250,
  radius: 'md' as const,
  fz: 12,
  color: 'dark',
  transitionProps: { transition: 'fade' as const, duration: 140 },
};

export const BTN_BASE: CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1,
};

export const BTN_PRIMARY: CSSProperties = {
  ...BTN_BASE,
  border: 'none',
  backgroundColor: DARK,
  color: 'white',
  fontWeight: 600,
};

export const BTN_OUTLINE: CSSProperties = {
  ...BTN_BASE,
  border: '1px solid #d1d5db',
  backgroundColor: 'white',
  color: LABEL_COLOR,
};

export const BTN_DISABLED: CSSProperties = {
  ...BTN_BASE,
  border: 'none',
  backgroundColor: '#e9ecef',
  color: '#adb5bd',
  fontWeight: 600,
  cursor: 'not-allowed',
};

export const INPUT_STYLES = {
  label: { fontSize: 14, fontWeight: 500, color: LABEL_COLOR, marginBottom: 6 },
  input: { fontSize: 14 },
} as const;
