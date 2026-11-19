import fs from 'node:fs';
import path from 'node:path';

export function readCompletedRelease(home,id){
 if(!/^\d+$/.test(id))throw Error('桌面版本識別錯誤');
 const dir=path.join(home,id);
 for(const name of ['index.html','server.cjs','version.json','completion.json'])if(!fs.statSync(path.join(dir,name)).size)throw Error(`桌面版本缺少 ${name}`);
 const version=JSON.parse(fs.readFileSync(path.join(dir,'version.json'),'utf8'));
 const completed=JSON.parse(fs.readFileSync(path.join(dir,'completion.json'),'utf8'));
 if(!version.buildId||completed.version.buildId!==version.buildId)throw Error('完成紀錄與前後端版本不一致');
 return {id,buildId:version.buildId};
}
export function activateRelease(home,id){
 const next=readCompletedRelease(home,id),file=path.join(home,'active.json');
 const previous=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
 fs.writeFileSync(file+'.tmp',JSON.stringify({...next,previous:previous?.id||null}));
 fs.renameSync(file+'.tmp',file);
 pruneReleases(home);
 return next;
}
/**
 * 2026-11-16：只保留目前、上一版與最新 keep 份完整建置；其餘舊建置刪除（皆可重建，玩家存檔不在此）。
 * 正在執行中被鎖住的檔案刪不掉時略過，下次更新再清。
 */
export function pruneReleases(home,keep=3){
 const file=path.join(home,'active.json');
 if(!fs.existsSync(file))return [];
 const active=JSON.parse(fs.readFileSync(file,'utf8'));
 const ids=fs.readdirSync(home,{withFileTypes:true}).filter(e=>e.isDirectory()&&/^\d+$/.test(e.name)).map(e=>e.name).sort((a,b)=>Number(b)-Number(a));
 const protect=new Set([active.id,active.previous,...ids.slice(0,keep)].filter(Boolean));
 const removed=[];
 for(const id of ids){
  if(protect.has(id))continue;
  try{fs.rmSync(path.join(home,id),{recursive:true,force:true});removed.push(id);}catch{/* 使用中，下次再清 */}
 }
 return removed;
}
