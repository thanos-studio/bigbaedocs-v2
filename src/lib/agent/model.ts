import 'server-only';

import { randomUUID } from 'node:crypto';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

import { AgentConfigurationError, getAgentConfiguration } from './config';

function getRequiredApiKey(apiKey: string | undefined): string {
  if (!apiKey) {
    throw new AgentConfigurationError('The selected agent provider requires AGENT_API_KEY.');
  }
  return apiKey;
}

export function getAgentModel(selectedModelId?: string): LanguageModel {
  const configuration = getAgentConfiguration();
  const model = configuration.models.find(
    (candidate) => candidate.id === (selectedModelId ?? configuration.defaultModelId)
  );
  if (!model) {
    throw new AgentConfigurationError('The selected agent model is not configured for this deployment.');
  }

  switch (configuration.provider) {
    case 'openai-compatible': {
      if (!configuration.baseURL) {
        throw new AgentConfigurationError('AGENT_BASE_URL is required for openai-compatible.');
      }
      const provider = createOpenAICompatible({
        name: 'bigbaedocs-gateway',
        ...(configuration.apiKey ? { apiKey: configuration.apiKey } : {}),
        baseURL: configuration.baseURL,
        headers: { 'x-opencode-session': randomUUID() },
        includeUsage: true,
      });
      return provider(model.model);
    }
    case 'openai-responses': {
      const provider = createOpenAI({
        apiKey: getRequiredApiKey(configuration.apiKey),
        baseURL: configuration.baseURL,
      });
      return provider.responses(model.model);
    }
    case 'anthropic': {
      const provider = createAnthropic({
        apiKey: getRequiredApiKey(configuration.apiKey),
        baseURL: configuration.baseURL,
      });
      return provider(model.model);
    }
  }
}
