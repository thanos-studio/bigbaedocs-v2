'use client';

import type { ReactNode } from 'react';
import type { LayoutStyle } from './style';
import { FW, FZ, SP } from '../theme';

/** Matches the track padding in tab.css. The pill inset depends on it. */
const TRACK_PAD = 3;

export type TabItem<K extends string> = {
  value: K;
  label: ReactNode;
};

export type TabsProps<K extends string> = {
  items: readonly TabItem<K>[];
  value: K;
  onChange: (value: K) => void;
  /** Accessible name for the tablist, e.g. "문서 상태 필터". */
  label: string;
  style?: LayoutStyle;
};

/**
 * Segmented control. One pill slides between equal-width tabs.
 *
 * The sliding element is a separate absolutely-positioned div - animating each
 * button's own background would cross-fade instead of move. Its inset maths
 * accounts for the track padding, which is the part that is easy to get wrong
 * by hand and is why this is a component.
 *
 * Tabs are equal width. For variable widths you need per-button measurement,
 * which this deliberately does not do.
 */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  label,
  style,
}: TabsProps<K>) {
  const index = items.findIndex((item) => item.value === value);
  const count = items.length;

  return (
    <div className="g-tabs" role="tablist" aria-label={label} style={style}>
      {/* Hidden from the a11y tree - it conveys nothing aria-selected does not. */}
      {index >= 0 && (
        <div
          className="g-tab-pill"
          aria-hidden
          style={{
            left: `calc(${(index / count) * 100}% + ${TRACK_PAD}px)`,
            width: `calc(${100 / count}% - ${TRACK_PAD * 2}px)`,
          }}
        />
      )}
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className="g-tab"
            data-active={active}
            onClick={() => onChange(item.value)}
            style={{
              flex: 1,
              padding: `${SP.sm}px 22px`,
              fontSize: FZ.body,
              fontWeight: active ? FW.semibold : FW.regular,
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
