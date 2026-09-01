import type { FastifyReply, FastifyRequest } from 'fastify'; import { verifyAccessToken } from './auth.js';
declare module 'fastify' { interface FastifyRequest { actor?: {userId:string;orgId:string;role:string} } }
export async function authenticate(req:FastifyRequest,reply:FastifyReply){ const h=req.headers.authorization; if(!h?.startsWith('Bearer ')) return reply.code(401).send({error:'unauthorized',message:'Bearer token required'}); try{ req.actor=await verifyAccessToken(h.slice(7)); }catch{return reply.code(401).send({error:'unauthorized',message:'Invalid or expired token'});} }
const rank:Record<string,number>={analyst:1,editor:2,approver:3,admin:4,owner:5};
export function requireRole(min:'analyst'|'editor'|'approver'|'admin'|'owner'){ return async(req:FastifyRequest,reply:FastifyReply)=>{ await authenticate(req,reply); if(reply.sent) return; if((rank[req.actor!.role]??0)<rank[min]) return reply.code(403).send({error:'forbidden',message:`${min} role required`}); }; }
