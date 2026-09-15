import fs from 'node:fs';
import path from 'node:path';
const roots=['components','hooks','app','db','lib','contracts','drizzle','tests','scripts','build','vendor','public'];
const rootFiles=['.npmrc','components.json','package.json','package-lock.json','vite.config.ts','tsconfig.json','drizzle.config.ts','cloudflare-env.d.ts','next.config.ts','postcss.config.mjs','eslint.config.mjs','.gitignore','.openai/hosting.json','README.md','SUBMISSION.md','T07-AUTH.md'];
const files={};
function visit(p){if(p.replaceAll('\\','/')=== 'public/source/files.json')return;const st=fs.lstatSync(p);if(st.isSymbolicLink())return;if(st.isDirectory()){for(const c of fs.readdirSync(p))visit(path.join(p,c));return}const key=p.replaceAll('\\','/');const binary=/\.(jpg|jpeg|png|webp|ico|woff2?)$/i.test(key);files[key]={encoding:binary?'base64':'utf8',content:fs.readFileSync(p,binary?'base64':'utf8')}}
for(const p of [...roots,...rootFiles])if(fs.existsSync(p))visit(p);
fs.mkdirSync('public/source',{recursive:true});fs.writeFileSync('public/source/files.json',JSON.stringify({title:'큐티스트릿도 다이어리 전체 소스',files}));
console.log(`Exported ${Object.keys(files).length} source files without environment or repository credentials.`);


