import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createBuildWorkspace,removeBuildWorkspace,assertBuildChild} from '../scripts/lib/buildWorkspace.mjs';
import {packageElectron,cleanupElectronWork} from '../scripts/package_electron.mjs';
import {prepareReleaseVersion} from '../scripts/lib/releaseArtifacts.mjs';
import {unzipSync} from 'fflate';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'seer-build-lifecycle-'));
const script=path.resolve('tools/prepare_share.ts');
try{
 const root=path.join(temp,'source');fs.mkdirSync(root);
 const localOnly=['.local-archives','.desktop-releases','.cleanup-audit','shots','_shots','.tmp-esbuild','.tmp-testlogs','__pycache__'];
 for(const dir of ['src','build/old-copy','dist-electron/win-unpacked','node_modules','dist',...localOnly])fs.mkdirSync(path.join(root,dir),{recursive:true});
 for(const dir of localOnly)fs.writeFileSync(path.join(root,dir,'private-fixture.txt'),'local only');
 fs.writeFileSync(path.join(root,'src','actual.ts'),'source preserved');
 fs.writeFileSync(path.join(root,'build','old-copy','large.txt'),'generated');
 fs.writeFileSync(path.join(root,'.env'),'fixture-secret');
 const work=createBuildWorkspace(root,'exe');
 const out=path.join(work,'source');
 const run=(target)=>spawnSync(process.execPath,['--import','tsx',script,'--force','--src',root,'--out',target],{encoding:'utf8',windowsHide:true});
 let result=run(out);assert.equal(result.status,0,result.stderr);
 assert.equal(fs.readFileSync(path.join(out,'src','actual.ts'),'utf8'),'source preserved');
 for(const dir of ['build','dist-electron','node_modules','dist','.env',...localOnly])assert.equal(fs.existsSync(path.join(out,dir)),false,'不可遞迴複製 '+dir);
 const unrelated=path.join(temp,'unrelated');fs.mkdirSync(unrelated);fs.writeFileSync(path.join(unrelated,'keep.txt'),'keep');
 result=run(unrelated);assert.notEqual(result.status,0,'拒絕清空未標記目錄');
 assert.equal(fs.readFileSync(path.join(unrelated,'keep.txt'),'utf8'),'keep');
 assert.notEqual(run(root).status,0,'拒絕輸出覆蓋來源');
 assert.notEqual(run(temp).status,0,'拒絕清空來源上層');
 assert.throws(()=>assertBuildChild(root,root),/越界/);
 assert.throws(()=>assertBuildChild(root,path.join(root,'build','..','..','outside')),/越界/);
 fs.symlinkSync(unrelated,path.join(root,'build','linked'),'junction');
 assert.throws(()=>assertBuildChild(root,path.join(root,'build','linked','nested')),/連結/);
 let failed=false;
 try{throw Error('simulated package failure');}catch{failed=true;}finally{removeBuildWorkspace(root,work);}
 assert.ok(failed);assert.equal(fs.existsSync(work),false,'失敗後清理自己的複製工作目錄');
 assert.equal(fs.readFileSync(path.join(root,'src','actual.ts'),'utf8'),'source preserved');
 for(const outcome of ['success','failure','keep','nozip']){
  const project=path.join(temp,outcome);fs.mkdirSync(project);
  fs.writeFileSync(path.join(project,'package.json'),JSON.stringify({version:'1.2.3'}));
  fs.writeFileSync(path.join(project,'package-lock.json'),JSON.stringify({version:'1.2.3',packages:{'':{version:'1.2.3'}}}));
  fs.writeFileSync(path.join(project,'version.ts'),'export const VERSION = "1.2.3";');
  const execute=()=>{
   for(const directory of ['build/electron-app','dist-electron/win-unpacked/resources','dist-electron/nsis-web'])fs.mkdirSync(path.join(project,directory),{recursive:true});
   fs.writeFileSync(path.join(project,'dist-electron','old.exe'),'original installer');
   fs.writeFileSync(path.join(project,'dist-electron','sim-1.2.4-portable.exe'),'new executable');
   fs.writeFileSync(path.join(project,'dist-electron','nsis-web','sim-1.2.4-web-setup.exe'),'web installer');
   fs.writeFileSync(path.join(project,'dist-electron','nsis-web','sim-1.2.4-web-setup.__uninstaller.exe'),'internal only');
   fs.writeFileSync(path.join(project,'dist-electron','nsis-web','payload.7z'),'required payload');
   fs.writeFileSync(path.join(project,'dist-electron','win-unpacked','resources','resource-slimming.json'),'{}');
   if(outcome==='failure')throw Error('mock failure');
  };
  const action=()=>packageElectron(project,{npmCli:'fixture',keep:outcome==='keep',makeZip:outcome!=='nozip',execute});
  if(outcome==='failure')assert.throws(action,/mock failure/);else action();
  for(const directory of ['build/electron-app','dist-electron/win-unpacked'])assert.equal(fs.existsSync(path.join(project,directory)),outcome==='keep',outcome+'中繼目錄處理');
  assert.equal(fs.readFileSync(path.join(project,'dist-electron','old.exe'),'utf8'),'original installer');
  assert.equal(fs.readFileSync(path.join(project,'dist-electron','nsis-web','payload.7z'),'utf8'),'required payload');
  assert.equal(fs.existsSync(path.join(project,'build','.electron-package.lock')),false,'所有出口釋放打包鎖');
  assert.equal(JSON.parse(fs.readFileSync(path.join(project,'package.json'),'utf8')).version,'1.2.4');
  assert.equal(prepareReleaseVersion(project,true),'1.2.4','關閉遞增仍保持三個來源一致');
  if(outcome==='nozip')assert.equal(fs.existsSync(path.join(project,'dist-electron','seer-battle-simulator-1.2.4-exe.zip')),false);
  if(outcome!=='failure'&&outcome!=='nozip')assert.ok(fs.existsSync(path.join(project,'dist-electron','seer-battle-simulator-1.2.4-exe.zip')));
  if(outcome!=='failure'&&outcome!=='nozip'){
   const files=unzipSync(fs.readFileSync(path.join(project,'dist-electron','seer-battle-simulator-1.2.4-exe.zip')));
   assert.deepEqual(Object.keys(files),['sim-1.2.4-portable.exe','sim-1.2.4-web-setup.exe'],'ZIP包含本版巢狀網路安裝EXE，排除舊成品與中繼解除安裝器');
   assert.equal(Buffer.from(files['sim-1.2.4-portable.exe']).toString(),'new executable');
  }
  if(outcome==='keep'){cleanupElectronWork(project);assert.equal(fs.existsSync(path.join(project,'dist-electron','win-unpacked')),false);}
 }
 console.log('封裝工作區：實際分享複製排除舊產物、來源/上層/未標記輸出保護、連結拒絕及失敗清理通過。');
}finally{
 assert.ok(temp.startsWith(path.join(os.tmpdir(),'seer-build-lifecycle-')));
 fs.rmSync(temp,{recursive:true,force:true});
}
