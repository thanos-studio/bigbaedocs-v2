'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useRouter } from 'next/navigation';
import { Group, Paper, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconArrowLeft, IconCheck, IconPlus, IconUsers } from '@tabler/icons-react';

import { getHalfDayPatches, toDisplayMessages, toHalfDayContext } from '@/lib/agent/client';
import { useThinkingClock, withThinkingSeconds } from '@/lib/agent/use-thinking-clock';
import { CHAT_SAVE_FAILED_MESSAGE, chatStorageKey, useChatPersistence } from '@/lib/chat-store';
import {
  HALF_DAY_DEFAULT_TITLE,
  HALF_DAY_LIMITS,
  HALF_DAY_STEPS,
  PERSONAL_DATES,
  applyPlanPatch,
  applyReportPatch,
  formatTableDate,
  getEntry,
  getReport,
  halfDayStepStatus,
  reportPlace,
  reportPurpose,
  isPlanReady,
  parseClassInfo,
  toIsoDate,
  type HalfDayData,
  type HalfDayEntry,
  type HalfDayReport,
  type HalfDayStep,
  type PhotoRef,
} from '@/lib/half-day';
import { toSheetStudents } from '@/lib/half-day-print';
import { polishPlanEntry, polishReport } from '@/lib/half-day-polish';
import { compressImage } from '@/lib/image-compress';
import { deletePhotos, getPhotos, putPhoto } from '@/lib/photo-store';
import { Button } from '@/lib/graphite/components';
import { BORDER_HOVER, FZ, ON_INK_SUB, R, WARN_BG, WARN_TEXT } from '@/lib/graphite/theme';
import { createId, useApplicationDraft, useStudents } from '@/lib/storage';
import { ACCENT, CARD_RADIUS, CARD_SHADOW, PAGE_BG, SUB, SURFACE_SOFT, TEXT } from '@/lib/theme';
import AgentSidebar, { type WritingOptionState } from '../AgentSidebar';
import { DraftTitle, SaveIndicator, StepHeader, Stepper } from '../editor-chrome';
import StudentModal from '../StudentModal';
import PlanStep from './PlanStep';
import ReportsStep from './ReportsStep';
import ReviewStep from './ReviewStep';
import SafetyModal from './SafetyModal';
import { useAgentModels } from './use-agent-models';

const HALF_DAY_CHAT_TRANSPORT = new DefaultChatTransport({
  api: '/api/agent/half-day-chat',
  prepareSendMessagesRequest: ({ messages, body }) => ({
    body: {
      messages,
      draft: body?.draft,
      model: body?.model,
      options: body?.options,
      availableStudents: body?.availableStudents,
    },
  }),
});

const DEFAULT_WRITING_OPTIONS: WritingOptionState = { formalTone: true, autoFill: true, longer: false, turbo: false };

