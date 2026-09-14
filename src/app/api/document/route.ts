import { buildApplicationFields } from '@/lib/application-fields';
import { generateRequestSchema } from '@/lib/agent/schema';
import { fillTemplate } from '@/lib/hwpx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Request body has an invalid document shape.', 400);
  }

  const { draft, student, guardian } = parsed.data;
  const fields = buildApplicationFields(draft, student, guardian);

  try {
    const doc = await fillTemplate(fields);
    const bytes = doc.exportHwpx();
    const filename = `${draft.title.trim() || '체험학습 신청서'}_${student.name}.hwpx`;

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.hancom.hwpx',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'X-Replaced-Fields': String(doc.replacedFields),
      },
    });
  } catch (error) {
    console.error('[document] failed:', error);
    return jsonError('Unable to build the application document.', 500);
  }
}
