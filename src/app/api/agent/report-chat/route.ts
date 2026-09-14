import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  toUIMessageStream,
} from 'ai';

import { AgentConfigurationError } from '@/lib/agent/config';
import { getAgentModel } from '@/lib/agent/model';
import { buildReportAgentInstructions } from '@/lib/agent/prompt';
import { reportChatRequestSchema } from '@/lib/agent/schema';
import { createReportTools } from '@/lib/agent/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  const parsed = reportChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Request body has an invalid report chat shape.', 400);
  }

  const { draft, model, options } = parsed.data;
  const tools = createReportTools(draft);
  const checkedMessages = await safeValidateUIMessages({
    messages: parsed.data.messages,
    tools,
  });
  if (!checkedMessages.success) {
    return jsonError('Messages do not match the AI SDK UI message protocol.', 400);
  }

  try {
    const result = streamText({
      model: getAgentModel(model),
      instructions: buildReportAgentInstructions(draft, options),
      messages: await convertToModelMessages(checkedMessages.data),
      tools,
      stopWhen: stepCountIs(options?.turbo ? 8 : 5),
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

    console.error('[agent/report-chat] failed to start:', error);
    return jsonError('Unable to start the agent response.', 500);
  }
}
