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

/**
 * 버튼 높이를 확정한다. height 없이 두면 테두리 두께가 높이에 더해져
 * border:none인 PRIMARY와 border:1px인 OUTLINE이 2px 어긋난다.
 * lineHeight도 상속값이 끼어들면 같은 글자 크기에서 높이가 갈린다.
 */
export const BTN_BASE: CSSProperties = {
  height: 38,
  padding: '0 14px',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  whiteSpace: 'nowrap',
};

/** 카드 안처럼 좁은 자리에 쓰는 작은 버튼. */
export const BTN_SMALL: CSSProperties = {
  ...BTN_BASE,
  height: 30,
  padding: '0 11px',
  fontSize: 13,
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
