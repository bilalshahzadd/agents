import { z } from 'zod';
export const env=z.object({
  NODE_ENV:z.enum(['development','test','production']).default('development'), API_PORT:z.coerce.number().default(4000), WEB_ORIGIN:z.string().default('http://localhost:3000'),
  DATABASE_URL:z.string(), REDIS_URL:z.string(), JWT_SECRET:z.string().min(32), DATA_ENCRYPTION_KEY:z.string().min(20), ACCESS_TOKEN_TTL_SECONDS:z.coerce.number().default(3600), REFRESH_TOKEN_TTL_DAYS:z.coerce.number().default(30)
}).parse(process.env);
