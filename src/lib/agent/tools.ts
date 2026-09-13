import 'server-only';

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

import { parseDateExpression } from '@/lib/parse-date';
import { searchPlaces } from '@/lib/places';

import {
  applicationPatchSchema,
  type ApplicationDraftContext,
  type ApplicationPatch,
} from './schema';

function describePatch(patch: ApplicationPatch): string {
  return Object.entries(patch)
    .map(([field, value]) => `${field}: ${String(value)}`)
    .join(', ');
}

export function createApplicationTools(draft: ApplicationDraftContext) {
  return {
    read_application_draft: tool({
      description: 'Read the current application draft before answering questions about its contents.',
      inputSchema: z.object({}),
      execute: async () => draft,
    }),
    parse_date_expression: tool({
      description:
        'Parse a Korean natural-language date expression into an application start and end date. Use it instead of guessing dates.',
      inputSchema: z.object({ expression: z.string().trim().min(1).max(300) }),
      execute: async ({ expression }) => ({
        expression,
        range: parseDateExpression(expression),
      }),
    }),
    search_application_places: tool({
      description:
        'Search the application place catalog. Use this before suggesting a known place or setting a known address.',
      inputSchema: z.object({
        region: z.enum(['domestic', 'overseas']),
        query: z.string().max(200),
      }),
      execute: async ({ region, query }) => ({
        places: searchPlaces(region, query),
      }),
    }),
    update_application_draft: tool({
      description:
        'Propose explicit application form changes. Call this whenever the user supplies or approves a field value. This returns a patch for the client to apply; it does not persist data itself.',
      inputSchema: applicationPatchSchema,
      execute: async (patch) => ({
        patch,
        summary: describePatch(patch),
      }),
    }),
  } satisfies ToolSet;
}
