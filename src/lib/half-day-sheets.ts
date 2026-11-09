import {
  HALF_DAY_FORM_TITLE,
  HALF_DAY_PERIOD,
  HALF_DAY_REPORT_TITLE,
  HALF_DAY_SCHEDULE,
  HALF_DAY_SCHOOL,
  formatTableDate,
  getEntry,
  reportPlace,
  reportPurpose,
  weekdayOf,
  getReport,
  type HalfDayData,
} from './half-day';

/**
 * 반일 교외체험학습 신청서(4쪽)와 결과 보고서(5쪽)를 A4 한 장짜리 HTML 로 그린다.
 * 같은 문자열을 화면 미리보기와 인쇄(printPages)에 함께 쓴다.
 * 사용자가 쓴 글은 전부 escapeHtml 을 거치므로 innerHTML 로 넣어도 안전하다.
 */

/** A4 를 96dpi 로 환산한 크기(px). */
export const SHEET_WIDTH = 794;
export const SHEET_HEIGHT = 1123;

export type SheetStudent = { name: string; classNo: string; number: string };

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/** 줄바꿈은 살리고 나머지는 이스케이프한다. */
const multiline = (text: string): string => escapeHtml(text.trim()).replace(/\r?\n/g, '<br>');

/**
 * 한 줄에 들어가는 글자 수로 줄 수를 어림한다. 한글은 한 글자가 1em, 영문·숫자·기호는 0.55em 정도다.
 * 칸이 넘치면 글자 크기를 한 단계 줄이는 데 쓴다.
 */
export function estimateLines(text: string, charsPerLine: number): number {
  if (text.trim() === '') return 1;
  return text.split(/\r?\n/).reduce((sum, line) => {
    const width = [...line].reduce((w, char) => w + (/[ᄀ-ᇿ㄰-㆏가-힣一-鿿]/.test(char) ? 1 : 0.62), 0);
    return sum + Math.max(1, Math.ceil(width / charsPerLine));
  }, 0);
}

/**
 * 원본 서식(PDF 4·5쪽)을 794×1123px 로 옮겨 잰 치수다.
 * 신청서는 직접 신청한 칸에 글이 길게 들어가면 표가 늘어나므로, 줄 수에 따라 글자 크기(t1·t2)와 여백(compact)을 줄인다.
 */
