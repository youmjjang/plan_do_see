import assert from 'node:assert/strict';
import {reviewStats,selectTasks} from '../lib/pds.ts';
const tasks=[{id:'a',plan_id:'p',due_date:'2026-09-13',status:'done',estimate:60},{id:'b',plan_id:'p',due_date:'2026-09-13',status:'open',estimate:20},{id:'c',plan_id:'p',due_date:'2026-09-14',status:'open',estimate:10},{id:'d',plan_id:'p',due_date:'2026-09-14',status:'done',estimate:999,deleted_at:'x'}];
const d={tasks,executions:[{task_id:'a',minutes:30,blocked:'blocked'},{task_id:'a',minutes:10,blocked:'again'},{task_id:'b',minutes:15,blocked:''},{task_id:'d',minutes:999,blocked:'hidden'}]};
const selected=selectTasks(d,'p','2026-09-01','2026-09-14');const s=reviewStats(d,selected,'2026-09-14');
assert.deepEqual([s.planned,s.done,s.late,s.blocked,s.estimate,s.actual,s.difference],[3,1,1,1,90,55,-35]);
const empty=reviewStats(d,[],'2026-09-14');assert.deepEqual([empty.planned,empty.done,empty.late,empty.blocked,empty.estimate,empty.actual,empty.difference],[0,0,0,0,0,0,0]);
console.log('PASS: aggregation, deleted exclusion, unique blocked tasks, Seoul today boundary, time delta and empty zero');
