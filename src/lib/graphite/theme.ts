import type { CSSProperties } from 'react';

/**
 * graphite/theme.ts - design tokens for React inline styles and Mantine props.
 *
 * Values are `var(--g-*)` references into graphite.css, so the stylesheet stays
 * the single source of truth. Changing a colour means editing one line of CSS,
 * not hunting through TSX.
 *
 * Where you need a real hex - canvas, SVG attributes, meta theme-color, an
 * email template - use RAW below instead.
 */

/* ------------------------------------------------------------------ colour -- */

export const SURFACE = 'var(--g-surface)';
export const PAGE = 'var(--g-page)';
export const SOFT = 'var(--g-soft)';
export const HOVER = 'var(--g-hover)';
export const ACTIVE = 'var(--g-active)';
export const BORDER = 'var(--g-border)';
export const BORDER_SOFT = 'var(--g-border-soft)';
export const BORDER_HOVER = 'var(--g-border-hover)';

export const TEXT = 'var(--g-text)';
export const SUB = 'var(--g-sub)';
export const LABEL = 'var(--g-label)';
export const MUTED = 'var(--g-muted)';
export const FAINT = 'var(--g-faint)';

/** The accent. Filled ink = primary action or selected state. */
export const INK = 'var(--g-ink)';
export const INK_HOVER = 'var(--g-ink-hover)';
export const INK_TINT = 'var(--g-ink-tint)';

export const DONE = 'var(--g-done)';
export const DONE_BG = 'var(--g-done-bg)';
export const DANGER = 'var(--g-danger)';
export const DANGER_BG = 'var(--g-danger-bg)';
export const DANGER_HOVER = 'var(--g-danger-hover)';
export const DANGER_ACTIVE = 'var(--g-danger-active)';
export const WARN = 'var(--g-warn)';
export const WARN_BG = 'var(--g-warn-bg)';

/** Text/icon colour on top of filled ink. */
export const ON_INK = 'var(--g-surface)';
/** Secondary text on filled ink - a flat grey would vanish against it. */
export const ON_INK_SUB = 'rgba(255,255,255,0.72)';

/**
 * Literal hex, for contexts that cannot resolve CSS variables.
 * Keep in sync with :root in graphite.css.
 */
export const RAW = {
  surface: '#ffffff',
  page: '#f0f2f5',
  soft: '#f1f3f5',
  hover: '#e9ecef',
  active: '#dee2e6',
  border: '#e5e7eb',
  borderSoft: '#f3f4f6',
  borderHover: '#ced4da',
  text: '#111827',
  sub: '#404a57',
  label: '#374151',
  muted: '#4b5563',
  faint: '#adb5bd',
  ink: '#212529',
  inkHover: '#343a40',
  done: '#15803d',
  doneBg: '#e8f8ee',
  danger: '#e03131',
  dangerBg: '#fff5f5',
  dangerHover: '#ffd8d8',
  dangerActive: '#ffc9c9',
  warn: '#f59f00',
  warnBg: '#fff9ec',
} as const;

/* -------------------------------------------------------------------- type -- */

/**
 * Seven steps. Body is 14 and carries ~60% of all text; reach for another step
 * only when the role genuinely differs. Large sizes get negative tracking
 * because SUIT sets loose at display sizes.
 */
export const FZ = {
  display: 34,
  title: 24,
  heading: 21,
  section: 15,
  body: 14,
  caption: 13,
  fine: 12,
} as const;

export const FW = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  heavy: 800,
} as const;

export const LH = {
  tight: 1.2,
  heading: 1.4,
  body: 1.5,
  relaxed: 1.55,
  loose: 1.6,
} as const;

/** Ready-made role styles. Spread these instead of re-deriving the trio. */
export const T_DISPLAY: CSSProperties = {
  fontSize: FZ.display,
  fontWeight: FW.heavy,
  lineHeight: 1.1,
  letterSpacing: -0.8,
  color: TEXT,
};

export const T_TITLE: CSSProperties = {
  fontSize: FZ.title,
  fontWeight: FW.bold,
  lineHeight: LH.tight,
  letterSpacing: -0.4,
  color: TEXT,
};

