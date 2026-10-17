// 單一指揮租約；僅處理本機檔案，不啟動服務、不呼叫模型。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [command='status',owner='',fileArg]=process.argv.slice(2);
const file=fileArg?path.resolve(fileArg):path.join(root,'docs/coordination/commander-lease.json');
const allowed=new Set(['codex-primary','free-deepseek-switch']);
const durationMs=20*60*1000;
const read=()=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
const emit=value=>console.log(JSON.stringify(value));
try {
  if(command==='status') {
    const lease=read();emit({lease,expired:!lease||Date.now()>=Date.parse(lease.expiresAt)});
  } else {
    if(!['claim','renew'].includes(command)||!allowed.has(owner))throw Error('指令或指揮身分無效');
    fs.mkdirSync(path.dirname(file),{recursive:true});
    const lock=file+'.lock';
    // 不自動刪除鎖：若程序在臨界區中斷，保留現場，避免誤判成雙指揮。
    const fd=fs.openSync(lock,'wx');
    try {
      const previous=read(),now=Date.now();
      const expired=!previous||now>=Date.parse(previous.expiresAt);
      if(previous&&previous.owner!==owner&&(!expired||command==='renew')) {
        emit({ok:false,reason:'other_commander',lease:previous});process.exitCode=2;
      } else if(command==='renew'&&!previous) {
        emit({ok:false,reason:'claim_required'});process.exitCode=2;
      } else {
        const lease={owner,epoch:previous?.owner===owner?previous.epoch:(previous?.epoch||0)+1,
          renewedAt:new Date(now).toISOString(),expiresAt:new Date(now+durationMs).toISOString(),durationMs};
        const temporary=file+`.${process.pid}.tmp`;
        fs.writeFileSync(temporary,JSON.stringify(lease,null,2)+'\n');fs.renameSync(temporary,file);
        emit({ok:true,lease});
      }
    } finally {fs.closeSync(fd);fs.unlinkSync(lock);}
  }
} catch(e) {emit({ok:false,reason:e.code==='EEXIST'?'transition_locked':e.message});process.exitCode=1;}
