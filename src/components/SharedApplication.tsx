'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Group, Modal, Paper, Stack, Text, TextInput } from '@mantine/core';
import {
  IconAlertCircle,
  IconBookmark,
  IconCheck,
  IconDownload,
  IconEye,
  IconLoader2,
  IconPencil,
  IconPrinter,
  IconUserPlus,
} from '@tabler/icons-react';

import BrandMark from './BrandMark';
import { HwpxViewer } from './HwpxViewer';
import { Button } from '@/lib/graphite/components';
import { FZ } from '@/lib/graphite/theme';
import { shareReadResponseSchema, type SharePayload } from '@/lib/share';
import { createId, useDrafts, useStudents } from '@/lib/storage';
import {
  BORDER,
  CARD_RADIUS,
  CARD_SHADOW,
  DANGER,
  DONE_COLOR,
  GREEN_SOFT,
  INPUT_STYLES,
  LABEL_COLOR,
  PAGE_BG,
  SUB,
  SURFACE_SOFT,
  TEXT,
} from '@/lib/theme';
import { createEmptyDraft, formatDateRange, type Student } from '@/lib/types';

type StudentEntry = {
  savedId: string | null;
  name: string;
  grade: string;
  classNum: string;
  studentNum: string;
  guardianName: string;
};

function emptyEntry(): StudentEntry {
  return { savedId: null, name: '', grade: '', classNum: '', studentNum: '', guardianName: '' };
}

function toClassInfo(entry: StudentEntry, saved: Student[]): string {
  if (entry.savedId !== null) {
    return saved.find((student) => student.id === entry.savedId)?.classInfo ?? '';
  }
  const { grade, classNum, studentNum } = entry;
  if (grade === '' || classNum === '' || studentNum === '') return '';
  return `${grade}학년 ${classNum}반 ${studentNum}번`;
}

function resolveName(entry: StudentEntry, saved: Student[]): string {
  if (entry.savedId !== null) {
    return saved.find((student) => student.id === entry.savedId)?.name ?? '';
  }
  return entry.name.trim();
}

