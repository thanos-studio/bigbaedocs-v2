import { placeText, splitClassInfo, splitDate } from './application-fields';
import { countDays, type Student } from './types';
import type { ApplicationDraftContext } from './agent/schema';

/**
 * 템플릿의 {1}~{18} 자리에 넣을 값. 키는 중괄호 없는 번호 문자열이다.
 * 번호와 의미는 src/templates/report.hwpx 서식을 따른다.
 * {1}~{15}는 신청서와 같고 {16}~{18}만 보고서 고유 항목이다.
 */
export function buildReportFields(
  draft: ApplicationDraftContext,
  student: Student
): Record<string, string> {
  const { grade, classNum, studentNum } = splitClassInfo(student.classInfo);
  const start = splitDate(draft.startDate);
  const end = splitDate(draft.endDate);
  const days = countDays(draft.startDate, draft.endDate);

  return {
    '1': grade,
    '2': classNum,
    '3': studentNum,
    '4': student.name,

    '5': start.year,
    '6': start.month,
    '7': start.day,
    '8': start.weekday,
    '9': end.year,
    '10': end.month,
    '11': end.day,
    '12': end.weekday,
    '13': days > 0 ? String(days) : '',

    '14': placeText(draft),
    '15': (draft.purpose ?? '').trim(),

    '16': (draft.experience ?? '').trim(),
    '17': (draft.reflection ?? '').trim(),
    '18': (draft.attachmentNote ?? '').trim(),
  };
}
