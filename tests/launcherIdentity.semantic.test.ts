import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {registerLauncherIdentity,serverSourceStamp} from '../server/launcherIdentity';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'seer-launcher-identity-'));
fs.mkdirSync(path.join(root,'server'));
fs.writeFileSync(path.join(root,'server.ts'),'old backend');
fs.writeFileSync(path.join(root,'server','api.ts'),'old route');
const app=express();registerLauncherIdentity(app,root,'production');
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
try{
 const url=`http://127.0.0.1:${(server.address() as any).port}/api/launcher/identity`;
 const first=await fetch(url),identity=await first.json();
 assert.equal(first.headers.get('cache-control'),'no-store');
 assert.equal(identity.app,'seer-battle-simulator');assert.equal(identity.root,root);assert.equal(identity.pid,process.pid);assert.equal(identity.mode,'production');
 assert.equal(identity.sourceStamp,serverSourceStamp(root));
 const changed=new Date(Date.now()+5000);fs.utimesSync(path.join(root,'server','api.ts'),changed,changed);
 assert.notEqual(serverSourceStamp(root),identity.sourceStamp);
 assert.deepEqual(await (await fetch(url)).json(),identity,'不能把新來源冒認為舊行程已載入');
 console.log('啟動服務身分、來源時點、模式、PID與不可快取契約通過');
}finally{await new Promise<void>(r=>server.close(()=>r()));fs.rmSync(root,{recursive:true,force:true});}
