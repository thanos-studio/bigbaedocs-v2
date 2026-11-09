import { z } from 'zod';

import { HALF_DAY_LIMITS, PERSONAL_DATES } from '@/lib/half-day';

const applicationStepSchema = z.enum([
  'people',
  'place',
  'schedule',
  'plan',
  'review',
  'document',
]);
const reportStepSchema = z.enum(['confirm', 'experience', 'reflection', 'review', 'document']);
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
    reportStep: reportStepSchema.optional(),
    experience: z.string().max(8_000).optional(),
    reflection: z.string().max(8_000).optional(),
    attachmentNote: z.string().max(1_000).optional(),
  })
  .strict();

export const availableStudentSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1).max(50),
    classInfo: z.string().trim().max(100),
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
  })
  .extend({ studentIds: z.array(z.string().trim().min(1)).max(50) })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'At least one field must be updated.');

export const reportPatchSchema = z
  .object({
    reportStep: reportStepSchema,
    experience: z.string().max(8_000),
    reflection: z.string().max(8_000),
    attachmentNote: z.string().max(1_000),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'At least one field must be updated.');

export const writingOptionsSchema = z
  .object({
    formalTone: z.boolean(),
    autoFill: z.boolean(),
    longer: z.boolean(),
    turbo: z.boolean(),
  })
  .strict();

export const agentChatRequestSchema = z
  .object({
    messages: z.array(z.unknown()).min(1).max(40),
    draft: applicationDraftSchema,
    options: writingOptionsSchema.optional(),
    availableStudents: z.array(availableStudentSchema).max(50).optional(),
    model: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((id) => /^[a-z][a-z0-9.-]{0,63}$/.test(id), 'Invalid model id.')
      .optional(),
  })
  .strict();

export const placeSearchRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(200),
    region: z.enum(['domestic', 'overseas']),
    source: z.enum(['osm', 'agent']),
    model: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((id) => /^[a-z][a-z0-9.-]{0,63}$/.test(id), 'Invalid model id.')
      .optional(),
  })
  .strict();

export const placeCandidateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(300),
});

export const placeCandidateListSchema = z.object({
  candidates: z.array(placeCandidateSchema).max(5),
});

export const polishRequestSchema = z
  .object({
    target: z.enum(['purpose', 'plan', 'experience', 'reflection']),
    text: z.string().trim().min(1).max(4_000),
    destination: z.string().trim().max(200).optional(),
    purpose: z.string().trim().max(4_000).optional(),
    formalTone: z.boolean().optional(),
    model: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((id) => /^[a-z][a-z0-9.-]{0,63}$/.test(id), 'Invalid model id.')
      .optional(),
  })
  .strict();

export const parseDateRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(200),
    today: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'today must be an ISO date (YYYY-MM-DD).')
      .optional(),
    model: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((id) => /^[a-z][a-z0-9.-]{0,63}$/.test(id), 'Invalid model id.')
      .optional(),
  })
  .strict();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const parsedDateRangeSchema = z.object({
  startDate: isoDate.describe('체험학습 시작일 (YYYY-MM-DD)'),
  endDate: isoDate.describe('체험학습 종료일 (YYYY-MM-DD). 하루면 시작일과 같게.'),
});

export type ParseDateRequest = z.infer<typeof parseDateRequestSchema>;
export type ParsedDateRange = z.infer<typeof parsedDateRangeSchema>;

export const generateRequestSchema = z
  .object({
    draft: applicationDraftSchema,
    student: z
      .object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1).max(50),
        classInfo: z.string().trim().max(100),
      })
      .strict(),
    guardian: z
      .object({
        name: z.string().trim().max(50),
        relation: z.string().trim().max(20),
        phone: z.string().trim().max(30),
      })
      .strict()
      .optional(),
  })
  .strict();

export const attachmentPhotoSchema = z
  .object({
    dataUrl: z
      .string()
      .max(9_000_000)
      .refine(
        (value) => /^data:image\/(png|jpeg|jpg|gif|bmp|webp);base64,[A-Za-z0-9+/=]+$/.test(value),
        'photo must be a base64 image data URL.'
      ),
    naturalWidth: z.number().int().positive().max(20_000),
    naturalHeight: z.number().int().positive().max(20_000),
  })
  .strict();

export const reportGenerateRequestSchema = z
  .object({
    draft: applicationDraftSchema,
    student: z
      .object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1).max(50),
        classInfo: z.string().trim().max(100),
      })
      .strict(),
    photo: attachmentPhotoSchema.optional(),
  })
  .strict();

export const reportChatRequestSchema = z
  .object({
    messages: z.array(z.unknown()).min(1).max(40),
    draft: applicationDraftSchema,
    options: writingOptionsSchema.optional(),
    model: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((id) => /^[a-z][a-z0-9.-]{0,63}$/.test(id), 'Invalid model id.')
      .optional(),
  })
  .strict();

// ---------- 반일 교외체험학습 ----------

const halfDayStepSchema = z.enum(['people', 'plan', 'review', 'reports']);
/** 에이전트가 쓸 수 있는 날짜는 학생이 직접 신청하는 날뿐이다. 학교가 정한 날은 고를 수 없다. */
const personalDateSchema = z.enum([...PERSONAL_DATES] as [string, ...string[]]);

