// Runs the built Worker against a disposable local D1 database, never production.
import fs from 'node:fs';
import path from 'node:path';
import {Miniflare} from 'miniflare';
const state='.wrangler/state/v3/d1';
if(fs.existsSync(state))throw new Error('Use a fresh checkout: this verifier requires an empty local D1 directory.');
const config=JSON.parse(fs.readFileSync('dist/server/wrangler.json','utf8'));
const modulePaths=fs.readdirSync('dist/server',{recursive:true}).filter(f=>f.endsWith('.js'));
modulePaths.sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b));
const mf=new Miniflare({
  modules:modulePaths.map(f=>({type:'ESModule',path:path.resolve('dist/server',f)})),
  modulesRoot:path.resolve('dist/server'),
  compatibilityDate:config.compatibility_date||'2026-05-15',
  compatibilityFlags:config.compatibility_flags||['nodejs_compat'],
  d1Databases:{DB:'t07-local-verification'},d1Persist:state,
  assets:{directory:path.resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true}},
  cf:false,
});
const originalFetch=globalThis.fetch;
try{
  const db=await mf.getD1Database('DB');
  for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()){
    const statements=fs.readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
    await db.batch(statements.map(sql=>db.prepare(sql)));
  }
  globalThis.fetch=(url,init)=>{
    if(!String(url).startsWith('http://localhost:5173/'))throw new Error('Only local test requests are allowed.');
    return mf.dispatchFetch(String(url),init);
  };
  process.env.TEST_BASE='http://localhost:5173';
  await import('./auth.mjs');
  await import('./observation.mjs');
  await import('./stats.mjs');
  console.log('PASS: built Worker verification completed; no production requests or real usage records created.');
}finally{
  globalThis.fetch=originalFetch;
  await mf.dispose();
  fs.rmSync(state,{recursive:true,force:true});
}