const SHEET_CSS = `
.hds-sheet{position:relative;width:${SHEET_WIDTH}px;height:${SHEET_HEIGHT}px;box-sizing:border-box;background:#fff;color:#000;overflow:hidden;
  font-family:'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR','Nanum Gothic',sans-serif;font-size:14.5px;line-height:1.35;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.hds-sheet *{box-sizing:border-box}
.hds-sheet table{border-collapse:collapse}
.hds-fill{display:inline-block;min-width:3.4em;padding:0 .3em;text-align:center;font-weight:700}
.hds-approval{position:absolute;border:1.5px solid #000;font-size:13.5px;text-align:center}
.hds-approval th,.hds-approval td{border:1px solid #000;font-weight:400;padding:0}
.hds-approval th{height:27px;background:#fff}
.hds-approval .hds-vert{width:25px;line-height:1.3;letter-spacing:1px}
.hds-approval td{height:48px}
.hds-approval .hds-sign{width:80px}
.hds-approval .hds-sign.hds-wide{vertical-align:bottom;text-align:right;padding:0 6px 3px;font-size:12.5px}

/* 신청서 */
.hds-app-note{position:absolute;left:57px;top:36px;font-size:14px}
.hds-app-title{position:absolute;left:0;right:0;top:62px;margin:0;text-align:center;font-size:21px;font-weight:700;letter-spacing:-.3px}
.hds-app .hds-approval{top:142px;right:42px}
.hds-app-box{position:absolute;left:57px;right:57px;top:250px;border:1.5px solid #000}
.hds-app.hds-compact .hds-app-box{top:236px}
.hds-person{display:flex;border-bottom:1px solid #000;height:32px;align-items:center}
.hds-person-label{width:115px;height:100%;display:flex;align-items:center;justify-content:center;border-right:1px solid #000}
.hds-person-value{padding-left:12px}
.hds-app-body{padding:6px 0 0}
.hds-app-body p{margin:0}
.hds-app-line{padding:0 26px;line-height:25px}
.hds-plan{margin:6px 0 0 35px;width:611px;font-size:14px;table-layout:fixed;border:1.5px solid #000}
.hds-plan th{background:#dbe5f1;font-weight:700;border:1px solid #000;height:25px;text-align:center}
.hds-plan td{border:1px solid #000;padding:3px 6px;height:25px;vertical-align:middle;line-height:1.25;word-break:keep-all;overflow-wrap:anywhere}
.hds-plan td.hds-d{text-align:center;padding:3px 2px}
.hds-plan td.hds-fixed{text-align:center;background:#efefef}
.hds-plan td.hds-fixed-date{background:#efefef}
.hds-plan td.hds-v{text-align:left}
.hds-plan.hds-t1{font-size:13px}
.hds-plan.hds-t1 td{padding:2px 5px}
.hds-plan.hds-t2{font-size:12px}
.hds-plan.hds-t2 td{padding:1px 4px;height:22px}
.hds-plan.hds-t2 th{height:22px}
.hds-request{text-align:center;margin-top:30px!important}
.hds-sign-date{text-align:center;margin-top:26px!important;letter-spacing:1px}
.hds-sign-block{width:214px;margin:22px auto 0;line-height:1.75}
.hds-sign-block div{display:flex;justify-content:space-between}
.hds-to{text-align:center;font-size:20px;margin-top:36px!important;margin-bottom:26px!important;letter-spacing:-.2px}
.hds-confirm{display:flex;border-top:1px solid #000}
.hds-confirm-label{width:148px;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:700;background:#f3f3f3;border-right:1px solid #000;padding:9px 4px;line-height:1.35}
.hds-confirm-text{flex:1;padding:8px 14px;line-height:1.6}
.hds-app.hds-compact .hds-request{margin-top:16px!important}
.hds-app.hds-compact .hds-sign-date{margin-top:12px!important}
.hds-app.hds-compact .hds-sign-block{margin-top:10px}
.hds-app.hds-compact .hds-to{margin-top:18px!important;margin-bottom:14px!important}

/* 보고서 */
.hds-rep-title{position:absolute;left:0;right:0;top:54px;margin:0;text-align:center;font-size:30px;font-weight:700;letter-spacing:.5px}
.hds-rep .hds-approval{top:87px;right:43px}
.hds-rep .hds-approval th{height:27px}
.hds-rep-body{position:absolute;left:72px;top:196px;width:643px}
.hds-rep-table{width:643px;border:1.5px solid #000;font-size:14.5px;table-layout:fixed}
.hds-rep-table th,.hds-rep-table td{border:1px solid #000;padding:4px 10px;vertical-align:middle;text-align:left}
.hds-rep-table th{width:82px;text-align:center;font-weight:400;padding:4px 2px}
.hds-rep-table .hds-person-row td{font-weight:700}
.hds-rep-table td.hds-tall{vertical-align:top;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;line-height:1.6;padding:9px 12px}
.hds-rep-table td.hds-attach{vertical-align:top;padding:9px 12px}
.hds-rep-table td.hds-attach small{display:block;font-size:13px;margin-bottom:6px}
.hds-photos{display:flex;justify-content:flex-start;align-items:flex-start;gap:8px;margin-top:8px}
.hds-photos img{display:block;flex:none;object-fit:cover;border:1px solid #d0d0d0}
.hds-rep-note{margin:44px 0 0 -36px;width:715px;font-size:13.5px;line-height:1.65}
.hds-rep-note p{margin:0 0 2px;padding-left:1.1em;text-indent:-1.1em}
.hds-rep-note b{text-decoration:underline}
`;

type Tier = { font: 14 | 13 | 12; className: '' | 'hds-t1' | 'hds-t2'; compact: boolean };

/** 칸 너비(px)에서 패딩을 뺀 폭. 글자 크기를 바꾸면 한 줄에 들어가는 글자 수가 달라진다. */
const COLUMN_INNER_WIDTH = { purpose: 120, place: 126, content: 262 } as const;
/** 한 줄이 늘 때마다 표가 커지는 높이(px). */
const EXTRA_LINE_HEIGHT = { 14: 17.5, 13: 16, 12: 15 } as const;
/** 신청서 한 장에 더 들어갈 수 있는 높이. 여백을 줄이지 않을 때와 줄였을 때. */
const SLACK_PX = { relaxed: 36, compact: 120 } as const;

