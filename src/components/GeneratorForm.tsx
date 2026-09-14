'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Stack,
  Group,
  Paper,
  SimpleGrid,
  Text,
  Title,
  Modal,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconFileText,
  IconSettings,
  IconDotsVertical,
  IconPencil,
  IconPlus,
  IconCalendarEvent,
  IconUser,
  IconCircleCheck,
  IconLoader2,
  IconBulb,
  IconClock,
  IconUsers,
  IconChevronRight,
  IconArrowRight,
  IconTrash,
} from '@tabler/icons-react';
import BrandMark from './BrandMark';
import StudentModal from './StudentModal';
import SettingsModal from './SettingsModal';
import { createId, useDrafts, useStudents } from '@/lib/storage';
import { createEmptyDraft, toTrip, type Student, type Trip } from '@/lib/types';
import {
  BTN_BASE,
  BTN_SMALL,
  BTN_OUTLINE,
  BTN_PRIMARY,
  TOOLTIP_PROPS,
  CARD_RADIUS,
  CARD_SHADOW,
  DONE_COLOR,
  LABEL_COLOR,
  SUB,
} from '@/lib/theme';

const TAB_KEYS = ['all', 'writing', 'done'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  all: '전체',
  writing: '작성 중',
  done: '완료',
};


const transparentDragImage = typeof window !== 'undefined' ? new Image() : null;
if (transparentDragImage) {
  transparentDragImage.src =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
}


