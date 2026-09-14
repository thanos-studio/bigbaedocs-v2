import type { UIMessage } from 'ai';
import { z } from 'zod';

import { APPLICATION_STEPS, REPORT_STEPS } from '@/lib/types';
import type {
  ApplicationDraft,
  ChatAttachment,
  ChatMessage,
  PlaceCandidate,
  ToolCall,
} from '@/lib/types';

import {
  applicationPatchSchema,
  reportPatchSchema,
  applicationDraftSchema,
  type ApplicationDraftContext,
  type ApplicationPatch,
  type ReportPatch,
} from './schema';

type AgentToolPart = Extract<UIMessage['parts'][number], { type: `tool-${string}` }>;

const TOOL_LABELS: Record<string, { kind: ToolCall['kind']; name: string; target?: string }> = {
  read_application_draft: { kind: 'tool', name: '신청서 확인' },
  parse_date_expression: { kind: 'tool', name: '날짜 인식', target: '기간' },
  search_application_places: { kind: 'tool', name: '장소 검색', target: '장소' },
  propose_place_addresses: { kind: 'question', name: '주소 후보', target: '장소' },
  list_available_students: { kind: 'tool', name: '학생 목록 확인' },
  ask_application_question: { kind: 'question', name: '확인 질문' },
  update_application_draft: { kind: 'tool', name: '신청서 반영' },
  read_report_draft: { kind: 'tool', name: '보고서 확인' },
  ask_report_question: { kind: 'question', name: '확인 질문' },
  update_report_draft: { kind: 'tool', name: '보고서 반영' },
};

const PATCH_FIELD_LABELS: Record<string, string> = {
  studentIds: '학생',
  step: '단계',
  title: '제목',
  startDate: '시작일',
  endDate: '종료일',
  learningType: '학습 형태',
  destination: '장소',
  placeRegion: '지역',
  placeAddress: '주소',
  purpose: '체험 목적',
  plan: '활동 계획',
  reportStep: '단계',
  experience: '체험내용',
  reflection: '느낀 점',
  attachmentNote: '첨부자료',
};

