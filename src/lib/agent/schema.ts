import { z } from 'zod';

const applicationStepSchema = z.enum(['people', 'place', 'schedule', 'plan', 'review']);
const placeRegionSchema = z.enum(['domestic', 'overseas']);

export const applicationDraftSchema = z
  .object({
    id: z.string().trim().min(1),
    studentIds: z.array(z.string().trim().min(1)).max(50),
    step: applicationStepSchema,
    title: z.string().max(200),
    startDate: z.string().max(32),
    endDate: z.string().max(32),
    learningType: z.string().max(100),
    destination: z.string().max(200),
    placeRegion: placeRegionSchema,
    placeAddress: z.string().max(300),
    purpose: z.string().max(4_000),
    plan: z.string().max(8_000),
    guardianRelation: z.string().max(100),
    guardianPhone: z.string().max(64),
  })
  .strict();

export const applicationPatchSchema = applicationDraftSchema
  .pick({
    step: true,
    title: true,
    startDate: true,
    endDate: true,
    learningType: true,
    destination: true,
    placeRegion: true,
    placeAddress: true,
    purpose: true,
    plan: true,
    guardianRelation: true,
    guardianPhone: true,
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'At least one field must be updated.');

export const agentChatRequestSchema = z
  .object({
    messages: z.array(z.unknown()).min(1).max(40),
    draft: applicationDraftSchema,
    model: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((id) => /^[a-z][a-z0-9.-]{0,63}$/.test(id), 'Invalid model id.')
      .optional(),
  })
  .strict();

export type ApplicationDraftContext = z.infer<typeof applicationDraftSchema>;
export type ApplicationPatch = z.infer<typeof applicationPatchSchema>;
export type AgentChatRequest = z.infer<typeof agentChatRequestSchema>;
