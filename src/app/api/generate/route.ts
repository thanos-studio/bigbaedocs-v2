import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const templateFile = formData.get('template') as File | null;
    const fieldsJson = formData.get('fields') as string | null;

    if (!templateFile) {
      return NextResponse.json({ error: '템플릿 파일이 없습니다.' }, { status: 400 });
    }
    if (!fieldsJson) {
      return NextResponse.json({ error: '필드 데이터가 없습니다.' }, { status: 400 });
    }

    const fields: Record<string, string> = JSON.parse(fieldsJson);
    const templateBuffer = Buffer.from(await templateFile.arrayBuffer());

    // @rhwp/core WASM을 서버사이드에서 동적 import
    const rhwp = await import('@rhwp/core');
    await rhwp.default(); // WASM 초기화

    const doc = new rhwp.HwpDocument(new Uint8Array(templateBuffer));

    for (const [key, value] of Object.entries(fields)) {
      doc.setFieldValueByName(key, value);
    }

    const output = doc.exportHwp();

    return new NextResponse(Buffer.from(output), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('생성문서.hwp')}`,
      },
    });
  } catch (err) {
    console.error('[generate] error:', err);
    return NextResponse.json({ error: '문서 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