function isToolPart(part: UIMessage['parts'][number]): part is AgentToolPart {
  return part.type.startsWith('tool-');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getPatchFields(part: AgentToolPart): string[] {
  if (part.state !== 'output-available' || !isRecord(part.output)) return [];

  const parsed = applicationPatchSchema.safeParse(part.output.patch);
  if (parsed.success) {
    return Object.keys(parsed.data)
      .filter((field) => field !== 'step')
      .map((field) => PATCH_FIELD_LABELS[field] ?? field);
  }

  const report = reportPatchSchema.safeParse(part.output.patch);
  if (!report.success) return [];

  return Object.keys(report.data)
    .filter((field) => field !== 'reportStep')
    .map((field) => PATCH_FIELD_LABELS[field] ?? field);
}

function getStepNavigation(part: AgentToolPart): string | null {
  if (part.state !== 'output-available' || !isRecord(part.output)) return null;

  const parsed = applicationPatchSchema.safeParse(part.output.patch);
  if (parsed.success && parsed.data.step !== undefined) {
    return APPLICATION_STEPS.find((step) => step.key === parsed.data.step)?.label ?? null;
  }

  const report = reportPatchSchema.safeParse(part.output.patch);
  if (!report.success || report.data.reportStep === undefined) return null;

  return REPORT_STEPS.find((step) => step.key === report.data.reportStep)?.label ?? null;
}

function getQuestionDetail(part: AgentToolPart): string | undefined {
  if (part.state !== 'output-available' || !isRecord(part.output)) return undefined;
  return typeof part.output.question === 'string' ? part.output.question : undefined;
}

function readString(source: unknown, key: string): string | undefined {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function describeToolRun(toolId: string, part: AgentToolPart): string | undefined {
  if (toolId === 'ask_application_question' || toolId === 'ask_report_question') {
    return getQuestionDetail(part);
  }

  if (toolId === 'parse_date_expression') {
    const expression = readString(part.input, 'expression');
    if (part.state !== 'output-available' || !isRecord(part.output)) return expression;

    const range = part.output.range;
    const start = readString(range, 'startDate');
    const end = readString(range, 'endDate');
    if (!start || !end) return expression;

    const period = start === end ? start : `${start} ~ ${end}`;
    return expression ? `${expression} → ${period}` : period;
  }

  if (toolId === 'search_application_places') {
    const query = readString(part.input, 'query');
    if (part.state !== 'output-available' || !isRecord(part.output)) {
      return query ? `"${query}" 검색` : undefined;
    }

    const places = Array.isArray(part.output.places) ? part.output.places : [];
    const names = places
      .map((place) => readString(place, 'name'))
      .filter((name): name is string => name !== undefined);

    if (names.length === 0) return query ? `"${query}" 검색 결과 없음` : undefined;

    const shown = names.slice(0, 2).join(', ');
    const suffix = names.length > 2 ? ` 외 ${names.length - 2}곳` : '';
    return `${query ? `"${query}" → ` : ''}${shown}${suffix}`;
  }

  return undefined;
}

function dedupeToolCalls(calls: ToolCall[]): ToolCall[] {
  const seen = new Map<string, number>();

  return calls.filter((call) => {
    const signature = `${call.kind}:${call.name}:${call.target ?? ''}:${call.detail ?? ''}`;
    const previous = seen.get(signature);

    if (previous === undefined) {
      seen.set(signature, 1);
      return true;
    }

    seen.set(signature, previous + 1);
    return false;
  });
}

function getQuestionChoices(part: AgentToolPart): string[] {
  if (part.state !== 'output-available' || !isRecord(part.output)) return [];
  const choices = part.output.choices;
  if (!Array.isArray(choices)) return [];

  return choices.filter((choice): choice is string => typeof choice === 'string' && choice.trim() !== '');
}

function getQuestionFlags(part: AgentToolPart): {
  freeText: boolean;
  placeholder: string | undefined;
} {
  if (part.state !== 'output-available' || !isRecord(part.output)) {
    return { freeText: false, placeholder: undefined };
  }

  return {
    freeText: part.output.freeText === true,
    placeholder: readString(part.output, 'placeholder'),
  };
}

function getPlaceCandidates(part: AgentToolPart): PlaceCandidate[] {
  if (part.state !== 'output-available' || !isRecord(part.output)) return [];
  const candidates = part.output.candidates;
  if (!Array.isArray(candidates)) return [];

  return candidates.flatMap((candidate) => {
    const name = readString(candidate, 'name');
    const address = readString(candidate, 'address');
    return name && address ? [{ name, address }] : [];
  });
}

function getToolCalls(message: UIMessage): ToolCall[] {
  const calls = message.parts.flatMap((part) => {
    if (!isToolPart(part)) return [];

    const toolId = part.type.slice('tool-'.length);
    const definition = TOOL_LABELS[toolId] ?? { kind: 'tool' as const, name: toolId };
    const status =
      part.state === 'output-available'
        ? 'done'
        : part.state === 'output-error'
          ? 'error'
          : 'running';
    const isPatch = toolId === 'update_application_draft' || toolId === 'update_report_draft';
    const isQuestion = toolId === 'ask_application_question' || toolId === 'ask_report_question';
    const isPlaceProposal = toolId === 'propose_place_addresses';
    const fields = isPatch ? getPatchFields(part) : [];
    const stepLabel = isPatch ? getStepNavigation(part) : null;
    const questionFlags = isQuestion
      ? getQuestionFlags(part)
      : { freeText: false, placeholder: undefined };

    const partCalls: ToolCall[] = [
      {
        id: part.toolCallId,
        kind: definition.kind,
        name: definition.name,
        target: definition.target,
        detail:
          part.state === 'output-error' ? part.errorText : describeToolRun(toolId, part),
        status,
        fields: fields.length > 0 ? fields : undefined,
        choices: isQuestion ? getQuestionChoices(part) : undefined,
        freeText: isQuestion ? questionFlags.freeText : undefined,
        placeholder: isQuestion ? questionFlags.placeholder : undefined,
        candidates: isPlaceProposal ? getPlaceCandidates(part) : undefined,
      },
    ];

    if (stepLabel) {
      partCalls.push({
        id: `${part.toolCallId}-step`,
        kind: 'navigate',
        name: '화면 전환',
        target: stepLabel,
        status: 'done',
      });
    }

    return partCalls;
  });

  return dedupeToolCalls(calls);
}

function getText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function getAttachments(message: UIMessage): ChatAttachment[] {
  return message.parts.flatMap((part, index) =>
    part.type === 'file'
      ? [
          {
            id: `${message.id}-file-${index}`,
            name: part.filename ?? '첨부파일',
            mediaType: part.mediaType,
            url: part.url,
          },
        ]
      : []
  );
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
    const attachments = getAttachments(message);
    return {
      id: message.id,
      role: message.role === 'assistant' ? 'agent' : message.role,
      content: getText(message),
      createdAt: 0,
      reasoning: reasoning.length > 0 ? reasoning : undefined,
      thinkingSeconds: undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    };
  });
}

export function toUiMessages(messages: ChatMessage[]): UIMessage[] {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      id: message.id,
      role: message.role === 'agent' ? 'assistant' : message.role,
      parts: [
        ...(message.attachments ?? []).map((attachment) => ({
          type: 'file' as const,
          filename: attachment.name,
          mediaType: attachment.mediaType,
          url: attachment.url,
        })),
        { type: 'text' as const, text: message.content },
      ],
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
    reportStep: draft.reportStep,
    experience: draft.experience,
    reflection: draft.reflection,
    attachmentNote: draft.attachmentNote,
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

export function getReportPatches(messages: UIMessage[]): {
  id: string;
  patch: ReportPatch;
}[] {
  return messages.flatMap((message) =>
    message.parts.flatMap((part) => {
      if (
        !isToolPart(part) ||
        part.type !== 'tool-update_report_draft' ||
        part.state !== 'output-available' ||
        !isRecord(part.output)
      ) {
        return [];
      }

      const parsed = reportPatchSchema.safeParse(part.output.patch);
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
