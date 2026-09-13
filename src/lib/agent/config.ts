import 'server-only';

import { z } from 'zod';

export type AgentProviderKind = 'openai-compatible' | 'openai-responses' | 'anthropic';

const DEFAULT_ZEN_MODELS = [
  {
    id: 'big-pickle',
    model: 'big-pickle',
    label: 'Big Pickle',
    description: '복잡한 신청서 초안과 도구 작업을 안정적으로 처리',
  },
  {
    id: 'mimo-v2.5-free',
    model: 'mimo-v2.5-free',
    label: 'MiMo-V2.5',
    description: '일반적인 문장 작성과 요약을 가볍게 처리',
  },
  {
    id: 'ling-3.0-flash-fin-free',
    model: 'ling-3.0-flash-fin-free',
    label: 'Ling 3.0 Flash Fin',
    description: '짧은 요청에 빠르게 응답하는 경량 모델',
  },
  {
    id: 'nemotron-3-ultra-free',
    model: 'nemotron-3-ultra-free',
    label: 'Nemotron 3 Ultra',
    description: '긴 맥락을 바탕으로 꼼꼼한 초안 작성에 적합',
  },
  {
    id: 'nemotron-3.5-lightning-free',
    model: 'nemotron-3.5-lightning-free',
    label: 'Nemotron 3.5 Lightning',
    description: '속도와 품질을 균형 있게 제공하는 빠른 모델',
  },
  {
    id: 'muse-spark-1.3-contributor-free',
    model: 'muse-spark-1.3-contributor-free',
    label: 'Muse Spark 1.3 Contributor',
    description: '아이디어 정리와 표현 다듬기에 적합',
  },
];

const DEFAULT_ZEN_BASE_URL = 'https://opencode.ai/zen/v1';
const DEFAULT_ZEN_MODEL_ID = 'big-pickle';

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
    AGENT_BASE_URL: process.env.AGENT_BASE_URL || DEFAULT_ZEN_BASE_URL,
    AGENT_DEFAULT_MODEL: process.env.AGENT_DEFAULT_MODEL || DEFAULT_ZEN_MODEL_ID,
    AGENT_MODELS_JSON: process.env.AGENT_MODELS_JSON || JSON.stringify(DEFAULT_ZEN_MODELS),
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
