'use client';

/** 보고서에 붙일 사진을 줄여서 JPEG data URL 로 만든다. 한 장이 100~300KB 가 되도록 긴 변을 제한한다. */

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'] as const;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_EDGE = 1400;
const QUALITY = 0.8;

export type CompressedImage = { dataUrl: string; width: number; height: number };

export class ImageRejected extends Error {}

/** 붙여넣기/끌어다 놓기로 들어온 파일이 첨부 가능한 이미지인지 가린다. */
export function isAcceptedImage(file: File): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
}

export async function compressImage(file: File): Promise<CompressedImage> {
  if (!isAcceptedImage(file)) {
    throw new ImageRejected(
      /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
        ? 'HEIC 사진은 올릴 수 없어요. JPG나 PNG로 바꿔 주세요.'
        : 'PNG, JPG, WebP, GIF 이미지만 올릴 수 있어요.'
    );
  }
  if (file.size > MAX_SOURCE_BYTES) throw new ImageRejected('사진 한 장은 25MB까지 올릴 수 있어요.');

  let bitmap: ImageBitmap;
  try {
    // 스마트폰 사진의 회전 정보(EXIF)를 반영해서 읽는다.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageRejected('이미지를 읽지 못했어요. 다른 파일로 시도해 주세요.');
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new ImageRejected('이미지를 처리하지 못했어요.');

    // JPEG 는 투명을 지원하지 않는다. 투명 PNG 가 검게 나오지 않도록 흰 배경을 깐다.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    return { dataUrl: canvas.toDataURL('image/jpeg', QUALITY), width, height };
  } finally {
    bitmap.close();
  }
}
