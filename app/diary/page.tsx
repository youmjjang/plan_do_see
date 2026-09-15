import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {userFor} from '../../lib/auth';
import Diary from '../diary';
export const dynamic='force-dynamic';
export default async function Page(){const h=await headers();const user=await userFor(new Request('https://internal/diary',{headers:h}));if(!user)redirect('/');return <Diary/>}