export default function SharedApplication({ id }: { id: string }) {
  const router = useRouter();
  const [, setDrafts] = useDrafts();
  const [savedStudents] = useStudents();
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<'choose' | 'print'>('choose');
  const [entries, setEntries] = useState<StudentEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [keptOpened, setKeptOpened] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);

  useEffect(() => {
    const key = window.location.hash.slice(1).replace(/[^A-Za-z0-9_-]/g, '');
    if (key === '') {
      setLoadError('링크에 열람 키가 없어요. 받은 링크 전체를 주소창에 붙여 주세요.');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/share?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`
        );
        const body: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof body === 'object' && body !== null && 'error' in body
              ? String((body as { error: unknown }).error)
              : '공유 내용을 불러오지 못했어요.';
          throw new Error(message);
        }

        const parsed = shareReadResponseSchema.safeParse(body);
        if (!parsed.success) throw new Error('공유 데이터 형식이 올바르지 않아요.');
        if (cancelled) return;

        setPayload(parsed.data.payload);
        setEntries(Array.from({ length: parsed.data.payload.studentCount }, emptyEntry));
      } catch (cause) {
        if (cancelled) return;
        setLoadError(cause instanceof Error ? cause.message : '공유 내용을 불러오지 못했어요.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const draftFrom = (source: SharePayload) => ({
    ...createEmptyDraft(createId()),
    title: source.title,
    startDate: source.startDate,
    endDate: source.endDate,
    learningType: source.learningType,
    destination: source.destination,
    placeRegion: source.placeRegion,
    placeAddress: source.placeAddress,
    purpose: source.purpose,
    plan: source.plan,
  });

  const handleEdit = () => {
    if (payload === null) return;

    const draft = { ...draftFrom(payload), step: 'people' as const };
    setDrafts((prev) => ({ ...prev, [draft.id]: draft }));
    router.push(`/c/${draft.id}`);
  };

  const handleKeep = () => {
    if (payload === null) return;

    const draft = { ...draftFrom(payload), step: 'review' as const };
    setDrafts((prev) => ({ ...prev, [draft.id]: draft }));
    setKeptOpened(true);
  };

  const updateEntry = (index: number, patch: Partial<StudentEntry>) => {
    setEntries((prev) =>
      prev.map((entry, position) => (position === index ? { ...entry, ...patch } : entry))
    );
    if (previewIndex === index) {
      setPreviewIndex(null);
      setPreviewBytes(null);
    }
  };

  const isReady = (index: number) => {
    const entry = entries[index];
    if (!entry) return false;
    return resolveName(entry, savedStudents) !== '';
  };

  const buildRequest = (index: number) => {
    if (payload === null) return null;
    const entry = entries[index];
    const name = resolveName(entry, savedStudents);
    if (name === '') return null;

    return {
      draft: {
        id: `shared-${id}`,
        studentIds: ['shared'],
        step: 'review' as const,
        title: payload.title,
        startDate: payload.startDate,
        endDate: payload.endDate,
        learningType: payload.learningType,
        destination: payload.destination,
        placeRegion: payload.placeRegion,
        placeAddress: payload.placeAddress,
        purpose: payload.purpose,
        plan: payload.plan,
      },
      student: { id: 'shared', name, classInfo: toClassInfo(entry, savedStudents) },
      guardian: { name: entry.guardianName.trim(), relation: '', phone: '' },
    };
  };

  const fetchDocument = async (index: number): Promise<Blob> => {
    const request = buildRequest(index);
    if (request === null) throw new Error('학생 이름을 입력하거나 저장된 학생을 선택해 주세요.');

    const response = await fetch('/api/document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error('신청서를 만들지 못했어요.');

    return response.blob();
  };

  const handlePreview = async (index: number) => {
    if (busy !== null) return;

    if (previewIndex === index) {
      setPreviewIndex(null);
      setPreviewBytes(null);
      return;
    }

    setBusy(`preview-${index}`);
    setActionError(null);
    try {
      const blob = await fetchDocument(index);
      setPreviewBytes(new Uint8Array(await blob.arrayBuffer()));
      setPreviewIndex(index);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '미리보기를 만들지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async (index: number) => {
    if (busy !== null) return;
    setBusy(`hwpx-${index}`);
    setActionError(null);
    try {
      const blob = await fetchDocument(index);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${payload?.title || '체험학습 신청서'}_${resolveName(entries[index], savedStudents)}.hwpx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '신청서를 만들지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = async (index: number) => {
    if (busy !== null) return;
    setBusy(`print-${index}`);
    setActionError(null);
    try {
      const blob = await fetchDocument(index);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const { renderHwpxPages, printPages } = await import('@/lib/hwpx-render');
      const { pages, width, height } = await renderHwpxPages(bytes);
      printPages(payload?.title || '체험학습 신청서', pages, width, height);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '인쇄 창을 열지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  const actionDisabled = (index: number) => busy !== null || !isReady(index);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: PAGE_BG }}>
      <Container size={620} px="md" py={28}>
        <Stack gap={20}>
          <Stack gap={8} align="center" pb={4}>
            <BrandMark height={60} />
            <Text fw={800} style={{ fontSize: 21, letterSpacing: -0.5, color: TEXT }}>
              공유받은 체험학습 계획
            </Text>
          </Stack>

          {loadError !== null && (
            <Paper withBorder radius={CARD_RADIUS} p={20} style={{ backgroundColor: 'white' }}>
              <Group gap={8} wrap="nowrap" align="flex-start">
                <IconAlertCircle size={16} color={DANGER} style={{ flexShrink: 0, marginTop: 2 }} />
                <Text style={{ fontSize: 14, color: DANGER, lineHeight: 1.55 }}>{loadError}</Text>
              </Group>
            </Paper>
          )}

          {payload === null && loadError === null && (
            <Paper withBorder radius={CARD_RADIUS} p={20} style={{ backgroundColor: 'white' }}>
              <Group gap={8} wrap="nowrap">
                <IconLoader2 size={16} color={SUB} className="spin" />
                <Text style={{ fontSize: 14, color: SUB }}>공유 내용을 불러오고 있어요.</Text>
              </Group>
            </Paper>
          )}

          {payload !== null && (
            <>
              <Paper
                withBorder
                radius={CARD_RADIUS}
                p={22}
                style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}
              >
                <Text fw={700} style={{ fontSize: 15, color: TEXT, marginBottom: 14 }}>
                  {payload.title || '체험학습 신청서'}
                </Text>
                <Stack gap={10}>
                  <SummaryRow label="장소" value={payload.placeAddress || payload.destination} />
                  <SummaryRow
                    label="기간"
                    value={formatDateRange(payload.startDate, payload.endDate)}
                  />
                  {payload.learningType !== '' && (
                    <SummaryRow label="유형" value={payload.learningType} />
                  )}
                  <SummaryRow label="목적" value={payload.purpose} />
                  <SummaryRow label="활동 계획" value={payload.plan} />
                </Stack>
              </Paper>

              {mode === 'choose' ? (
                <Paper
                  withBorder
                  radius={CARD_RADIUS}
                  p={22}
                  style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}
                >
                  <Text fw={700} style={{ fontSize: 15, color: TEXT, marginBottom: 4 }}>
                    무엇을 할까요?
                  </Text>
                  <Text style={{ fontSize: 14, color: SUB, marginBottom: 16, lineHeight: 1.55 }}>
                    학생 정보는 이 링크에 담겨 있지 않아요. 저장된 학생을 고르거나 직접 채우면
                    신청서가 완성됩니다.
                  </Text>

                  <Stack gap={10}>
                    <ModeButton
                      icon={IconPrinter}
                      title="바로 인쇄하거나 받기"
                      description="미리보기로 확인하고 hwpx나 인쇄·PDF로 받을 수 있어요."
                      onClickAction={() => setMode('print')}
                    />
                    <ModeButton
                      icon={IconPencil}
                      title="내용을 고쳐서 쓰기"
                      description="편집 화면으로 가서 장소·기간·계획까지 바꿀 수 있어요."
                      onClickAction={handleEdit}
                    />
                  </Stack>

                  <Group justify="flex-end" mt={18}>
                    <button
                      type="button"
                      onClick={handleKeep}
                      className="answer-chip"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        borderRadius: 20,
                        padding: '7px 14px',
                        fontSize: 13,
                        fontWeight: 500,
                        color: LABEL_COLOR,
                        cursor: 'pointer',
                      }}
                    >
                      <IconBookmark size={14} />
                      내 신청서로 보관하기
                    </button>
                  </Group>
                </Paper>
              ) : (
                <Paper
                  withBorder
                  radius={CARD_RADIUS}
                  p={22}
                  style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}
                >
                  <Group justify="space-between" align="flex-start" mb={16} wrap="nowrap">
                    <div>
                      <Text fw={700} style={{ fontSize: 15, color: TEXT }}>
                        학생 정보 채우기
                      </Text>
                      <Text style={{ fontSize: 14, color: SUB, marginTop: 2 }}>
                        저장된 학생을 고르거나 직접 입력할 수 있어요.
                      </Text>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMode('choose')}
                      className="text-btn"
                      style={{
                        background: 'none',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        color: SUB,
                        fontSize: 13,
                        padding: '6px 10px',
                        flexShrink: 0,
                      }}
                    >
                      뒤로
                    </button>
                  </Group>

                  <Stack gap={16}>
                    {entries.map((entry, index) => (
                      <div
                        key={index}
                        style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16 }}
                      >
                        {entries.length > 1 && (
                          <Text style={{ fontSize: 13, color: SUB, marginBottom: 12 }}>
                            {index + 1}번째 학생
                          </Text>
                        )}

                        {savedStudents.length > 0 && (
                          <div style={{ marginBottom: 14 }}>
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: LABEL_COLOR,
                                marginBottom: 8,
                              }}
                            >
                              저장된 학생
                            </Text>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {savedStudents.map((student) => {
                                const picked = entry.savedId === student.id;
                                return (
                                  <button
                                    key={student.id}
                                    type="button"
                                    onClick={() =>
                                      updateEntry(index, { savedId: picked ? null : student.id })
                                    }
                                    aria-pressed={picked}
                                    className="pick-chip"
                                    data-picked={picked}
                                    style={{
                                      borderRadius: 20,
                                      padding: '6px 13px',
                                      fontSize: 13,
                                      cursor: 'pointer',
                                      color: picked ? 'white' : LABEL_COLOR,
                                    }}
                                  >
                                    {student.name}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => updateEntry(index, { savedId: null })}
                                aria-pressed={entry.savedId === null}
                                className="pick-chip"
                                data-picked={entry.savedId === null}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  borderRadius: 20,
                                  padding: '6px 13px',
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  color: entry.savedId === null ? 'white' : LABEL_COLOR,
                                }}
                              >
                                <IconUserPlus size={13} />
                                직접 입력
                              </button>
                            </div>
                          </div>
                        )}

                        {entry.savedId === null ? (
                          <Stack gap={12}>
                            <TextInput
                              label="학생 이름"
                              placeholder="김배대"
                              value={entry.name}
                              onChange={(e) => updateEntry(index, { name: e.currentTarget.value })}
                              radius="md"
                              size="md"
                              styles={INPUT_STYLES}
                            />
                            <Group gap={10} grow>
                              <TextInput
                                label="학년"
                                placeholder="1"
                                value={entry.grade}
                                onChange={(e) =>
                                  updateEntry(index, { grade: e.currentTarget.value })
                                }
                                radius="md"
                                size="md"
                                styles={INPUT_STYLES}
                              />
                              <TextInput
                                label="반"
                                placeholder="7"
                                value={entry.classNum}
                                onChange={(e) =>
                                  updateEntry(index, { classNum: e.currentTarget.value })
                                }
                                radius="md"
                                size="md"
                                styles={INPUT_STYLES}
                              />
                              <TextInput
                                label="번호"
                                placeholder="12"
                                value={entry.studentNum}
                                onChange={(e) =>
                                  updateEntry(index, { studentNum: e.currentTarget.value })
                                }
                                radius="md"
                                size="md"
                                styles={INPUT_STYLES}
                              />
                            </Group>
                          </Stack>
                        ) : (
                          <Text style={{ fontSize: 13, color: SUB }}>
                            {toClassInfo(entry, savedStudents) || '학반 정보 없음'}
                          </Text>
                        )}

                        <div style={{ marginTop: 12 }}>
                          <TextInput
                            label="보호자 이름"
                            placeholder="신청인 칸에 들어갈 이름"
                            value={entry.guardianName}
                            onChange={(e) =>
                              updateEntry(index, { guardianName: e.currentTarget.value })
                            }
                            radius="md"
                            size="md"
                            styles={INPUT_STYLES}
                          />
                        </div>

                        <Group gap={8} justify="flex-end" mt={14}>
                          <Button
                            variant="outline"
                            onClick={() => void handlePreview(index)}
                            disabled={actionDisabled(index)}
                          >
                            {busy === `preview-${index}` ? (
                              <IconLoader2 size={14} className="spin" />
                            ) : (
                              <IconEye size={14} />
                            )}
                            {previewIndex === index ? '미리보기 닫기' : '미리보기'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => void handlePrint(index)}
                            disabled={actionDisabled(index)}
                          >
                            {busy === `print-${index}` ? (
                              <IconLoader2 size={14} className="spin" />
                            ) : (
                              <IconPrinter size={14} />
                            )}
                            인쇄 · PDF
                          </Button>
                          <Button
                            variant="solid"
                            onClick={() => void handleDownload(index)}
                            disabled={actionDisabled(index)}
                          >
                            {busy === `hwpx-${index}` ? (
                              <IconLoader2 size={14} className="spin" />
                            ) : (
                              <IconDownload size={14} />
                            )}
                            HWPX
                          </Button>
                        </Group>

                        {previewIndex === index && previewBytes !== null && (
                          <div className="fade-up" style={{ marginTop: 14 }}>
                            <HwpxViewer bytes={previewBytes} maxHeight={420} />
                          </div>
                        )}
                      </div>
                    ))}
                  </Stack>

                  {actionError !== null && (
                    <Text
                      className="fade-up"
                      style={{ fontSize: 13, color: DANGER, marginTop: 14 }}
                    >
                      {actionError}
                    </Text>
                  )}
                </Paper>
              )}
            </>
          )}
        </Stack>
      </Container>

      <Modal
        opened={keptOpened}
        onClose={() => setKeptOpened(false)}
        centered
        radius="lg"
        size={380}
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
        transitionProps={{
          transition: 'pop',
          duration: 220,
          timingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        padding={24}
      >
        <Stack gap={18}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: GREEN_SOFT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconCheck size={22} color={DONE_COLOR} stroke={2.5} />
          </div>
          <div>
            <Text fw={700} style={{ fontSize: FZ.section, color: TEXT }}>
              내 신청서로 보관을 완료했어요
            </Text>
            <Text style={{ fontSize: 14, color: SUB, marginTop: 6, lineHeight: 1.6 }}>
              메인 화면의 최근 체험학습 목록에서
              <br />
              이어서 작성할 수 있어요.
            </Text>
          </div>

          <Group justify="flex-end">
            <Button
              variant="solid"
              onClick={() => {
                setKeptOpened(false);
                router.push('/');
              }}
            >
              메인으로 가기
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}

function ModeButton({
  icon: Icon,
  title,
  description,
  onClickAction,
}: {
  icon: typeof IconPrinter;
  title: string;
  description: string;
  onClickAction: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClickAction}
      className="setting-option"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        width: '100%',
        padding: '14px 15px',
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          backgroundColor: SURFACE_SOFT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={17} color={SUB} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text fw={600} style={{ fontSize: 14, color: TEXT }}>
          {title}
        </Text>
        <Text style={{ fontSize: 13, color: SUB, marginTop: 3, lineHeight: 1.5 }}>
          {description}
        </Text>
      </div>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Group gap={14} wrap="nowrap" align="flex-start">
      <Text style={{ fontSize: 14, color: SUB, width: 68, flexShrink: 0 }}>{label}</Text>
      <Text
        style={{
          fontSize: 14,
          color: LABEL_COLOR,
          flex: 1,
          whiteSpace: 'pre-wrap',
          lineHeight: 1.55,
        }}
      >
        {value || '—'}
      </Text>
    </Group>
  );
}
