import {
  AgentConfigurationError,
  getDefaultAgentModelId,
  getPublicAgentModels,
} from '@/lib/agent/config';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  try {
    return Response.json({
      defaultModelId: getDefaultAgentModelId(),
      models: getPublicAgentModels(),
    });
  } catch (error) {
    if (error instanceof AgentConfigurationError) {
      return Response.json({ error: error.message }, { status: 503 });
    }

    console.error('[agent/models] failed to load configuration:', error);
    return Response.json({ error: 'Unable to load agent model configuration.' }, { status: 500 });
  }
}
