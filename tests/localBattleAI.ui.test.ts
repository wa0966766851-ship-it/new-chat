import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
const dom = new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/'});
const saved = new Map<string,PropertyDescriptor|undefined>();
for (const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true})) {
  saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
  Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
}
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel:'silent' });
const React = await import('react'), {createRoot}=await import('react-dom/client');
const {BattleAISettingsPanel} = await server.ssrLoadModule('/src/components/BattleAISettingsPanel.tsx');
const {BattleAIQuickSettings} = await server.ssrLoadModule('/src/components/BattleAIQuickSettings.tsx');
const {readAISettings,writeAISettings,publishDecision,clearDecisions} = await server.ssrLoadModule('/src/battle/ai/settings.ts');
const root=createRoot(dom.window.document.getElementById('root')!);
try {
  await React.act(async()=>{root.render(React.createElement(React.Fragment,null,React.createElement(BattleAISettingsPanel),React.createElement(BattleAIQuickSettings)));});
  const group = (label:string) => dom.window.document.querySelector<HTMLElement>(`[role="radiogroup"][aria-label="${label}"]`)!;
  const select = (label:string) => ({
    get value(){return group(label).querySelector<HTMLElement>('button[data-active="true"]')?.dataset.value;},
    get options(){return group(label).querySelectorAll('button');},
  });
  const pick = (label:string,value:string) => React.act(async()=>{group(label).querySelector<HTMLButtonElement>(`button[data-value="${value}"]`)!.click();});
  assert.equal(select('AI決策方式').value,'planner');
  await pick('AI難度','hard');
  assert.equal(readAISettings().difficulty,'hard');
  const change=pick;
  assert.equal(select('首頁敵方AI風格').options.length,5);
  assert.equal(select('首頁敵方AI風險').options.length,3);
  await change('首頁敵方AI風格','disruptive');await change('首頁我方託管風格','defensive');
  await change('首頁敵方AI風險','reckless');await change('首頁我方託管風險','conservative');
  assert.equal(select('AI風格').value,'disruptive');assert.equal(select('我方託管風格').value,'defensive');
  assert.equal(select('AI風險傾向').value,'reckless');assert.equal(select('我方託管風險').value,'conservative');
  await change('AI風格','sustain');assert.equal(select('首頁敵方AI風格').value,'sustain');
  assert.equal(readAISettings().ownStyle,'defensive');assert.equal(readAISettings().ownRisk,'conservative');
  await React.act(async()=>{publishDecision({side:'p2',turn:3,mode:'planner',forced:false,action:{kind:'skill',slot:0},
    candidates:[{action:{kind:'skill',slot:0},label:'護盾組合',score:22,positionDelta:22,strategyBonus:0,reason:'實際推演',samples:2,worst:10,parts:[]}],
    elapsedMs:120,simulations:4,completedSweeps:2,timedOut:false,assumptions:[]});});
  assert.ok(dom.window.document.body.textContent!.includes('P2 第 3 回合 · 護盾組合'));
  assert.ok(dom.window.document.body.textContent!.includes('4 分支'));
  await React.act(async()=>{dom.window.document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();});
  assert.equal(readAISettings().explain,false);
  assert.ok(!dom.window.document.body.textContent!.includes('P2 第 3 回合'));
  await React.act(async()=>{dom.window.document.querySelector<HTMLButtonElement>('button')!.click();});
  assert.equal(readAISettings().difficulty,'balanced');
  await React.act(async()=>{clearDecisions();});
  assert.ok(!dom.window.document.body.textContent!.includes('P2 第 3 回合'));
  const storagePrototype = Object.getPrototypeOf(dom.window.localStorage);
  const setItem = storagePrototype.setItem;
  try {
    storagePrototype.setItem = () => { throw new Error('quota'); };
    await React.act(async()=>{writeAISettings({...readAISettings(),difficulty:'easy'});});
    assert.equal(readAISettings().difficulty,'easy');
    assert.equal(select('AI難度').value,'easy');
  } finally { storagePrototype.setItem = setItem; }
  await React.act(async()=>{writeAISettings({...readAISettings(),difficulty:'balanced'});});
  assert.equal(readAISettings().difficulty,'balanced');
  // 首頁本地 AI 策略：預設收合、摘要、展開記憶、雙人同屏隱藏
  const doc=dom.window.document;
  const toggleBtn=()=>doc.querySelector<HTMLButtonElement>('[data-testid="homepage-ai-settings"] button[aria-expanded]')!;
  const rowsOpen=()=>doc.querySelector('#homepage-ai-rows')!.getAttribute('data-open');
  const summary=()=>doc.querySelector('[data-testid="homepage-ai-summary"]')!.textContent;
  await React.act(async()=>root.unmount());
  dom.window.localStorage.removeItem('seer.homeAIStrategyOpen');
  writeAISettings({...readAISettings(),style:'aggressive',ownStyle:'follow',difficulty:'balanced',risk:'balanced',ownRisk:'follow'});
  const root2=createRoot(doc.getElementById('root')!);
  await React.act(async()=>{root2.render(React.createElement(BattleAIQuickSettings));});
  assert.equal(toggleBtn().getAttribute('aria-expanded'),'false');assert.equal(rowsOpen(),'false');
  assert.equal(summary(),'強攻・跟隨・標準');
  await change('首頁我方託管風格','defensive');await change('首頁AI難度','hard');await change('首頁敵方AI風險','reckless');
  assert.equal(summary(),'強攻・穩守・深入・風險激進');
  await React.act(async()=>{doc.querySelector<HTMLElement>('[data-testid="homepage-ai-settings"] h2')!.click();});
  assert.equal(toggleBtn().getAttribute('aria-expanded'),'true');assert.equal(rowsOpen(),'true');
  assert.equal(dom.window.localStorage.getItem('seer.homeAIStrategyOpen'),'1');
  await React.act(async()=>root2.unmount());
  const root3=createRoot(doc.getElementById('root')!);
  await React.act(async()=>{root3.render(React.createElement(BattleAIQuickSettings));});
  assert.equal(rowsOpen(),'true');
  await React.act(async()=>{toggleBtn().click();});
  assert.equal(rowsOpen(),'false');assert.equal(dom.window.localStorage.getItem('seer.homeAIStrategyOpen'),'0');
  const proto=Object.getPrototypeOf(dom.window.localStorage),getItem=proto.getItem;
  try{proto.getItem=()=>{throw new Error('blocked');};
    await React.act(async()=>root3.unmount());const root4=createRoot(doc.getElementById('root')!);
    await React.act(async()=>{root4.render(React.createElement(BattleAIQuickSettings));});
    assert.equal(rowsOpen(),'false');await React.act(async()=>root4.unmount());
  } finally{proto.getItem=getItem;}
  const root5=createRoot(doc.getElementById('root')!);
  await React.act(async()=>{root5.render(React.createElement(BattleAIQuickSettings,{pve:false}));});
  assert.ok(!doc.querySelector('[data-testid="homepage-ai-settings"]'),'雙人同屏不顯示本地 AI 策略');
  await React.act(async()=>root5.unmount());
  const startSrc=(await import('node:fs')).readFileSync('src/components/StartScreen.tsx','utf8');
  assert.ok(/battleMode === 'PVE' && <Suspense/.test(startSrc),'雙人同屏時首頁不載入 AI 策略區塊');
  console.log('✓ AI設定UI：掛載、選型、儲存、即時決策說明、關閉說明與重設通過');
} finally {
  try{await React.act(async()=>root.unmount());}catch{}await server.close();dom.window.close();
  for(const [key,descriptor] of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete (globalThis as any)[key];
}
