import type { UIMessage } from 'ai';
import { z } from 'zod';

import type { ApplicationDraft, ChatMessage, ToolCall } from '@/lib/types';

import {
  applicationPatchSchema,
  applicationDraftSchema,
  type ApplicationDraftContext,
  type ApplicationPatch,
} from './schema';

type AgentToolPart = Extract<UIMessage['parts'][number], { type: `tool-${string}` }>;

const TOOL_LABELS: Record<string, { kind: ToolCall['kind']; name: string; target?: string }> = {
  read_application_draft: { kind: 'tool', name: '신청서 확인' },
  parse_date_expression: { kind: 'tool', name: '날짜 인식', target: '기간' },
  search_application_places: { kind: 'tool', name: '장소 검색', target: '장소' },
  update_application_draft: { kind: 'tool', name: '신청서 반영' },
};

function isToolPart(part: UIMessage['parts'][number]): part is AgentToolPart {
  return part.type.startsWith('tool-');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getToolCalls(message: UIMessage): ToolCall[] {
  return message.parts.flatMap((part) => {
    if (!isToolPart(part)) return [];

    const toolId = part.type.slice('tool-'.length);
    const definition = TOOL_LABELS[toolId] ?? { kind: 'tool' as const, name: toolId };
    const status =
      part.state === 'output-available'
        ? 'done'
        : part.state === 'output-error'
          ? 'error'
          : 'running';
    const detail =
      part.state === 'output-error'
        ? part.errorText
        : toolId === 'update_application_draft' && part.state === 'output-available' && isRecord(part.output)
          ? typeof part.output.summary === 'string'
            ? part.output.summary
            : undefined
          : undefined;

    return [
      {
        id: part.toolCallId,
        kind: definition.kind,
        name: definition.name,
        target: definition.target,
        detail,
        status,
      },
    ];
  });
}

function getText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function getReasoning(message: UIMessage): string[] {
  return message.parts.flatMap((part) =>
    part.type === 'reasoning' && part.text.trim() !== '' ? [part.text] : []
  );
}

export function toDisplayMessages(messages: UIMessage[]): ChatMessage[] {
  return messages.map((message) => {
    const toolCalls = getToolCalls(message);
    const reasoning = getReasoning(message);
    return {
      id: message.id,
      role: message.role === 'assistant' ? 'agent' : message.role,
      content: getText(message),
      createdAt: 0,
      reasoning: reasoning.length > 0 ? reasoning : undefined,
      thinkingSeconds: undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  });
}

export function toUiMessages(messages: ChatMessage[]): UIMessage[] {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      id: message.id,
      role: message.role === 'agent' ? 'assistant' : message.role,
      parts: [{ type: 'text', text: message.content }],
    }));
}

export function toApplicationDraftContext(draft: ApplicationDraft): ApplicationDraftContext {
  return applicationDraftSchema.parse({
    id: draft.id,
    studentIds: draft.studentIds,
    step: draft.step,
    title: draft.title,
    startDate: draft.startDate,
    endDate: draft.endDate,
    learningType: draft.learningType,
    destination: draft.destination,
    placeRegion: draft.placeRegion,
    placeAddress: draft.placeAddress,
    purpose: draft.purpose,
    plan: draft.plan,
    guardianRelation: draft.guardianRelation,
    guardianPhone: draft.guardianPhone,
  });
}

export function getApplicationPatches(messages: UIMessage[]): {
  id: string;
  patch: ApplicationPatch;
}[] {
  return messages.flatMap((message) =>
    message.parts.flatMap((part) => {
      if (
        !isToolPart(part) ||
        part.type !== 'tool-update_application_draft' ||
        part.state !== 'output-available' ||
        !isRecord(part.output)
      ) {
        return [];
      }

      const parsed = applicationPatchSchema.safeParse(part.output.patch);
      return parsed.success ? [{ id: part.toolCallId, patch: parsed.data }] : [];
    })
  );
}

export const agentModelCatalogSchema = z
  .object({
    defaultModelId: z.string().trim().min(1),
    models: z
      .array(
        z.object({
          id: z.string().trim().min(1),
          label: z.string().trim().min(1),
          description: z.string().trim().min(1),
        })
      )
      .min(1),
  })
  .refine((catalog) => catalog.models.some((model) => model.id === catalog.defaultModelId));

export type AgentModelCatalog = z.infer<typeof agentModelCatalogSchema>;
