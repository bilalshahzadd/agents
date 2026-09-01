import crypto from 'node:crypto'; import { env } from './config.js';
function key(){ const k=Buffer.from(env.DATA_ENCRYPTION_KEY,'base64'); if(k.length!==32) throw new Error('DATA_ENCRYPTION_KEY must be base64 for exactly 32 bytes'); return k; }
export function encryptJson(value:unknown){ const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv('aes-256-gcm',key(),iv); const enc=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]); const tag=cipher.getAuthTag(); return Buffer.concat([iv,tag,enc]).toString('base64'); }
export function decryptJson<T=Record<string,unknown>>(value:string):T{ const b=Buffer.from(value,'base64'), iv=b.subarray(0,12), tag=b.subarray(12,28), enc=b.subarray(28); const d=crypto.createDecipheriv('aes-256-gcm',key(),iv); d.setAuthTag(tag); return JSON.parse(Buffer.concat([d.update(enc),d.final()]).toString('utf8')) as T; }
export const hashToken=(t:string)=>crypto.createHash('sha256').update(t).digest('hex');
