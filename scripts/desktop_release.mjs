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
 return next;
}
