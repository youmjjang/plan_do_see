import {database} from '../../../lib/server-db';
import {requireUser,reply,failure} from '../../../lib/auth';
import {snapshot} from '../diary/route';
import {observationData} from '../observation/route';
export async function GET(r:Request){try{const user=await requireUser(r);return reply({schema:'pds-t07-v1',timezone:'Asia/Seoul',exported_at:new Date().toISOString(),profile_photo:await database().prepare('SELECT data,mime,updated_at FROM profile_photos WHERE user_id=?').bind(user.id).first(),...await snapshot(user.id),archived_plans:(await database().prepare('SELECT * FROM plans WHERE owner_id=? AND merged_into IS NOT NULL').bind(user.id).all()).results,observation:await observationData(user.id)},200,{'Content-Disposition':'attachment; filename="island-diary.json"'})}catch(e){return failure(e)}}
