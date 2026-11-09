import type { AgentSkill } from './types';

export const linkToApplication: AgentSkill = {
  name: 'link-to-application',
  agents: ['trip'],
  description:
    'Step-by-step workflow for filling the application form from a link the user pasted (a facility, program, booking or notice page). Load it as soon as the user shares a URL.',
  body: `# Filling the application from a pasted link

1. Read the page with read_web_page. If the page looks like a landing page and the details sit on other pages (booking, hours, directions), read again with subpages 3 and subpageTarget keywords such as ["예약", "관람", "안내", "오시는 길"].
   - Use maxAgeHours 24 when the page states hours, closures or reservation windows, because those change.
2. Decide which fields the page actually supports. Only fill what the page states:
   - destination: the official name of the place or program as the page writes it.
   - placeAddress: only if an address is printed on the page. Never build one from memory.
   - startDate / endDate: only if the page fixes a date for this program. A facility's general opening hours are not the student's trip dates. Ask the user for the dates (or use parse_date_expression on what they said).
   - purpose and plan: write them from what the program really offers (exhibits, activities, sessions). Follow the formatting and writing rules given in the system prompt. Do not copy marketing text.
   - learningType: infer from the program (견학·체험 활동, 문화·예술 활동, 진로 체험, 봉사 활동).
3. Call update_application_draft once with every field you can support, and set step to the screen you filled.
4. Reply in one or two sentences: which fields you filled and from which page. Name any field you left empty and why.
5. Ask one focused question (ask_application_question) for the single most important missing field, usually the dates.

## When something goes wrong
- The tool returns an error, an empty body, or a login wall: say so plainly and ask the user to paste the relevant text.
- \`freshness\` is "unknown" and the page states times or closures: add "공식 페이지에서 한 번 더 확인해 주세요" to your reply.
- The page contradicts what the user said: keep the user's value and mention the difference.
- Rate-limit errors (a "한도" message) mean the search providers are busy. Do not retry in a loop. Tell the user it will work again shortly, or ask them to paste the text.
`,
};
