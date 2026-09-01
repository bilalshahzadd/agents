import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { closeDb } from '@spheric/db';
import { env } from './config.js';
import { routes } from './routes.js';
import { closeQueues } from './queues.js';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  trustProxy: true,
  bodyLimit: 2_000_000,
});

await app.register(helmet, { global: true });
await app.register(cors, { origin: env.WEB_ORIGIN.split(',').map((x) => x.trim()), credentials: true });
await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

app.setErrorHandler((err, req, reply) => {
  if (err instanceof ZodError) {
    return reply.code(400).send({
      error: 'validation_error',
      message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    });
  }
  req.log.error(err);
  return reply.code(500).send({ error: 'internal_error', message: 'Request failed' });
});

await app.register(routes);
await app.listen({ host: '0.0.0.0', port: env.API_PORT });

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  app.log.info({ signal }, 'graceful shutdown started');
  await app.close();
  await closeQueues();
  await closeDb();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
