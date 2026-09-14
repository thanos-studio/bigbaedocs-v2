import { PasteShError, createPaste, readPaste } from '@/lib/paste-sh';
import { shareCreateRequestSchema, sharePayloadSchema } from '@/lib/share';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID_PATTERN = /^[A-Za-z0-9_-]{8,12}$/;
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

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

  const parsed = shareCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('공유할 내용의 형식이 올바르지 않아요.', 400);
  }

  try {
    const location = await createPaste(JSON.stringify(parsed.data.payload));
    return Response.json(location);
  } catch (error) {
    if (error instanceof PasteShError) return jsonError(error.message, 502);

    console.error('[share] create failed:', error);
    return jsonError('공유 링크를 만들지 못했어요.', 502);
  }
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const id = params.get('id') ?? '';
  const key = params.get('key') ?? '';

  if (!ID_PATTERN.test(id) || !KEY_PATTERN.test(key)) {
    return jsonError('공유 링크가 올바르지 않아요.', 400);
  }

  try {
    const plaintext = await readPaste({ id, key });

    let decoded: unknown;
    try {
      decoded = JSON.parse(plaintext);
    } catch {
      return jsonError('공유 데이터를 읽지 못했어요.', 502);
    }

    const payload = sharePayloadSchema.safeParse(decoded);
    if (!payload.success) {
      return jsonError('공유 데이터 형식이 올바르지 않아요.', 502);
    }

    return Response.json({ payload: payload.data });
  } catch (error) {
    if (error instanceof PasteShError) return jsonError(error.message, 502);

    console.error('[share] read failed:', error);
    return jsonError('공유 내용을 불러오지 못했어요.', 502);
  }
}
