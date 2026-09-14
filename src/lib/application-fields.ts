import { countDays, type Student } from './types';
import type { ApplicationDraftContext } from './agent/schema';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type DateParts = { year: string; month: string; day: string; weekday: string };

export function splitDate(date: string): DateParts {
  const parsed = new Date(`${date}T00:00:00`);
  if (!date || Number.isNaN(parsed.getTime())) {
    return { year: '', month: '', day: '', weekday: '' };
  }
  return {
    year: String(parsed.getFullYear()),
    month: String(parsed.getMonth() + 1),
    day: String(parsed.getDate()),
    weekday: WEEKDAYS[parsed.getDay()],
  };
}

export function splitClassInfo(classInfo: string) {
  const match = classInfo.match(/(\d+)학년\s*(\d+)반\s*(\d+)번/);
  return { grade: match?.[1] ?? '', classNum: match?.[2] ?? '', studentNum: match?.[3] ?? '' };
}

/** 장소 칸에는 주소만 넣는다. 주소를 모르면 장소 이름으로 대신한다. */
export function placeText(draft: ApplicationDraftContext): string {
  const address = draft.placeAddress.trim();
  return address !== '' ? address : draft.destination.trim();
}

/**
 * 템플릿의 {1}~{24} 자리에 넣을 값. 키는 중괄호 없는 번호 문자열이다.
 * 번호와 의미는 src/templates/application.hwpx 서식을 따른다.
 */
export type GuardianInfo = {
  /** 하단 신청인(학부모) 칸에 쓰는 이름. 국내·해외 모두 필요하다. */
  name: string;
  /** 동행 보호자 관계·연락처. 해외 여행에서만 기재한다. */
  relation: string;
  phone: string;
};

export function buildApplicationFields(
  draft: ApplicationDraftContext,
  student: Student,
  guardian: GuardianInfo = { name: '', relation: '', phone: '' },
  submittedAt = new Date()
): Record<string, string> {
  const { grade, classNum, studentNum } = splitClassInfo(student.classInfo);
  const start = splitDate(draft.startDate);
  const end = splitDate(draft.endDate);
  const submitted = splitDate(
    `${submittedAt.getFullYear()}-${String(submittedAt.getMonth() + 1).padStart(2, '0')}-${String(
      submittedAt.getDate()
    ).padStart(2, '0')}`
  );
  const days = countDays(draft.startDate, draft.endDate);
  const overseas = draft.placeRegion === 'overseas';

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
    '15': draft.purpose.trim(),
    '16': draft.plan.trim(),

    // 동행 보호자 행은 해외 여행에서만 채운다. 국내는 빈칸으로 남긴다.
    '17': overseas ? guardian.name.trim() : '',
    '18': overseas ? guardian.relation.trim() : '',
    '19': overseas ? guardian.phone.trim() : '',

    '20': submitted.year,
    '21': submitted.month,
    '22': submitted.day,
    '23': student.name,
    '24': guardian.name.trim(),
  };
}