export const halfDayPlanPatchSchema = z.object({
  entries: z
    .array(
      z.object({
        date: personalDateSchema.describe('YYYY-MM-DD. 학생이 직접 신청하는 날짜만 가능하다.'),
        applied: z.boolean().optional().describe('이 날 반일 체험학습을 신청하는지. 내용을 쓰면 true 로 본다.'),
        purpose: z.string().trim().max(HALF_DAY_LIMITS.purpose).optional().describe(`체험 목적. ${HALF_DAY_LIMITS.purpose}자 이내 명사구.`),
        place: z.string().trim().max(HALF_DAY_LIMITS.place).optional().describe(`체험 장소. ${HALF_DAY_LIMITS.place}자 이내.`),
        content: z.string().trim().max(HALF_DAY_LIMITS.content).optional().describe(`체험 내용. ${HALF_DAY_LIMITS.content}자 이내 한 문장.`),
      })
    )
    .min(1)
    .max(PERSONAL_DATES.length),
  step: halfDayStepSchema.optional(),
});

export const halfDayReportPatchSchema = z.object({
  reports: z
    .array(
      z.object({
        date: personalDateSchema,
        place: z.string().trim().max(HALF_DAY_LIMITS.reportPlace).optional(),
        purpose: z.string().trim().max(HALF_DAY_LIMITS.reportPurpose).optional(),
        content: z.string().trim().max(HALF_DAY_LIMITS.reportContent).optional().describe('체험내용. 다녀온 뒤의 과거형.'),
        feeling: z.string().trim().max(HALF_DAY_LIMITS.reportFeeling).optional().describe('느낀 점.'),
        attachmentNote: z.string().trim().max(HALF_DAY_LIMITS.reportAttachment).optional(),
      })
    )
    .min(1)
    .max(PERSONAL_DATES.length),
  step: halfDayStepSchema.optional(),
});

const halfDayEntrySchema = z.object({
  applied: z.boolean(),
  purpose: z.string().max(200),
  place: z.string().max(200),
  content: z.string().max(400),
});

const halfDayReportSchema = z.object({
  place: z.string().max(400).optional(),
  purpose: z.string().max(400).optional(),
  content: z.string().max(4_000),
  feeling: z.string().max(4_000),
  attachmentNote: z.string().max(1_000),
});

export const halfDayDraftSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().max(200),
    studentIds: z.array(z.string().trim().min(1)).max(50),
    halfDay: z
      .object({
        step: halfDayStepSchema,
        entries: z.record(z.string().max(10), halfDayEntrySchema),
        reports: z.record(z.string().max(10), halfDayReportSchema),
        safetyAcknowledged: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const halfDayChatRequestSchema = z
  .object({
    messages: z.array(z.unknown()).min(1).max(40),
    draft: halfDayDraftSchema,
    options: writingOptionsSchema.optional(),
    availableStudents: z.array(availableStudentSchema).max(50).optional(),
    model: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((id) => /^[a-z][a-z0-9.-]{0,63}$/.test(id), 'Invalid model id.')
      .optional(),
  })
  .strict();

const polishModelSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((id) => /^[a-z][a-z0-9.-]{0,63}$/.test(id), 'Invalid model id.')
  .optional();

/** 대충 적은 칸을 양식에 맞게 다듬어 달라는 요청. plan 은 표의 세 칸, report 는 체험내용과 느낀 점. */
export const halfDayPolishRequestSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('plan'),
      purpose: z.string().max(400),
      place: z.string().max(400),
      content: z.string().max(800),
      model: polishModelSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('report'),
      content: z.string().max(4_000),
      feeling: z.string().max(4_000),
      place: z.string().max(400).optional(),
      purpose: z.string().max(400).optional(),
      model: polishModelSchema,
    })
    .strict(),
]);

export type HalfDayPolishRequest = z.infer<typeof halfDayPolishRequestSchema>;
export type HalfDayDraftContext = z.infer<typeof halfDayDraftSchema>;
export type HalfDayPlanPatch = z.infer<typeof halfDayPlanPatchSchema>;
export type HalfDayReportPatch = z.infer<typeof halfDayReportPatchSchema>;

export const reportPolishRequestSchema = z
  .object({
    target: z.enum(['experience', 'reflection']),
    text: z.string().trim().min(1).max(4_000),
    destination: z.string().trim().max(200).optional(),
    formalTone: z.boolean().optional(),
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
export type WritingOptions = z.infer<typeof writingOptionsSchema>;
export type AvailableStudent = z.infer<typeof availableStudentSchema>;
export type PlaceSearchRequest = z.infer<typeof placeSearchRequestSchema>;
export type ReportPatch = z.infer<typeof reportPatchSchema>;
export type AttachmentPhoto = z.infer<typeof attachmentPhotoSchema>;
export type ReportGenerateRequest = z.infer<typeof reportGenerateRequestSchema>;
export type ReportChatRequest = z.infer<typeof reportChatRequestSchema>;
export type ReportPolishRequest = z.infer<typeof reportPolishRequestSchema>;
