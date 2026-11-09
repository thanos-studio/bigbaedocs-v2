import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isFileUIPart,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';

import { extractPdfAttachments } from '@/lib/agent/attachments';
import { AgentConfigurationError } from '@/lib/agent/config';
import { validateChatHistory } from '@/lib/agent/history';
import { getAgentModel } from '@/lib/agent/model';
import { buildHalfDayAgentInstructions } from '@/lib/agent/prompt';
import { halfDayChatRequestSchema } from '@/lib/agent/schema';
import { createHalfDayTools } from '@/lib/agent/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const SUPPORTED_ATTACHMENT_TYPES = new Set(['application/pdf', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);

function hasSupportedAttachments(messages: UIMessage[]): boolean {
  return messages.every((message) =>
    message.parts.every((part) => {
      if (!isFileUIPart(part)) return true;
      if (!SUPPORTED_ATTACHMENT_TYPES.has(part.mediaType)) return false;
      return !part.url.startsWith('data:') || part.url.length <= MAX_ATTACHMENT_BYTES * 1.4;
    })
  );
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  const parsed = halfDayChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Request body has an invalid half-day chat shape.', 400);
  }

  const { draft, model, options, availableStudents } = parsed.data;
  const pdfAttachments = extractPdfAttachments(parsed.data.messages);
  const tools = createHalfDayTools(draft, availableStudents ?? [], pdfAttachments);

  const checkedMessages = await validateChatHistory(parsed.data.messages, tools);
  if (!checkedMessages.success) {
    return jsonError('Messages do not match the AI SDK UI message protocol.', 400);
  }
  if (!hasSupportedAttachments(checkedMessages.data)) {
    return jsonError('Only PNG, JPEG, GIF, WebP, and PDF files up to 5 MB are supported.', 400);
  }

  try {
    const result = streamText({
      model: getAgentModel(model),
      instructions: buildHalfDayAgentInstructions(
        draft,
        options,
        pdfAttachments.map((file) => file.name)
      ),
      messages: await convertToModelMessages(checkedMessages.data),
      tools,
      stopWhen: stepCountIs(options?.turbo ? 10 : 6),
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        tools,
        originalMessages: checkedMessages.data,
      }),
    });
  } catch (error) {
    if (error instanceof AgentConfigurationError) {
      return jsonError(error.message, 503);
    }

    console.error('[agent/half-day-chat] failed to start:', error);
    return jsonError('Unable to start the agent response.', 500);
  }
}