function chooseTier(data: HalfDayData): Tier {
  const applied = HALF_DAY_SCHEDULE.flatMap((day) => (day.kind === 'personal' && getEntry(data, day.date).applied ? [getEntry(data, day.date)] : []));
  const tiers: Tier[] = [
    { font: 14, className: '', compact: false },
    { font: 14, className: '', compact: true },
    { font: 13, className: 'hds-t1', compact: true },
    { font: 12, className: 'hds-t2', compact: true },
  ];

  const extraPx = (font: Tier['font']) =>
    applied.reduce((sum, entry) => {
      const lines = Math.max(
        estimateLines(entry.purpose, COLUMN_INNER_WIDTH.purpose / font),
        estimateLines(entry.place, COLUMN_INNER_WIDTH.place / font),
        estimateLines(entry.content, COLUMN_INNER_WIDTH.content / font)
      );
      return sum + (lines - 1) * EXTRA_LINE_HEIGHT[font];
    }, 0);

  return (
    tiers.find((tier) => extraPx(tier.font) <= (tier.compact ? SLACK_PX.compact : SLACK_PX.relaxed)) ??
    tiers[tiers.length - 1]
  );
}

function approvalBox(kind: 'application' | 'report'): string {
  if (kind === 'application') {
    return (
      `<table class="hds-approval"><tr><th rowspan="2" class="hds-vert">결<br>재</th><th class="hds-sign">담임교사</th><th class="hds-sign" style="width:84px">학년부장</th></tr>` +
      `<tr><td></td><td class="hds-sign hds-wide">전결</td></tr></table>`
    );
  }
  return (
    `<table class="hds-approval"><tr><th rowspan="2" class="hds-vert">결<br>재</th><th class="hds-sign" style="width:80px">담임교사</th></tr>` +
    `<tr><td style="height:63px"></td></tr></table>`
  );
}

function personValue(student: SheetStudent): string {
  const fill = (value: string) => `<span class="hds-fill">${escapeHtml(value)}</span>`;
  return `3학년 (${fill(student.classNo)})반 (${fill(student.number)})번 &nbsp; 이름: (${fill(student.name)})`;
}

function periodLabel(): string {
  const format = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    return `${year}.${month}.${day}.(${weekdayOf(iso)})`;
  };
  return `${format(HALF_DAY_PERIOD.start)} ~ ${format(HALF_DAY_PERIOD.end)}`;
}

/** 신청서 표. 학교가 정한 날은 칸을 합쳐 문구만 보이고, 연속된 같은 문구(진로 3일)는 세로로 합친다. */
function planRows(data: HalfDayData): string {
  const rows: string[] = [];

  for (let index = 0; index < HALF_DAY_SCHEDULE.length; index += 1) {
    const day = HALF_DAY_SCHEDULE[index];
    const date = `<td class="hds-d${day.kind === 'personal' ? '' : ' hds-fixed-date'}">${formatTableDate(day.date)}</td>`;

    if (day.kind === 'personal') {
      const entry = getEntry(data, day.date);
      const cells = (['purpose', 'place', 'content'] as const).map(
        (field) => `<td class="hds-v">${multiline(entry.applied ? entry[field] : '')}</td>`
      );
      rows.push(`<tr>${date}${cells.join('')}</tr>`);
      continue;
    }

    const previous = HALF_DAY_SCHEDULE[index - 1];
    if (day.kind === 'career' && previous?.kind === 'career') {
      // 위 행의 칸이 이미 이 행까지 합쳐져 있다.
      rows.push(`<tr>${date}</tr>`);
      continue;
    }

    const span = day.kind === 'career' ? HALF_DAY_SCHEDULE.slice(index).filter((item) => item.kind === 'career').length : 1;
    rows.push(`<tr>${date}<td class="hds-fixed" colspan="3" rowspan="${span}">${escapeHtml(day.label)}</td></tr>`);
  }

  return rows.join('');
}