export default function HalfDayEditor({ uuid }: { uuid: string }) {
  const router = useRouter();
  const [students, setStudents] = useStudents();
  const { draft, hydrated, saveState, update } = useApplicationDraft(uuid);
  const [studentModalOpened, { open: openStudentModal, close: closeStudentModal }] = useDisclosure(false);
  const [safetyOpened, { open: openSafety, close: closeSafety }] = useDisclosure(false);
  // 마감까지 남은 날을 세는 기준. 렌더마다 바뀌지 않게 처음 한 번만 정한다.
  const [today] = useState(() => toIsoDate(new Date()));

  const halfDay = draft.halfDay;
  const step = halfDay.step;

  // 입력과 에이전트 변경이 연달아 와도 서로 덮어쓰지 않도록, 최신 값을 ref 에 들고 순서대로 이어 붙인다.
  const halfDayRef = useRef(halfDay);
  useEffect(() => {
    halfDayRef.current = halfDay;
  }, [halfDay]);

  const patchHalfDay = useCallback(
    (change: (current: HalfDayData) => HalfDayData) => {
      const next = change(halfDayRef.current);
      halfDayRef.current = next;
      update({ halfDay: next });
    },
    [update]
  );

  // ---------- 에이전트 ----------
  const resolveModel = useCallback((modelId: string) => update({ modelId }), [update]);
  const { catalog: agentCatalog, error: agentCatalogError } = useAgentModels(draft.modelId, resolveModel);

  const appliedPatchIdsRef = useRef(new Set<string>());
  const thinkingClock = useThinkingClock();
  const {
    begin: beginThinking,
    elapsed: thinkingElapsed,
    finish: finishThinking,
    restore: restoreThinkingSeconds,
    secondsById: thinkingSecondsById,
  } = thinkingClock;
  const { clearError, error, messages, sendMessage, setMessages, status } = useChat({
    transport: HALF_DAY_CHAT_TRANSPORT,
    throttle: 50,
    onFinish: ({ message }) => finishThinking(message.id),
  });
  const thinking = status === 'submitted' || status === 'streaming';

  // 되살린 대화에 이미 반영된 변경이 들어 있다. 다시 적용하면 그 뒤에 고친 값을 덮어쓰므로 적용된 것으로 표시해 둔다.
  const handleChatRestored = useCallback((restored: UIMessage[]) => {
    getHalfDayPatches(restored).forEach(({ id }) => appliedPatchIdsRef.current.add(id));
  }, []);

  const { saveFailed: chatSaveFailed } = useChatPersistence({
    storageKey: chatStorageKey('half-day', uuid),
    messages,
    setMessages,
    busy: thinking,
    secondsById: thinkingSecondsById,
    restoreSeconds: restoreThinkingSeconds,
    legacy: { messages: [], hydrated },
    onRestored: handleChatRestored,
  });

  useEffect(() => {
    const fresh = getHalfDayPatches(messages).filter(({ id }) => !appliedPatchIdsRef.current.has(id));
    if (fresh.length === 0) return;

    fresh.forEach(({ id }) => appliedPatchIdsRef.current.add(id));
    patchHalfDay((current) =>
      fresh.reduce((data, item) => (item.kind === 'plan' ? applyPlanPatch(data, item.patch) : applyReportPatch(data, item.patch)), current)
    );
  }, [messages, patchHalfDay]);

  const handleSend = (text: string, files: File[], options: WritingOptionState) => {
    if (thinking || !agentCatalog || draft.modelId === '') return;

    clearError();
    beginThinking();
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    void sendMessage(files.length > 0 ? { text, files: transfer.files } : { text }, {
      body: {
        draft: toHalfDayContext(draft),
        model: draft.modelId,
        options,
        availableStudents: students.map((student) => ({ id: student.id, name: student.name, classInfo: student.classInfo })),
      },
    });
  };

  const handleModelChange = (modelId: string) => {
    if (modelId === draft.modelId || thinking) return;
    clearError();
    update({ modelId });
  };

  // ---------- 대충 적은 칸 다듬기 ----------
  const [polishing, setPolishing] = useState<string | null>(null);
  const [polishError, setPolishError] = useState<{ date: string; message: string } | null>(null);

  const runPolish = async (date: string, task: () => Promise<void>) => {
    if (polishing !== null || draft.modelId === '') return;
    setPolishing(date);
    setPolishError(null);
    try {
      await task();
    } catch (cause) {
      setPolishError({ date, message: cause instanceof Error ? cause.message : '문장을 다듬지 못했어요.' });
    } finally {
      setPolishing(null);
    }
  };

  const polishEntry = (date: string) =>
    runPolish(date, async () => {
      const { purpose, place, content } = getEntry(halfDayRef.current, date);
      changeEntry(date, await polishPlanEntry({ purpose, place, content }, draft.modelId));
    });

  const polishReportText = (date: string) =>
    runPolish(date, async () => {
      const { content, feeling } = getReport(halfDayRef.current, date);
      changeReport(date, await polishReport({ content, feeling, place: reportPlace(halfDayRef.current, date), purpose: reportPurpose(halfDayRef.current, date) }, draft.modelId));
    });

  // ---------- 폼 ----------
  const goToStep = (next: HalfDayStep) => patchHalfDay((current) => ({ ...current, step: next }));

  const changeEntry = (date: string, patch: Partial<HalfDayEntry>) =>
    patchHalfDay((current) => ({ ...current, entries: { ...current.entries, [date]: { ...getEntry(current, date), ...patch } } }));

  const applyAll = (applied: boolean) =>
    patchHalfDay((current) => ({
      ...current,
      entries: {
        ...current.entries,
        ...Object.fromEntries(PERSONAL_DATES.map((date) => [date, { ...getEntry(current, date), applied }])),
      },
    }));

  /** 바로 앞에서 내용을 적은 날짜의 칸을 가져온다. 이미 적은 칸은 건드리지 않는다. */
  const copyPrevious = (date: string) =>
    patchHalfDay((current) => {
      const source = [...PERSONAL_DATES]
        .filter((other) => other < date)
        .reverse()
        .map((other) => getEntry(current, other))
        .find((entry) => entry.purpose.trim() !== '' || entry.place.trim() !== '' || entry.content.trim() !== '');
      if (!source) return current;

      const target = getEntry(current, date);
      return {
        ...current,
        entries: {
          ...current.entries,
          [date]: {
            ...target,
            purpose: target.purpose.trim() === '' ? source.purpose : target.purpose,
            place: target.place.trim() === '' ? source.place : target.place,
            content: target.content.trim() === '' ? source.content : target.content,
          },
        },
      };
    });

  const changeReport = (date: string, patch: Partial<HalfDayReport>) =>
    patchHalfDay((current) => ({
      ...current,
      reports: { ...current.reports, [date]: { ...getReport(current, date), ...patch } },
    }));

  // ---------- 첨부 사진 ----------
  // 사진 데이터는 IndexedDB 에 있고 초안에는 참조만 있다. 화면에 아직 없는 사진만 불러온다.
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<{ date: string; message: string } | null>(null);

  const missingPhotoKey = Object.values(halfDay.reports)
    .flatMap((report) => (report.photos ?? []).map((photo) => photo.id))
    .filter((id) => photoUrls[id] === undefined)
    .join(',');

  useEffect(() => {
    if (missingPhotoKey === '') return;

    let cancelled = false;
    void getPhotos(missingPhotoKey.split(',')).then((found) => {
      if (!cancelled && Object.keys(found).length > 0) setPhotoUrls((prev) => ({ ...prev, ...found }));
    });
    return () => {
      cancelled = true;
    };
  }, [missingPhotoKey]);

  const addPhotos = async (date: string, files: File[]) => {
    if (photoBusy !== null) return;

    const existing = getReport(halfDayRef.current, date).photos ?? [];
    const room = HALF_DAY_LIMITS.reportPhotos - existing.length;
    if (room <= 0) {
      setPhotoError({ date, message: `사진은 최대 ${HALF_DAY_LIMITS.reportPhotos}장까지 올릴 수 있어요.` });
      return;
    }

    setPhotoBusy(date);
    setPhotoError(null);

    const added: PhotoRef[] = [];
    const urls: Record<string, string> = {};
    let message: string | null =
      files.length > room ? `사진은 최대 ${HALF_DAY_LIMITS.reportPhotos}장이라 ${room}장만 올렸어요.` : null;

    for (const file of files.slice(0, room)) {
      try {
        const { dataUrl, width, height } = await compressImage(file);
        const id = createId();
        await putPhoto(id, dataUrl);
        // 스크린샷은 전부 image.png 로 오므로 칩에서 알아볼 수 있게 이름을 붙인다.
        added.push({ id, name: file.name === '' || file.name === 'image.png' ? '붙여넣은 사진' : file.name, width, height });
        urls[id] = dataUrl;
      } catch (cause) {
        message = cause instanceof Error ? cause.message : '사진을 올리지 못했어요.';
      }
    }

    if (added.length > 0) {
      setPhotoUrls((prev) => ({ ...prev, ...urls }));
      // 사진을 처리하는 동안 글을 고쳤을 수 있으므로, 지금의 보고서에 이어 붙인다.
      changeReport(date, { photos: [...(getReport(halfDayRef.current, date).photos ?? []), ...added] });
    }
    setPhotoError(message ? { date, message } : null);
    setPhotoBusy(null);
  };

  const removePhoto = (date: string, id: string) => {
    changeReport(date, { photos: (getReport(halfDayRef.current, date).photos ?? []).filter((photo) => photo.id !== id) });
    setPhotoUrls((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    void deletePhotos([id]);
  };

  const toggleStudent = (id: string) =>
    update({
      studentIds: draft.studentIds.includes(id) ? draft.studentIds.filter((item) => item !== id) : [...draft.studentIds, id],
    });

  const handleAddStudent = (name: string, grade: string, classNum: string, studentNum: string) => {
    const created = { id: createId(), name, classInfo: `${grade}학년 ${classNum}반 ${studentNum}번` };
    setStudents((prev) => [...prev, created]);
    update({ studentIds: [...draft.studentIds, created.id] });
  };

  const sheetStudents = toSheetStudents(students, draft.studentIds);
  const stepStatus = halfDayStepStatus(halfDay, draft.studentIds.length);
  const stepIndex = HALF_DAY_STEPS.findIndex((item) => item.key === step);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === HALF_DAY_STEPS.length - 1;
  const canAdvance = step === 'people' ? stepStatus.people : step === 'plan' ? isPlanReady(halfDay) : true;
  const canAsk = !thinking && agentCatalog !== null && draft.modelId !== '';
  const classInfoMissing = draft.studentIds.flatMap((id) => {
    const student = students.find((item) => item.id === id);
    return student && parseClassInfo(student.classInfo).classNo === '' ? [student.name] : [];
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: PAGE_BG }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 18 }}>
        <Text fw={800} style={{ fontSize: FZ.heading, letterSpacing: -0.4, color: TEXT, lineHeight: 1.2 }}>
          BigBaeDocs
        </Text>
      </div>
      <div
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 40, maxWidth: 1280, margin: '0 auto', padding: '22px 28px 64px' }}
      >
        <div style={{ flex: '1 1 auto', width: '100%', maxWidth: 720, minWidth: 0, paddingRight: 4 }}>
          <Stack gap={0} px={4}>
            <Group justify="space-between" align="center">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="ghost-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  color: SUB,
                  fontSize: 14,
                  padding: '6px 10px 6px 8px',
                  marginLeft: -8,
                }}
              >
                <IconArrowLeft size={16} />
                나가기
              </button>
              {hydrated && <SaveIndicator state={saveState} />}
            </Group>

            <div style={{ marginTop: 18 }}>
              <DraftTitle value={draft.title} onChange={(title) => update({ title })} placeholder={HALF_DAY_DEFAULT_TITLE} />
            </div>

            <div style={{ marginTop: 28 }}>
              <Stepper
                steps={HALF_DAY_STEPS.map((item) => ({ key: item.key, label: item.label, done: stepStatus[item.key] }))}
                current={step}
                onSelect={(key) => goToStep(key as HalfDayStep)}
              />
            </div>

            <div style={{ marginTop: 24 }} key={step} className="step-panel">
              {step === 'people' && (
                <Paper withBorder radius={CARD_RADIUS} p={24} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
                  <Group justify="space-between" align="flex-start" wrap="nowrap" gap={20} mb={20}>
                    <StepHeader icon={IconUsers} title="인적사항" description="신청서를 작성할 학생을 선택하세요. 여러 명을 함께 고를 수 있어요." />
                    <Text
                      style={{ fontSize: 13, fontWeight: 600, color: draft.studentIds.length > 0 ? ACCENT : SUB, flexShrink: 0, whiteSpace: 'nowrap', marginTop: 9 }}
                    >
                      {draft.studentIds.length}명 선택
                    </Text>
                  </Group>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {students.map((student) => {
                      const picked = draft.studentIds.includes(student.id);
                      return (
                        <button
                          key={student.id}
                          type="button"
                          className="pick-chip"
                          data-picked={picked}
                          aria-pressed={picked}
                          aria-label={`${student.name} ${student.classInfo} 선택`}
                          onClick={() => toggleStudent(student.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: R.pill, padding: '7px 14px' }}
                        >
                          <Text fw={600} style={{ fontSize: 14, color: picked ? 'white' : TEXT }}>
                            {student.name}
                          </Text>
                          <Text style={{ fontSize: 14, color: picked ? ON_INK_SUB : SUB }}>{student.classInfo}</Text>
                          {picked && <IconCheck size={14} color="white" />}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={openStudentModal}
                      className="suggest-chip"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        border: `1px dashed ${BORDER_HOVER}`,
                        borderRadius: R.pill,
                        padding: '7px 16px',
                        backgroundColor: 'transparent',
                        fontSize: 14,
                        fontWeight: 500,
                        color: SUB,
                      }}
                    >
                      <IconPlus size={14} />
                      학생 추가
                    </button>
                  </div>

                  {students.length === 0 && (
                    <Text style={{ fontSize: 14, color: SUB, marginTop: 14, lineHeight: 1.55 }}>
                      등록한 학생이 없어요. 학생을 추가하면 신청서를 만들 수 있어요.
                    </Text>
                  )}

                  {classInfoMissing.length > 0 && (
                    <div style={{ marginTop: 16, backgroundColor: WARN_BG, borderRadius: R.md, padding: '10px 12px' }}>
                      <Text style={{ fontSize: 13, color: WARN_TEXT, lineHeight: 1.55 }}>
                        {classInfoMissing.join(', ')} 학생은 반·번호 정보가 없어서 신청서의 반·번호 칸이 비어요. 학생 정보를 &ldquo;3학년 2반 15번&rdquo; 형식으로 고쳐 주세요.
                      </Text>
                    </div>
                  )}

                  <div style={{ marginTop: 18, backgroundColor: SURFACE_SOFT, borderRadius: R.md, padding: '12px 14px' }}>
                    <Text style={{ fontSize: 13, color: SUB, lineHeight: 1.6 }}>
                      3학년 수능 이후 전환기 교육 기간({formatTableDate(PERSONAL_DATES[0])} ~ 12/11) 중, 직접 정한 날에 반일 개인 진로·직업 체험을 신청해요. 신청하지 않은 날은 정상 수업이에요.
                    </Text>
                  </div>
                </Paper>
              )}

              {step === 'plan' && (
                <Paper withBorder radius={CARD_RADIUS} p={24} style={{ backgroundColor: 'white', boxShadow: CARD_SHADOW }}>
                  <PlanStep
                    data={halfDay}
                    today={today}
                    polishing={polishing}
                    polishError={polishError}
                    canPolish={draft.modelId !== ''}
                    onEntryChange={changeEntry}
                    onApplyAll={applyAll}
                    onCopyPrevious={copyPrevious}
                    onPolish={polishEntry}
                  />
                </Paper>
              )}

              {step === 'review' && (
                <ReviewStep students={sheetStudents} data={halfDay} onOpenSafety={openSafety} onGoTo={goToStep} />
              )}

              {step === 'reports' && (
                <ReportsStep
                  students={sheetStudents}
                  data={halfDay}
                  today={today}
                  canAsk={canAsk}
                  polishing={polishing}
                  polishError={polishError}
                  onPolish={polishReportText}
                  photoUrls={photoUrls}
                  photoBusy={photoBusy}
                  photoError={photoError}
                  onAddPhotos={addPhotos}
                  onRemovePhoto={removePhoto}
                  onChangeReport={changeReport}
                  onAskAgent={(date) =>
                    handleSend(`${formatTableDate(date)} 결과 보고서를 같이 써줘. 그날 뭘 했는지 물어봐줘.`, [], DEFAULT_WRITING_OPTIONS)
                  }
                  onGoTo={goToStep}
                />
              )}
            </div>

            <Group justify="space-between" mt={24}>
              {!isFirst ? (
                <Button variant="outline" onClick={() => goToStep(HALF_DAY_STEPS[stepIndex - 1].key)}>
                  이전
                </Button>
              ) : (
                <span />
              )}
              {isLast ? (
                <Button variant="solid" onClick={() => router.push('/')} leftIcon={<IconCheck size={16} stroke={2.5} />}>
                  홈으로
                </Button>
              ) : (
                <Button variant="solid" onClick={() => goToStep(HALF_DAY_STEPS[stepIndex + 1].key)} disabled={!canAdvance}>
                  다음
                </Button>
              )}
            </Group>
          </Stack>
        </div>

        <Paper
          withBorder
          radius={CARD_RADIUS}
          className="hidden-mobile"
          style={{
            width: 440,
            flexShrink: 0,
            backgroundColor: 'white',
            boxShadow: CARD_SHADOW,
            position: 'sticky',
            top: 64,
            height: 'calc(100vh - 128px)',
            minHeight: 600,
            overflow: 'hidden',
            flexDirection: 'column',
          }}
        >
          <AgentSidebar
            messages={withThinkingSeconds(toDisplayMessages(messages), thinkingSecondsById)}
            onSendAction={handleSend}
            models={agentCatalog?.models ?? []}
            modelId={draft.modelId}
            onModelChangeAction={handleModelChange}
            thinking={thinking}
            thinkingElapsed={thinkingElapsed}
            errorMessage={error?.message ?? agentCatalogError ?? (chatSaveFailed ? CHAT_SAVE_FAILED_MESSAGE : null)}
            variant="half-day"
          />
        </Paper>
      </div>

      <StudentModal opened={studentModalOpened} onClose={closeStudentModal} onSubmit={handleAddStudent} />
      <SafetyModal
        opened={safetyOpened}
        acknowledged={halfDay.safetyAcknowledged}
        onClose={closeSafety}
        onAcknowledge={() => patchHalfDay((current) => ({ ...current, safetyAcknowledged: true }))}
      />
    </div>
  );
}
