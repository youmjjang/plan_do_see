export type Row=Record<string,any>;
export type Data={plans:Row[];tasks:Row[];executions:Row[];plan_revisions:Row[];completions:Row[];reviews:Row[]};
export function seoulToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export function selectTasks(data:Data,planId:string,from='',to=''){return data.tasks.filter(t=>!t.deleted_at&&t.plan_id===planId&&(!from||t.due_date>=from)&&(!to||t.due_date<=to))}
export function reviewStats(data:Data,tasks:Row[],today=seoulToday()){
 const ids=new Set(tasks.map(t=>t.id));const records=data.executions.filter(e=>ids.has(e.task_id));const blocked=new Set(records.filter(e=>e.blocked.trim()).map(e=>e.task_id));
 const estimate=tasks.reduce((n,t)=>n+t.estimate,0),actual=records.reduce((n,e)=>n+e.minutes,0);
 return {planned:tasks.length,done:tasks.filter(t=>t.status==='done').length,late:tasks.filter(t=>t.status!=='done'&&t.due_date<today).length,blocked:tasks.filter(t=>blocked.has(t.id)).length,estimate,actual,difference:actual-estimate,records};
}