/** 신청서(4쪽). 직접 신청하는 날만 칸이 채워지고, 나머지는 빈칸으로 남는다. */
export function buildApplicationSheet(student: SheetStudent, data: HalfDayData): string {
  const html = planRows(data);
  const tier = chooseTier(data);

  return (
    `<style>${SHEET_CSS}</style>` +
    `<div class="hds-sheet hds-app${tier.compact ? ' hds-compact' : ''}">` +
    `<div class="hds-app-note">(서식)</div>` +
    `<h1 class="hds-app-title">${escapeHtml(HALF_DAY_FORM_TITLE)}</h1>` +
    approvalBox('application') +
    `<div class="hds-app-box">` +
    `<div class="hds-person"><div class="hds-person-label">인적사항</div><div class="hds-person-value">${personValue(student)}</div></div>` +
    `<div class="hds-app-body">` +
    `<p class="hds-app-line">1. 일시 : ${periodLabel()}</p>` +
    `<p class="hds-app-line">2. 반일 개인 진로·직업 체험학습 신청 내용</p>` +
    `<table class="hds-plan${tier.className ? ` ${tier.className}` : ''}"><colgroup><col style="width:13%"><col style="width:21%"><col style="width:22%"><col style="width:44%"></colgroup>` +
    `<thead><tr><th>날짜</th><th>체험 목적</th><th>체험 장소</th><th>체험 내용</th></tr></thead><tbody>${html}</tbody></table>` +
    `<p class="hds-request">위와 같이 반일 교외체험학습(개인 진로·직업체험)을 신청하오니 허락하여 주시기 바랍니다.</p>` +
    `<p class="hds-sign-date">2026. &nbsp;&nbsp;&nbsp;&nbsp;. &nbsp;&nbsp;&nbsp;&nbsp;.</p>` +
    `<div class="hds-sign-block"><div><span>학 생 :</span><span>(서명 또는 인)</span></div><div><span>학부모 :</span><span>(서명 또는 인)</span></div></div>` +
    `<p class="hds-to">${escapeHtml(HALF_DAY_SCHOOL)}장 귀하</p>` +
    `</div>` +
    `<div class="hds-confirm"><div class="hds-confirm-label">담임 선생님<br>확인 방법 및 일시</div>` +
    `<div class="hds-confirm-text">( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)월 ( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)일 ( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)(를) 통해 반일 교외체험학습(개인 진로·직업 체험) 신청 사항을 보호자에게 확인하였음.</div></div>` +
    `</div></div>`
  );
}

/** 체험내용·느낀 점 칸의 안쪽 폭(px). 표 643 − 라벨 82 − 좌우 패딩 24 − 테두리. */
const REPORT_TEXT_WIDTH = 535;
const REPORT_TEXT_FONTS = [14.5, 13.5, 12.5, 11.5] as const;
/** 두 칸(체험내용 + 느낀 점)이 함께 쓸 수 있는 높이. 안내문까지 한 장에 들어가도록 잡았다. */
const REPORT_TEXT_BUDGET_PX = 437;
/** 첨부자료 칸 기본 높이와 줄일 수 있는 한계. 사진이 들어가면 사진 줄 높이만큼 늘어난다. */
const ATTACH_HEIGHT = { normal: 180, min: 110 } as const;
/** 칸 머리말(22) + 사진 위 간격(8) + 안쪽 여백(18). 사진 줄 높이는 여기에 더한다. */
const PHOTO_CHROME_PX = 48;
/** 첨부 칸 안쪽 폭(px). 표 643 − 좌우 패딩 24 − 테두리. */
const PHOTO_ROW_WIDTH = 612;
const PHOTO_GAP_PX = 8;
const PHOTO_MAX_HEIGHT_PX = 200;
/** 첨부 메모가 차지할 수 있는 높이(세 줄). 더 길면 칸 안에서 잘린다. */
const ATTACH_NOTE_MAX_PX = 70;
const ATTACH_TEXT_WIDTH = 595;
/** 한 칸이 커질 수 있는 한계. 이보다 길면 칸 안에서 잘린다(화면에서는 reportFits 로 미리 알려 준다). */
const REPORT_TEXT_MAX_PX = { content: 280, feeling: 210 } as const;
const REPORT_ROW_MIN_PX = { content: 165, feeling: 133 } as const;

/** 사진 한 장의 크기(px). 모르면 4:3 으로 본다. */
export type PhotoSize = { width: number; height: number };