function TabSwitcher({
  value,
  onChange,
  counts,
}: {
  value: TabKey;
  onChange: (key: TabKey) => void;
  counts: Record<TabKey, number>;
}) {
  const activeIndex = TAB_KEYS.indexOf(value);
  return (
    <div style={{ position: 'relative', display: 'inline-flex', backgroundColor: '#f1f3f5', borderRadius: 20, padding: 3 }}>
      <div
        style={{
          position: 'absolute',
          top: 3,
          bottom: 3,
          left: `calc(${(activeIndex / TAB_KEYS.length) * 100}% + 3px)`,
          width: `calc(${100 / TAB_KEYS.length}% - 6px)`,
          backgroundColor: '#212529',
          borderRadius: 18,
          transition: 'left 280ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
      {TAB_KEYS.map((key) => {
        const isActive = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="tab-btn"
            data-active={isActive}
            style={{
              position: 'relative',
              zIndex: 1,
              flex: 1,
              padding: '8px 22px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: isActive ? 'white' : SUB,
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {TAB_LABELS[key]} ({counts[key]})
          </button>
        );
      })}
    </div>
  );
}


export default function GeneratorForm() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [studentList, setStudentList] = useStudents();
  const [drafts, setDrafts] = useDrafts();
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [settingsOpened, { open: openSettings, close: closeSettings }] = useDisclosure(false);
  const [reportPickerOpened, { open: openReportPicker, close: closeReportPicker }] =
    useDisclosure(false);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [pendingDeleteTrip, setPendingDeleteTrip] = useState<Trip | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverTrash, setDragOverTrash] = useState(false);
  const [dragOverChipId, setDragOverChipId] = useState<string | null>(null);
  const [dropSide, setDropSide] = useState<'before' | 'after' | null>(null);
  const [pendingDeleteStudent, setPendingDeleteStudent] = useState<Student | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const trashRef = useRef<HTMLButtonElement>(null);
  const chipRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragGeomRef = useRef<{ offsetX: number; offsetY: number; width: number; height: number } | null>(null);
  const dragOverTrashRef = useRef(false);
  const dragOverChipIdRef = useRef<string | null>(null);
  const dropSideRef = useRef<'before' | 'after' | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  const handleAddStudent = (name: string, grade: string, classNum: string, studentNum: string) => {
    setStudentList((prev) => [
      ...prev,
      { id: createId(), name, classInfo: `${grade}학년 ${classNum}반 ${studentNum}번` },
    ]);
  };

  const handleUpdateStudent = (id: string, name: string, grade: string, classNum: string, studentNum: string) => {
    setStudentList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name, classInfo: `${grade}학년 ${classNum}반 ${studentNum}번` } : s))
    );
  };

  const handleDeleteStudent = (id: string) => {
    setStudentList((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) setDeleteMode(false);
      return next;
    });
  };

  const handleOpenAddModal = () => {
    setEditingStudent(null);
    openModal();
  };

  const handleOpenEditModal = (student: Student) => {
    setEditingStudent(student);
    openModal();
  };

  const handleModalSubmit = (name: string, grade: string, classNum: string, studentNum: string) => {
    if (editingStudent) {
      handleUpdateStudent(editingStudent.id, name, grade, classNum, studentNum);
    } else {
      handleAddStudent(name, grade, classNum, studentNum);
    }
  };

  const handleChipDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    if (transparentDragImage) e.dataTransfer.setDragImage(transparentDragImage, 0, 0);
    setDraggingId(id);
    draggingIdRef.current = id;
    const rect = e.currentTarget.getBoundingClientRect();
    dragGeomRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    setDragPos({ x: e.clientX, y: e.clientY });
  };

  const handleChipDrag = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.clientX === 0 && e.clientY === 0) return;
    const geom = dragGeomRef.current;
    if (!geom || !trashRef.current) return;
    setDragPos({ x: e.clientX, y: e.clientY });
    const left = e.clientX - geom.offsetX;
    const top = e.clientY - geom.offsetY;
    const right = left + geom.width;
    const bottom = top + geom.height;
    const trashRect = trashRef.current.getBoundingClientRect();
    const intersectsTrash =
      left < trashRect.right && right > trashRect.left && top < trashRect.bottom && bottom > trashRect.top;
    if (dragOverTrashRef.current !== intersectsTrash) {
      dragOverTrashRef.current = intersectsTrash;
      setDragOverTrash(intersectsTrash);
    }

    if (intersectsTrash) {
      if (dragOverChipIdRef.current !== null) {
        dragOverChipIdRef.current = null;
        setDragOverChipId(null);
      }
      if (dropSideRef.current !== null) {
        dropSideRef.current = null;
        setDropSide(null);
      }
      return;
    }

    const cloneCenterX = left + geom.width / 2;
    let bestId: string | null = null;
    let bestSide: 'before' | 'after' | null = null;
    let bestDistance = Infinity;
    chipRefs.current.forEach((el, id) => {
      if (id === draggingIdRef.current) return;
      const rect = el.getBoundingClientRect();
      const chipIntersects =
        left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top;
      if (!chipIntersects) return;
      const chipCenterX = rect.left + rect.width / 2;
      const distance = Math.abs(chipCenterX - cloneCenterX);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
        bestSide = cloneCenterX < chipCenterX ? 'before' : 'after';
      }
    });

    if (dragOverChipIdRef.current !== bestId) {
      dragOverChipIdRef.current = bestId;
      setDragOverChipId(bestId);
    }
    if (dropSideRef.current !== bestSide) {
      dropSideRef.current = bestSide;
      setDropSide(bestSide);
    }
  };

  const handleChipDragEnd = () => {
    if (dragOverTrashRef.current && draggingIdRef.current) {
      const student = studentList.find((s) => s.id === draggingIdRef.current);
      if (student) setPendingDeleteStudent(student);
    } else if (
      dragOverChipIdRef.current &&
      draggingIdRef.current &&
      dragOverChipIdRef.current !== draggingIdRef.current
    ) {
      const sourceId = draggingIdRef.current;
      const targetId = dragOverChipIdRef.current;
      const side = dropSideRef.current;
      setStudentList((prev) => {
        const fromIndex = prev.findIndex((s) => s.id === sourceId);
        if (fromIndex === -1 || !prev.some((s) => s.id === targetId)) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        const baseIndex = next.findIndex((s) => s.id === targetId);
        if (baseIndex === -1) return prev;
        const insertIndex = side === 'after' ? baseIndex + 1 : baseIndex;
        next.splice(insertIndex, 0, moved);
        return next;
      });
    }
    dragOverTrashRef.current = false;
    dragOverChipIdRef.current = null;
    dropSideRef.current = null;
    setDragOverTrash(false);
    setDraggingId(null);
    setDragOverChipId(null);
    setDropSide(null);
    setDragPos(null);
    dragGeomRef.current = null;
    draggingIdRef.current = null;
  };

  const handleTrashDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteStudent) handleDeleteStudent(pendingDeleteStudent.id);
    setPendingDeleteStudent(null);
  };

  const handleCancelDelete = () => {
    setPendingDeleteStudent(null);
  };

  const handleTrashClick = () => {
    setDeleteMode((prev) => !prev);
  };

  const allTrips = Object.values(drafts)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((draft) => toTrip({ ...createEmptyDraft(draft.id), ...draft }, studentList));

  const tripCounts: Record<TabKey, number> = {
    all: allTrips.length,
    writing: allTrips.filter((trip) => trip.applicationStatus !== 'done').length,
    done: allTrips.filter((trip) => trip.applicationStatus === 'done').length,
  };

  const visibleTrips =
    activeTab === 'all'
      ? allTrips
      : activeTab === 'done'
        ? allTrips.filter((trip) => trip.applicationStatus === 'done')
        : allTrips.filter((trip) => trip.applicationStatus !== 'done');

  const handleStartApplication = () => {
    const id = createId();
    setDrafts((prev) => ({ ...prev, [id]: createEmptyDraft(id) }));
    router.push(`/c/${id}`);
  };

  const handleDeleteTrip = (id: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPendingDeleteTrip(null);
  };

  const handleStartReport = () => {
    if (allTrips.length === 0) {
      setReportNotice('먼저 신청서를 작성해야 보고서를 쓸 수 있어요.');
      return;
    }
    if (allTrips.length === 1) {
      router.push(`/r/${allTrips[0].id}`);
      return;
    }
    openReportPicker();
  };

  useEffect(() => {
    if (!deleteMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeleteMode(false);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (pendingDeleteStudent) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-delete-mode-keep]')) return;
      setDeleteMode(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [deleteMode, pendingDeleteStudent]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <main>
        <Container size={820} px="md" py={28}>
          <Stack gap={20}>

            {/* 설정 */}
            <Group justify="flex-end">
              <button
                type="button"
                className="text-btn"
                onClick={openSettings}
                aria-label="설정 열기"
                style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', color: SUB, fontSize: 14, padding: '6px 10px', borderRadius: 8 }}
              >
                <IconSettings size={16} />
                설정
              </button>
            </Group>

            {/* Hero */}
            <Stack gap={8} align="center" pb={12}>
              <BrandMark height={84} />
              <Title order={1} fw={800} style={{ fontSize: 34, letterSpacing: -0.8, color: '#111827', lineHeight: 1.1 }}>
                BigBaeDocs
              </Title>
              <Text style={{ fontSize: 15, color: SUB }} ta="center">
                필요한 내용만 입력하면 AI가 문서를 완성해드립니다.
              </Text>
            </Stack>

            {/* CTA Cards */}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Paper
                withBorder
                radius={CARD_RADIUS}
                p="md"
                className="card-hover"
                component="button"
                type="button"
                onClick={handleStartApplication}
                style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW, cursor: 'pointer', textAlign: 'left', width: '100%' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#e8f8ee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconFileText size={22} color="#16a34a" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={700} style={{ fontSize: 15, color: '#111827', marginBottom: 3 }}>체험학습 신청서 작성</Text>
                    <Text style={{ fontSize: 14, color: SUB, lineHeight: 1.5 }}>
                      체험 장소와 일정을 입력하면<br />AI가 신청서를 작성해드립니다.
                    </Text>
                  </div>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: '#e8f8ee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconArrowRight size={16} color="#16a34a" />
                  </div>
                </div>
              </Paper>

              <Paper
                withBorder
                radius={CARD_RADIUS}
                p="md"
                className="card-hover"
                component="button"
                type="button"
                onClick={handleStartReport}
                style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW, cursor: 'pointer', textAlign: 'left', width: '100%' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#fdf1e3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconFileText size={22} color="#d97706" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={700} style={{ fontSize: 15, color: '#111827', marginBottom: 3 }}>체험학습 보고서 작성</Text>
                    <Text style={{ fontSize: 14, color: SUB, lineHeight: 1.5 }}>
                      체험 내용을 입력하면<br />AI가 보고서를 작성해드립니다.
                    </Text>
                  </div>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: '#fdf1e3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconArrowRight size={16} color="#d97706" />
                  </div>
                </div>
              </Paper>
            </SimpleGrid>

            {/* Tip */}
            <Paper p="md" radius={CARD_RADIUS} style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
              <Group gap="sm">
                <IconBulb size={16} color="#f59f00" />
                <Text fw={700} style={{ fontSize: 14, color: '#111827' }}>Tip</Text>
                <Text style={{ fontSize: 14, color: SUB, borderLeft: '1px solid #e5e7eb', paddingLeft: 10 }}>
                  신청서를 먼저 작성하면, 입력한 내용으로 보고서를 더 쉽게 작성할 수 있어요.
                </Text>
              </Group>
            </Paper>

            {/* 인적사항 */}
            <Paper withBorder p="md" radius={CARD_RADIUS} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
              <Group justify="space-between" mb="md">
                <Group gap="sm">
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconUsers size={18} color="#555e6b" />
                  </div>
                  <div>
                    <Text fw={700} style={{ fontSize: 15, color: '#111827' }}>인적사항</Text>
                    {deleteMode ? (
                      <Text style={{ fontSize: 14, color: '#e03131', fontWeight: 500 }}>
                        삭제할 학생을 클릭하세요.
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 14, color: SUB }}>문서 작성에 사용할 학생 정보를 관리합니다.</Text>
                    )}
                  </div>
                </Group>
                <Group gap={10}>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#4c6ef5', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 2 }} className="visible-mobile">
                    관리 <IconChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    ref={trashRef}
                    onClick={handleTrashClick}
                    onDragOver={handleTrashDragOver}
                    data-delete-mode-keep
                    className={dragOverTrash ? undefined : 'nudge-hover'}
                    aria-pressed={deleteMode}
                    aria-label="학생 삭제 모드 전환"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: dragOverTrash || deleteMode ? '#ffe3e3' : '#f1f3f5',
                      color: dragOverTrash || deleteMode ? '#e03131' : SUB,
                      transform: dragOverTrash ? 'scale(1.25)' : undefined,
                      transition: 'background-color 150ms ease, color 150ms ease, transform 150ms ease',
                    }}
                  >
                    <IconTrash size={dragOverTrash ? 22 : 18} />
                  </button>
                </Group>
              </Group>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {studentList.map((s) => {
                  const isGapTarget = dragOverChipId === s.id && draggingId !== s.id;
                  const gapWidth = (dragGeomRef.current?.width ?? 80) + 8;
                  return (
                    <div
                      key={s.id}
                      ref={(el) => {
                        if (el) chipRefs.current.set(s.id, el);
                        else chipRefs.current.delete(s.id);
                      }}
                      className={`student-chip${draggingId === s.id ? ' dragging' : ''}${deleteMode ? ' chip-danger' : ''}`}
                      draggable={!deleteMode}
                      onDragStart={(e) => handleChipDragStart(e, s.id)}
                      onDrag={handleChipDrag}
                      onDragEnd={handleChipDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={deleteMode ? () => setPendingDeleteStudent(s) : undefined}
                      data-delete-mode-keep
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        border: '1px solid #e5e7eb',
                        borderRadius: 20,
                        padding: deleteMode ? '7px 14px' : '7px 8px 7px 14px',
                        backgroundColor: 'white',
                        cursor: deleteMode ? 'pointer' : undefined,
                        marginLeft: isGapTarget && dropSide === 'before' ? gapWidth : 0,
                        marginRight: isGapTarget && dropSide === 'after' ? gapWidth : 0,
                      }}
                    >
                      <Text fw={600} style={{ fontSize: 14, color: '#111827' }}>{s.name}</Text>
                      <Text style={{ fontSize: 14, color: SUB }}>{s.classInfo}</Text>
                      {!deleteMode && (
                        <button
                          type="button"
                          aria-label={`${s.name} 수정`}
                          onClick={() => handleOpenEditModal(s)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#6b7280',
                          }}
                        >
                          <IconPencil size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}

                {!deleteMode && (
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="nudge-hover"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      border: '1px dashed #cbd5e1',
                      borderRadius: 20,
                      padding: '7px 16px',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                      color: SUB,
                    }}
                  >
                    <IconPlus size={14} />
                    학생 추가
                  </button>
                )}
              </div>

              {studentList.length === 0 && (
                <Text style={{ fontSize: 14, color: SUB, marginTop: 12, lineHeight: 1.55 }}>
                  아직 등록한 학생이 없어요. 학생을 추가하면 신청서에 바로 쓸 수 있어요.
                </Text>
              )}
            </Paper>

            {/* 최근 체험학습 */}
            <Stack gap={12}>
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <IconClock size={17} color="#374151" />
                  <Text fw={700} style={{ fontSize: 16, color: '#111827' }}>최근 체험학습</Text>
                </Group>
                <div className="hidden-mobile">
                  <TabSwitcher value={activeTab} onChange={setActiveTab} counts={tripCounts} />
                </div>
              </Group>

              <div className="visible-mobile">
                <TabSwitcher value={activeTab} onChange={setActiveTab} counts={tripCounts} />
              </div>

              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {visibleTrips.map((trip) => (
                  <Paper key={trip.id} withBorder radius={CARD_RADIUS} className="card-hover fade-up" style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
                    {/* 상단: 문서 정보 */}
                    <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <Group justify="space-between" align="flex-start" gap={8} wrap="nowrap">
                        <Text fw={700} style={{ fontSize: 15, color: '#111827', marginBottom: 6, flex: 1, minWidth: 0 }}>{trip.name}</Text>
                        <Tooltip label="이 체험학습을 삭제해요" {...TOOLTIP_PROPS}>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteTrip(trip)}
                            aria-label={`${trip.name} 삭제`}
                            className="trip-delete"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              border: 'none',
                              backgroundColor: 'transparent',
                              cursor: 'pointer',
                              color: SUB,
                              flexShrink: 0,
                            }}
                          >
                            <IconTrash size={15} />
                          </button>
                        </Tooltip>
                      </Group>
                      <Group gap={4}>
                        <IconCalendarEvent size={12} color="#4b5563" />
                        <Text style={{ fontSize: 13, color: SUB }}>{trip.dateRange}</Text>
                      </Group>
                      <Group gap={4} style={{ marginTop: 2 }}>
                        <IconUser size={12} color="#4b5563" />
                        <Text style={{ fontSize: 13, color: SUB }}>{trip.student}</Text>
                      </Group>
                    </div>

                    {/* 하단: 신청서 | 보고서 2칸 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                      {/* 신청서 */}
                      <div style={{ padding: '12px 16px', borderRight: '1px solid #f3f4f6' }}>
                        <Text style={{ fontSize: 13, color: '#4b5563', fontWeight: 600, marginBottom: 8 }}>신청서</Text>
                        {trip.applicationStatus === 'done' ? (
                          <>
                            <Group gap={4} style={{ marginBottom: 8 }}>
                              <IconCircleCheck size={14} color="#15803d" />
                              <Text style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>완료</Text>
                            </Group>
                            <button
                              type="button"
                              onClick={() => router.push(`/c/${trip.id}`)}
                              style={{ ...BTN_SMALL, width: '100%', backgroundColor: 'white', color: LABEL_COLOR, border: '1px solid #d1d5db' }}
                              data-outline
                            >
                              문서 보기
                            </button>
                          </>
                        ) : trip.applicationStatus === 'in-progress' ? (
                          <>
                            <Text style={{ fontSize: 13, color: '#4c6ef5', fontWeight: 600, marginBottom: 8 }}>작성 중</Text>
                            <button
                              type="button"
                              onClick={() => router.push(`/c/${trip.id}`)}
                              className="solid-btn"
                              style={{ ...BTN_SMALL, width: '100%', backgroundColor: '#212529', color: 'white', border: 'none', fontWeight: 600 }}
                            >
                              계속 작성
                            </button>
                          </>
                        ) : (
                          <>
                            <Text style={{ fontSize: 13, color: '#4b5563', marginBottom: 8 }}>미작성</Text>
                            <button style={{ ...BTN_SMALL, width: '100%', backgroundColor: 'white', color: LABEL_COLOR, border: '1px solid #d1d5db' }} data-outline>
                              작성하기
                            </button>
                          </>
                        )}
                      </div>

                      {/* 보고서 */}
                      <div style={{ padding: '12px 16px' }}>
                        <Text style={{ fontSize: 13, color: '#4b5563', fontWeight: 600, marginBottom: 8 }}>보고서</Text>
                        {trip.reportStatus === 'done' ? (
                          <>
                            <Group gap={4} style={{ marginBottom: 8 }}>
                              <IconCircleCheck size={14} color="#15803d" />
                              <Text style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>완료</Text>
                            </Group>
                            <button
                              type="button"
                              onClick={() => router.push(`/r/${trip.id}`)}
                              style={{ ...BTN_SMALL, width: '100%', backgroundColor: 'white', color: LABEL_COLOR, border: '1px solid #d1d5db' }}
                              data-outline
                            >
                              문서 보기
                            </button>
                          </>
                        ) : trip.reportStatus === 'in-progress' ? (
                          <>
                            <Text style={{ fontSize: 13, color: '#4c6ef5', fontWeight: 600, marginBottom: 8 }}>작성 중</Text>
                            <button
                              type="button"
                              onClick={() => router.push(`/r/${trip.id}`)}
                              style={{ ...BTN_SMALL, width: '100%', backgroundColor: '#212529', color: 'white', border: 'none', fontWeight: 600 }}
                            >
                              계속 작성
                            </button>
                          </>
                        ) : (
                          <>
                            <Text style={{ fontSize: 13, color: '#4b5563', marginBottom: 8 }}>미작성</Text>
                            <button
                              type="button"
                              onClick={() => router.push(`/r/${trip.id}`)}
                              style={{ ...BTN_SMALL, width: '100%', backgroundColor: 'white', color: LABEL_COLOR, border: '1px solid #d1d5db' }}
                              data-outline
                            >
                              작성하기
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </Paper>
                ))}
              </SimpleGrid>

              {visibleTrips.length === 0 && (
                <Paper
                  withBorder
                  radius={CARD_RADIUS}
                  className="fade-up"
                  style={{
                    backgroundColor: 'white',
                    boxShadow: CARD_SHADOW,
                    padding: '38px 20px',
                    textAlign: 'center',
                  }}
                >
                  <Text fw={600} style={{ fontSize: 15, color: '#111827' }}>
                    {allTrips.length === 0
                      ? '아직 만든 신청서가 없어요'
                      : '이 조건에 맞는 신청서가 없어요'}
                  </Text>
                  <Text style={{ fontSize: 14, color: SUB, marginTop: 6, lineHeight: 1.55 }}>
                    {allTrips.length === 0
                      ? '위에서 체험학습 신청서를 만들어보세요.'
                      : '다른 탭을 확인해 보세요.'}
                  </Text>
                </Paper>
              )}
            </Stack>

          </Stack>
        </Container>
      </main>

      <StudentModal
        key={editingStudent?.id ?? 'new'}
        opened={modalOpened}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
        onDelete={handleDeleteStudent}
        student={editingStudent}
      />

      <SettingsModal opened={settingsOpened} onCloseAction={closeSettings} />

      <Modal
        opened={reportPickerOpened}
        onClose={closeReportPicker}
        centered
        radius="lg"
        size={400}
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
        transitionProps={{ transition: 'pop', duration: 220, timingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
        padding={22}
      >
        <Stack gap={16}>
          <div>
            <Text fw={700} style={{ fontSize: 16, color: '#111827' }}>
              어느 체험학습의 보고서를 쓸까요?
            </Text>
            <Text style={{ fontSize: 14, color: SUB, marginTop: 4, lineHeight: 1.55 }}>
              신청서에 적은 장소와 기간을 그대로 가져와요.
            </Text>
          </div>

          <Stack gap={8}>
            {allTrips.map((trip) => (
              <button
                key={trip.id}
                type="button"
                className="setting-option"
                onClick={() => {
                  closeReportPicker();
                  router.push(`/r/${trip.id}`);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '13px 14px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: '1px solid #e5e7eb',
                  backgroundColor: 'white',
                  textAlign: 'left',
                }}
              >
                <IconFileText size={17} color={SUB} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={600} style={{ fontSize: 14, color: '#111827' }}>
                    {trip.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: SUB, marginTop: 2 }}>
                    {trip.dateRange} · {trip.student}
                  </Text>
                </div>
                {trip.reportStatus !== 'none' && (
                  <Text style={{ fontSize: 13, color: '#15803d', fontWeight: 600, flexShrink: 0 }}>
                    {trip.reportStatus === 'done' ? '완료' : '작성 중'}
                  </Text>
                )}
              </button>
            ))}
          </Stack>

          <Group justify="flex-end">
            <button type="button" onClick={closeReportPicker} style={BTN_OUTLINE}>
              닫기
            </button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={reportNotice !== null}
        onClose={() => setReportNotice(null)}
        centered
        radius="lg"
        size={340}
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
        transitionProps={{ transition: 'pop', duration: 220, timingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
        padding={22}
      >
        <Stack gap={16}>
          <Text style={{ fontSize: 15, color: '#111827', lineHeight: 1.6 }}>{reportNotice}</Text>
          <Group justify="flex-end" gap={8}>
            <button type="button" onClick={() => setReportNotice(null)} style={BTN_OUTLINE}>
              닫기
            </button>
            <button
              type="button"
              onClick={() => {
                setReportNotice(null);
                handleStartApplication();
              }}
              style={BTN_PRIMARY}
            >
              신청서 작성하기
            </button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={pendingDeleteTrip !== null}
        onClose={() => setPendingDeleteTrip(null)}
        centered
        radius="lg"
        size={360}
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
        transitionProps={{ transition: 'pop', duration: 220, timingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
        padding={22}
      >
        <Stack gap={16}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#ffe3e3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconTrash size={20} color="#e03131" />
          </div>
          <div>
            <Text fw={700} style={{ fontSize: 15, color: '#111827' }}>이 체험학습을 삭제할까요?</Text>
            <Text style={{ fontSize: 14, color: SUB, marginTop: 4, lineHeight: 1.6 }}>
              {pendingDeleteTrip?.name}의 신청서와 보고서가 함께 지워져요. 되돌릴 수 없어요.
            </Text>
          </div>
          <Group gap={8} justify="flex-end">
            <button
              type="button"
              onClick={() => setPendingDeleteTrip(null)}
              data-outline
              style={{ ...BTN_BASE, padding: '0 18px', border: '1px solid #d1d5db', backgroundColor: 'white', color: LABEL_COLOR }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => pendingDeleteTrip && handleDeleteTrip(pendingDeleteTrip.id)}
              className="solid-btn"
              style={{ ...BTN_BASE, padding: '0 18px', border: 'none', backgroundColor: '#e03131', color: 'white', fontWeight: 600 }}
            >
              삭제
            </button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={pendingDeleteStudent !== null}        onClose={handleCancelDelete}
        centered
        radius="lg"
        size={340}
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
        transitionProps={{ transition: 'pop', duration: 220, timingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
        padding={22}
      >
        <Stack gap={16}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#ffe3e3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconTrash size={20} color="#e03131" />
          </div>
          <div>
            <Text fw={700} style={{ fontSize: 15, color: '#111827' }}>삭제할까요?</Text>
            <Text style={{ fontSize: 14, color: SUB }}>{pendingDeleteStudent?.name} 학생 정보가 삭제됩니다.</Text>
          </div>
          <Group gap={8} justify="flex-end">
            <button
              type="button"
              onClick={handleCancelDelete}
              data-outline
              style={{ ...BTN_BASE, padding: '0 18px', border: '1px solid #d1d5db', backgroundColor: 'white', color: LABEL_COLOR }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="solid-btn"
              style={{ ...BTN_BASE, padding: '0 18px', border: 'none', backgroundColor: '#e03131', color: 'white', fontWeight: 600 }}
            >
              삭제
            </button>
          </Group>
        </Stack>
      </Modal>

      {draggingId && dragPos && dragGeomRef.current && (() => {
        const draggedStudent = studentList.find((s) => s.id === draggingId);
        if (!draggedStudent) return null;
        return (
          <div
            className={dragOverTrash ? 'chip-danger' : undefined}
            style={{
              position: 'fixed',
              zIndex: 500,
              pointerEvents: 'none',
              left: dragPos.x - dragGeomRef.current.offsetX,
              top: dragPos.y - dragGeomRef.current.offsetY,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid #e5e7eb',
              borderRadius: 20,
              padding: '7px 8px 7px 14px',
              backgroundColor: 'white',
              boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
            }}
          >
            <Text fw={600} style={{ fontSize: 14, color: '#111827' }}>{draggedStudent.name}</Text>
            <Text style={{ fontSize: 14, color: SUB }}>{draggedStudent.classInfo}</Text>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                color: '#6b7280',
              }}
            >
              <IconPencil size={14} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