export const T_HEADING: CSSProperties = {
  fontSize: FZ.heading,
  fontWeight: FW.bold,
  lineHeight: LH.tight,
  letterSpacing: -0.5,
  color: TEXT,
};

export const T_SECTION: CSSProperties = {
  fontSize: FZ.section,
  fontWeight: FW.bold,
  lineHeight: LH.heading,
  color: TEXT,
};

export const T_BODY: CSSProperties = {
  fontSize: FZ.body,
  fontWeight: FW.regular,
  lineHeight: LH.body,
  color: TEXT,
};

/** Body text that is explanatory rather than primary. */
export const T_BODY_SUB: CSSProperties = {
  fontSize: FZ.body,
  fontWeight: FW.regular,
  lineHeight: LH.relaxed,
  color: SUB,
};

export const T_CAPTION: CSSProperties = {
  fontSize: FZ.caption,
  fontWeight: FW.regular,
  lineHeight: LH.body,
  color: SUB,
};

export const T_FINE: CSSProperties = {
  fontSize: FZ.fine,
  fontWeight: FW.regular,
  lineHeight: LH.loose,
  color: MUTED,
};

/* ----------------------------------------------------------------- layout -- */

/** Multiples of 4, plus 6/10/14 for dense component interiors. */
export const SP = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  page: 28,
  section: 40,
} as const;

export const R = {
  sm: 6,
  md: 8,
  panel: 12,
  card: 16,
  pill: 999,
} as const;

export const LAYOUT = {
  /** Single-column form or list page. */
  content: 820,
  /** Prose or document editor - narrower for line length. */
  reading: 720,
  /** Full app shell with a sidebar. */
  shell: 1280,
  cardPadding: 16,
  cardPaddingLarge: 24,
  modalPadding: 24,
} as const;

/** Icon sizes. Optical, not geometric - 15 next to 14px text reads as equal. */
export const ICON = {
  fine: 12,
  chip: 14,
  inline: 15,
  action: 16,
  header: 18,
  large: 22,
} as const;

export const SHADOW = {
  card: 'var(--g-shadow-card)',
  lift: 'var(--g-shadow-lift)',
  chip: 'var(--g-shadow-chip)',
  /** A page in a document preview. Heavier than a card, on purpose. */
  paper: 'var(--g-shadow-paper)',
} as const;

export const MOTION = {
  fast: 150,
  base: 180,
  enter: 260,
  exit: 160,
  ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easeBack: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
} as const;

/* ------------------------------------------------------- Mantine presets -- */

/*
 * Only what components/ does not already cover. Buttons, chips, cards, options
 * and tabs are components now - there are no BTN_* or CHIP_* presets, because a
 * preset that must be paired with a matching className is exactly the mismatch
 * this version removes.
 */

/** Modals and any Paper you still hand-roll. Mantine 'lg' is 16px = R.card. */
export const CARD_RADIUS = 'lg' as const;

/** Native tooltips are unstyled and slow. Spread this onto Mantine Tooltip. */
export const TOOLTIP_PROPS = {
  position: 'top' as const,
  withArrow: true,
  openDelay: 250,
  radius: 'md' as const,
  fz: FZ.fine,
  color: 'dark',
  transitionProps: { transition: 'fade' as const, duration: 140 },
};

/** Spread onto TextInput / Textarea / Select via styles=. */
export const INPUT_STYLES = {
  label: {
    fontSize: FZ.body,
    fontWeight: FW.medium,
    color: LABEL,
    marginBottom: SP.xs,
  },
  input: { fontSize: FZ.body },
} as const;

/**
 * Modal transitions. Exit is faster than enter so dismissing feels immediate.
 * Spread onto Modal / Drawer via transitionProps=.
 */
export const MODAL_TRANSITION = {
  transition: 'pop' as const,
  duration: 220,
  exitDuration: MOTION.exit,
  timingFunction: MOTION.easeOut,
};

/** Modal sizes. Anything wider than `wide` should be a page, not a modal. */
export const MODAL = {
  confirm: 340,
  form: 420,
  wide: 460,
} as const;