/**
 * 사진을 한 줄에 왼쪽부터 놓는다. 모든 사진이 같은 높이에서 원래 비율 그대로 나란히 서므로 여백(레터박스)이 생기지 않는다.
 * 줄 폭이 모자라면 높이를 줄여서 다 들어가게 한다.
 */
function photoRow(sizes: PhotoSize[]): { height: number; widths: number[] } {
  if (sizes.length === 0) return { height: 0, widths: [] };

  const ratios = sizes.map(({ width, height }) =>
    width > 0 && height > 0 ? Math.min(3, Math.max(0.4, width / height)) : 4 / 3
  );
  const room = PHOTO_ROW_WIDTH - PHOTO_GAP_PX * (sizes.length - 1);
  const height = Math.floor(Math.min(PHOTO_MAX_HEIGHT_PX, room / ratios.reduce((sum, ratio) => sum + ratio, 0)));
  return { height, widths: ratios.map((ratio) => Math.floor(ratio * height)) };
}

type ReportLayout = {
  font: number;
  attach: number;
  fits: boolean;
  contentMax: number;
  feelingMax: number;
  noteMax: number;
};

const reportTextHeight = (text: string, font: number, minimum: number) =>
  Math.max(minimum, estimateLines(text, REPORT_TEXT_WIDTH / font) * font * 1.6 + 18);

/**
 * 글이 길면 글자 크기를 한 단계씩 줄이고, 그래도 모자라면 첨부자료 칸을 줄여서 한 장에 넣는다.
 * 그래도 안 들어가면 fits 가 false 이고, 각 칸의 최대 높이를 남은 공간에 맞춰 줄여 페이지가 넘치지 않게 한다.
 */
function reportLayout(content: string, feeling: string, photoHeight = 0, note = ''): ReportLayout {
  const hasPhotos = photoHeight > 0;
  const noteHeight =
    note.trim() === '' ? 0 : Math.min(estimateLines(note, ATTACH_TEXT_WIDTH / 14.5) * 23, ATTACH_NOTE_MAX_PX);
  const need = (hasPhotos ? PHOTO_CHROME_PX + photoHeight : 60) + noteHeight;
  const base = Math.max(ATTACH_HEIGHT.normal, need);
  const minimum = Math.max(ATTACH_HEIGHT.min, need);
  const total = REPORT_TEXT_BUDGET_PX + ATTACH_HEIGHT.normal;
  const textBudget = total - base;
  const uncapped = (font: number) =>
    reportTextHeight(content, font, REPORT_ROW_MIN_PX.content) + reportTextHeight(feeling, font, REPORT_ROW_MIN_PX.feeling);

  const common = { noteMax: ATTACH_NOTE_MAX_PX };
  const font = REPORT_TEXT_FONTS.find((candidate) => uncapped(candidate) <= textBudget);
  if (font !== undefined) {
    return { font, attach: base, fits: true, contentMax: REPORT_TEXT_MAX_PX.content, feelingMax: REPORT_TEXT_MAX_PX.feeling, ...common };
  }

  const smallest = REPORT_TEXT_FONTS[REPORT_TEXT_FONTS.length - 1];
  const overflow = uncapped(smallest) - textBudget;
  const fitsPage = overflow <= base - minimum;
  const attach = Math.max(minimum, base - overflow);
  const fitsCaps =
    reportTextHeight(content, smallest, 0) <= REPORT_TEXT_MAX_PX.content &&
    reportTextHeight(feeling, smallest, 0) <= REPORT_TEXT_MAX_PX.feeling;

  // 안 들어가면 남은 공간을 두 칸이 나눠 쓰도록 최대 높이를 줄인다(잘리더라도 안내문은 페이지 안에 남는다).
  const remaining = total - attach;
  const contentMax = fitsPage ? REPORT_TEXT_MAX_PX.content : Math.round(remaining * 0.57);
  const feelingMax = fitsPage ? REPORT_TEXT_MAX_PX.feeling : remaining - contentMax;
  return { font: smallest, attach, fits: fitsCaps && fitsPage, contentMax, feelingMax, ...common };
}

/** 체험내용·느낀 점·첨부 메모가 한 장에 다 들어가는지. 편집 화면에서 경고를 띄우는 데 쓴다. */
export function reportFits(
  report: { content: string; feeling: string; attachmentNote?: string },
  photos: PhotoSize[] = []
): boolean {
  return reportLayout(report.content, report.feeling, photoRow(photos).height, report.attachmentNote ?? '').fits;
}

