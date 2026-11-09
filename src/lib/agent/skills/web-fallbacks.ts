import type { AgentSkill } from './types';

export const webFallbacks: AgentSkill = {
  name: 'web-fallbacks',
  description:
    'How the web tools fall back between Exa and Firecrawl, what rate-limit and failure messages mean, and how to read an attached PDF with parse_attachment. Load it when a web tool reports an error, a limit, or a fallback note, or when the user attaches a PDF.',
  body: `# Providers, fallbacks and limits

## Order
- read_web_page: Exa first, then Firecrawl (scrape), then a plain fetch of the page.
  - Requests that set maxAgeHours (0 or higher) or images skip the free Exa reader, which cannot do them, and start with Firecrawl.
- web_search: Exa first, then Firecrawl (search). An empty result also triggers the next provider.
- parse_attachment: Firecrawl parse only.

Every result lists \`provider\` (who answered), \`notes\` (what changed, e.g. a fallback or an ignored option) and \`attempts\` (who failed and why). Read the notes before you rely on the result.

## Rate limits
- Both services run keyless at a free rate. When one says it hit a limit, the tools put it on cooldown and use the other one right away. You do not need to wait or retry.
- The free Firecrawl allowance is capped per day and per minute (roughly 10 requests a minute). Heavy use such as many subpages can use it up.
- If every provider is limited, the tool fails with an error that includes seconds until retry. Then:
  1. Do not call the tool again this turn.
  2. Tell the user the web lookup is busy and say how long to wait.
  3. Carry on with what the user already told you, or ask them to paste the page text.
- Do not repeat the same call hoping for a different result.

## Failures
- "본문이 비어 있어요": the page is script-rendered or blocked. Try one read with maxAgeHours 0, then ask the user to paste the text.
- "열 수 없는 주소예요": private or local addresses are blocked on purpose. Ask for a public link.
- A login or reservation wall: the page cannot be read. Say so.

## Attached PDFs
- When the user attaches a PDF, the system lists it under "Attached documents". The model can already see the PDF, so only call parse_attachment when you need clean text of a long or scanned document or want personal data masked.
- Options: maxPages (PDF pages to read), maxCharacters, redactPII (mask names and contact details in what comes back).
- Only PDFs are parsed. Images are viewed directly.
`,
};
