import {activityMetric,giftMetric} from '../../../lib/observation-metrics';
import {z} from 'zod';
import {database} from '../../../lib/server-db';
import {requireUser,jsonBody,reply,failure,HttpError} from '../../../lib/auth';
const text=z.string().trim().min(1).max(1000);
const baseConfig=z.object({question:text,rule:text,missing:text,duplicate:text,outlier:text,rounding:text,weekStart:text});
const configSchema=z.union([baseConfig.extend({metric:z.literal(activityMetric.metric),unit:z.literal('개'),calculation:z.literal(activityMetric.calculation)}),baseConfig.extend({metric:z.literal(giftMetric.metric),unit:z.literal('0/1'),calculation:z.literal(giftMetric.calculation)})]);
export async function observationData(userId:string){const db=database();const setup=await db.prepare('SELECT * FROM observations WHERE user_id=?').bind(userId).first<any>();const parsed=setup?JSON.parse(setup.config):null;const days=(await db.prepare('SELECT * FROM observation_days WHERE user_id=? ORDER BY created_at,id').bind(userId).all<any>()).results;const sum=days.reduce((a:number,b:any)=>a+b.value,0);return {canRestore:!!parsed?.draft,setup:setup&&!parsed?.draft?{...setup,config:parsed,change:setup.change?JSON.parse(setup.change):null}:null,days,sum,average:days.length?Math.round(sum/days.length*100)/100:null,recordedDays:days.length,complete:days.length===5,before:days.length>=2?(days[0].value+days[1].value)/2:null,after:days.length>2?Math.round(days.slice(2).reduce((a:number,b:any)=>a+b.value,0)/(days.length-2)*100)/100:null}}
export async function GET(r:Request){try{return reply(await observationData((await requireUser(r)).id))}catch(e){return failure(e)}}
export async function POST(r:Request){try{const user=await requireUser(r),b=await jsonBody(r),db=database(),now=new Date().toISOString(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());const data=await observationData(user.id);
if(b.action==='start'){
const config=configSchema.parse(b.config);if(data.setup)throw new HttpError(409,'시작할 때 정한 관찰 기준은 고정되어 있어요.');const saved=await db.prepare("INSERT INTO observations (user_id,config,created_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET config=excluded.config,created_at=excluded.created_at,change=NULL WHERE json_extract(observations.config,'$.draft')=1 AND NOT EXISTS (SELECT 1 FROM observation_days WHERE user_id=excluded.user_id)").bind(user.id,JSON.stringify(config),now).run();if(!saved.meta.changes)throw new HttpError(409,'관찰 기준이 이미 저장됐어요. 저장된 기준을 다시 확인해 주세요.');
}else if(b.action==='correct-gift-metric'){
if(!data.setup||data.setup.config.metric!==activityMetric.metric||data.days.length>1||data.setup.change||data.days.some((d:any)=>d.value!==0&&d.value!==1))throw new HttpError(409,'첫 관찰의 0/1 기록만 보존해서 지표를 바로잡을 수 있어요.');
const config={...data.setup.config,...giftMetric,metricCorrection:{at:now,previous:{metric:data.setup.config.metric,unit:data.setup.config.unit,calculation:data.setup.config.calculation},reason:'앱이 활동 개수로 고정했던 지표를 사용자의 선물 받음 여부 관찰에 맞게 정정. 기존 날짜·값·메모는 유지.'}};
const saved=await db.prepare('UPDATE observations SET config=? WHERE user_id=? AND config=? AND change IS NULL AND (SELECT count(*) FROM observation_days WHERE user_id=?)<=1 AND NOT EXISTS (SELECT 1 FROM observation_days WHERE user_id=? AND value NOT IN (0,1))').bind(JSON.stringify(config),user.id,JSON.stringify(data.setup.config),user.id,user.id).run();if(!saved.meta.changes)throw new HttpError(409,'기록이 변경됐어요. 새로고침 후 확인해 주세요.');
}else if(b.action==='reset'){

if(!data.setup)throw new HttpError(409,'이미 초기화되어 있어요.');
const draft={draft:true,resetId:crypto.randomUUID(),previous:data.setup.config,previousDays:data.days,previousChange:data.setup.change,previousCreatedAt:data.setup.created_at};
const result=await db.batch([
 db.prepare('UPDATE observations SET config=?,change=NULL WHERE user_id=? AND config=? AND (SELECT count(*) FROM observation_days WHERE user_id=?)=?').bind(JSON.stringify(draft),user.id,JSON.stringify(data.setup.config),user.id,data.days.length),
 db.prepare("DELETE FROM observation_days WHERE user_id=? AND EXISTS (SELECT 1 FROM observations WHERE user_id=? AND json_extract(config,'$.resetId')=?)").bind(user.id,user.id,draft.resetId)
]);
if(!result[0].meta.changes)throw new HttpError(409,'관찰 내용이 변경됐어요. 새로고침 후 다시 눌러 주세요.');
}else if(b.action==='restore'){
const raw=await db.prepare('SELECT config FROM observations WHERE user_id=?').bind(user.id).first<any>();const draft=raw?JSON.parse(raw.config):null;
if(!draft?.draft||data.days.length)throw new HttpError(409,'되돌릴 초기화 내용이 없어요.');
const rows=(draft.previousDays||[]).map((d:any)=>db.prepare("INSERT OR IGNORE INTO observation_days (id,user_id,day,value,note,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM observations WHERE user_id=? AND config=?)").bind(d.id,user.id,d.day,d.value,d.note,d.created_at,user.id,raw.config));
rows.push(db.prepare('UPDATE observations SET config=?,change=?,created_at=? WHERE user_id=? AND config=?').bind(JSON.stringify(draft.previous),draft.previousChange?JSON.stringify(draft.previousChange):null,draft.previousCreatedAt||now,user.id,raw.config));
await db.batch(rows);
}else if(b.action==='day'){

if(!data.setup)throw new HttpError(409,'먼저 관찰 질문과 규칙을 정해 주세요.');
if(data.days.length>=5)throw new HttpError(409,'다섯 날짜의 기록을 모두 남겼어요.');
if(data.days.some((d:any)=>d.day===today))throw new HttpError(409,'오늘 기록은 이미 있어요. 하루에 한 번 기록해요.');
if(data.days.length===2&&!data.setup.change)throw new HttpError(409,'3일차 기록 전에 계획 규칙 하나를 바꿔 주세요.');
const value=z.number().int().min(0).max(data.setup.config.unit==='0/1'?1:10000).parse(b.value),note=text.parse(b.note);
const saved=await db.prepare('INSERT OR IGNORE INTO observation_days (id,user_id,day,value,note,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM observation_days WHERE user_id=?)<5 AND EXISTS (SELECT 1 FROM observations WHERE user_id=? AND json_extract(config,"$.draft") IS NULL AND config=?)').bind(crypto.randomUUID(),user.id,today,value,note,now,user.id,user.id,JSON.stringify(data.setup.config)).run();if(!saved.meta.changes)throw new HttpError(409,'오늘 기록이 이미 저장됐거나 5일 기록이 완료됐어요. 저장된 기록을 다시 확인해 주세요.');
}else if(b.action==='change'){
if(!data.setup||data.days.length!==2||data.setup.change)throw new HttpError(409,'계획 규칙은 2일차 뒤, 3일차 전에 한 번만 바꿀 수 있어요.');
const rule=text.parse(b.rule),reason=text.parse(b.reason);if(rule===data.setup.config.rule)throw new HttpError(400,'기존과 다른 계획 규칙 하나를 적어 주세요.');
const change={rule,reason,changed_at:now,based_on:data.days.map((d:any)=>({id:d.id,day:d.day,value:d.value})),previous_rule:data.setup.config.rule};
const saved=await db.prepare('UPDATE observations SET change=? WHERE user_id=? AND change IS NULL AND (SELECT count(*) FROM observation_days WHERE user_id=?)=2').bind(JSON.stringify(change),user.id,user.id).run();if(!saved.meta.changes)throw new HttpError(409,'계획 규칙이 이미 바뀌었어요. 저장된 규칙을 다시 확인해 주세요.');
}else throw new HttpError(400,'지원하지 않는 요청이에요.');return reply(await observationData(user.id));
}catch(e){return e instanceof z.ZodError?reply({error:'빈 항목이나 숫자 범위를 확인해 주세요.'},400):failure(e)}}