function koreanDateWithWeekday(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일 ( ${weekdayOf(iso)}요일 )`;
}

/** 결과 보고서(5쪽). 신청한 날짜마다 한 장씩, 그날 하루가 기간이다. */
export function buildReportSheet(
  student: SheetStudent,
  data: HalfDayData,
  date: string,
  /** 사진 id → data URL. 아직 못 불러온 사진은 건너뛴다. */
  photoUrls: Record<string, string> = {}
): string {
  const report = getReport(data, date);
  const shown = (report.photos ?? []).filter((photo) => photoUrls[photo.id]);
  const row = photoRow(shown);
  const layout = reportLayout(report.content, report.feeling, row.height, report.attachmentNote);
  const { font, attach } = layout;
  const photoGrid =
    shown.length === 0
      ? ''
      : `<div class="hds-photos">${shown
          .map((photo, index) => `<img src="${escapeHtml(photoUrls[photo.id])}" alt="" style="width:${row.widths[index]}px;height:${row.height}px">`)
          .join('')}</div>`;
  const clipped = (text: string, max: number) => `<div style="max-height:${max}px;overflow:hidden">${multiline(text)}</div>`;

  return (
    `<style>${SHEET_CSS}</style>` +
    `<div class="hds-sheet hds-rep">` +
    `<h1 class="hds-rep-title">${escapeHtml(HALF_DAY_REPORT_TITLE)}</h1>` +
    approvalBox('report') +
    `<div class="hds-rep-body"><table class="hds-rep-table">` +
    `<tr class="hds-person-row"><th style="height:32px">인적사항</th><td>${personValue(student)}</td></tr>` +
    `<tr><th rowspan="2">기 간</th><td style="font-weight:700;height:32px">${koreanDateWithWeekday(date)} ~ ${koreanDateWithWeekday(date)}</td></tr>` +
    `<tr><td style="height:32px"><b>총 ( 1 )일간</b> &nbsp;※ 일수 산정 시 토·일요일, 공휴일, 휴업일 제외</td></tr>` +
    `<tr><th>장 소</th><td style="height:32px">${multiline(reportPlace(data, date))}</td></tr>` +
    `<tr><th>목 적</th><td style="height:48px">${multiline(reportPurpose(data, date))}</td></tr>` +
    `<tr><th>체험내용</th><td class="hds-tall" style="height:${Math.min(REPORT_ROW_MIN_PX.content, layout.contentMax)}px;font-size:${font}px">${clipped(report.content, layout.contentMax - 18)}</td></tr>` +
    `<tr><th>느낀 점</th><td class="hds-tall" style="height:${Math.min(REPORT_ROW_MIN_PX.feeling, layout.feelingMax)}px;font-size:${font}px">${clipped(report.feeling, layout.feelingMax - 18)}</td></tr>` +
    `<tr><td colspan="2" class="hds-attach" style="height:${attach}px"><small>[첨부자료] (사진, 입장권 등의 관련 증빙자료를 반드시 첨부합니다.)</small>${clipped(report.attachmentNote, layout.noteMax)}${photoGrid}</td></tr>` +
    `</table>` +
    `<div class="hds-rep-note">` +
    `<p>※ 신청서는 교외체험학습 실시 <b>최소 2일 전(토·일요일, 공휴일, 휴업일 제외)</b>까지, 보고서는 <b>실시 후 7일 이내</b>에 제출하여야 합니다.<br>교외체험학습 실시 후 보고서를 제출하지 않으면 해당 기간을 미인정 결석으로 처리합니다.</p>` +
    `<p>※ <b>연속 5일 초과</b> 교외체험학습 시 학생은 <b>주1회 이상 담임교사에게 연락</b>하여 안전을 확인하도록 합니다.</p>` +
    `</div></div></div>`
  );
}

export function sheetFileTitle(student: SheetStudent, kind: 'application' | 'report', date?: string): string {
  const base = kind === 'application' ? '반일 교외체험학습 신청서' : '교외체험학습 결과 보고서';
  // ISO 날짜는 Windows/macOS 파일명에서 안전하며 브라우저 PDF 저장 기본 이름으로도 읽기 쉽다.
  return [base, student.name, date ?? ''].filter(Boolean).join(' ');
}
