# Social platform connectors

Social credentials are supplied only for accounts the organization is authorized to operate. The API immediately encrypts the credential object with AES-256-GCM; list APIs never return it. Workers decrypt only immediately before the outbound provider call.

## X

Credential envelope:

```json
{ "accessToken": "..." }
```

The adapter uses the official v2 create-post endpoint and is text-only. Obtain write permissions for the production X developer project. Implement the provider's approved media-upload flow before attaching X media; the connector intentionally rejects media URLs rather than silently dropping them.

## Telegram

```json
{ "botToken": "...", "chatId": "..." }
```

The bot must be permitted to post in the target channel/group. The included adapter uses `sendMessage` and is text-only.

## LinkedIn

```json
{
  "accessToken": "...",
  "authorUrn": "urn:li:organization:123",
  "apiVersion": "YYYYMM"
}
```

The version is explicit so engineering must verify the currently supported LinkedIn version during credential onboarding rather than inheriting a stale hard-coded header. The adapter creates text posts; media requires LinkedIn's asset upload workflow and the corresponding approved product/scopes.

## Facebook Pages

```json
{
  "accessToken": "...",
  "pageId": "...",
  "graphVersion": "vNN.N"
}
```

The adapter publishes text to the Page feed. `graphVersion` is explicit for the same reason as LinkedIn's API version. Use the token lifecycle pattern approved for your Meta app and organization.

## Instagram

```json
{
  "accessToken": "...",
  "igUserId": "...",
  "graphVersion": "vNN.N"
}
```

The included path creates and publishes a **single image** container from a publicly reachable image URL. Reels and carousels require their separate official flows and should be added only after the account/app scopes are approved.

## TikTok

TikTok is present in shared schemas/UI so campaign planning can include it, but publishing throws an explicit unsupported error until the deploying Spheric developer app has the correct Content Posting product, review and account authorization. Implement Direct Post/Upload against the official API after approval; do not substitute browser automation.

## Production OAuth/token lifecycle

`POST /v1/social-accounts` is a secure admin/bootstrap path, not a substitute for polished OAuth onboarding. Before letting non-security operators connect OAuth providers, implement provider-specific connect/callback endpoints with PKCE/state, persist granted scopes/expiry/refresh metadata inside the encrypted envelope, refresh tokens server-side, handle provider revocation webhooks where available, and keep staging/production developer apps separate.

Provider APIs, scopes, review requirements and version windows change. Re-confirm them against each provider's current official documentation at every release that modifies a connector.
