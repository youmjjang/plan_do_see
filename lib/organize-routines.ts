import {database} from './server-db';
// Keep original plan rows and revision history; only move their child records.
export async function organizeRoutines(userId:string){
 const db=database();const rows=(await db.prepare("SELECT * FROM plans WHERE owner_id=? AND merged_into IS NULL AND (id LIKE '%daily-routine%' OR title LIKE '%매일 섬 루틴%' OR title='데일리 계획') ORDER BY created_at,id").bind(userId).all<any>()).results;
 if(!rows.length)return null;
 const target=rows[0],others=rows.slice(1);if(!others.length&&target.title==='매일 섬 루틴')return target.id;
 const start=rows.map(p=>p.start_date).sort()[0],end=rows.map(p=>p.end_date).sort().at(-1),now=new Date().toISOString();
 const statements=[db.prepare('INSERT OR IGNORE INTO plan_revisions (id,plan_id,version,snapshot,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),target.id,target.version,JSON.stringify(target),now),db.prepare('UPDATE plans SET title=?,start_date=?,end_date=?,version=version+1 WHERE id=? AND owner_id=?').bind('매일 섬 루틴',start,end,target.id,userId)];
 for(const old of others){statements.push(db.prepare('UPDATE tasks SET plan_id=? WHERE plan_id=?').bind(target.id,old.id),db.prepare('UPDATE reviews SET plan_id=? WHERE plan_id=?').bind(target.id,old.id),db.prepare('UPDATE reviews SET next_plan_id=? WHERE next_plan_id=?').bind(target.id,old.id),db.prepare('UPDATE plans SET merged_into=? WHERE id=? AND owner_id=?').bind(target.id,old.id,userId));}
 await db.batch(statements);return target.id;
}
