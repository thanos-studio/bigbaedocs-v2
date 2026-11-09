import type { AgentSkill } from './types';

export const halfDayPlanning: AgentSkill = {
  name: 'half-day-planning',
  agents: ['half-day'],
  description:
    'How to fill the half-day application table and the per-date result reports: which dates are yours, how to write each cell within its length limit, how to use a pasted link or search for a program, and deadlines. Load it before your first update_half_day_plan or update_half_day_report call.',
  body: `# Half-day off-campus learning (개인 진로·직업 체험)

## What the form is
- One application table lists every school day from 2026-11-20 to 2026-12-11.
- Nine of them are run by the school (field trips on 11/24, 12/1, 12/3 and 12/8, 단축수업 11/25, 재량휴업일 11/26, 진로 12/9 to 12/11). They are already printed in the form. Never write entries for them. If the user asks about one, explain it is a school day and needs nothing from them.
- Seven dates are personal days: 11/20, 11/23, 11/27, 11/30, 12/2, 12/4, 12/7. The student chooses which of these to apply for and fills 체험 목적, 체험 장소, 체험 내용 for each one.
- A day not applied for is a normal school day. Do not set applied for dates the user did not ask for.
- Every applied date also needs its own 결과 보고서 after it happens.

## Filling the application (update_half_day_plan)
Cells are small. Obey the limits exactly or the tool call is rejected:
- purpose (체험 목적): at most 20 characters, a noun phrase. 진로 탐색, 직업 체험, 대학 탐방, 직무 이해.
- place (체험 장소): at most 22 characters. The real name of the place, no address. 국립중앙박물관, 용산 전자상가, 서울 코엑스.
- content (체험 내용): at most 44 characters, one line, ending as a noun phrase, no final period. 큐레이터 직무 탐색 및 상설전시 관람.
- Write only what the user said or a page you read says. Do not invent a program, a visit time or a person.
- Keep each date different when the user described different activities. If they gave one activity for several dates, repeat it faithfully; do not make up variations.
- Give plain text only: no bullets, no markdown, no emoji.
- Batch every date you can fill into one update_half_day_plan call and set step to "plan".

## From a link or a search
- When the user pastes a link, call read_web_page, then fill the dates the user named (or ask which dates) using what the page says: place name from the page, content from the program.
- When you need a fact (does the place take walk-ins, what are the hours), web_search, then use only what the results state. Never invent opening hours.
- Prefer maxAgeHours 24 when the answer is an opening hour, closure or reservation rule.

## Deadlines (mention only when useful)
- The application is due at least 2 school days before the date, not counting weekends and the 11/26 recess day. The prompt lists the exact due date for each personal date.
- The report is due within 7 days after the date. Not handing it in turns that day into an unexcused absence.

## Reports (update_half_day_report)
- Reports are written for applied dates. The date being in the future never stops you; do not mention today's date as a reason.
- If the student tells you what they did, use exactly that. If they hand the work to you ("알아서", "N일치"), write it at once from the application row and ask nothing.
- content (체험내용): at most 500 characters, past tense, plain prose, two to four sentences. From the row only: where they went, what they did, the stated purpose.
- feeling (느낀 점): at most 400 characters, past tense, plain and personal, one or two sentences that follow from the purpose. No grand resolutions, no clichés.
- Never add details the row does not contain: clock times, people, quotes, prices, weather, crowds, souvenirs, programs.
- attachmentNote: what proof will be attached, for example 입장권 사진. Leave it empty unless the student said so. Photos are attached by the student in the app.
- place and purpose default to the application. Only send them when the student changed them.
- Set step to "reports" after writing.
- After delegated reports end with: "신청서 내용을 바탕으로 쓴 초안이에요. 다녀온 뒤 실제 내용에 맞게 고쳐 주세요."

## Delegated application ("알아서 신청서 만들어줘")
- Choose the dates (all seven unless the user gave a number or dates) and fill every cell in one update_half_day_plan call.
- Pick famous public places in Seoul that fit 진로·직업 체험 and vary them. Check weekly closing days (many museums close on Monday) and use web_search with maxAgeHours 24 when unsure.
- Tell the student which place you picked for each date so they can change it.

## When something goes wrong
- A web tool fails or is rate limited: say so and ask the user to describe the plan in their own words.
- The user wants more than seven dates or a school day: explain the limit kindly and offer the closest personal date.
- Never answer a request to write something with "I can't" or "ask me later". If anything is missing, make a sensible, modest choice and say what you chose.
`,
};
