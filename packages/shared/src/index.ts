import { z } from 'zod';

export const platformSchema = z.enum(['x','linkedin','telegram','instagram','facebook','tiktok']);
export type Platform = z.infer<typeof platformSchema>;
export const roleSchema = z.enum(['owner','admin','editor','analyst','approver']);
export type Role = z.infer<typeof roleSchema>;
export const contentStatusSchema = z.enum(['draft','pending_approval','approved','scheduled','publishing','published','failed','rejected']);
export type ContentStatus = z.infer<typeof contentStatusSchema>;

export const campaignCreateSchema = z.object({
  brandId: z.string().uuid(),
  name: z.string().min(2).max(120),
  objective: z.string().min(10).max(4000),
  audience: z.string().min(2).max(2000),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  platforms: z.array(platformSchema).min(1),
  postsPerPlatform: z.number().int().min(1).max(50).default(5),
  requiresApproval: z.boolean().default(true)
}).refine((v) => Date.parse(v.endAt) > Date.parse(v.startAt), { message: 'endAt must be after startAt', path: ['endAt'] });

export const contentCreateSchema = z.object({
  campaignId: z.string().uuid(),
  socialAccountId: z.string().uuid().optional(),
  platform: platformSchema,
  body: z.string().min(1).max(10000),
  mediaUrls: z.array(z.string().url()).default([]),
  scheduledAt: z.string().datetime().optional()
});

export const agentCreateSchema = z.object({
  brandId: z.string().uuid(),
  name: z.string().min(2).max(100),
  kind: z.enum(['research','strategy','copywriter','community','analytics','compliance','scheduler']),
  instructions: z.string().min(10).max(12000),
  model: z.string().default('gpt-5.6-terra'),
  enabled: z.boolean().default(true)
});

export const socialAccountCreateSchema = z.object({
  brandId: z.string().uuid(),
  platform: platformSchema,
  handle: z.string().min(1).max(200),
  externalAccountId: z.string().min(1).max(300),
  credentials: z.record(z.string(), z.unknown()),
  postingEnabled: z.boolean().default(false)
});

export type ApiError = { error: string; message: string };
export const queueNames = { agent: 'agent-jobs', publish: 'publish-jobs', analytics: 'analytics-jobs' } as const;
