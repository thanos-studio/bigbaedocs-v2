import type { CSSProperties } from 'react';

import * as g from './graphite/theme';

/**
 * 프로젝트 토큰. 값은 전부 graphite 로 위임하고 기존 이름만 유지한다.
 *
 * 653곳에서 이 이름들을 쓰고 있어서 rename 대신 재정의를 택했다. 새 코드는
 * `@/lib/graphite/theme` 에서 직접 가져오고, 버튼·칩·카드는
 * `@/lib/graphite/components` 의 컴포넌트를 쓴다.
 *
 * 여기 있는 BTN_* 은 graphite 가 지운 프리셋의 잔재다. <Button> 으로 옮기면서
 * 하나씩 사라진다. 인라인 배경이 클래스의 :hover 를 이기는 문제가 여기서 나온다.
 */

export const PAGE_BG = g.PAGE;
export const TEXT = g.TEXT;
export const SUB = g.SUB;
export const LABEL_COLOR = g.LABEL;
export const MUTED = g.MUTED;
export const BORDER = g.BORDER;
export const BORDER_SOFT = g.BORDER_SOFT;
export const SURFACE_SOFT = g.SOFT;
export const DARK = g.INK;
export const DANGER = g.DANGER;
export const GREEN = g.DONE;
export const GREEN_SOFT = g.DONE_BG;
export const DONE_COLOR = g.DONE;

/**
 * 예전엔 파란색(#4c6ef5)이었다. graphite 는 무채색이고 강조는 잉크가 맡으므로
 * 잉크로 보냈다. 파란 링크색을 되살리면 팔레트가 다시 두 갈래가 된다.
 */
export const ACCENT = g.INK;

export const CARD_RADIUS = g.CARD_RADIUS;
export const CARD_SHADOW = g.SHADOW.card;

export const TOOLTIP_PROPS = g.TOOLTIP_PROPS;
export const INPUT_STYLES = g.INPUT_STYLES;

/* -------------------------------------------------------------- 버튼 잔재 ---- */

/**
 * 높이와 lineHeight:1 은 없으면 안 된다. height 를 비우면 border:none 버튼과
 * border:1px 버튼이 2px 어긋나 같은 줄에서 삐뚤어지고, lineHeight 를 비우면
 * 상속값이 끼어들어 같은 글자 크기인데 높이가 갈린다.
 *
 * 배경·색은 넣지 않는다. 인라인으로 주면 클래스의 :hover 를 이겨서 hover 가
 * 죽는다. .solid-btn / [data-outline] 클래스가 그 역할을 한다.
 */
export const BTN_BASE: CSSProperties = {
  height: 38,
  padding: '0 18px',
  borderRadius: g.R.md,
  cursor: 'pointer',
  fontSize: g.FZ.body,
  fontWeight: g.FW.medium,
  lineHeight: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: g.SP.xs,
  boxSizing: 'border-box',
  whiteSpace: 'nowrap',
};

/** 카드 안처럼 좁은 자리에 쓰는 작은 버튼. */
export const BTN_SMALL: CSSProperties = {
  ...BTN_BASE,
  height: 30,
  padding: '0 11px',
  fontSize: g.FZ.caption,
};

export const BTN_PRIMARY: CSSProperties = {
  ...BTN_BASE,
  border: 'none',
  backgroundColor: g.INK,
  color: g.ON_INK,
  fontWeight: g.FW.semibold,
};

export const BTN_OUTLINE: CSSProperties = {
  ...BTN_BASE,
  border: `1px solid ${g.BORDER_HOVER}`,
  backgroundColor: g.SURFACE,
  color: g.LABEL,
};

export const BTN_DISABLED: CSSProperties = {
  ...BTN_BASE,
  border: 'none',
  backgroundColor: g.HOVER,
  color: g.FAINT,
  fontWeight: g.FW.semibold,
  cursor: 'not-allowed',
};
