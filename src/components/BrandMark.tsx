import { RAW } from '@/lib/graphite/theme';

type BrandMarkProps = {
  height?: number;
  documentColor?: string;
  lineColor?: string;
  accentColor?: string;
};

const VIEW_W = 76;
const VIEW_H = 64;

/*
 * 로고의 파란색은 브랜드 아트라서 무채색 팔레트 규칙에서 제외한다.
 * UI 크롬(버튼·칩·링크)만 잉크를 쓴다.
 */
export default function BrandMark({
  height = 84,
  documentColor = RAW.text,
  lineColor = '#93aef2',
  accentColor = '#4c6ef5',
}: BrandMarkProps) {
  return (
    <svg
      width={(height * VIEW_W) / VIEW_H}
      height={height}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      fill="none"
      role="img"
      aria-label="BigBaeDocs"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* 스파클이 놓이는 자리를 비워 문서 외곽선과 겹치지 않게 함 */}
      <mask id="brandmark-sparkle-cutout">
        <rect width={VIEW_W} height={VIEW_H} fill="white" />
        <circle cx="57" cy="45" r="13" fill="black" />
      </mask>

      <g
        mask="url(#brandmark-sparkle-cutout)"
        stroke={documentColor}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M34 8H13a5 5 0 0 0-5 5v38a5 5 0 0 0 5 5h28a5 5 0 0 0 5-5V20L34 8Z" />
        <path d="M34 8v7a5 5 0 0 0 5 5h7" />

        <path d="M18 28h11" />
        <path d="M18 38h18" />
        <path d="M18 48h15" stroke={lineColor} />
      </g>

      <path
        d="M57 32c1.3 8.9 3.8 11.4 12.7 12.7C60.8 46 58.3 48.5 57 57.4 55.7 48.5 53.2 46 44.3 44.7 53.2 43.4 55.7 40.9 57 32Z"
        fill={accentColor}
      />
    </svg>
  );
}
