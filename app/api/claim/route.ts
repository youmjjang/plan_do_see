import {getChatGPTUser} from '../../chatgpt-auth';
import {requireUser,jsonBody,reply,failure,HttpError} from '../../../lib/auth';
import {database} from '../../../lib/server-db';
export async function POST(request:Request){try{await jsonBody(request);const user=await requireUser(request),owner=await getChatGPTUser();if(owner?.email.toLowerCase()!=='youmnana19@gmail.com')throw new HttpError(403,'기존 T06 소유자의 ChatGPT 계정으로 확인해 주세요.');const result=await database().prepare('UPDATE plans SET owner_id=? WHERE owner_id IS NULL').bind(user.id).run();return reply({ok:true,count:result.meta.changes})}catch(e){return failure(e)}}
