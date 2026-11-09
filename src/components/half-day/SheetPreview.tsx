'use client';

import { useEffect, useRef, useState } from 'react';

import { SHEET_HEIGHT, SHEET_WIDTH } from '@/lib/half-day-sheets';
import { BORDER } from '@/lib/theme';
import { R, SHADOW } from '@/lib/graphite/theme';

/**
 * A4 양식(794×1123px)을 카드 폭에 맞춰 줄여서 보여준다.
 * 폭이 바뀌면 ResizeObserver 가 배율을 다시 계산한다. 높이는 aspect-ratio 로 맞추므로 레이아웃이 튀지 않는다.
 * html 은 half-day-sheets 가 만든 문자열이며, 사용자 입력은 모두 이스케이프되어 있다.
 */
export default function SheetPreview({ html, label }: { html: string; label: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.75);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / SHEET_WIDTH);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      role="img"
      aria-label={label}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${SHEET_WIDTH} / ${SHEET_HEIGHT}`,
        overflow: 'hidden',
        backgroundColor: 'white',
        border: `1px solid ${BORDER}`,
        borderRadius: R.md,
        boxShadow: SHADOW.paper,
      }}
    >
      <div
        style={{
          width: SHEET_WIDTH,
          height: SHEET_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
