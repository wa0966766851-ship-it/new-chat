import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
const reservation=createServer();
reservation.listen(0,'127.0.0.1');
await new Promise(done=>reservation.once('listening',done));
const port=reservation.address().port;
await new Promise(done=>reservation.close(done));
const child=spawn(process.execPath,[path.resolve('dist-online/signal.cjs')],{cwd:path.resolve('dist-online'),windowsHide:true,stdio:'ignore',env:{
  ...process.env,SEER_P2P_HOST:'127.0.0.1',SEER_P2P_PORT:String(port),
  SEER_P2P_ALLOW_DIRECT:'1',SEER_P2P_PUBLIC_ORIGIN:'',SEER_P2P_ORIGINS:'',
}});
const origin='http://127.0.0.1:'+port;
let started=false;
try {
  for(let i=0;i<40;i++){
    try {started=(await fetch(origin+'/api/p2p/status')).ok;if(started)break;}catch{}
    if(child.exitCode!==null)throw Error('獨立服務提前退出');
    await new Promise(done=>setTimeout(done,100));
  }
  assert.ok(started,'獨立服務正常啟動');
  const identity=await fetch(origin+'/api/p2p/identity').then(r=>r.json());
  assert.equal(identity.app,'seer-online');assert.equal(identity.pid,child.pid);assert.equal(identity.root,path.resolve('dist-online'));
  const html=await fetch(origin+'/').then(res=>res.text());
  assert.ok(html.includes('src="/assets/online-'));
  const module=html.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(module);
  assert.equal((await fetch(origin+module)).status,200);
  assert.equal((await fetch(origin+'/signal.cjs')).status,404);
  assert.equal((await fetch(origin+'/api/player-save')).status,404);
  assert.equal((await fetch(origin+'/api/battle-ai/status')).status,404);
  const create=await fetch(origin+'/api/p2p/rooms',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({version:'seer-room-1v1-v3'})});
  assert.equal(create.status,200);
  console.log('獨立建置服務通過，首頁與素材可載入、信令可建房、單機存檔與 AI API 隔離');
} finally {
  if(child.exitCode===null){
    const ended=new Promise(done=>child.once('exit',done));
    child.kill();
    await ended;
  }
}
