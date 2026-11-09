import type { AgentSkill } from './types';

export const webSearch: AgentSkill = {
  name: 'web-search',
  description:
    'How to use web_search well: writing the query and objective, search types, domain and date filters, freshness, and when not to add options. Load it before searching for facts about a place, program or reservation that the user did not provide.',
  body: `# Searching the web with web_search

Use web_search when you are missing real-world facts the user did not give and no link was shared: how a facility names itself, its address, whether group visits need a reservation, opening hours, what programs it runs.
If the user gave a URL, use read_web_page instead.

## Query and objective
- Write query as a natural-language description of the ideal page, not keywords. "국립중앙박물관 학생 단체 관람 예약 안내 페이지" works better than "국립중앙박물관 예약".
- Name the source type when it matters ("공식 홈페이지", "공지사항", "보도자료").
- Put recency in the query ("최신", "2026년") instead of adding a date filter.
- objective is required. Say what should rank first, what to exclude, and which facts to pull out. Example: "공식 기관 페이지를 우선하고 블로그는 제외. 단체 예약 방법, 관람 시간, 휴관일을 찾는다."
- Ask for the facts you need in the objective, then read the snippets. Do not make a second search just to re-word the first one.

## Defaults: leave everything else out
numResults defaults to 5. type defaults to auto. Add options only when the task needs them:

| Option | Add it only when |
| - | - |
| numResults | you truly need more than 5 candidates (max 10) |
| type: "lite" | speed or cost matters more than depth. Lite cannot use maxAgeHours, subpages or textMaxCharacters; if you set them the tool switches to auto |
| includeDomains | the user or the task demands a hard allowlist, e.g. ["go.kr"]. Paths like "anthropic.com/news" work on Exa. Otherwise state the source preference in the query |
| excludeDomains | a source would make the result unusable. Cannot be combined with includeDomains on the Firecrawl fallback |
| category | the user asked for one: news, pdf, company, publication, github, "personal site", people, "financial report" |
| startPublishedDate / endPublishedDate | the user gave a bounded window ("2026년 이후 공지"). Format YYYY-MM-DD. These are hard filters that drop pages with no date |
| country | results should favor a region. Two letters, e.g. KR |
| maxAgeHours | the page content itself must be current (hours, closures). It is not a publication-date filter |
| textMaxCharacters | highlights are not enough and you need page text. Returns text instead of highlights. Max 5000 |
| subpages + subpageTarget | the answer is on a sibling page (booking, hours) of each result. Keep it at 1 to 3 |

## Reading the results
- Each result has \`snippets\` (the passages relevant to your objective), \`publishedDate\` when known, and sometimes \`image\` and \`favicon\`.
- If snippets answer the question, stop. If they do not, read the single best URL with read_web_page. Do not read every result.
- Prefer official sources (the facility's own site, .go.kr, .or.kr, .ac.kr). Treat blogs and aggregators as hints only.
- Search results are not user-supplied facts. Tell the user which page a fact came from, and never invent an address or time that no result states.

## Common mistakes
- Adding category, domain filters or a date window by habit. Each one can drop the right page.
- Using startPublishedDate to mean "recent". Say "최신" in the query instead.
- Using maxAgeHours to mean "recent publication". It controls page freshness only.
- Requesting both highlights and text. Pick one: the default highlights, or textMaxCharacters.
- Searching for a page you were already given.
`,
};
