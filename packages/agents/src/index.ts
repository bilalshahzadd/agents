import OpenAI from 'openai';
import { z } from 'zod';
import type { Platform } from '@spheric/shared';

function openai() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for agent jobs');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export const operatingPolicy = `You operate only authorized brand-owned social accounts. Never create fake identities, impersonate people, coordinate artificial engagement, fabricate endorsements, mass-spam replies/DMs, or misrepresent facts. Do not invent partnerships, metrics, security claims, prices, financial performance, or legal conclusions. Material financial/security/partnership claims must be routed to human approval. Optimize for useful, truthful content and legitimate community support.`;

export function localPolicyCheck(text: string) {
  const banned = [/guaranteed returns?/i, /risk[- ]?free profit/i, /impersonat(e|ing)/i, /buy followers?/i, /fake engagement/i, /mass dm/i];
  const hits = banned.filter((rule) => rule.test(text)).map((rule) => rule.source);
  return { ok: hits.length === 0, hits };
}

const planSchema = z.object({
  items: z.array(z.object({
    platform: z.enum(['x', 'linkedin', 'telegram', 'instagram', 'facebook', 'tiktok']),
    body: z.string().min(1).max(10000),
    rationale: z.string().optional(),
  })).max(250),
});

export async function generateCampaignContent(input: {
  brandName: string;
  voice: string;
  objective: string;
  audience: string;
  platforms: Platform[];
  postsPerPlatform: number;
  knowledge: unknown;
  guidance?: string;
  model?: string;
}) {
  const total = input.platforms.length * input.postsPerPlatform;
  const prompt = `${operatingPolicy}\nBrand: ${input.brandName}\nVoice: ${input.voice}\nObjective: ${input.objective}\nAudience: ${input.audience}\nPlatforms: ${input.platforms.join(', ')}\nAgent guidance: ${input.guidance ?? 'Use sound editorial judgment.'}\nCreate exactly ${total} platform-native posts (${input.postsPerPlatform} per platform). Knowledge base: ${JSON.stringify(input.knowledge).slice(0, 12000)}\nReturn JSON only: {"items":[{"platform":"x","body":"...","rationale":"..."}]}`;
  const response = await openai().responses.create({
    model: input.model ?? process.env.OPENAI_MODEL ?? 'gpt-5.6-terra',
    input: prompt,
    store: false,
  });
  const raw = response.output_text.trim().replace(/^```json\s*/, '').replace(/```$/, '');
  const parsed = planSchema.parse(JSON.parse(raw));
  const filtered = parsed.items.filter((item) => input.platforms.includes(item.platform));
  for (const platform of input.platforms) {
    const count = filtered.filter((item) => item.platform === platform).length;
    if (count !== input.postsPerPlatform) throw new Error(`Agent returned ${count} ${platform} posts; expected ${input.postsPerPlatform}`);
  }
  return filtered;
}

export async function complianceReview(input: { body: string; brandName: string; guidance?: string; model?: string }) {
  const local = localPolicyCheck(input.body);
  if (!local.ok) return { allowed: false, risk: 'high' as const, reasons: local.hits };
  const prompt = `${operatingPolicy}\nAdditional compliance guidance: ${input.guidance ?? 'Apply conservative brand-safety judgment.'}\nReview this proposed ${input.brandName} social post. Return JSON only with {"allowed":boolean,"risk":"low"|"medium"|"high","reasons":string[]}\nPOST:\n${input.body}`;
  const response = await openai().responses.create({
    model: input.model ?? process.env.OPENAI_MODEL ?? 'gpt-5.6-terra',
    input: prompt,
    store: false,
  });
  const raw = response.output_text.trim().replace(/^```json\s*/, '').replace(/```$/, '');
  return z.object({
    allowed: z.boolean(),
    risk: z.enum(['low', 'medium', 'high']),
    reasons: z.array(z.string()),
  }).parse(JSON.parse(raw));
}

export async function researchBrief(input: { brandName: string; query: string; knowledge?: unknown; guidance?: string; model?: string }) {
  const prompt = `${operatingPolicy}\nResearch-agent guidance: ${input.guidance ?? 'Prioritize primary sources and distinguish facts from interpretation.'}\nResearch a concise, source-aware briefing for ${input.brandName}. Focus only on material developments relevant to this query: ${input.query}. Existing brand knowledge: ${JSON.stringify(input.knowledge ?? {}).slice(0, 8000)}. Separate verified developments from interpretation. Do not recommend coordinated engagement or deceptive tactics.`;
  const response = await openai().responses.create({
    model: input.model ?? process.env.OPENAI_MODEL ?? 'gpt-5.6-terra',
    tools: [{ type: 'web_search' }],
    input: prompt,
    store: false,
  });
  return {
    title: `Research: ${input.query}`.slice(0, 180),
    summary: response.output_text,
    raw: { responseId: response.id },
  };
}
