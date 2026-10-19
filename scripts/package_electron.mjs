import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {assertBuildChild} from './lib/buildWorkspace.mjs';
import {prepareReleaseVersion,zipExecutables} from './lib/releaseArtifacts.mjs';
function cleanWork(root){
 const slimming=path.join(root,'dist-electron','win-unpacked','resources','resource-slimming.json');
 if(fs.existsSync(slimming))fs.copyFileSync(slimming,path.join(root,'dist-electron','resource-slimming.json'));
 for(const [parent,name] of [['build','electron-app'],['dist-electron','win-unpacked']]){
  const dir=assertBuildChild(root,path.join(root,parent,name),parent);
  if(fs.existsSync(dir))fs.rmSync(dir,{recursive:true,force:true,maxRetries:3,retryDelay:250});
 }
}
export function cleanupElectronWork(root){
 const lock=assertBuildChild(root,path.join(root,'build','.electron-package.lock'));
 fs.mkdirSync(path.dirname(lock),{recursive:true});const fd=fs.openSync(lock,'wx');
 try{cleanWork(root);}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
export function packageElectron(root,{keep=false,keepVersion=false,npmCli=process.env.npm_execpath,execute,zip=zipExecutables}={}) {
if(!npmCli)throw Error('請使用 npm run package:electron 啟動');
const run=execute || (args=>{const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true});if(r.error)throw r.error;if(r.status!==0)throw Error('封裝程序失敗，exit '+r.status);});
let succeeded=false;
const lock=assertBuildChild(root,path.join(root,'build','.electron-package.lock'));
fs.mkdirSync(path.dirname(lock),{recursive:true});
const lockFd=fs.openSync(lock,'wx');
fs.writeFileSync(lockFd,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
try{
 const version=prepareReleaseVersion(root,keepVersion);
 console.log('封裝版本：'+version+(keepVersion?'（保留版本）':'（自動遞增修訂號）'));
 run([npmCli,'run','build:electron']);
 const require=createRequire(import.meta.url);
 run([require.resolve('electron-builder/cli.js'),'--config','electron-builder.yml','--publish','never']);
 const files=fs.readdirSync(path.join(root,'dist-electron')).filter(n=>n.endsWith('.exe')&&n.includes(`-${version}-`)).map(n=>path.join(root,'dist-electron',n));
 if(!files.length)throw Error('封裝完成但沒有EXE，保留診斷資訊');
 console.log('EXE ZIP：'+zip(root,files,version));
 succeeded=true;
}finally{
 try {
 const slimming=path.join(root,'dist-electron','win-unpacked','resources','resource-slimming.json');
 if(fs.existsSync(slimming))fs.copyFileSync(slimming,path.join(root,'dist-electron','resource-slimming.json'));
 if(!keep){
  cleanWork(root);
 }
 } finally { fs.closeSync(lockFd);fs.unlinkSync(lock); }
 console.log(keep?'保留封裝中繼目錄供檢查。':'封裝中繼副本已清理；正式成品與快取保留。');
 if(!succeeded)console.log('本次未成功打包；請查看上方錯誤。');
}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 if(process.argv.includes('--clean-work'))cleanupElectronWork(root);
 else packageElectron(root,{keep:process.argv.includes('--keep-work'),keepVersion:process.argv.includes('--keep-version')});
}
