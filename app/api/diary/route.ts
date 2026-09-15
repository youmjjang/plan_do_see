import {requireUser,HttpError,failure,jsonBody,reply} from '../../../lib/auth';
import {dailyTasks} from '../../../lib/routine';
import {z} from 'zod';
import {database} from '../../../lib/server-db';
const str=z.string().trim().min(1).max(1000),id=z.string().min(1).max(100),date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'날짜를 확인해 주세요');
const plan=z.object({id,title:str,start_date:date,end_date:date,priority:z.number().int().min(1).max(3),success:str,estimate:z.number().int().min(0).max(100000),improvement:z.string().max(1000).default(''),version:z.number().int().optional()}).refine(p=>p.start_date<=p.end_date,'종료일은 시작일 이후여야 해요');
const task=z.object({id,plan_id:id,title:str,due_date:date,priority:z.number().int().min(1).max(3),tags:z.string().max(300),estimate:z.number().int().min(0).max(100000)});
const log=z.object({id,task_id:id,start_at:z.string().datetime(),end_at:z.string().datetime(),blocked:z.string().max(1000),note:z.string().max(2000),complete:z.boolean(),cycle:z.number().int().min(0)}).refine(e=>Date.parse(e.end_at)>Date.parse(e.start_at),'끝난 시각은 시작 시각보다 뒤여야 해요');
const headers={'Cache-Control':'no-store'};
export async function snapshot(userId:string){const db=database();const names=['plans','tasks','executions','plan_revisions','completions','reviews'];const queries=[
 'SELECT * FROM plans WHERE owner_id=?',
 'SELECT t.* FROM tasks t JOIN plans p ON p.id=t.plan_id WHERE p.owner_id=?',
 'SELECT e.* FROM executions e JOIN tasks t ON t.id=e.task_id JOIN plans p ON p.id=t.plan_id WHERE p.owner_id=?',
 'SELECT r.* FROM plan_revisions r JOIN plans p ON p.id=r.plan_id WHERE p.owner_id=?',
 'SELECT c.* FROM completions c JOIN tasks t ON t.id=c.task_id JOIN plans p ON p.id=t.plan_id WHERE p.owner_id=?',
 'SELECT r.* FROM reviews r JOIN plans p ON p.id=r.plan_id WHERE p.owner_id=?'];const results=await db.batch(queries.map(q=>db.prepare(q).bind(userId)));return Object.fromEntries(names.map((n,i)=>[n,results[i].results]))}
