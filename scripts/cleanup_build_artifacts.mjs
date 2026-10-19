import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {assertBuildChild} from './lib/buildWorkspace.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const apply=process.argv.includes('--apply');
const report={generatedAt:new Date().toISOString(),applied:apply,candidates:[],removedBytes:0};
function inspect(target){
 const stat=fs.lstatSync(target);
 if(stat.isSymbolicLink())throw Error('拒絕清理連結：'+target);
 if(stat.isDirectory())return fs.readdirSync(target).reduce((n,name)=>{
  if(name==='.git')throw Error('拒絕清理Git工作區：'+target);
  return n+inspect(path.join(target,name));
 },0);
 return stat.size;
}
const candidates=[];
// 舊測試只放合成資料；保留最近24小時的工作，避免干涉其他AI正在測試。
for(const name of fs.existsSync(path.join(root,'build'))?fs.readdirSync(path.join(root,'build')):[]){
 if(!/^(slimming-test|update-tests|asset-cache-test)-[A-Za-z0-9]+$/.test(name))continue;
 const dir=assertBuildChild(root,path.join(root,'build',name));
 if(Date.now()-fs.lstatSync(dir).mtimeMs<24*3600e3)continue;
 candidates.push({path:dir,reason:'超過24小時的合成測試暫存'});
}
// 2026-09-28舊流程把win-unpacked輸出放入dist再包入自己。只處理已標記副本內的生成輸出。
const share=path.resolve(root,'..','SeerSim_share');
const marker=path.join(share,'.share_copy');
if(fs.existsSync(marker)){
 const text=fs.readFileSync(marker,'utf8');
 if(text.startsWith('share copy of '+root+' at ')){
  const target=path.join(share,'dist','win-unpacked');
  if(fs.existsSync(target)){
   assertBuildChild(share,target,'dist');
   fs.accessSync(path.join(target,'resources','app.asar'));
   candidates.push({path:target,reason:'已標記舊分享副本中遞迴收進自身的Electron中繼輸出'});
  }
 }
}
for(const item of candidates){
 const rel=path.relative(root,item.path);
 if(!rel.startsWith('..')){
  const tracked=execFileSync('git',['ls-files','-z','--',rel],{cwd:root});
  if(tracked.length)throw Error('候選包含受版控檔案：'+item.path);
 }
 item.bytes=inspect(item.path);
 report.candidates.push(item);
}
console.log(JSON.stringify({apply,candidates:report.candidates.length,bytes:report.candidates.reduce((n,x)=>n+x.bytes,0),largest:[...report.candidates].sort((a,b)=>b.bytes-a.bytes).slice(0,4)},null,2));
if(apply){
 const receipt=path.join(root,'docs','audits','build-cleanup-20261019.json');
 if(!report.candidates.length){console.log('沒有可清理項目，保留原清理回執。');process.exit(0);}
 const previous=fs.existsSync(receipt)?JSON.parse(fs.readFileSync(receipt,'utf8')):null;
 if(previous){
  report.previousRuns=[...(previous.previousRuns||[]),{...previous,previousRuns:undefined}];
  report.totalRemovedBytes=previous.totalRemovedBytes??previous.removedBytes??0;
 }
 const previousBytes=report.totalRemovedBytes||0;
 fs.writeFileSync(receipt,JSON.stringify(report,null,2)+'\n');
 for(const item of report.candidates){
  // 每次刪除前再核對全樹；不清任何版本安裝包、來源素材或分享副本原始碼。
  if(inspect(item.path)!==item.bytes)throw Error('候選在確認後變動，停止：'+item.path);
  fs.rmSync(item.path,{recursive:true,force:true,maxRetries:3,retryDelay:250});
  report.removedBytes+=item.bytes;item.removed=true;
  report.totalRemovedBytes=previousBytes+report.removedBytes;
  fs.writeFileSync(receipt,JSON.stringify(report,null,2)+'\n');
 }
 console.log('已清理 '+report.removedBytes+' bytes；紀錄 '+receipt);
}
