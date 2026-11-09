'use client';

import { useEffect, useRef, useState } from 'react';
import { Text, Tooltip } from '@mantine/core';
import { IconLoader2, IconPhotoPlus, IconX } from '@tabler/icons-react';

import { HALF_DAY_LIMITS, type PhotoRef } from '@/lib/half-day';
import { isAcceptedImage } from '@/lib/image-compress';
import { R } from '@/lib/graphite/theme';
import { BORDER, BORDER_SOFT, DANGER, LABEL_COLOR, SUB, SURFACE_SOFT, TEXT, TOOLTIP_PROPS } from '@/lib/theme';

const THUMB = 88;
const REMOVE_ANIMATION_MS = 170;

/** 클립보드에 올라온 이미지 파일. 엑셀·워드처럼 글과 함께 오는 이미지 스냅샷이면 글 붙여넣기를 우선하도록 비워 준다. */
function pastedImages(event: ClipboardEvent): File[] {
  const files = Array.from(event.clipboardData?.files ?? []).filter(isAcceptedImage);
  if (files.length === 0) return [];

  const hasText = (event.clipboardData?.getData('text/plain') ?? '').trim() !== '';
  const isRichTextSnapshot = hasText && (event.clipboardData?.types ?? []).includes('text/html');
  return isRichTextSnapshot ? [] : files;
}

/**
 * 보고서 첨부자료 사진. 눌러서 고르거나, 끌어다 놓거나, 붙여넣어서(⌘/Ctrl+V) 올린다.
 * 붙여넣기는 이 카드가 열려 있고 포커스가 카드 안이거나 어디에도 없을 때만 받는다. 채팅창 같은 다른 입력칸의 붙여넣기는 건드리지 않는다.
 */
export default function PhotoAttachments({
  photos,
  urls,
  busy,
  error,
  active,
  onAdd,
  onRemove,
}: {
  photos: PhotoRef[];
  urls: Record<string, string>;
  busy: boolean;
  error: string | null;
  /** 카드가 열려 있어서 붙여넣기를 받아도 되는지. */
  active: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<string[]>([]);
  const full = photos.length >= HALF_DAY_LIMITS.reportPhotos;

  // 붙여넣기 리스너는 최신 onAdd 를 ref 로 읽어서 매 렌더마다 다시 달지 않는다.
  const onAddRef = useRef(onAdd);
  useEffect(() => {
    onAddRef.current = onAdd;
  }, [onAdd]);

  useEffect(() => {
    if (!active) return;

    const handlePaste = (event: ClipboardEvent) => {
      const focused = document.activeElement;
      const inside = rootRef.current?.closest('[data-photo-scope]')?.contains(focused) ?? false;
      if (focused && focused !== document.body && !inside) return;

      const files = pastedImages(event);
      if (files.length === 0) return;
      event.preventDefault();
      onAddRef.current(files);
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [active]);

  const remove = (id: string) => {
    setLeaving((prev) => [...prev, id]);
    setTimeout(() => {
      onRemove(id);
      setLeaving((prev) => prev.filter((item) => item !== id));
    }, REMOVE_ANIMATION_MS);
  };

  const handleFiles = (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []);
    if (files.length > 0) onAdd(files);
  };

  return (
    <div ref={rootRef}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: 500, color: LABEL_COLOR }}>사진 · 입장권 첨부</Text>
        <Text style={{ fontSize: 12, color: SUB }}>
          {photos.length}/{HALF_DAY_LIMITS.reportPhotos}
        </Text>
      </div>

      <div
        role="button"
        tabIndex={full ? -1 : 0}
        aria-disabled={full}
        aria-label="사진 첨부. 눌러서 고르거나 끌어다 놓거나 붙여넣을 수 있어요"
        onClick={() => !full && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (!full && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          if (full) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!full) handleFiles(event.dataTransfer.files);
        }}
        className="hd-dropzone"
        data-dragging={dragging}
        style={{
          marginTop: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          padding: '14px 12px',
          borderRadius: R.md,
          cursor: full ? 'not-allowed' : 'pointer',
          opacity: full ? 0.6 : 1,
        }}
      >
        {busy ? <IconLoader2 size={16} color={SUB} className="spin" /> : <IconPhotoPlus size={16} color={SUB} />}
        <Text style={{ fontSize: 13, color: SUB }}>
          {busy
            ? '사진을 처리하는 중이에요…'
            : full
              ? `최대 ${HALF_DAY_LIMITS.reportPhotos}장까지 올릴 수 있어요`
              : '여기에 사진을 끌어다 놓거나, 붙여넣거나(⌘/Ctrl+V), 눌러서 고르세요'}
        </Text>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
          multiple
          hidden
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            handleFiles(event.currentTarget.files);
            // 같은 파일을 지웠다가 다시 고를 수 있도록 선택을 비운다.
            event.currentTarget.value = '';
          }}
        />
      </div>

      {error && (
        <Text role="alert" style={{ fontSize: 13, color: DANGER, marginTop: 8 }}>
          {error}
        </Text>
      )}

      {photos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          {photos.map((photo) => {
            const url = urls[photo.id];
            return (
              <div
                key={photo.id}
                className="attach-item"
                data-leaving={leaving.includes(photo.id)}
                style={{ position: 'relative', width: THUMB, height: THUMB }}
              >
                {url ? (
                  // 로컬에서 만든 data URL 미리보기라 next/image 최적화 대상이 아니다.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={photo.name}
                    width={THUMB}
                    height={THUMB}
                    style={{ width: THUMB, height: THUMB, objectFit: 'cover', borderRadius: R.md, border: `1px solid ${BORDER}`, display: 'block' }}
                  />
                ) : (
                  <div
                    aria-label={`${photo.name} 불러오는 중`}
                    style={{ width: THUMB, height: THUMB, borderRadius: R.md, border: `1px solid ${BORDER_SOFT}`, backgroundColor: SURFACE_SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <IconLoader2 size={16} color={SUB} className="spin" />
                  </div>
                )}
                <Tooltip label="사진 삭제" {...TOOLTIP_PROPS}>
                  <button
                    type="button"
                    aria-label={`${photo.name} 삭제`}
                    onClick={() => remove(photo.id)}
                    style={{
                      position: 'absolute',
                      top: -7,
                      right: -7,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: `1px solid ${BORDER}`,
                      backgroundColor: 'white',
                      color: TEXT,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <IconX size={12} />
                  </button>
                </Tooltip>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
