// 正式建置的Worker跨執行緒測試，不依賴DOM、不修改實戰狀態。
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { createServer } from 'vite';
const assets = resolve('dist/assets');
const entries = readdirSync(assets).filter(f => /^worker-.*\.js$/.test(f));
assert.equal(entries.length, 1, '請先建置以取得唯一正式Worker入口');
const workerUrl = pathToFileURL(resolve(assets, entries[0])).href;
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_AI_SETTINGS } = await server.ssrLoadModule('/src/battle/ai/settings.ts');
const skill = (name, power) => ({ name, power, pp: 20, maxPp: 20, type: '普通', category: power ? '物理' : '屬性', description: '', isSureHit: true });
const elf = (id,speed) => ({ id, name: id, battleId: id, level: 100, type: '普通', currentHp: 5000, maxHp: 5000,
  baseStats:{hp:100,atk:100,def:100,spatk:100,spdef:100,speed:100},
  calculatedStats:{hp:5000,atk:300,def:200,spatk:300,spdef:200,speed},statStages:{},skills:[skill('空等',0),skill('攻擊',60)]});
const engine = createBattleEngine({ initialP1Team:[elf('A',200)],initialP2Team:[elf('B',100)],p1StarterId:'A',p2StarterId:'B',battleMode:'PVP',preparedTeams:true,isFast:()=>true });
const state = structuredClone(engine.getState());state.p1ItemInventory={};state.p2ItemInventory={};
const before = structuredClone(state);
// 僅補Node不存在的WebWorker通訊介面。實際被import的是Vite建置出的正式Worker及其依賴。
const worker = new Worker(`
  const {parentPort} = await import('node:worker_threads');
  globalThis.self=globalThis;
  globalThis.postMessage=message=>parentPort.postMessage(message);
  parentPort.on('message',data=>globalThis.onmessage?.({data}));
  await import(${JSON.stringify(workerUrl)});
`,{eval:true,type:'module'});
let timer;
try {
  const result = await new Promise((ok,no)=>{
    timer=setTimeout(()=>no(new Error('建置Worker載入或推演逾時')),15000);
    worker.on('error',no);
    worker.on('message',m=>{
      if(m.type==='ready')worker.postMessage({id:1,assumptions:[],request:{state,side:'p1',seed:7,settings:{...DEFAULT_AI_SETTINGS,difficulty:'hard',budgetMs:2000}}});
      if(m.type==='error'||m.type==='boot-error')no(new Error(m.error));
      if(m.type==='done')ok(m.report);
    });
  });
  assert.equal(result.mode,'planner');assert.ok(result.completedSweeps>0);
  assert.equal(result.action.kind,'skill');assert.equal(result.action.slot,1);
  assert.deepEqual(state,before);
  console.log('✓ 正式Worker載入、跨執行緒傳輸、真正推演、選招與原局隔離：',result.simulations,'分支',Math.round(result.elapsedMs),'ms');
} finally {clearTimeout(timer);await worker.terminate();engine.unmount();await server.close();}
