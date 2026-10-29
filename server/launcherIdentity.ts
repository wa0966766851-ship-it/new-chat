import fs from 'node:fs';
import path from 'node:path';
import type {Express} from 'express';

/** 啟動時快照，不能把新寫入的來源誤認成目前行程已經載入的版本。 */
export function serverSourceStamp(root:string):number {
  const files=[path.join(root,'server.ts')];
  const walk=(dir:string)=>{if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(?:ts|cjs|mjs)$/.test(file))files.push(file);
  }};
  walk(path.join(root,'server'));
  return Math.max(0,...files.filter(file=>fs.existsSync(file)).map(file=>Math.trunc(fs.statSync(file).mtimeMs)));
}
export function registerLauncherIdentity(app:Express,root:string,mode:string){
  const versionFile=path.join(process.env.SEER_DIST_DIR||path.join(root,'dist'),'version.json');
  const buildId=mode==='production'&&fs.existsSync(versionFile)?JSON.parse(fs.readFileSync(versionFile,'utf8')).buildId:null;
  if(process.env.SEER_RELEASE_ID&&process.env.SEER_RELEASE_ID!==buildId)throw Error('桌面前後端版本不一致');
  const identity={app:'seer-battle-simulator',root:path.resolve(root),pid:process.pid,mode,sourceStamp:serverSourceStamp(root),buildId};
  app.get('/api/launcher/identity',(req,res)=>{
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||''))return res.sendStatus(404);
    res.setHeader('Cache-Control','no-store');res.json(identity);
  });
}
