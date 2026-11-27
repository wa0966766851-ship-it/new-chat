import fs from 'node:fs';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer as createVite } from 'vite';
import { createServer as reservePort } from 'node:net';
import { launchPetTestBrowser, petTestProfile, closePetTestBrowser, findPetTestBrowser } from './helpers/petBrowserProcess.mjs';
import { createP2PSignalRouter } from '../server/p2pSignal';

const browser = process.env.SEER_TEST_BROWSER || findPetTestBrowser();
assert.ok(browser, '找不到測試用 Chromium 瀏覽器');
const profile = petTestProfile();
const reservation = reservePort();
reservation.listen(0, '127.0.0.1');
await new Promise<void>(done=>reservation.once('listening',done));
const debugPort = (reservation.address() as {port:number}).port;
await new Promise<void>(done=>reservation.close(()=>done()));
const vite = await createVite({ configFile:false, root:process.cwd(), server:{ middlewareMode:true,hmr:false,watch:null },
  optimizeDeps:{noDiscovery:true,include:[]}, appType:'custom',logLevel:'silent' });
const app = express();
app.use('/api/p2p', createP2PSignalRouter({SEER_P2P_ALLOW_DIRECT:'1'},req=>`http://${req.get('host')}`));
app.get('/probe',(_req,res)=>res.type('html').send('<!doctype html><title>P2P isolation test</title>'));
app.use(express.static('dist-online', { index: false }));
app.use(vite.middlewares);
const server = app.listen(0,'127.0.0.1');
await new Promise<void>(done=>server.once('listening',done));
const origin = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
const child = launchPetTestBrowser(browser, debugPort, profile);
const debugUrl = 'ws://127.0.0.1:' + debugPort;
const pause=(ms:number)=>new Promise(done=>setTimeout(done,ms));
const setField=(selector:string,value:string)=>`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`;
async function until<T>(run:()=>Promise<T>, label:string, duration=30_000):Promise<T>{
  const deadline=Date.now()+duration;
  while(Date.now()<deadline){const result=await run();if(result)return result;await pause(100);}
  throw Error('逾時 '+label);
}
const sockets: WebSocket[]=[];
async function tab() {
  const host = new URL(debugUrl).host;
  const target=await fetch(`http://${host}/json/new?${encodeURIComponent(origin+'/probe')}`,{method:'PUT'}).then(res=>res.json());
  const socket=new WebSocket(target.webSocketDebuggerUrl);
  sockets.push(socket);
  await new Promise<void>((done,reject)=>{socket.addEventListener('open',()=>done(),{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;
  const waiting=new Map<number,{resolve:(value:any)=>void;reject:(cause:any)=>void;timer:ReturnType<typeof setTimeout>}>();
  socket.addEventListener('message',event=>{
    const response=JSON.parse(String(event.data)), task=waiting.get(response.id);
    if(!task)return;
    waiting.delete(response.id);clearTimeout(task.timer);
    if(response.error||response.result?.exceptionDetails) task.reject(Error(JSON.stringify(response.error||response.result.exceptionDetails)));
    else task.resolve(response.result?.result?.value??response.result);
  });
  const command=(method:string,params:object):Promise<any>=>new Promise((resolve,reject)=>{
    const id=++sequence;
    const timer=setTimeout(()=>{waiting.delete(id);reject(Error('瀏覽器指令逾時'));},25_000);
    waiting.set(id,{resolve,reject,timer});
    socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=(expression:string)=>command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,replMode:true});
  await command('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
  await until(()=>evaluate("location.pathname==='/probe'&&document.readyState==='complete'"),'頁面載入');
  await evaluate(`window.NativePeer=RTCPeerConnection;window.RTCPeerConnection=class extends NativePeer{
    createDataChannel(...args){const channel=super.createDataChannel(...args);window.rawChannel=channel;return channel;}
  };window.api=await import('/src/online/roomConnection.ts');window.events={status:[],messages:[],errors:[],latency:[]};window.control=new AbortController();
    window.routes={onStatus:s=>events.status.push(s),onMessage:m=>events.messages.push(m),onError:e=>events.errors.push(e),onLatency:n=>events.latency.push(n)};`);
  return Object.assign(evaluate,{capture:()=>command('Page.captureScreenshot',{format:'png'})});
}
try {
  await until(async()=>{
    try { return (await fetch('http://127.0.0.1:'+debugPort+'/json/version')).ok; }
    catch { return false; }
  },'瀏覽器啟動');
  const a=await tab(),b=await tab();
  const code=await a(`window.room=await api.connectRoom(location.origin,null,true,control.signal,routes);room.code`);
  await b(`window.room=await api.connectRoom(location.origin,${JSON.stringify(code)},true,control.signal,routes);room.seat`);
  await until(()=>a("events.status.includes('connected')"),'房主資料通道');
  await until(()=>b("events.status.includes('connected')"),'加入者資料通道');
  assert.equal(await a("room.send({kind:'ready',elfId:'5000'})"),true,JSON.stringify({host:await a('events'),guest:await b('events')}));
  await until(()=>b("events.messages.some(m=>m.kind==='ready'&&m.elfId==='5000')"),'就緒訊息');
  assert.equal(await b("room.send({kind:'ready',elfId:'5053'})"),true);
  await until(()=>a("events.messages.some(m=>m.elfId==='5053')"),'雙向訊息');
  assert.equal(await a("room.send({kind:'ready',elfId:'x',untrusted:1})"),false);
  await b("setTimeout(()=>room.send({kind:'unready'}),400);true");
  await until(()=>a("events.messages.some(m=>m.kind==='unready')"),'延後送出的狀態');
  await until(()=>a("events.latency.length>0"),'心跳延遲回報',10_000);
  const latency=await a('events.latency[0]');
  assert.ok(Number.isFinite(latency)&&latency>=0);
  assert.deepEqual(await a('events.errors'),[]);
  assert.deepEqual(await b('events.errors'),[]);
  await b('room.close();true');
  await until(()=>a("events.status.includes('disconnected')"),'離房通知');
  assert.equal(await a("room.send({kind:'unready'})"),false);
  const second=await a("window.control=new AbortController();window.events={status:[],messages:[],errors:[],latency:[]};window.room=await api.connectRoom(location.origin,null,true,control.signal,routes);room.code");
  await b(`window.control=new AbortController();window.events={status:[],messages:[],errors:[],latency:[]};window.room=await api.connectRoom(location.origin,${JSON.stringify(second)},true,control.signal,routes);true`);
  await until(()=>a("events.status.includes('connected')"),'第二次房主連線');
  await until(()=>b("events.status.includes('connected')"),'第二次加入者連線');
  await a("rawChannel.send('{malformed');true");
  await until(()=>b("events.errors.includes('收到無效房間訊息')"),'畸形封包處理');
  await until(()=>a("events.status.includes('disconnected')"),'畸形封包關閉通道');
  await Promise.all([
    a("window.control=new AbortController();window.events={status:[],messages:[],errors:[],latency:[]};window.room=await api.connectRoom(location.origin,null,true,control.signal,routes,'peak');room.seat"),
    b("window.control=new AbortController();window.events={status:[],messages:[],errors:[],latency:[]};window.room=await api.connectRoom(location.origin,null,true,control.signal,routes,'peak');room.seat")
  ]);
  assert.equal(await a('room.code'),await b('room.code'));
  assert.notEqual(await a('room.seat'),await b('room.seat'));
  await until(()=>a("events.status.includes('connected')"),'隨機配對房主驗證');
  await until(()=>b("events.status.includes('connected')"),'隨機配對對手驗證');
  assert.equal(await a("room.send({kind:'ready',elfId:'5000'})"),true);
  await until(()=>b("events.messages.some(m=>m.kind==='ready')"),'配對後準備狀態');
  await a("room.close();true");await b("room.close();true");
  console.log('兩個瀏覽器隨機配對、相同房間、不同座位與驗證後準備通過');
  const ui = await tab();
  await ui("localStorage.setItem('seer_last_used_p1_team','offline-save-sentinel');location.href='/online.html';true");
  await until(()=>ui("!!document.querySelector('[data-online-modern-only]')"),'獨立遊戲大廳載入',45_000);
  assert.equal(await ui("!!document.querySelector('[aria-label=雙人連線]')"),false,'進入遊戲先編隊，不先開房間');
  assert.equal(await ui("document.querySelectorAll('[data-online-elf]').length"),6);
  assert.equal(await ui("[...document.querySelectorAll('button')].some(b=>/舊版|Legacy|經典版/.test(b.textContent))"),false,'雙人版不提供舊版跳轉');
  await ui("document.querySelector('[data-online-elf] button[aria-label^=培養]').click();true");
  await until(()=>ui("!!document.querySelector('[data-aegis-training]')"),'匹配前開啟原生新版培養');
  await ui(setField('input[aria-label="體力學習力數值"]','100'));
  await ui("document.querySelector('.atr-actions [aria-label=關閉]').click();true");
  await ui(setField('select[aria-label="雙人隊伍火焰"]','flame_purple'));
  await ui("document.querySelectorAll('[data-online-elf]')[1].querySelector(':scope>div button').click();true");
  await ui("[...document.querySelectorAll('button')].find(b=>b.textContent==='儲存配置').click();true");
  const preparation=await ui("JSON.parse(localStorage.getItem('seer_online_preparation_v1'))");
  assert.equal(preparation.configurations[preparation.team[0].id].evs.hp,100);assert.equal(preparation.equipment.flame,'flame_purple');assert.equal(preparation.starterId,preparation.team[1].id);
  await ui("location.reload();true");await until(()=>ui("document.querySelectorAll('[data-online-elf]').length===6"),'雙人配置重開保留');
  assert.equal(await ui("document.querySelector('select[aria-label=雙人隊伍火焰]').value"),'flame_purple');
  assert.equal(await ui("document.querySelector('[data-online-modern-only]').scrollWidth<=innerWidth"),true);
  fs.mkdirSync('shots/online-lobby',{recursive:true});fs.writeFileSync('shots/online-lobby/preparation.png',Buffer.from((await ui.capture()).data,'base64'));
  console.log('新版大廳先編隊、原生培養、首發/火焰保存重載、禁止舊版跳轉通過');

  await ui("[...document.querySelectorAll('button')].find(b=>b.textContent==='邀請對手').click();true");
  await until(()=>ui("!!document.querySelector('[aria-label=雙人連線]')"),'編隊後開啟邀請');
  assert.equal(await ui("localStorage.getItem('seer_last_used_p1_team')"),'offline-save-sentinel');
  await ui("document.querySelector('input[type=checkbox]').checked||document.querySelector('input[type=checkbox]').click();[...document.querySelectorAll('button')].find(b=>b.textContent==='建立房間').click();true");
  await until(()=>ui("!!document.querySelector('[aria-label=邀請碼]')"),'獨立版本建房');
  assert.equal(await ui("localStorage.getItem('seer_last_used_p1_team')"),'offline-save-sentinel');
  await ui("document.querySelector('[aria-label=關閉連線房間]').click();true");
  console.log('獨立連線網頁載入及建房通過，單機隊伍存檔原文保留');
  const matchedUiA=await tab(),matchedUiB=await tab();
  await Promise.all([matchedUiA("location.href='/online.html';true"),matchedUiB("location.href='/online.html';true")]);
  for(const page of [matchedUiA,matchedUiB]){
    await until(()=>page("!!document.querySelector('[data-online-modern-only]')"),'配對前遊戲大廳');
    await page("[...document.querySelectorAll('button')].find(b=>b.textContent==='開始匹配').click();true");
  }
  await until(()=>matchedUiA("document.body.textContent.includes('加密及身分已驗證')"),'配對介面雙方驗證');
  await until(()=>matchedUiB("document.body.textContent.includes('加密及身分已驗證')"),'配對介面對手驗證');
  assert.equal(await matchedUiA("document.body.textContent.includes('準備倒數')"),false,'雙方確認前不可自動選精靈');
  for(const page of [matchedUiA,matchedUiB]){
    await until(()=>page("[...document.querySelectorAll('button')].some(b=>b.textContent==='確認對手'&&!b.disabled)"),'取得對手名稱');
    await page("[...document.querySelectorAll('button')].find(b=>b.textContent==='確認對手').click();true");
  }
  await until(()=>matchedUiA("document.body.textContent.includes('準備倒數')"),'雙方確認後啟動倒數');

  await matchedUiA("window.realNow=Date.now;Date.now=()=>realNow()+31000;true");
  await until(()=>matchedUiA("[...document.querySelectorAll('button')].some(b=>b.textContent==='取消就緒')"),'準備超時自動選取');
  await until(()=>matchedUiB("document.body.textContent.includes('對手已就緒')"),'自動選取同步給對手');
  await matchedUiA("Date.now=realNow;[...document.querySelectorAll('button')].find(b=>b.textContent==='離開房間').click();true");
  await matchedUiB("document.querySelector('[aria-label=關閉連線房間]').click();true");
  console.log('正式雙人版介面配對、等待/準備倒數、超時自動選取與同步通過');
  await matchedUiA("document.querySelector('[aria-label=關閉連線房間]').click();[...document.querySelectorAll('button')].find(b=>b.textContent==='邀請對手').click();true");
  await matchedUiB("[...document.querySelectorAll('button')].find(b=>b.textContent==='邀請對手').click();true");

  await matchedUiA(setField('input[maxlength="24"]','巔峰邀請甲'));
  await matchedUiA("[...document.querySelectorAll('button')].find(b=>b.textContent==='建立房間').click();true");
  await until(()=>matchedUiA("!!document.querySelector('[aria-label=邀請碼]')"),'巔峰指定邀請建房');
  const invitation=await matchedUiA("document.querySelector('[aria-label=邀請碼]').textContent");
  await matchedUiB(setField('input[maxlength="24"]','巔峰邀請乙'));
  await matchedUiB(setField('input[maxlength="16"]',invitation));
  // Guest selection is intentionally different: the host owns the invited room's mode.
  assert.equal(await matchedUiB("document.querySelector('.peer-room select').disabled"),true);
  await matchedUiB("document.querySelector('input[type=checkbox]').checked||document.querySelector('input[type=checkbox]').click();document.querySelector('form').requestSubmit();true");
  for(const page of [matchedUiA,matchedUiB])await until(()=>page("[...document.querySelectorAll('button')].some(b=>b.textContent==='確認對手'&&!b.disabled)"),'指定對手身分到齊');
  assert.ok(await matchedUiA("document.body.textContent.includes('巔峰邀請乙')"));
  assert.ok(await matchedUiB("document.body.textContent.includes('巔峰邀請甲')&&document.body.textContent.includes('模式：巔峰')"));
  await matchedUiA("[...document.querySelectorAll('button')].find(b=>b.textContent==='確認對手').click();true");
  assert.equal(await matchedUiA("document.body.textContent.includes('準備倒數')"),false,'單方確認不開始倒數');
  await matchedUiB("[...document.querySelectorAll('button')].find(b=>b.textContent==='確認對手').click();true");
  await until(()=>matchedUiA("document.body.textContent.includes('準備倒數')"),'指定巔峰雙方確認');
  await matchedUiB("[...document.querySelectorAll('button')].find(b=>b.textContent==='取消對手確認').click();true");
  await until(()=>matchedUiA("!document.body.textContent.includes('準備倒數')"),'撤回確認停止準備倒數');
  await matchedUiA("[...document.querySelectorAll('button')].find(b=>b.textContent==='離開房間').click();true");
  await matchedUiB("document.querySelector('[aria-label=關閉連線房間]').click();true");
  console.log('巔峰指定邀請、玩家名稱、房主模式繼承、雙方確認與撤回通過');


  console.log(`真實 Edge 雙頁 WebRTC 通過，雙向就緒、版本握手、訊息驗證、心跳 RTT ${latency} ms 與斷線皆已驗證（本機直連）`);
} finally {
  for(const socket of sockets)socket.close();
  closePetTestBrowser(child,profile);
  await vite.close();
  server.closeAllConnections();
  await new Promise<void>(done=>server.close(()=>done()));
}
