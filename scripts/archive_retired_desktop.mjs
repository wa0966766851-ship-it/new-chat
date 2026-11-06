import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertBuildChild} from './lib/buildWorkspace.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const home=path.join(root,'.desktop-releases'),archive=path.join(root,'.local-archives','desktop-content');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const apply=process.argv.includes('--apply'),restore=process.argv.includes('--restore')?process.argv[process.argv.indexOf('--restore')+1]:null;
const checked=new Set();
function objectFile(hash){if(!/^[a-f0-9]{64}$/.test(hash))throw Error('無效備份雜湊');return path.join(archive,'objects',hash+'.gz');}
function readObject(hash){const data=zlib.gunzipSync(fs.readFileSync(objectFile(hash)));if(digest(data)!==hash)throw Error('備份校驗失敗 '+hash);return data;}
function walk(dir){const files=[];function visit(f){const s=fs.lstatSync(f);if(s.isSymbolicLink())throw Error('拒絕連結 '+f);if(s.isDirectory())for(const name of fs.readdirSync(f).sort())visit(path.join(f,name));else if(s.isFile())files.push({name:path.relative(dir,f).replaceAll('\\','/'),size:s.size,mtime:s.mtimeMs});}visit(dir);return files;}
function manifestPath(id){if(!/^\d{13}$/.test(id))throw Error('無效版本');return path.join(archive,'manifests',id+'.json');}
if(restore){
  const manifest=JSON.parse(fs.readFileSync(manifestPath(restore),'utf8'));
  const destination=assertBuildChild(root,path.join(root,'build','restored-desktop',restore));
  if(fs.existsSync(destination))throw Error('還原目標已存在，拒絕覆蓋');
  for(const f of manifest.files){
    const target=assertBuildChild(root,path.resolve(destination,f.name));
    if(!target.startsWith(destination+path.sep))throw Error('還原路徑越界');
    const bytes=readObject(f.sha256);if(bytes.length!==f.size)throw Error('備份大小不符');
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});
  }
  console.log(JSON.stringify({restored:restore,path:destination,files:manifest.files.length}));
}else{
  if(fs.existsSync(path.join(home,'update.lock')))throw Error('桌面更新進行中，不能封存');
  const activeRaw=fs.readFileSync(path.join(home,'active.json'),'utf8'),active=JSON.parse(activeRaw);
  const ids=fs.readdirSync(home).filter(n=>/^\d{13}$/.test(n)).sort().reverse();
  const keep=new Set([active.id,active.previous,...ids.slice(0,3)]);
  const processes=()=>execFileSync('powershell.exe',['-NoProfile','-Command','Get-CimInstance Win32_Process | Select-Object -ExpandProperty CommandLine | ConvertTo-Json -Compress'],{encoding:'utf8',windowsHide:true}).toLowerCase().replaceAll('\\\\','\\');
  const commands=processes();
  const tracked=execFileSync('git',['ls-files','-z','--','.desktop-releases'],{cwd:root,encoding:'utf8'});if(tracked)throw Error('桌面版本含版控檔案，停止');
  const candidates=ids.filter(id=>!keep.has(id)).map(id=>({id,dir:assertBuildChild(root,path.join(home,id),'.desktop-releases')}))
    .filter(e=>!commands.includes(e.dir.toLowerCase())).map(e=>({...e,files:walk(e.dir)}))
    .filter(e=>e.files.every(f=>Date.now()-f.mtime>48*3600e3));
  const report={createdAt:new Date().toISOString(),apply,keep:[...keep],beforeBytes:candidates.reduce((n,e)=>n+e.files.reduce((b,f)=>b+f.size,0),0),addedBackupBytes:0,removedBytes:0,completed:[]};
  console.log(JSON.stringify({candidates:candidates.length,bytes:report.beforeBytes,keep:report.keep}));
  if(apply){
    fs.mkdirSync(path.join(archive,'objects'),{recursive:true});fs.mkdirSync(path.join(archive,'manifests'),{recursive:true});
    for(const e of candidates){
      const files=[];
      for(const f of e.files){
        const data=fs.readFileSync(path.join(e.dir,f.name)),hash=digest(data),target=objectFile(hash);
        if(data.length!==f.size)throw Error('來源變動，停止');
        if(!fs.existsSync(target)){const gz=zlib.gzipSync(data,{level:9});fs.writeFileSync(target,gz,{flag:'wx'});report.addedBackupBytes+=gz.length;}
        if(!checked.has(hash)){readObject(hash);checked.add(hash);}
        files.push({...f,sha256:hash});
      }
      const manifest={schema:1,id:e.id,files};const out=manifestPath(e.id);
      if(fs.existsSync(out) && fs.readFileSync(out,'utf8')!==JSON.stringify(manifest))throw Error('既有封存清單不一致');
      fs.writeFileSync(out,JSON.stringify(manifest));
      if(fs.readFileSync(path.join(home,'active.json'),'utf8')!==activeRaw || fs.existsSync(path.join(home,'update.lock')) || processes().includes(e.dir.toLowerCase()))throw Error('啟用／執行狀態變動，停止');
      if(JSON.stringify(walk(e.dir))!==JSON.stringify(e.files))throw Error('來源檔案變動，停止');
      // 刪除前完整重讀來源；每個檔案都有已解壓並核對的備份。
      for(const f of files)if(digest(fs.readFileSync(path.join(e.dir,f.name)))!==f.sha256)throw Error('來源內容變動，停止');
      assertBuildChild(root,e.dir,'.desktop-releases');fs.rmSync(e.dir,{recursive:true});
      const bytes=files.reduce((n,f)=>n+f.size,0);report.removedBytes+=bytes;report.completed.push({id:e.id,files:files.length,bytes});
      fs.writeFileSync(path.join(archive,'receipt-'+report.createdAt.replaceAll(':','-')+'.json'),JSON.stringify(report,null,2));
      console.log(JSON.stringify({archived:e.id,bytes}));
    }
    fs.writeFileSync(path.join(archive,'README.md'),'# 桌面舊版本內容去重封存\n\n同內容僅保存一份 gzip，manifests/ 保留每個版本的逐檔 SHA-256。不要分開刪 objects 與 manifests。\n\n還原到新目錄（不覆寫目前版本）：\n\n`node scripts/archive_retired_desktop.mjs --restore <13位版本ID>`\n\n還原路徑為 build/restored-desktop/<ID>。核對後才能另行部署，這個命令不改 active.json 或玩家存檔。\n');
    console.log(JSON.stringify({...report,netSavedBytes:report.removedBytes-report.addedBackupBytes}));
  }
}
