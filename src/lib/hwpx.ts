import { readFile } from 'node:fs/promises';
import path from 'node:path';

const TEMPLATE_PATHS = {
  application: path.join(process.cwd(), 'src/templates/application.hwpx'),
  report: path.join(process.cwd(), 'src/templates/report.hwpx'),
} as const;

export type TemplateKind = keyof typeof TEMPLATE_PATHS;

type SearchTextResult = {
  found: boolean;
  cellContext?: { parentPara: number; ctrlIdx: number; cellIdx: number; cellPara: number };
};

type RhwpDocument = {
  searchText: (
    query: string,
    fromSec: number,
    fromPara: number,
    fromChar: number,
    forward: boolean,
    caseSensitive: boolean,
    includeCells?: boolean | null
  ) => string;
  renderPageSvg: (page: number) => string;
  insertPicture: (
    sectionIdx: number,
    paraIdx: number,
    charOffset: number,
    cellPathJson: string,
    imageData: Uint8Array,
    width: number,
    height: number,
    naturalWidthPx: number,
    naturalHeightPx: number,
    extension: string,
    description: string,
    paperOffsetXHu?: number | null,
    paperOffsetYHu?: number | null
  ) => string;
};

/**
 * wasm-bindgen 기본 초기화는 fetch로 .wasm을 불러오는데, Node 런타임에서는
 * file: 요청이 막혀 실패한다. 그래서 바이트를 직접 읽어 넘긴다.
 * require.resolve로 .wasm을 가리키면 Turbopack이 이를 모듈로 번들하려 하므로
 * node_modules 경로를 직접 계산한다.
 */
async function loadRhwp() {
  const rhwp = await import('@rhwp/core');
  const wasmPath = path.join(process.cwd(), 'node_modules/@rhwp/core/rhwp_bg.wasm');
  const wasmBytes = await readFile(wasmPath);
  await rhwp.default({ module_or_path: wasmBytes });
  return rhwp;
}

export type FilledDocument = {
  exportHwpx: () => Uint8Array;
  replacedFields: number;
};

export type AttachedPhoto = {
  bytes: Uint8Array;
  extension: string;
  naturalWidth: number;
  naturalHeight: number;
};

const MM_TO_HWPUNIT = 283.465;
const PX_TO_MM = 25.4 / 96;

/** 사진이 들어갈 최대 크기(mm). 첨부자료 칸을 넘지 않는 값이다. */
const PHOTO_MAX_WIDTH_MM = 120;
const PHOTO_MAX_HEIGHT_MM = 90;
const PHOTO_GAP_BELOW_LABEL_MM = 6;

/**
 * 첨부자료 칸에 사진을 넣는다.
 *
 * insertPicture의 offset은 셀 기준이 아니라 용지 절대 좌표라서, 라벨을 렌더한
 * 좌표를 읽어 그 아래로 내려야 글자와 겹치지 않는다. 표 행 높이가 고정이라
 * 본문 길이가 달라져도 라벨 위치는 그대로다.
 */
function attachPhoto(doc: RhwpDocument, photo: AttachedPhoto): boolean {
  const hit = JSON.parse(
    doc.searchText('[첨부자료]', 0, 0, 0, true, false, true)
  ) as SearchTextResult;
  if (!hit.found || !hit.cellContext) return false;

  const { parentPara, ctrlIdx, cellIdx } = hit.cellContext;
  const anchor = findAttachmentAnchor(doc.renderPageSvg(0));
  if (!anchor) return false;

  const ratio = Math.min(
    PHOTO_MAX_WIDTH_MM / (photo.naturalWidth * PX_TO_MM),
    PHOTO_MAX_HEIGHT_MM / (photo.naturalHeight * PX_TO_MM),
    1
  );
  const widthMm = photo.naturalWidth * PX_TO_MM * ratio;
  const heightMm = photo.naturalHeight * PX_TO_MM * ratio;

  const cellPath = JSON.stringify([
    { controlIndex: ctrlIdx, cellIndex: cellIdx, cellParaIndex: 2 },
  ]);

  const result = JSON.parse(
    doc.insertPicture(
      0,
      parentPara,
      0,
      cellPath,
      photo.bytes,
      Math.round(widthMm * MM_TO_HWPUNIT),
      Math.round(heightMm * MM_TO_HWPUNIT),
      photo.naturalWidth,
      photo.naturalHeight,
      photo.extension,
      '체험학습 증빙 사진',
      Math.round(anchor.x * PX_TO_MM * MM_TO_HWPUNIT),
      Math.round((anchor.y * PX_TO_MM + PHOTO_GAP_BELOW_LABEL_MM) * MM_TO_HWPUNIT)
    )
  ) as { ok?: boolean };

  return result.ok === true;
}

/**
 * 렌더된 SVG에서 첨부자료 칸의 마지막 글자 줄 위치를 찾는다.
 * 라벨만 기준으로 잡으면 사용자가 적은 첨부자료 문구와 사진이 겹친다.
 * rhwp는 글자를 낱개 text로 뿌리므로 baseline(y)이 같은 것을 한 줄로 묶는다.
 */
function findAttachmentAnchor(svg: string): { x: number; y: number } | null {
  let labelX: number | null = null;
  let labelY: number | null = null;
  const baselines: number[] = [];

  for (const match of svg.matchAll(/<text([^>]*)>([\s\S]*?)<\/text>/g)) {
    const text = match[2].replace(/<[^>]+>/g, '');
    const x = /\bx="([\d.]+)/.exec(match[1]);
    const y = /\by="([\d.]+)/.exec(match[1]);
    if (!x || !y || text.trim() === '') continue;

    const yv = parseFloat(y[1]);
    if (labelY === null && text.includes('[')) {
      labelX = parseFloat(x[1]);
      labelY = yv;
    }
    baselines.push(yv);
  }

  if (labelX === null || labelY === null) return null;

  const lastLine = Math.max(...baselines.filter((y) => y >= labelY));
  return { x: labelX, y: lastLine };
}

export async function fillTemplate(
  fields: Record<string, string>,
  kind: TemplateKind = 'application',
  photo?: AttachedPhoto
): Promise<FilledDocument> {
  const [rhwp, template] = await Promise.all([loadRhwp(), readFile(TEMPLATE_PATHS[kind])]);
  const doc = new rhwp.HwpDocument(new Uint8Array(template));

  let replacedFields = 0;
  for (const [key, value] of Object.entries(fields)) {
    const result = JSON.parse(doc.replaceAll(`{${key}}`, value, false)) as { count?: number };
    replacedFields += result.count ?? 0;
  }

  if (photo) attachPhoto(doc, photo);

  return {
    exportHwpx: () => doc.exportHwpx(),
    replacedFields,
  };
}
