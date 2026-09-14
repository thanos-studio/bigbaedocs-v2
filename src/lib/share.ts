import { z } from 'zod';

/**
 * 공유 링크에 담기는 내용.
 * 학생 이름·학년·반·번호와 보호자 이름은 스키마에 자리가 없다.
 * 여행 계획만 공유하고 사람 정보는 받는 사람이 직접 채운다.
 * studentCount는 받는 쪽에 입력칸을 몇 개 보여줄지 정하는 값이다.
 */
export const sharePayloadSchema = z
  .object({
    version: z.literal(2),
    title: z.string().trim().max(200),
    startDate: z.string().trim().max(32),
    endDate: z.string().trim().max(32),
    learningType: z.string().trim().max(100),
    destination: z.string().trim().max(200),
    placeRegion: z.enum(['domestic', 'overseas']),
    placeAddress: z.string().trim().max(300),
    purpose: z.string().max(4_000),
    plan: z.string().max(8_000),
    studentCount: z.number().int().min(1).max(30),
  })
  .strict();

export type SharePayload = z.infer<typeof sharePayloadSchema>;

export const shareCreateRequestSchema = z
  .object({ payload: sharePayloadSchema })
  .strict();

export const shareCreateResponseSchema = z
  .object({ id: z.string().trim().min(8).max(12), key: z.string().trim().min(1).max(64) })
  .strict();

export const shareReadResponseSchema = z
  .object({ payload: sharePayloadSchema })
  .strict();