export async function GET(request:Request){try{const user=await requireUser(request);const data=await snapshot(user.id);const url=new URL(request.url);if(url.searchParams.has('id')){const row=data.tasks.find((t:any)=>t.id===url.searchParams.get('id'));if(!row)throw new HttpError(404,'자료를 찾을 수 없어요.');return reply(row)}return reply(data)}catch(e){return failure(e)}}
async function owned(userId:string,kind:string,key:string){const q=kind==='plan'?'SELECT id FROM plans WHERE id=? AND owner_id=?':kind==='task'?'SELECT t.id FROM tasks t JOIN plans p ON p.id=t.plan_id WHERE t.id=? AND p.owner_id=?':'SELECT e.id FROM executions e JOIN tasks t ON t.id=e.task_id JOIN plans p ON p.id=t.plan_id WHERE e.id=? AND p.owner_id=?';if(!await database().prepare(q).bind(key,userId).first())throw new HttpError(404,'자료를 찾을 수 없어요.')}
export async function POST(request:Request){
 try{
 const user=await requireUser(request);const input=z.object({op:z.string()}).passthrough().parse(await jsonBody(request));const db=database(),now=new Date().toISOString(),op=input.op;
 const v=input.value as any;
 if(['plan-create','task-create','execution','review'].includes(op))z.string().uuid().parse(v?.id);
 if(op==='review')z.string().uuid().parse(v?.next?.id);

 if(op==='plan-edit')await owned(user.id,'plan',id.parse(v?.id));
 if(op==='task-create'||op==='review')await owned(user.id,'plan',id.parse(v?.plan_id));
 if(op==='task-edit'){await owned(user.id,'task',id.parse(v?.id));await owned(user.id,'plan',id.parse(v?.plan_id));}
 if(op==='task-delete'||op==='task-reopen')await owned(user.id,'task',id.parse(input.id));
 if(op==='execution')await owned(user.id,'task',id.parse(v?.task_id));
 if(op==='execution-edit')await owned(user.id,'execution',id.parse(v?.id));
 if(op==='bootstrap'){
 // Compatibility: reading no longer creates sample records.
 }else if(op==='daily-routine'){
 const day=date.parse(input.date),pid=user.id+':daily-routine-'+day;
 const p={id:pid,title:day+' · 매일 섬 루틴',start_date:day,end_date:day,priority:2,success:'플레이한 날의 다섯 가지 루틴을 확인하고 실제로 한 일을 기록하기',estimate:dailyTasks.reduce((n,t)=>n+t.estimate,0),improvement:'',version:1,created_at:now};
 await db.batch([db.prepare('INSERT OR IGNORE INTO plans (owner_id,id,title,start_date,end_date,priority,success,estimate,improvement,version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(user.id,...Object.values(p)),db.prepare('INSERT OR IGNORE INTO plan_revisions (id,plan_id,version,snapshot,created_at) VALUES (?,?,?,?,?)').bind(pid+':1',pid,1,JSON.stringify(p),now),...dailyTasks.map((t,i)=>db.prepare('INSERT OR IGNORE INTO tasks (id,plan_id,title,due_date,priority,tags,estimate,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(pid+'-'+(i+1),pid,t.title,day,2,'매일 루틴',t.estimate,now))]);
 }else if(op==='plan-create'){

 const p=plan.parse(input.value);await db.batch([db.prepare('INSERT INTO plans (owner_id,id,title,start_date,end_date,priority,success,estimate,improvement,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(user.id,p.id,p.title,p.start_date,p.end_date,p.priority,p.success,p.estimate,p.improvement,now),db.prepare('INSERT INTO plan_revisions (id,plan_id,version,snapshot,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),p.id,1,JSON.stringify({...p,version:1}),now)]);
 }else if(op==='plan-edit'){
 const p=plan.parse(input.value);const result=await db.batch([db.prepare('UPDATE plans SET title=?,start_date=?,end_date=?,priority=?,success=?,estimate=?,improvement=?,version=version+1 WHERE id=? AND version=?').bind(p.title,p.start_date,p.end_date,p.priority,p.success,p.estimate,p.improvement,p.id,p.version??0),db.prepare('INSERT OR IGNORE INTO plan_revisions (id,plan_id,version,snapshot,created_at) SELECT ?,id,version,json_object(\'title\',title,\'start_date\',start_date,\'end_date\',end_date,\'priority\',priority,\'success\',success,\'estimate\',estimate,\'improvement\',improvement),? FROM plans WHERE id=?').bind(crypto.randomUUID(),now,p.id)]);if(!result[0].meta.changes)return Response.json({error:'다른 수정이 먼저 저장됐어요. 창을 닫고 새로고침한 뒤 다시 수정해 주세요.'},{status:409});
 }else if(op==='task-create'||op==='task-edit'){
 const t=task.parse(input.value);if(op==='task-create')await db.prepare('INSERT INTO tasks (id,plan_id,title,due_date,priority,tags,estimate,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(t.id,t.plan_id,t.title,t.due_date,t.priority,t.tags,t.estimate,now).run();
 else await db.prepare('UPDATE tasks SET title=?,due_date=?,priority=?,tags=?,estimate=? WHERE id=? AND deleted_at IS NULL').bind(t.title,t.due_date,t.priority,t.tags,t.estimate,t.id).run();
 }else if(op==='task-delete'){
 await db.prepare('UPDATE tasks SET deleted_at=? WHERE id=? AND deleted_at IS NULL').bind(now,id.parse(input.id)).run();
 }else if(op==='task-reopen'){
 await db.prepare("UPDATE tasks SET status='open',cycle=cycle+1 WHERE id=? AND status='done' AND deleted_at IS NULL").bind(id.parse(input.id)).run();
  }else if(op==='execution-edit'){
 const fields=z.object({start_at:z.string().datetime(),end_at:z.string().datetime(),blocked:z.string().max(1000),note:z.string().max(2000)});
 const e=fields.extend({id,original:fields}).parse(input.value),minutes=Math.round((Date.parse(e.end_at)-Date.parse(e.start_at))/60000);
 if(minutes<1||minutes>100000)throw new Error('invalid');
 const r=await db.prepare('UPDATE executions SET start_at=?,end_at=?,minutes=?,blocked=?,note=? WHERE id=? AND start_at=? AND end_at=? AND blocked=? AND note=?').bind(e.start_at,e.end_at,minutes,e.blocked,e.note,e.id,e.original.start_at,e.original.end_at,e.original.blocked,e.original.note).run();
 if(!r.meta.changes)return Response.json({error:'기록'+'이 다른 곳에서 수정됐어요. 창을 닫고 저장된 자료를 다시 확인한 뒤 수정해 주세요.'},{status:409});
 }else if(op==='execution'){

 const e=log.parse(input.value),minutes=Math.round((Date.parse(e.end_at)-Date.parse(e.start_at))/60000);if(minutes<1||minutes>100000)throw new Error('invalid');
 const key=e.complete?e.task_id+':'+e.cycle:null;
 const conditions=e.complete?" AND status='open' AND cycle=?":"";
 const values=[e.id,e.start_at,e.end_at,minutes,e.blocked,e.note,key,now,e.task_id,...(e.complete?[e.cycle]:[])];
 const statements=[db.prepare(`INSERT OR IGNORE INTO executions (id,task_id,start_at,end_at,minutes,blocked,note,completion_key,created_at) SELECT ?,id,?,?,?,?,?,?,? FROM tasks WHERE id=? AND deleted_at IS NULL${conditions}`).bind(...values)];
 if(e.complete){statements.push(db.prepare("INSERT OR IGNORE INTO completions (id,task_id,cycle,created_at) SELECT ?,id,cycle,? FROM tasks WHERE id=? AND status='open' AND cycle=? AND deleted_at IS NULL").bind(key,now,e.task_id,e.cycle));statements.push(db.prepare("UPDATE tasks SET status='done' WHERE id=? AND status='open' AND cycle=? AND deleted_at IS NULL").bind(e.task_id,e.cycle))}
 await db.batch(statements);
 }else if(op==='review'){
 const r=z.object({id,plan_id:id,start_date:date,end_date:date,improvement:str,next:plan}).parse(input.value);if(r.start_date>r.end_date)throw new Error('invalid');
 const p=r.next;if(await db.prepare('SELECT id FROM plans WHERE id=?').bind(p.id).first())throw new HttpError(409,'이미 존재하는 계획 ID예요.');await db.batch([db.prepare('INSERT OR IGNORE INTO plans (owner_id,id,title,start_date,end_date,priority,success,estimate,improvement,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(user.id,p.id,p.title,p.start_date,p.end_date,p.priority,p.success,p.estimate,r.improvement,now),db.prepare('INSERT OR IGNORE INTO plan_revisions (id,plan_id,version,snapshot,created_at) VALUES (?,?,?,?,?)').bind(p.id+':1',p.id,1,JSON.stringify({...p,improvement:r.improvement}),now),db.prepare('INSERT OR IGNORE INTO reviews (id,plan_id,start_date,end_date,improvement,next_plan_id,created_at) VALUES (?,?,?,?,?,?,?)').bind(r.id,r.plan_id,r.start_date,r.end_date,r.improvement,p.id,now)]);
 }else return Response.json({error:'지원하지 않는 요청이에요.'},{status:400});
 return Response.json(await snapshot(user.id),{headers});
 }catch(error){if(error instanceof HttpError)return failure(error);const invalid=error instanceof z.ZodError||(error instanceof Error&&error.message==='invalid');return Response.json({error:invalid?'날짜, 시간, 필수 항목을 확인해 주세요.':'저장하지 못했어요. 입력 내용은 그대로 있으니 잠시 뒤 다시 시도해 주세요.'},{status:invalid?400:503,headers})}
}


