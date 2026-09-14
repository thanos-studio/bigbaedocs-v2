'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Group, Text, Tooltip } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconLoader2 } from '@tabler/icons-react';

import { BORDER, SUB, TEXT, TOOLTIP_PROPS } from '@/lib/theme';
import { HOVER, R, SHADOW } from '@/lib/graphite/theme';
import { renderHwpxPages } from '@/lib/hwpx-render';

const PAGE_BTN: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

type PageInfo = { width: number; height: number };

export function HwpxViewer({ bytes, maxHeight = 460 }: { bytes: Uint8Array; maxHeight?: number }) {
  const [pages, setPages] = useState<string[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo>({ width: 794, height: 1123 });
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      try {
        const { pages: rendered, width, height } = await renderHwpxPages(bytes);
        if (cancelled) return;
        setPageInfo({ width, height });
        setPages(rendered);
        setCurrent(0);
      } catch (cause) {
        console.error('[HwpxViewer] render failed:', cause);
        if (!cancelled) setError('미리보기를 불러오지 못했어요.');
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [bytes]);

  const pageSvg = pages[current];

  return (
    <div>
      <div
        style={{
          border: `1px solid ${BORDER}`,
          borderRadius: R.md,
          backgroundColor: HOVER,
          height: maxHeight,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: 14,
        }}
      >
        {error !== null ? (
          <Text style={{ fontSize: 13, color: SUB, textAlign: 'center', paddingTop: 24 }}>
            {error}
          </Text>
        ) : pageSvg === undefined ? (
          <Group gap={7} justify="center" style={{ paddingTop: 24 }}>
            <IconLoader2 size={15} className="spin" color={SUB} />
            <Text style={{ fontSize: 13, color: SUB }}>미리보기를 그리고 있어요</Text>
          </Group>
        ) : (
          <div
            className="hwpx-page fade-up"
            style={{
              width: '100%',
              aspectRatio: `${pageInfo.width} / ${pageInfo.height}`,
              backgroundColor: 'white',
              boxShadow: SHADOW.paper,
            }}
            dangerouslySetInnerHTML={{ __html: pageSvg }}
          />
        )}
      </div>

      {pages.length > 1 && (
        <Group gap={8} justify="center" mt={10}>
          <Tooltip label="이전 장" {...TOOLTIP_PROPS}>
            <button
              type="button"
              onClick={() => setCurrent((page) => Math.max(0, page - 1))}
              disabled={current === 0}
              aria-label="이전 장"
              className="answer-chip"
              style={{ ...PAGE_BTN, opacity: current === 0 ? 0.4 : 1 }}
            >
              <IconChevronLeft size={16} color={TEXT} />
            </button>
          </Tooltip>
          <Text style={{ fontSize: 13, color: SUB }}>
            {current + 1} / {pages.length}
          </Text>
          <Tooltip label="다음 장" {...TOOLTIP_PROPS}>
            <button
              type="button"
              onClick={() => setCurrent((page) => Math.min(pages.length - 1, page + 1))}
              disabled={current === pages.length - 1}
              aria-label="다음 장"
              className="answer-chip"
              style={{ ...PAGE_BTN, opacity: current === pages.length - 1 ? 0.4 : 1 }}
            >
              <IconChevronRight size={16} color={TEXT} />
            </button>
          </Tooltip>
        </Group>
      )}
    </div>
  );
}
