import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  toUIMessageStream,
  isFileUIPart,
  type UIMessage,
} from 'ai';

import { AgentConfigurationError } from '@/lib/agent/config';
import { getAgentModel } from '@/lib/agent/model';
import { buildApplicationAgentInstructions } from '@/lib/agent/prompt';
import { agentChatRequestSchema } from '@/lib/agent/schema';
import { createApplicationTools } from '@/lib/agent/tools';

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

  const parsed = agentChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Request body has an invalid agent chat shape.', 400);
  }

  const { draft, model, options, availableStudents } = parsed.data;
  const tools = createApplicationTools(draft, availableStudents ?? [], options?.turbo ?? false);
  const checkedMessages = await safeValidateUIMessages({
    messages: parsed.data.messages,
    tools,
  });
  if (!checkedMessages.success) {
    return jsonError('Messages do not match the AI SDK UI message protocol.', 400);
  }
  if (!hasSupportedAttachments(checkedMessages.data)) {
    return jsonError('Only PNG, JPEG, GIF, WebP, and PDF files up to 5 MB are supported.', 400);
  }

  try {
    const result = streamText({
      model: getAgentModel(model),
      instructions: buildApplicationAgentInstructions(draft, options),
      messages: await convertToModelMessages(checkedMessages.data),
      tools,
      stopWhen: stepCountIs(options?.turbo ? 12 : 5),
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

    console.error('[agent/chat] failed to start:', error);
    return jsonError('Unable to start the agent response.', 500);
  }
}
