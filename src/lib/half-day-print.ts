import { appliedDates, parseClassInfo, type HalfDayData } from './half-day';
import {
  SHEET_HEIGHT,
  SHEET_WIDTH,
  buildApplicationSheet,
  buildReportSheet,
  type SheetStudent,
} from './half-day-sheets';
import { printPages } from './hwpx-render';
import { getPhotos } from './photo-store';
import type { Student } from './types';

/** 선택된 학생을 양식에 쓸 이름·반·번호로 바꾼다. 반·번호는 "3학년 2반 15번" 형식의 학급 정보에서 읽는다. */
export function toSheetStudents(students: Student[], ids: string[]): SheetStudent[] {
  return ids.flatMap((id) => {
    const student = students.find((item) => item.id === id);
    if (!student) return [];
    const { classNo, number } = parseClassInfo(student.classInfo);
    return [{ name: student.name, classNo, number }];
  });
}

/** 신청서는 학생마다 한 장. 같은 일정을 모든 학생에게 똑같이 적용한다. */
export function printApplications(students: SheetStudent[], data: HalfDayData): void {
  if (students.length === 0) return;
  const studentLabel = students.length === 1 ? students[0].name : `${students[0].name} 외 ${students.length - 1}명`;
  printPages(
    `반일 교외체험학습 신청서 ${studentLabel}`,
    students.map((student) => buildApplicationSheet(student, data)),
    SHEET_WIDTH,
    SHEET_HEIGHT
  );
}

/**
 * 보고서는 학생마다, 신청한 날짜마다 한 장. dates 를 주면 그 날짜만 낸다.
 * 첨부 사진은 IndexedDB 에 있으므로, 화면에 아직 안 불러온 것만 읽어 온 뒤 양식을 만든다.
 */
export async function printReports(
  students: SheetStudent[],
  data: HalfDayData,
  dates: string[] = appliedDates(data),
  loaded: Record<string, string> = {}
): Promise<void> {
  const wanted = dates.flatMap((date) => (data.reports[date]?.photos ?? []).map((photo) => photo.id));
  const missing = wanted.filter((id) => loaded[id] === undefined);
  const photoUrls = missing.length === 0 ? loaded : { ...loaded, ...(await getPhotos(missing)) };

  const pages = students.flatMap((student) => dates.map((date) => buildReportSheet(student, data, date, photoUrls)));
  if (pages.length === 0) return;

  const studentLabel = students.length === 1 ? students[0].name : `${students[0].name} 외 ${students.length - 1}명`;
  const dateLabel = dates.length === 0 ? '' : dates.length === 1 ? dates[0] : `${dates[0]}-${dates[dates.length - 1]}`;
  printPages(
    `교외체험학습 결과 보고서 ${studentLabel}${dateLabel ? ` ${dateLabel}` : ''}`,
    pages,
    SHEET_WIDTH,
    SHEET_HEIGHT
  );
}
