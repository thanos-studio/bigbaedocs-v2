import 'server-only';

export type PdfAttachment = { name: string; contentType: 'application/pdf'; bytes: Uint8Array };

const MAX_PDFS = 5;
const MAX_PDF_BYTES = 5 * 1024 * 1024;

type FilePartLike = { type?: unknown; mediaType?: unknown; url?: unknown; filename?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 대화에 붙은 PDF(data URL)를 바이트로 꺼낸다. 첨부는 매 턴 메시지 이력에 같이 실려 오므로,
 * 같은 파일은 이름과 크기로 한 번만 센다. 요청 검증은 호출부(chat route)가 이미 한다.
 */
export function extractPdfAttachments(messages: readonly unknown[]): PdfAttachment[] {
  const found = new Map<string, PdfAttachment>();

  for (const message of messages) {
    if (!isRecord(message) || !Array.isArray(message.parts)) continue;

    for (const part of message.parts as FilePartLike[]) {
      if (!isRecord(part) || part.type !== 'file' || part.mediaType !== 'application/pdf') continue;
      if (typeof part.url !== 'string') continue;

      const match = /^data:[^,]*?;base64,([\s\S]*)$/.exec(part.url);
      if (!match) continue;

      const bytes = new Uint8Array(Buffer.from(match[1], 'base64'));
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_PDF_BYTES) continue;

      const name = typeof part.filename === 'string' && part.filename !== '' ? part.filename : 'document.pdf';
      found.set(`${name}:${bytes.byteLength}`, { name, contentType: 'application/pdf', bytes });
      if (found.size >= MAX_PDFS) return [...found.values()];
    }
  }

  return [...found.values()];
}
