'use client';

import { useState } from 'react';
import { Modal, Stack, Group, Text, TextInput } from '@mantine/core';
import { IconUsers } from '@tabler/icons-react';
import type { Student } from '@/lib/types';
import {
  BTN_BASE,
  BTN_OUTLINE,
  DANGER,
  DARK,
  INPUT_STYLES,
  SUB,
  SURFACE_SOFT,
  TEXT,
} from '@/lib/theme';

function parseClassInfo(classInfo?: string) {
  const match = classInfo?.match(/(\d+)학년\s*(\d+)반\s*(\d+)번/);
  return {
    grade: match?.[1] ?? '',
    classNum: match?.[2] ?? '',
    studentNum: match?.[3] ?? '',
  };
}

export default function StudentModal({
  opened,
  onClose,
  onSubmit,
  onDelete,
  student,
}: {
  opened: boolean;
  onClose: () => void;
  onSubmit: (name: string, grade: string, classNum: string, studentNum: string) => void;
  onDelete?: (id: string) => void;
  student?: Student | null;
}) {
  const parsed = parseClassInfo(student?.classInfo);
  const [name, setName] = useState(student?.name ?? '');
  const [grade, setGrade] = useState(parsed.grade);
  const [classNum, setClassNum] = useState(parsed.classNum);
  const [studentNum, setStudentNum] = useState(parsed.studentNum);

  const isEditing = Boolean(student);

  const canSubmit =
    name.trim() !== '' && grade.trim() !== '' && classNum.trim() !== '' && studentNum.trim() !== '';

  const reset = () => {
    setName('');
    setGrade('');
    setClassNum('');
    setStudentNum('');
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(name.trim(), grade.trim(), classNum.trim(), studentNum.trim());
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDeleteClick = () => {
    if (student && onDelete) onDelete(student.id);
    reset();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      centered
      radius="lg"
      size={420}
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}
      transitionProps={{
        transition: 'fade-up',
        duration: 220,
        exitDuration: 160,
        timingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      padding={24}
    >
      <Stack gap={20}>
        <Group gap="sm">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: SURFACE_SOFT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconUsers size={18} color={SUB} />
          </div>
          <div>
            <Text fw={700} style={{ fontSize: 15, color: TEXT }}>
              {isEditing ? '학생 수정' : '학생 추가'}
            </Text>
            <Text style={{ fontSize: 14, color: SUB }}>문서에 사용할 학생 정보를 입력하세요.</Text>
          </div>
        </Group>

        <Stack gap={12}>
          <TextInput
            label="이름"
            placeholder="김배대"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            radius="md"
            size="md"
            styles={INPUT_STYLES}
            data-autofocus
          />
          <Group gap={10} grow>
            <TextInput
              label="학년"
              placeholder="1"
              value={grade}
              onChange={(e) => setGrade(e.currentTarget.value)}
              radius="md"
              size="md"
              styles={INPUT_STYLES}
            />
            <TextInput
              label="반"
              placeholder="7"
              value={classNum}
              onChange={(e) => setClassNum(e.currentTarget.value)}
              radius="md"
              size="md"
              styles={INPUT_STYLES}
            />
            <TextInput
              label="번호"
              placeholder="12"
              value={studentNum}
              onChange={(e) => setStudentNum(e.currentTarget.value)}
              radius="md"
              size="md"
              styles={INPUT_STYLES}
            />
          </Group>
        </Stack>

        <Group gap={8} justify={isEditing ? 'space-between' : 'flex-end'}>
          {isEditing && (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="danger-btn"
              style={{
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                color: DANGER,
                padding: '7px 12px',
              }}
            >
              삭제
            </button>
          )}
          <Group gap={8}>
            <button
              type="button"
              onClick={handleClose}
              data-outline
              style={{ ...BTN_OUTLINE, padding: '0 18px' }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={canSubmit ? 'solid-btn' : undefined}
              style={{
                ...BTN_BASE,
                padding: '0 18px',
                border: 'none',
                backgroundColor: canSubmit ? DARK : '#e9ecef',
                color: canSubmit ? 'white' : '#adb5bd',
                fontWeight: 600,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {isEditing ? '저장' : '추가하기'}
            </button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
