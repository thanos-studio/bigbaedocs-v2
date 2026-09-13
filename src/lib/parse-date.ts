const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * 기준일이 속한 주의 월요일. 일요일(0)은 지난 주로 보고 6일을 뺀다.
 */
function startOfWeek(base: Date): Date {
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(base, diff);
}

function findWeekday(text: string, from: number): { index: number; at: number } | null {
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const at = text.indexOf(`${WEEKDAYS[i]}요일`, from);
    if (at !== -1) return { index: i, at };
  }
  return null;
}

export type ParsedRange = { startDate: string; endDate: string };

/**
 * "다음주 수요일부터 목요일", "7월 15일부터 16일", "내일", "3일간" 같은 표현을 날짜로 바꾼다.
 * 해석에 실패하면 null.
 */
export function parseDateExpression(input: string, today = new Date()): ParsedRange | null {
  const text = input.trim();
  if (text === '') return null;

  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const durationOnly = text.match(/(\d+)\s*(?:일간|일\s*동안|박)/);

  const explicit = durationOnly
    ? []
    : [...text.matchAll(/(?:(\d{1,2})\s*월\s*)?(\d{1,2})\s*일/g)];
  if (explicit.length > 0) {
    let lastMonth = base.getMonth();
    const dates = explicit.map((match, index) => {
      const month = match[1] ? Number(match[1]) - 1 : lastMonth;
      lastMonth = month;
      const day = Number(match[2]);
      const candidate = new Date(base.getFullYear(), month, day);
      if (index === 0 && !match[1] && candidate < base) {
        candidate.setMonth(candidate.getMonth() + 1);
        lastMonth = candidate.getMonth();
      }
      return candidate;
    });
    const start = dates[0];
    const end = dates[1] ?? start;
    if (end < start) return null;
    return { startDate: toISO(start), endDate: toISO(end) };
  }

  let anchor: Date | null = null;
  if (/모레|이틀\s*뒤|이틀\s*후/.test(text)) anchor = addDays(base, 2);
  else if (/내일|다음\s*날/.test(text)) anchor = addDays(base, 1);
  else if (/오늘/.test(text)) anchor = base;

  const weekOffset = /다다음\s*주/.test(text)
    ? 14
    : /다음\s*주|차주/.test(text)
      ? 7
      : /이번\s*주|금주/.test(text)
        ? 0
        : null;

  if (weekOffset !== null) {
    const weekStart = addDays(startOfWeek(base), weekOffset);
    const first = findWeekday(text, 0);
    if (first) {
      const offset = first.index === 0 ? 6 : first.index - 1;
      anchor = addDays(weekStart, offset);
      if (weekOffset === 0 && anchor < base) anchor = addDays(anchor, 7);

      const second = findWeekday(text, first.at + 1);
      if (second) {
        const endOffset = second.index === 0 ? 6 : second.index - 1;
        const end = addDays(anchor, endOffset - offset);
        if (end >= anchor) {
          return { startDate: toISO(anchor), endDate: toISO(end) };
        }
      }
    } else {
      anchor = weekOffset === 0 && weekStart < base ? base : weekStart;
    }
  } else if (anchor === null) {
    const weekday = findWeekday(text, 0);
    if (weekday) {
      const target = weekday.index;
      const diff = (target - base.getDay() + 7) % 7;
      anchor = addDays(base, diff === 0 ? 7 : diff);
    }
  }

  if (anchor === null) {
    if (durationOnly) anchor = base;
    else return null;
  }

  const duration = durationOnly;
  if (duration) {
    const count = Number(duration[1]);
    const nights = /박/.test(duration[0]);
    const span = nights ? count : count - 1;
    return { startDate: toISO(anchor), endDate: toISO(addDays(anchor, Math.max(0, span))) };
  }

  return { startDate: toISO(anchor), endDate: toISO(anchor) };
}
