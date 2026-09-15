'use client';
import {useState} from 'react';
export default function ClaimButton(){const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);return <><button className="primary" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const d:any=await r.json();setMessage(r.ok?`기존 계획 ${d.count}개를 내 계정으로 연결했어요.`:d.error)}catch{setMessage('연결이 어려워요. 다시 시도해 주세요.')}finally{setBusy(false)}}}>기존 기록 연결하기</button><p role="status">{message}</p></>}
