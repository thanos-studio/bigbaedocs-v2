import type { AgentSkill } from './types';

export const webReading: AgentSkill = {
  name: 'web-reading',
  description:
    'How to use read_web_page well: content freshness (maxAgeHours), crawling subpages, getting image URLs and favicons, and the mistakes to avoid. Load it before reading a link when the page may have changed recently, spans several pages, or you need images.',
  body: `# Reading a known URL with read_web_page

Use read_web_page when you already have the URL. Do not web_search for a URL you were given.
The tool tries Exa, then Firecrawl, then a plain fetch, and tells you which one answered in \`provider\`.

## Output
- Page text comes back as markdown in \`text\`. \`truncated: true\` means it was cut at maxCharacters.
- Default is 12000 characters per page. Raise maxCharacters (max 30000) only when the page really is long and a field you need is missing. Lower it when you only need a quick check.
- \`query\` focuses extraction on one question. It only takes effect when Exa has an API key; otherwise read the text yourself.
- \`favicon\` and \`image\` (a representative image) come back when the provider has them.

## Content freshness: maxAgeHours
Most reads should omit it. Set it only when stale content would be wrong: opening hours, closures, reservation windows, prices, availability, notices.

| Value | Behavior |
| - | - |
| omit | Use cached content if available, fetch when needed |
| positive number | Use the cache only if it is newer than this many hours, otherwise fetch live. 24 is a good default for "current" |
| 0 | Always fetch live. Use for closure notices or anything dated "today" |
| -1 | Cached copy only. Fast, but can be old |

- maxAgeHours is how fresh the *extracted page* must be. It is not a publication-date filter.
- A live fetch can take 10 to 15 seconds on slow sites. Do not ask for 0 when a cached copy would do.
- Without an Exa API key the free Exa reader cannot honor freshness, so the tool sends those requests to Firecrawl first. The result's \`freshness\` field says \`live\`, \`cached\` or \`unknown\`. If it says \`unknown\` and the date matters, tell the user to confirm on the official page.

## Crawling subpages: subpages and subpageTarget
- subpages is how many linked pages to read after the starting URL (0 to 10). Each one costs a request, so keep it small: 3 to 5 is plenty for a facility site.
- subpageTarget is a list of keywords that make matching links win, e.g. ["예약", "관람", "오시는 길", "단체"]. Match the words the site's own URLs and menus use.
- Only same-site links are followed. Subpage text is shorter (3000 characters each) than the main page.
- Use it when the answer is split across a main page and its booking, hours or directions pages. Do not use it to read one page.

## Images and favicons: images
- images is the number of image URLs to return from the page (0 to 20). Ask for it only when the user wants pictures or a logo. The form does not need images, so leave it out otherwise.

## Common mistakes
- Setting maxAgeHours "just in case". It makes every read slower.
- Treating cached text as proof that a page is current. Say when the freshness is unknown.
- Asking for many subpages without subpageTarget on a big site. You will read unrelated pages.
- Sending a bare domain you guessed. Use the exact URL the user gave or one that web_search returned.
- Reading the same URL twice in one turn with the same options.
`,
};
