import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd(),workspace=path.dirname(root),apply=process.argv.includes('--apply');
if(!fs.existsSync(path.join(root,'src/battle/petAnimationLoader.ts')))throw Error('請從對戰模擬器專案根目錄執行');
const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date()),archive=path.join(root,'shots/archive',date,'from-workspace-root');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const candidates=fs.readdirSync(workspace,{withFileTypes:true}).filter(e=>e.isFile()&&/^_.*\.(png|jpe?g|webp)$/i.test(e.name));
const text=[];
function scan(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink()||['archive','node_modules','dist','.git','.seer-cache'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else if(/\.(md|mjs|js|ts|tsx|py|ps1|json|html|cmd|bat)$/i.test(e.name)&&fs.statSync(p).size<2e6)text.push([p,fs.readFileSync(p,'utf8')]);}}
for(const base of [root,workspace]){for(const d of ['scripts','tests','docs','src'])scan(path.join(base,d));for(const e of fs.readdirSync(base,{withFileTypes:true}))if(e.isFile()&&/\.(md|json|ps1|bat|cmd)$/i.test(e.name))text.push([path.join(base,e.name),fs.readFileSync(path.join(base,e.name),'utf8')]);}
const rows=candidates.map(e=>{const from=path.resolve(workspace,e.name),to=path.resolve(archive,e.name);if(path.dirname(from)!==workspace||!to.startsWith(root+path.sep)||fs.lstatSync(from).isSymbolicLink())throw Error('拒絕不安全路徑');return {from,to,bytes:fs.statSync(from).size,sha256:hash(from),references:text.filter(([,s])=>s.includes(e.name)).map(([p])=>p),moved:false};});
const receipt={created:new Date().toISOString(),apply,workspace,archive,files:rows};
if(apply&&rows.length){fs.mkdirSync(archive,{recursive:true});const journal=path.join(archive,'manifest.json');if(fs.existsSync(journal))throw Error('封存回執已存在，請先檢查，拒絕覆寫');fs.writeFileSync(journal,JSON.stringify(receipt,null,2));for(const row of rows){if(row.references.length)continue;if(fs.existsSync(row.to))throw Error('目的地已存在：'+row.to);fs.renameSync(row.from,row.to);row.moved=true;if(hash(row.to)!==row.sha256)throw Error('雜湊核對失敗');fs.writeFileSync(journal,JSON.stringify(receipt,null,2));}}
console.log(JSON.stringify({apply,candidates:rows.length,moved:rows.filter(r=>r.moved).length,referenced:rows.filter(r=>r.references.length),bytes:rows.reduce((n,r)=>n+r.bytes,0),archive},null,2));
