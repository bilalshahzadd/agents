import { SignJWT, jwtVerify } from 'jose';
import crypto from 'node:crypto';
import { env } from './config.js';
import { hashToken } from './crypto.js';
import { query } from '@spheric/db';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export async function signAccessToken(userId: string, orgId: string, role: string) {
  return new SignJWT({ orgId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return { userId: String(payload.sub), orgId: String(payload.orgId), role: String(payload.role) };
}

export async function issueRefreshToken(userId: string) {
  const raw = crypto.randomBytes(48).toString('base64url');
  const hash = hashToken(raw);
  await query(
    "INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+($3||' days')::interval)",
    [userId, hash, env.REFRESH_TOKEN_TTL_DAYS],
  );
  return raw;
}

export async function rotateRefreshToken(raw: string) {
  const hash = hashToken(raw);
  const result = await query<{ id: string; user_id: string }>(
    'UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now() RETURNING id,user_id',
    [hash],
  );
  if (!result.rowCount) return null;
  const refreshToken = await issueRefreshToken(result.rows[0]!.user_id);
  return { userId: result.rows[0]!.user_id, refreshToken };
}

export async function revokeRefreshToken(raw: string) {
  await query('UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,now()) WHERE token_hash=$1', [hashToken(raw)]);
}
