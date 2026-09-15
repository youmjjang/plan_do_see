import {database} from '../../../lib/server-db';
import {HttpError,reply,failure,jsonBody,userFor,requireUser,validPassword,hashPassword,verifyPassword,newSession,cookie,rateLimit} from '../../../lib/auth';
export async function GET(request:Request){try{return reply({user:await userFor(request)})}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const b=await jsonBody(request),db=database();
 if(b.action==='signup'||b.action==='login'){
 const name=typeof b.username==='string'?b.username.trim().toLowerCase():'';
 if(!/^[a-z0-9_]{4,32}$/.test(name)||!validPassword(b.password))throw new HttpError(400,'아이디는 영문 소문자·숫자·밑줄 4~32자, 비밀번호는 12자 이상·72바이트 이하로 입력해 주세요.');
 await rateLimit(request,name);
 if(b.action==='signup'){
 const hash=await hashPassword(b.password),id=crypto.randomUUID();
 const result=await db.prepare('INSERT OR IGNORE INTO auth_users (id,username,password_hash,created_at) VALUES (?,?,?,?)').bind(id,name,hash,new Date().toISOString()).run();
 if(!result.meta.changes)throw new HttpError(409,'이 아이디로 가입할 수 없어요. 다른 아이디를 사용해 주세요.');
 return reply({ok:true},201,{'Set-Cookie':await newSession(request,id)});
 }
 const user=await db.prepare('SELECT id,password_hash,session_epoch FROM auth_users WHERE username=?').bind(name).first<{id:string;password_hash:string;session_epoch:number}>();
 const dummy='$2b$12$LQv3c1yqBWVHxkd0LHAkCOYBBoH9qiZ24Ps5U2qoT.Dsu8XqsaB5K';
 const matches=await verifyPassword(b.password,user?.password_hash||dummy);
 if(!user||!matches)throw new HttpError(401,'아이디 또는 비밀번호를 확인해 주세요.');
 return reply({ok:true},200,{'Set-Cookie':await newSession(request,user.id,user.session_epoch)});
 }
 const user=await requireUser(request);
 if(b.action==='logout'){await db.batch([db.prepare('UPDATE auth_users SET session_epoch=session_epoch+1 WHERE id=?').bind(user.id),db.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(user.id)]);return reply({ok:true},200,{'Set-Cookie':cookie(request,'',0)})}
 const stored=await db.prepare('SELECT password_hash FROM auth_users WHERE id=?').bind(user.id).first<{password_hash:string}>();
 await rateLimit(request,user.username);
 if(typeof b.currentPassword!=='string'||!validPassword(b.currentPassword)||!stored||!await verifyPassword(b.currentPassword,stored.password_hash))throw new HttpError(401,'현재 비밀번호를 확인해 주세요.');
 if(b.action==='password'){
 if(!validPassword(b.newPassword))throw new HttpError(400,'새 비밀번호는 12자 이상·72바이트 이하로 입력해 주세요.');
 await db.batch([db.prepare('UPDATE auth_users SET password_hash=?,session_epoch=session_epoch+1 WHERE id=?').bind(await hashPassword(b.newPassword),user.id),db.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(user.id)]);
 return reply({ok:true},200,{'Set-Cookie':cookie(request,'',0)});
 }
 if(b.action==='delete'){
 const planIds='SELECT id FROM plans WHERE owner_id=?',taskIds=`SELECT id FROM tasks WHERE plan_id IN (${planIds})`;
 await db.batch([
 ...['completions','executions'].map(t=>db.prepare(`DELETE FROM ${t} WHERE task_id IN (${taskIds})`).bind(user.id)),
 ...['reviews','plan_revisions','tasks'].map(t=>db.prepare(`DELETE FROM ${t} WHERE plan_id IN (${planIds})`).bind(user.id)),
 db.prepare('DELETE FROM plans WHERE owner_id=?').bind(user.id),db.prepare('DELETE FROM observation_days WHERE user_id=?').bind(user.id),db.prepare('DELETE FROM observations WHERE user_id=?').bind(user.id),db.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(user.id),db.prepare('DELETE FROM auth_users WHERE id=?').bind(user.id)]);
 return reply({ok:true},200,{'Set-Cookie':cookie(request,'',0)});
 }
 throw new HttpError(400,'지원하지 않는 요청이에요.');
 }catch(e){return failure(e)}}
