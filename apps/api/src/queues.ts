import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { queueNames } from '@spheric/shared';
import { env } from './config.js';

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const agentQueue = new Queue(queueNames.agent, { connection });
export const publishQueue = new Queue(queueNames.publish, { connection });
export const analyticsQueue = new Queue(queueNames.analytics, { connection });

export async function syncPublishJob(contentItemId: string, scheduledAt?: string | Date | null) {
  const jobId = `content-${contentItemId}`;
  const existing = await publishQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state !== 'active') await existing.remove();
    else return existing;
  }
  if (!scheduledAt) return null;
  const when = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  return publishQueue.add(
    'publish-content',
    { contentItemId },
    {
      delay: Math.max(0, when.getTime() - Date.now()),
      jobId,
      removeOnComplete: true,
      removeOnFail: 5000,
    },
  );
}

export async function closeQueues() {
  await Promise.allSettled([agentQueue.close(), publishQueue.close(), analyticsQueue.close()]);
  await connection.quit();
}
