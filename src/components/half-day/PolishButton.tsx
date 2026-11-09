'use client';

import { Tooltip } from '@mantine/core';
import { IconLoader2, IconSparkles } from '@tabler/icons-react';

import { Button } from '@/lib/graphite/components';
import { R } from '@/lib/graphite/theme';
import { LABEL_COLOR, TOOLTIP_PROPS } from '@/lib/theme';

/**
 * 대충 적은 칸을 양식에 맞게 고쳐 주는 버튼.
 * - chip: 알약 모양. 옆에 같은 알약("앞 날짜와 같게 채우기")이 있는 칸 아래에서 쓴다.
 * - button: 그래파이트 outline 버튼. 옆에 다른 버튼(AI로 쓰기, 미리보기 …)이 줄지어 있는 곳에서 쓴다.
 * 같은 줄의 형제와 모양이 다르면 하나만 튀어 보이므로, 놓이는 줄에 맞춰 고른다.
 */
export default function PolishButton({
  tooltip,
  loading,
  disabled,
  appearance = 'chip',
  onClick,
}: {
  tooltip: string;
  loading: boolean;
  disabled: boolean;
  appearance?: 'chip' | 'button';
  onClick: () => void;
}) {
  const icon = loading ? <IconLoader2 size={appearance === 'button' ? 16 : 14} className="spin" /> : <IconSparkles size={appearance === 'button' ? 16 : 14} />;

  return (
    <Tooltip label={tooltip} {...TOOLTIP_PROPS}>
      {appearance === 'button' ? (
        <span style={{ display: 'inline-flex' }}>
          <Button variant="outline" leftIcon={icon} disabled={disabled || loading} onClick={onClick}>
            AI로 다듬기
          </Button>
        </span>
      ) : (
        <button
          type="button"
          className="answer-chip"
          disabled={disabled || loading}
          onClick={onClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: R.pill,
            padding: '6px 12px',
            fontSize: 13,
            fontWeight: 500,
            color: LABEL_COLOR,
            cursor: disabled || loading ? 'not-allowed' : 'pointer',
          }}
        >
          {icon}
          AI로 다듬기
        </button>
      )}
    </Tooltip>
  );
}
