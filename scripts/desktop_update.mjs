import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
import net from 'node:net';
import {activateRelease} from './desktop_release.mjs';
import {buildSync} from 'esbuild';
const root=process.cwd(),home=path.join(root,'.desktop-releases');
fs.mkdirSync(home,{recursive:true});
const lock=path.join(home,'update.lock');let fd;
try{fd=fs.openSync(lock,'wx');}catch{throw Error('已有桌面更新進行中；確認該流程結束後再處理更新鎖。');}
function run(cmd,args){const r=spawnSync(process.execPath,[cmd,...args],{cwd:root,stdio:'inherit',windowsHide:true});if(r.status!==0)throw Error(`更新停止：${cmd}`);}
async function smoke(dir,buildId){
 const probe=net.createServer();await new Promise((ok,no)=>{probe.once('error',no);probe.listen(0,'127.0.0.1',ok);});
 const port=probe.address().port;await new Promise(ok=>probe.close(ok));
 const child=spawn(process.execPath,[path.join(dir,'server.cjs')],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',PORT:String(port),SEER_HOST:'127.0.0.1',SEER_DIST_DIR:dir,SEER_RELEASE_ID:buildId}});
 let output='';for(const pipe of [child.stdout,child.stderr])pipe.on('data',d=>{output=(output+d).slice(-4000);});
 let spawnError;child.once('error',e=>{spawnError=e;});
 try{
  const url=`http://127.0.0.1:${port}`;
  for(let n=0;n<120;n++){
   if(spawnError||child.exitCode!==null)throw Error('桌面後端無法啟動：'+(spawnError||output));
   try{
    const r=await fetch(url+'/api/launcher/identity',{signal:AbortSignal.timeout(1000)});
    if(r.ok){const identity=await r.json();
     if(identity.pid!==child.pid||identity.buildId!==buildId||identity.mode!=='production'||path.resolve(identity.root)!==root)throw Error('後端身分不一致');
     const version=await (await fetch(url+'/version.json')).json();
     const html=await (await fetch(url)).text();
     if(version.buildId!==buildId||!html.includes('/assets/')||html.includes('/@vite/client'))throw Error('前後端產物不一致');
     return;
    }
   }catch(e){if(!['TypeError','TimeoutError'].includes(e.name))throw e;}
   await new Promise(ok=>setTimeout(ok,250));
  }
  throw Error('桌面後端啟動逾時：'+output);
 }finally{if(child.exitCode===null&&!spawnError){const closed=new Promise(ok=>child.once('exit',ok));child.kill();await closed;}}
}
function fingerprint(){
 const h=crypto.createHash('sha256');
 const walk=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  const f=path.join(p,e.name);if(e.isDirectory())walk(f);else if(e.isFile()){h.update(path.relative(root,f));h.update(fs.readFileSync(f));}
 }};
 for(const d of ['src','public','server','scripts','tests'])walk(path.join(root,d));
 for(const f of ['AGENTS.md','launcher/launcher.ps1','launcher/serverIdentity.ps1','server.ts','vite.config.ts','package.json','package-lock.json','index.html','tsconfig.json'])h.update(fs.readFileSync(f));
 return h.digest('hex');
}
try{
 run('node_modules/tsx/dist/cli.mjs',['scripts/pack_reviewed_kits.ts']);
 const source=fingerprint();
 run('node_modules/typescript/bin/tsc',['--noEmit']);
 run('node_modules/tsx/dist/cli.mjs',['tests/petAnimationImpact.semantic.test.ts']);
 run('node_modules/tsx/dist/cli.mjs',['tests/petAnimationRetarget.semantic.test.ts']);
 run('node_modules/tsx/dist/cli.mjs',['tests/petAnimationCache.semantic.test.ts']);
 run('node_modules/tsx/dist/cli.mjs',['tests/petLoadingFlow.semantic.test.ts']);
 for(const file of ['tests/corruptedRey.semantic.test.ts','tests/battleSpriteFacing.semantic.test.ts','tests/petAnimationModes.semantic.test.ts','tests/petAnimationModes.ui.test.tsx','tests/builtinEffectBindings.semantic.test.ts','tests/savedCorruptedRey.semantic.test.ts','tests/reySavedPresentation.integration.test.tsx','tests/elfSkins.ui.test.tsx','tests/staticModeAndDetails.ui.test.tsx','tests/elfSpotlight.ui.test.tsx','tests/launcherIdentity.semantic.test.ts']){ // vite 轉譯快取偶發 60 秒傳輸逾時（與程式碼無關）；同一支測試重跑一次即可通過，故允許一次重試。
   try{run('node_modules/tsx/dist/cli.mjs',[file]);}catch(err){
     console.warn('重試一次：'+file);
     try{run('node_modules/tsx/dist/cli.mjs',[file]);}catch(again){throw again;}
   }
  }
 run('tests/desktopRelease.semantic.test.mjs',[]);
 const launcherCheck=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','tests/launcherIdentity.semantic.test.ps1'],{cwd:root,stdio:'inherit',windowsHide:true});
 if(launcherCheck.status!==0)throw Error('Windows啟動器驗證失敗');
 const id=Date.now().toString(),dir=path.join(home,id);
 run('node_modules/vite/bin/vite.js',['build','--outDir',dir,'--sourcemap','false']);
 buildSync({entryPoints:['server.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',outfile:path.join(dir,'server.cjs')});
 if(fingerprint()!==source)throw Error('建置期間來源有變更，本次產物不切換；請完成編輯後重試。');
 for(const f of ['index.html','server.cjs','version.json'])if(!fs.statSync(path.join(dir,f)).size)throw Error(`產物不完整：${f}`);
 const version=JSON.parse(fs.readFileSync(path.join(dir,'version.json'),'utf8'));
 await smoke(dir,version.buildId);
 if(fingerprint()!==source)throw Error('服務驗證期間來源有變更，本次產物不切換。');
 fs.writeFileSync(path.join(dir,'completion.json'),JSON.stringify({source,version,checks:'types, rey, facing, saved definitions, skins, HTTP frontend/backend identity',completedAt:new Date().toISOString()}));
 activateRelease(home,id);
 console.log('桌面完成版本已就緒。結束目前戰鬥並關閉舊視窗後，使用原桌面捷徑開啟。');
}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
