export type RenderedPages = { pages: string[]; width: number; height: number };

/**
 * rhwp 렌더러는 글자 폭을 JS 쪽 Canvas로 되물어본다.
 * init 전에 globalThis에 등록해야 첫 렌더에서 줄바꿈이 깨지지 않는다.
 */
function registerTextMeasurement(): void {
  const target = globalThis as { measureTextWidth?: (font: string, text: string) => number };
  if (target.measureTextWidth) return;

  const context = document.createElement('canvas').getContext('2d');
  target.measureTextWidth = (font, text) => {
    if (!context) return 0;
    context.font = font;
    return context.measureText(text).width;
  };
}

export async function renderHwpxPages(bytes: Uint8Array): Promise<RenderedPages> {
  registerTextMeasurement();
  const rhwp = await import('@rhwp/core');
  await rhwp.default({ module_or_path: '/rhwp_bg.wasm' });

  const doc = new rhwp.HwpDocument(bytes);
  try {
    const info = JSON.parse(doc.getPageInfo(0)) as { width: number; height: number };
    const pages: string[] = [];
    for (let page = 0; page < doc.pageCount(); page += 1) {
      pages.push(doc.renderPageSvg(page));
    }
    return { pages, width: info.width, height: info.height };
  } finally {
    doc.free();
  }
}

function buildPrintDocument(
  title: string,
  pages: string[],
  width: number,
  height: number
): string {
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>` +
    `@page { size: ${width}px ${height}px; margin: 0 }` +
    `html, body { margin: 0; padding: 0; background: white }` +
    `.page { width: ${width}px; height: ${height}px; overflow: hidden; page-break-after: always }` +
    `.page:last-child { page-break-after: auto }` +
    `</style></head><body>` +
    pages.map((svg) => `<div class="page">${svg}</div>`).join('') +
    `</body></html>`
  );
}

/**
 * 숨은 iframe에서 인쇄 창을 띄운다. 새 창은 팝업 차단에 걸리고 빈 탭이 남는다.
 * rhwp에 PDF export가 없어 인쇄 창의 "PDF로 저장"을 쓴다.
 */
export function printPages(
  title: string,
  pages: string[],
  width: number,
  height: number
): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.visibility = 'hidden';

  document.body.append(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error('print frame unavailable');
  }

  doc.open();
  doc.write(buildPrintDocument(title, pages, width, height));
  doc.close();

  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    throw new Error('print frame unavailable');
  }

  // 인쇄 대화상자가 닫히기 전에 iframe을 지우면 브라우저가 인쇄를 취소한다.
  const cleanup = () => setTimeout(() => frame.remove(), 1_000);
  win.addEventListener('afterprint', cleanup, { once: true });

  const start = () => {
    try {
      win.focus();
      win.print();
    } catch {
      cleanup();
    }
  };

  if (doc.readyState === 'complete') {
    start();
  } else {
    win.addEventListener('load', start, { once: true });
  }
}

/** 인쇄용 HTML을 Blob URL로 만든다. 새 탭에서 열어 보관할 때 쓴다. */
export function createPrintableUrl(
  title: string,
  pages: string[],
  width: number,
  height: number
): string {
  const html = buildPrintDocument(title, pages, width, height);
  return URL.createObjectURL(new Blob([html], { type: 'text/html' }));
}
