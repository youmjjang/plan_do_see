import {z} from 'zod';
import {database} from '../../../lib/server-db';
const str=z.string().trim().min(1).max(1000),id=z.string().min(1).max(100),date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'날짜를 확인해 주세요');
const plan=z.object({id,title:str,start_date:date,end_date:date,priority:z.number().int().min(1).max(3),success:str,estimate:z.number().int().min(0).max(100000),improvement:z.string().max(1000).default(''),version:z.number().int().optional()}).refine(p=>p.start_date<=p.end_date,'종료일은 시작일 이후여야 해요');
const task=z.object({id,plan_id:id,title:str,due_date:date,priority:z.number().int().min(1).max(3),tags:z.string().max(300),estimate:z.number().int().min(0).max(100000)});
const log=z.object({id,task_id:id,start_at:z.string().datetime(),end_at:z.string().datetime(),blocked:z.string().max(1000),note:z.string().max(2000),complete:z.boolean(),cycle:z.number().int().min(0)}).refine(e=>Date.parse(e.end_at)>Date.parse(e.start_at),'끝난 시각은 시작 시각보다 뒤여야 해요');
const headers={'Cache-Control':'no-store'};
async function snapshot(){const db=database();const names=['plans','tasks','executions','plan_revisions','completions','reviews'];const results=await db.batch(names.map(n=>db.prepare(`SELECT * FROM ${n} ORDER BY created_at,id`)));return Object.fromEntries(names.map((n,i)=>[n,results[i].results]))}
export async function GET(){try{return Response.json(await snapshot(),{headers})}catch{return Response.json({error:'자료를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'},{status:503,headers})}}
export async function POST(request:Request){
 try{
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'이 화면에서 다시 시도해 주세요.'},{status:403});
 if(Number(request.headers.get('content-length')||0)>32000)return Response.json({error:'입력 내용이 너무 길어요.'},{status:413});
 const input=z.object({op:z.string()}).passthrough().parse(await request.json());const db=database(),now=new Date().toISOString(),op=input.op;
 if(op==='bootstrap'){
 const titles=['새 위치와 두 가게 배치 정하기','옮길 곳 주변 정리하기','너굴상점·옷가게 이전 진행하기','길과 작은 광장 꾸미기','가구·가로등·울타리 배치하기','직접 걸어 보고 동선 다듬기'];
 const p={id:'island-shopping-street',title:'유럽·모던풍 상점가 꾸미기',start_date:'2026-09-19',end_date:'2026-09-27',priority:2,success:'두 가게를 오가기 편하고, 섬 입구·박물관과 분위기가 이어지는 상점가 완성',estimate:480,improvement:'',version:1,created_at:now};
 await db.batch([db.prepare('INSERT OR IGNORE INTO plans (id,title,start_date,end_date,priority,success,estimate,improvement,version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(...Object.values(p)),db.prepare('INSERT OR IGNORE INTO plan_revisions (id,plan_id,version,snapshot,created_at) VALUES (?,?,?,?,?)').bind('initial-plan',p.id,1,JSON.stringify(p),now),...titles.map((title,i)=>db.prepare('INSERT OR IGNORE INTO tasks (id,plan_id,title,due_date,priority,tags,estimate,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(`island-task-${i+1}`,p.id,title,i<3?'2026-09-20':'2026-09-27',2,i<3?'이번 주말':'다음 주말',[60,60,120,90,90,60][i],now))]);
 }else if(op==='plan-create'){
 const p=plan.parse(input.value);await db.batch([db.prepare('INSERT INTO plans (id,title,start_date,end_date,priority,success,estimate,improvement,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(p.id,p.title,p.start_date,p.end_date,p.priority,p.success,p.estimate,p.improvement,now),db.prepare('INSERT INTO plan_revisions (id,plan_id,version,snapshot,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),p.id,1,JSON.stringify({...p,version:1}),now)]);
 }else if(op==='plan-edit'){
 const p=plan.parse(input.value);const result=await db.batch([db.prepare('UPDATE plans SET title=?,start_date=?,end_date=?,priority=?,success=?,estimate=?,improvement=?,version=version+1 WHERE id=? AND version=?').bind(p.title,p.start_date,p.end_date,p.priority,p.success,p.estimate,p.improvement,p.id,p.version??0),db.prepare('INSERT OR IGNORE INTO plan_revisions (id,plan_id,version,snapshot,created_at) SELECT ?,id,version,json_object(\'title\',title,\'start_date\',start_date,\'end_date\',end_date,\'priority\',priority,\'success\',success,\'estimate\',estimate,\'improvement\',improvement),? FROM plans WHERE id=?').bind(crypto.randomUUID(),now,p.id)]);if(!result[0].meta.changes)return Response.json({error:'다른 수정이 먼저 저장됐어요. 창을 닫고 새로고침한 뒤 다시 수정해 주세요.'},{status:409});
 }else if(op==='task-create'||op==='task-edit'){
 const t=task.parse(input.value);if(op==='task-create')await db.prepare('INSERT INTO tasks (id,plan_id,title,due_date,priority,tags,estimate,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(t.id,t.plan_id,t.title,t.due_date,t.priority,t.tags,t.estimate,now).run();
 else await db.prepare('UPDATE tasks SET title=?,due_date=?,priority=?,tags=?,estimate=? WHERE id=? AND deleted_at IS NULL').bind(t.title,t.due_date,t.priority,t.tags,t.estimate,t.id).run();
 }else if(op==='task-delete'){
 await db.prepare('UPDATE tasks SET deleted_at=? WHERE id=? AND deleted_at IS NULL').bind(now,id.parse(input.id)).run();
 }else if(op==='task-reopen'){
 await db.prepare("UPDATE tasks SET status='open',cycle=cycle+1 WHERE id=? AND status='done' AND deleted_at IS NULL").bind(id.parse(input.id)).run();
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
 const p=r.next;await db.batch([db.prepare('INSERT OR IGNORE INTO plans (id,title,start_date,end_date,priority,success,estimate,improvement,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(p.id,p.title,p.start_date,p.end_date,p.priority,p.success,p.estimate,r.improvement,now),db.prepare('INSERT OR IGNORE INTO plan_revisions (id,plan_id,version,snapshot,created_at) VALUES (?,?,?,?,?)').bind(p.id+':1',p.id,1,JSON.stringify({...p,improvement:r.improvement}),now),db.prepare('INSERT OR IGNORE INTO reviews (id,plan_id,start_date,end_date,improvement,next_plan_id,created_at) VALUES (?,?,?,?,?,?,?)').bind(r.id,r.plan_id,r.start_date,r.end_date,r.improvement,p.id,now)]);
 }else return Response.json({error:'지원하지 않는 요청이에요.'},{status:400});
 return Response.json(await snapshot(),{headers});
 }catch(error){const invalid=error instanceof z.ZodError||(error instanceof Error&&error.message==='invalid');return Response.json({error:invalid?'날짜, 시간, 필수 항목을 확인해 주세요.':'저장하지 못했어요. 입력 내용은 그대로 있으니 잠시 뒤 다시 시도해 주세요.'},{status:invalid?400:503,headers})}
}

