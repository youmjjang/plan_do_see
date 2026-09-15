import {requireChatGPTUser} from '../chatgpt-auth';
import ClaimButton from './submit';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/claim');return <main className="auth-shell"><section className="auth-card"><h1>T06 기록 가져오기</h1><p>기존 다이어리 소유자의 ChatGPT 계정인지 확인한 뒤, 현재 로그인한 다이어리 계정에 기존 기록을 연결해요.</p><ClaimButton/><a href="/diary">다이어리로 돌아가기</a></section></main>}
