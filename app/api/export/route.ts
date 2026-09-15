import {requireUser,reply,failure} from '../../../lib/auth';
import {snapshot} from '../diary/route';
import {observationData} from '../observation/route';
export async function GET(r:Request){try{const user=await requireUser(r);return reply({schema:'pds-t07-v1',timezone:'Asia/Seoul',exported_at:new Date().toISOString(),...await snapshot(user.id),observation:await observationData(user.id)},200,{'Content-Disposition':'attachment; filename="island-diary.json"'})}catch(e){return failure(e)}}
