import { reportGenerateRequestSchema, type AttachmentPhoto } from '@/lib/agent/schema';
import { buildReportFields } from '@/lib/report-fields';
import { fillTemplate, type AttachedPhoto } from '@/lib/hwpx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function decodePhoto(photo: AttachmentPhoto): AttachedPhoto {
  const [header, base64] = photo.dataUrl.split(',');
  const mime = /^data:image\/([a-z]+);/.exec(header)?.[1] ?? 'png';

  return {
    bytes: new Uint8Array(Buffer.from(base64, 'base64')),
    extension: mime === 'jpeg' ? 'jpg' : mime,
    naturalWidth: photo.naturalWidth,
    naturalHeight: photo.naturalHeight,
  };
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  const parsed = reportGenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Request body has an invalid report shape.', 400);
  }

  const { draft, student, photo } = parsed.data;
  const fields = buildReportFields(draft, student);

  try {
    const doc = await fillTemplate(fields, 'report', photo ? decodePhoto(photo) : undefined);
    const bytes = doc.exportHwpx();
    const filename = `${draft.title.trim() || '체험학습 보고서'}_${student.name}.hwpx`;

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.hancom.hwpx',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'X-Replaced-Fields': String(doc.replacedFields),
      },
    });
  } catch (error) {
    console.error('[report] failed:', error);
    return jsonError('Unable to build the report document.', 500);
  }
}
