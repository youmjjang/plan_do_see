import bcrypt from 'bcryptjs';
import {database} from './server-db';
export const SESSION_SECONDS=60*60*12;
export const cookieName='pds_session';
export const privateHeaders={'Cache-Control':'no-store, private','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
export class HttpError extends Error {constructor(public status:number,message:string){super(message)}}
export function reply(value:unknown,status=200,extra:Record<string,string>={}){return Response.json(value,{status,headers:{...privateHeaders,...extra}})}
export function failure(e:unknown){return reply({error:e instanceof HttpError?e.message:'잠시 연결이 어려워요. 입력 내용을 그대로 두고 다시 시도해 주세요.'},e instanceof HttpError?e.status:503)}
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('')}
export function sessionValue(request:Request){return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)||''}
export async function userFor(request:Request){const token=sessionValue(request);if(!/^[a-f0-9]{64}$/.test(token))return null;return await database().prepare('SELECT u.id,u.username,s.expires_at FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),new Date().toISOString()).first<{id:string;username:string;expires_at:string}>()}
export async function requireUser(request:Request){const user=await userFor(request);if(!user)throw new HttpError(401,'로그인이 필요해요. 다시 로그인해 주세요.');return user}
export function sameOrigin(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)throw new HttpError(403,'이 다이어리 화면에서 다시 시도해 주세요.')}
export async function jsonBody(request:Request){sameOrigin(request);const text=await request.text();if(new TextEncoder().encode(text).length>32000)throw new HttpError(413,'입력 내용이 너무 길어요.');try{return JSON.parse(text)}catch{throw new HttpError(400,'입력 내용을 확인해 주세요.')}}
export function validPassword(p:unknown):p is string{return typeof p==='string'&&p.length>=12&&new TextEncoder().encode(p).length<=72}
export const hashPassword=(p:string)=>bcrypt.hash(p,12);
export const verifyPassword=(p:string,h:string)=>bcrypt.compare(p,h);
export function cookie(request:Request,value:string,seconds=SESSION_SECONDS){return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${new URL(request.url).protocol==='https:'?'; Secure':''}`}
export async function newSession(request:Request,userId:string,epoch=0){const value=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');const expires=new Date(Date.now()+SESSION_SECONDS*1000).toISOString();const result=await database().prepare('INSERT INTO auth_sessions (token_hash,user_id,expires_at) SELECT ?,id,? FROM auth_users WHERE id=? AND session_epoch=?').bind(await digest(value),expires,userId,epoch).run();if(!result.meta.changes)throw new HttpError(401,'로그인 상태가 바뀌었어요. 다시 로그인해 주세요.');return cookie(request,value)}
export async function rateLimit(request:Request,username:string){const db=database(),bucket=Math.floor(Date.now()/900000);const keys=['ip:'+await digest(request.headers.get('cf-connecting-ip')||'local'),'name:'+await digest(username)];for(const key of keys){const r=await db.prepare('INSERT INTO auth_attempts (id,count) VALUES (?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(`${bucket}:${key}`).first<{count:number}>();if((r?.count||0)>(key.startsWith('ip:')?80:12))throw new HttpError(429,'시도가 많아요. 15분 뒤 다시 시도해 주세요.')}}
