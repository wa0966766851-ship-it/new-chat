import express, {type Express} from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {isLocalLauncherRequest} from './launcherPreferences';

export type PlayerSave = {schema:1; revision:string; entries:Record<string,string>};
export function validPlayerEntries(value:unknown):value is Record<string,string> {
  return !!value && typeof value==='object' && !Array.isArray(value) &&
    Object.entries(value).every(([k,v])=>/^seer_[a-zA-Z0-9_.:-]+$/.test(k) && typeof v==='string') &&
    Buffer.byteLength(JSON.stringify(value))<=16*1024*1024;
}
/** 存檔在安裝目錄之外。舊版、其他分頁與失敗寫入都不能靜默覆蓋新資料。 */
export class PlayerSaveStore {
  constructor(readonly directory:string) {}
  read():PlayerSave {
    const file=path.join(this.directory,'current.json');
    if(!fs.existsSync(file))return {schema:1,revision:'empty',entries:{}};
    const saved=JSON.parse(fs.readFileSync(file,'utf8'));
    if(saved.schema!==1 || typeof saved.revision!=='string' || !validPlayerEntries(saved.entries))throw Error('存檔損壞，保留原檔並停止寫入');
    return saved;
  }
  write(revision:string, entries:Record<string,string>):PlayerSave|null {
    if(!validPlayerEntries(entries))throw Error('存檔格式不符');
    fs.mkdirSync(this.directory,{recursive:true});
    // 同一資料夾即使被兩個服務同時使用，也只能有一個寫入者。
    // 遺留鎖不自動刪除：寧可停止同步，不能冒險覆蓋另一個程序。
    const lock=path.join(this.directory,'write.lock');
    let lockFd:number;
    try{lockFd=fs.openSync(lock,'wx');}catch(error){
      if((error as NodeJS.ErrnoException).code==='EEXIST')return null;
      throw error;
    }
    try{
    const previous=this.read();
    if(previous.revision!==revision)return null;
    if(JSON.stringify(previous.entries)===JSON.stringify(entries))return previous;
    fs.mkdirSync(this.directory,{recursive:true});
    // 寫新檔以前先保存原始內容；不循環刪除歷史，不回寫安裝包。
    const file=path.join(this.directory,'current.json');
    if(fs.existsSync(file)){
      const backup=path.join(this.directory,'history');fs.mkdirSync(backup,{recursive:true});
      fs.copyFileSync(file,path.join(backup,`${Date.now()}-${randomUUID()}.json`),fs.constants.COPYFILE_EXCL);
    }
    const next:PlayerSave={schema:1,revision:randomUUID(),entries};
    const temporary=path.join(this.directory,`${next.revision}.tmp`);
    const fd=fs.openSync(temporary,'wx');
    try{fs.writeFileSync(fd,JSON.stringify(next));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(temporary,file);
    return next;
    }finally{fs.closeSync(lockFd);fs.unlinkSync(lock);}
  }
}
export function registerPlayerSaves(app:Express,directory=process.env.SEER_PLAYER_DATA_DIR) {
  if(!directory)return; // 網站與一般開發預覽沒有本機存檔權限。
  const store=new PlayerSaveStore(path.resolve(directory));
  app.use('/api/player-save',(req,res,next)=>{
    if(!isLocalLauncherRequest(req))return res.status(403).json({error:'僅限本機同源頁面'});
    res.setHeader('Cache-Control','no-store');next();
  },express.json({limit:'17mb'}));
  app.get('/api/player-save',(_req,res)=>{
    try{res.json(store.read());}catch{res.status(500).json({error:'本機存檔讀取失敗，原檔未重設'});}
  });
  app.post('/api/player-save',(req,res)=>{
    if(typeof req.body?.revision!=='string' || !validPlayerEntries(req.body?.entries))return res.status(400).json({error:'存檔格式不符'});
    try{
      const saved=store.write(req.body.revision,req.body.entries);
      if(!saved)return res.status(409).json({error:'另一視窗已有新存檔；未覆蓋，請先保存目前資料再重開'});
      res.json({revision:saved.revision});
    }catch{res.status(500).json({error:'本機備份或寫入失敗，請保留目前視窗並匯出資料'});}
  });
}
