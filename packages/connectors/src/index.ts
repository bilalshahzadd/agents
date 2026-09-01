import type { Platform } from '@spheric/shared';

export type PublishInput = { body: string; mediaUrls?: string[]; replyToId?: string };
export type PublishResult = { id: string; url?: string; raw?: unknown };
export type Metrics = {
  impressions: number;
  engagements: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  followers?: number;
  raw?: unknown;
};
export interface SocialConnector {
  publish(input: PublishInput): Promise<PublishResult>;
  metrics?(postId: string): Promise<Metrics>;
}

type Creds = Record<string, unknown>;
type FetchResult = { data: any; headers: Headers };

async function jsonFetch(url: string, init: RequestInit): Promise<FetchResult> {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { text };
  }
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    throw new Error(`platform API ${response.status}${retryAfter ? ` retry-after=${retryAfter}` : ''}: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return { data, headers: response.headers };
}

class XConnector implements SocialConnector {
  constructor(private credentials: Creds) {}
  async publish(input: PublishInput) {
    const accessToken = String(this.credentials.accessToken ?? '');
    if (!accessToken) throw new Error('X accessToken missing');
    if (input.mediaUrls?.length) throw new Error('X media upload is not enabled in this adapter; upload media through the approved X media API flow first');
    const body: any = { text: input.body };
    if (input.replyToId) body.reply = { in_reply_to_tweet_id: input.replyToId };
    const { data } = await jsonFetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const id = String(data.data?.id ?? '');
    if (!id) throw new Error('X publish succeeded without a post id');
    return { id, url: `https://x.com/i/web/status/${id}`, raw: data };
  }
}

class TelegramConnector implements SocialConnector {
  constructor(private credentials: Creds) {}
  async publish(input: PublishInput) {
    const botToken = String(this.credentials.botToken ?? '');
    const chatId = String(this.credentials.chatId ?? '');
    if (!botToken || !chatId) throw new Error('Telegram botToken/chatId missing');
    if (input.mediaUrls?.length) throw new Error('Telegram media publishing is not enabled in this adapter; use a media-specific connector extension');
    const { data } = await jsonFetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: input.body, disable_web_page_preview: false }),
    });
    const id = String(data.result?.message_id ?? '');
    if (!id) throw new Error('Telegram publish succeeded without a message id');
    return { id, raw: data };
  }
}

class LinkedInConnector implements SocialConnector {
  constructor(private credentials: Creds) {}
  async publish(input: PublishInput) {
    const accessToken = String(this.credentials.accessToken ?? '');
    const authorUrn = String(this.credentials.authorUrn ?? '');
    const apiVersion = String(this.credentials.apiVersion ?? '');
    if (!accessToken || !authorUrn || !apiVersion) throw new Error('LinkedIn accessToken/authorUrn/apiVersion missing');
    if (input.mediaUrls?.length) throw new Error('LinkedIn media publishing requires the asset upload flow and is not enabled in this text adapter');
    const { data, headers } = await jsonFetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': apiVersion,
        'X-Restli-Protocol-Version': '2.0.0',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        author: authorUrn,
        commentary: input.body,
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    });
    const id = String(headers.get('x-restli-id') ?? data.id ?? data.urn ?? '');
    if (!id) throw new Error('LinkedIn publish succeeded without a post id');
    return { id, raw: data };
  }
}

class MetaConnector implements SocialConnector {
  constructor(private credentials: Creds, private kind: 'instagram' | 'facebook') {}
  async publish(input: PublishInput) {
    const accessToken = String(this.credentials.accessToken ?? '');
    const graphVersion = String(this.credentials.graphVersion ?? '');
    if (!accessToken || !graphVersion) throw new Error('Meta accessToken/graphVersion missing');

    if (this.kind === 'facebook') {
      const pageId = String(this.credentials.pageId ?? '');
      if (!pageId) throw new Error('Facebook pageId missing');
      if (input.mediaUrls?.length) throw new Error('Facebook media publishing is not enabled in this text adapter');
      const params = new URLSearchParams({ message: input.body, access_token: accessToken });
      const { data } = await jsonFetch(`https://graph.facebook.com/${graphVersion}/${pageId}/feed`, { method: 'POST', body: params });
      const id = String(data.id ?? '');
      if (!id) throw new Error('Facebook publish succeeded without a post id');
      return { id, raw: data };
    }

    const igUserId = String(this.credentials.igUserId ?? '');
    if (!igUserId) throw new Error('Instagram igUserId missing');
    if (!input.mediaUrls?.[0]) throw new Error('Instagram publishing requires a publicly reachable image URL');
    if (input.mediaUrls.length > 1) throw new Error('Instagram carousel publishing is not enabled in this adapter');
    const createParams = new URLSearchParams({ image_url: input.mediaUrls[0], caption: input.body, access_token: accessToken });
    const created = await jsonFetch(`https://graph.facebook.com/${graphVersion}/${igUserId}/media`, { method: 'POST', body: createParams });
    const publishParams = new URLSearchParams({ creation_id: String(created.data.id), access_token: accessToken });
    const published = await jsonFetch(`https://graph.facebook.com/${graphVersion}/${igUserId}/media_publish`, { method: 'POST', body: publishParams });
    const id = String(published.data.id ?? '');
    if (!id) throw new Error('Instagram publish succeeded without a media id');
    return { id, raw: published.data };
  }
}

class UnsupportedConnector implements SocialConnector {
  constructor(private platform: string) {}
  async publish(): Promise<PublishResult> {
    throw new Error(`${this.platform} connector requires platform app approval/API implementation for this account type`);
  }
}

export function connectorFor(platform: Platform, credentials: Creds): SocialConnector {
  if (platform === 'x') return new XConnector(credentials);
  if (platform === 'telegram') return new TelegramConnector(credentials);
  if (platform === 'linkedin') return new LinkedInConnector(credentials);
  if (platform === 'facebook' || platform === 'instagram') return new MetaConnector(credentials, platform);
  return new UnsupportedConnector(platform);
}
