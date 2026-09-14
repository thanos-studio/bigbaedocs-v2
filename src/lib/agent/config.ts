import 'server-only';

import { z } from 'zod';

export type AgentProviderKind = 'openai-compatible' | 'openai-responses' | 'anthropic';

const DEFAULT_MODELS = [
  {
    id: 'gemini-3.8-flash-medium',
    model: 'google-antigravity/gemini-3.8-flash-medium',
    label: 'Gemini 3.8 Flash',
    description: '속도와 품질의 균형',
  },
  {
    id: 'gemini-3.8-flash-high',
    model: 'google-antigravity/gemini-3.8-flash-high',
    label: 'Gemini 3.8 Flash High',
    description: '꼼꼼한 초안 작성에 적합',
  },
  {
    id: 'gemini-3.8-flash-low',
    model: 'google-antigravity/gemini-3.8-flash-low',
    label: 'Gemini 3.8 Flash Low',
    description: '짧은 요청에 빠르게 응답',
  },
];

const DEFAULT_BASE_URL = 'http://localhost:10100/v1';
const DEFAULT_MODEL_ID = 'gemini-3.8-flash-medium';

const environmentSchema = z.object({
  AGENT_PROVIDER: z.enum(['openai-compatible', 'openai-responses', 'anthropic']),
  AGENT_API_KEY: z.string().trim().min(1).optional(),
  AGENT_BASE_URL: z.url().optional(),
  AGENT_DEFAULT_MODEL: z.string().trim().min(1),
  AGENT_MODELS_JSON: z.string().trim().min(1),
});

const modelDefinitionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((id) => /^[a-z][a-z0-9.-]{0,63}$/.test(id), 'Invalid model id.'),
    model: z.string().trim().min(1).max(200),
    label: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(200),
  })
  .strict();

const modelDefinitionsSchema = z
  .array(modelDefinitionSchema)
  .min(1)
  .max(20)
  .refine(
    (models) => new Set(models.map((model) => model.id)).size === models.length,
    'Each model id must be unique.'
  );

export type AgentModelConfiguration = z.infer<typeof modelDefinitionSchema>;
export type PublicAgentModel = Pick<AgentModelConfiguration, 'id' | 'label' | 'description'>;

export type AgentConfiguration = {
  provider: AgentProviderKind;
  apiKey?: string;
  baseURL?: string;
  defaultModelId: string;
  models: AgentModelConfiguration[];
};

export class AgentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentConfigurationError';
  }
}

export function getAgentConfiguration(): AgentConfiguration {
  const parsed = environmentSchema.safeParse({
    AGENT_PROVIDER: process.env.AGENT_PROVIDER || 'openai-compatible',
    AGENT_API_KEY: process.env.AGENT_API_KEY || undefined,
    AGENT_BASE_URL: process.env.AGENT_BASE_URL || DEFAULT_BASE_URL,
    AGENT_DEFAULT_MODEL: process.env.AGENT_DEFAULT_MODEL || DEFAULT_MODEL_ID,
    AGENT_MODELS_JSON: process.env.AGENT_MODELS_JSON || JSON.stringify(DEFAULT_MODELS),
  });

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new AgentConfigurationError(`Missing or invalid agent configuration: ${fields}`);
  }

  const environment = parsed.data;
  if (environment.AGENT_PROVIDER === 'openai-compatible' && !environment.AGENT_BASE_URL) {
    throw new AgentConfigurationError(
      'AGENT_BASE_URL is required when AGENT_PROVIDER is openai-compatible.'
    );
  }
  if (environment.AGENT_PROVIDER !== 'openai-compatible' && !environment.AGENT_API_KEY) {
    throw new AgentConfigurationError(
      'AGENT_API_KEY is required when AGENT_PROVIDER is openai-responses or anthropic.'
    );
  }

  let modelsJson: unknown;
  try {
    modelsJson = JSON.parse(environment.AGENT_MODELS_JSON);
  } catch {
    throw new AgentConfigurationError('AGENT_MODELS_JSON must be valid JSON.');
  }

  const models = modelDefinitionsSchema.safeParse(modelsJson);
  if (!models.success) {
    throw new AgentConfigurationError('AGENT_MODELS_JSON has an invalid model definition.');
  }
  if (!models.data.some((model) => model.id === environment.AGENT_DEFAULT_MODEL)) {
    throw new AgentConfigurationError('AGENT_DEFAULT_MODEL must match an id in AGENT_MODELS_JSON.');
  }

  return {
    provider: environment.AGENT_PROVIDER,
    apiKey: environment.AGENT_API_KEY,
    baseURL: environment.AGENT_BASE_URL,
    defaultModelId: environment.AGENT_DEFAULT_MODEL,
    models: models.data,
  };
}

export function getPublicAgentModels(): PublicAgentModel[] {
  return getAgentConfiguration().models.map(({ id, label, description }) => ({
    id,
    label,
    description,
  }));
}

export function getDefaultAgentModelId(): string {
  return getAgentConfiguration().defaultModelId;
}
