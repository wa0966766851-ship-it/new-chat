import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import {JSDOM} from 'jsdom';
import {PlayerSaveStore,registerPlayerSaves} from '../server/playerSaves';
import {initializePlayerSave} from '../src/utils/playerSaveBridge';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'seer-save-test-'));
const app=express();registerPlayerSaves(app,root);
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
const address=server.address() as {port:number};const origin=`http://127.0.0.1:${address.port}`;
const request:typeof fetch=(url,options={})=>fetch(new URL(String(url),origin),{...options,headers:{...options.headers,Origin:origin}});
const dom=new JSDOM('<body></body>',{url:origin});
Object.assign(globalThis,{document:dom.window.document,location:dom.window.location,localStorage:dom.window.localStorage});
const storage=dom.window.localStorage;
let bridge:Awaited<ReturnType<typeof initializePlayerSave>>;
try{
  storage.setItem('seer_last_used_p1_team','{"team":[{"id":"custom_one"}]}');
  storage.setItem('seer_custom_elves','[{"id":"custom_one","name":"玩家原稿"}]');
  storage.setItem('unrelated_token','never-export');
  bridge=await initializePlayerSave(storage,request);assert.ok(bridge);
  const store=new PlayerSaveStore(root),first=store.read();
  assert.equal(first.entries.seer_custom_elves,storage.getItem('seer_custom_elves'));assert.equal(first.entries.unrelated_token,undefined);
  const reorderedDom=new JSDOM('<body></body>',{url:'http://127.0.0.1:39997'});
  for(const key of Object.keys(first.entries).reverse())reorderedDom.window.localStorage.setItem(key,first.entries[key]);
  const reordered=await initializePlayerSave(reorderedDom.window.localStorage,request);
  assert.ok(reordered,'同內容不同排列不得被誤判成衝突');reordered!.stop();reorderedDom.window.close();
  // 真正第二個網址（不同埠）的空 localStorage；在任何預設初始化前恢復。
  const second=new JSDOM('<body></body>',{url:'http://127.0.0.1:39998'}).window.localStorage;
  const next=await initializePlayerSave(second,request);assert.ok(next);
  assert.equal(second.getItem('seer_last_used_p1_team'),storage.getItem('seer_last_used_p1_team'));
  second.setItem('seer_custom_elves','[{"id":"custom_one","name":"更新後修改"}]');await next!.flush();
  assert.equal(new PlayerSaveStore(root).read().entries.seer_custom_elves,second.getItem('seer_custom_elves'));
  // 舊視窗不能蓋回新視窗。原字串仍留在各自瀏覽器，出現明確告警。
  storage.setItem('seer_custom_elves','[{"name":"舊視窗"}]');await bridge!.flush();
  assert.equal(store.read().entries.seer_custom_elves,second.getItem('seer_custom_elves'));
  assert.ok(dom.window.document.querySelector('[role=alert]')?.textContent?.includes('另一視窗'));
  next!.stop();bridge!.stop();
  assert.ok(fs.readdirSync(path.join(root,'history')).length>=1);
  const backups=fs.readdirSync(path.join(root,'history')).map(f=>JSON.parse(fs.readFileSync(path.join(root,'history',f),'utf8')));
  assert.ok(backups.some(b=>b.entries.seer_custom_elves===first.entries.seer_custom_elves));
  const rejected=await fetch(origin+'/api/player-save',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({revision:store.read().revision,entries:{seer_custom_elves:'[]'}})});
  assert.equal(rejected.status,403);
  // 另一個服務已取得寫入鎖時，原檔與版本都不得改動。
  const beforeLock=fs.readFileSync(path.join(root,'current.json'),'utf8');
  fs.writeFileSync(path.join(root,'write.lock'),'other-process');
  assert.equal(store.write(store.read().revision,{seer_custom_elves:'[]'}),null);
  assert.equal(fs.readFileSync(path.join(root,'current.json'),'utf8'),beforeLock);
  fs.unlinkSync(path.join(root,'write.lock'));
  // 損壞檔案不轉成預設並覆蓋；失敗時 byte-for-byte 原樣保留。
  fs.writeFileSync(path.join(root,'current.json'),'{broken');
  assert.throws(()=>store.write('anything',{seer_custom_elves:'[]'}));assert.equal(fs.readFileSync(path.join(root,'current.json'),'utf8'),'{broken');
  console.log('玩家存檔：跨埠恢復、重啟讀取、自製精靈保留、原檔備份、多視窗拒絕覆寫、同源限制與損壞保護通過。');
}finally{bridge?.stop();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));dom.window.close();fs.rmSync(root,{recursive:true,force:true});}
