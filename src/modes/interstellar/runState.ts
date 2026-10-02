import { DIFFICULTY_MODIFIERS, INTERSTELLAR_COLLECTIBLES } from '../../data/interstellarData';
import { generateLayerMap } from './map';
import { isAliveBySurvivalRule } from '../../battle/survivalRules';
export const RUN_KEY = 'INTERSTELLAR_ACTIVE_RUN';
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
export const newRunId = () => globalThis.crypto.randomUUID();
export function loadRun(storage: Storage): any | null {
  const raw = storage.getItem(RUN_KEY);
  if (!raw) return null;
  try {
    const run = JSON.parse(raw);
    if (!run || !Array.isArray(run.layers) || !Array.isArray(run.runElves ?? [])) return null;
    return { ...run, schemaVersion: 1, revision: run.revision ?? 0 };
  } catch { return null; }
}
/** UI快照不可覆蓋開戰／結算後的新修訂，也不寫入已卸載UI的舊值。 */
export function saveRun(storage: Storage, snapshot: any): any {
  const current = loadRun(storage);
  if (storage.getItem(RUN_KEY) && !current) throw new Error('探索存檔損壞，已保留原始資料，未覆寫。');
  if (current?.runId && current.runId !== snapshot.runId) return current;
  if (current && current.revision > (snapshot.revision ?? 0)) return current;
  const next = { ...snapshot, schemaVersion: 1, revision: (current?.revision ?? 0) + 1 };
  storage.setItem(RUN_KEY, JSON.stringify(next));
  return next;
}
export function prepareBattle(run: any, id: string, rolls: number[], teams?: any): any {
  if (run.pendingBattle) return run;
  const node = run.layers.find((l: any) => l.id === run.currentLayer)?.nodes.find((n: any) => n.status === 'current') ?? run.layers.find((l: any) => l.id === run.currentLayer)?.nodes[0];
  if (!node) throw new Error('探索節點不存在');
  return { ...run, pendingBattle: { id, nodeId: node.id, layer: run.currentLayer, type: node.type, rolls, teams } };
}
export function settleBattle(run: any, id: string, winner: string, team?: any[]): any {
  const battle = run.pendingBattle;
  if (!battle || battle.id !== id || !['p1','p2','exit','draw'].includes(winner)) return run;
  const win = winner === 'p1'; const boss = battle.type === 'boss'; const elite = battle.type === 'elite';
  const beans = win ? boss ? 400 : elite ? 200 : 80 : 0;
  const multiplier = (run.selectedModifiers ?? []).reduce((m: number, key: string) => m + (DIFFICULTY_MODIFIERS.find(x => x.id === key)?.multiplier ?? 0), 1);
  const exp = win ? Math.floor((boss ? 300 : 100) * multiplier) : 0;
  const [drop, which, order, tier] = battle.rolls;
  const collectible = win && drop < (boss ? 1 : elite ? .6 : .2) ? INTERSTELLAR_COLLECTIBLES[Math.min(INTERSTELLAR_COLLECTIBLES.length-1, Math.floor(which*INTERSTELLAR_COLLECTIBLES.length))] : null;
  const vouchers = { ...run.vouchers };
  if (win && order < (boss ? 1 : elite ? .5 : .15)) { const key = boss || tier < .25 ? 'A' : 'B'; vouchers[key] = (vouchers[key] ?? 0) + 1; }
  let layers = run.layers.map((l: any) => l.id !== battle.layer ? l : { ...l, nodes: l.nodes.map((n: any) => n.id === battle.nodeId && win ? { ...n, occupied:true } : n) });
  let currentLayer = run.currentLayer; let fuel = winner === 'p2' ? Math.max(0,run.fuel-2) : run.fuel;
  if (win && boss && battle.layer < 6) { currentLayer = battle.layer+1; if (!layers.some((l: any) => l.id === currentLayer)) layers = [...layers,{id:currentLayer,name:`第 ${currentLayer} 星區`,nodes:generateLayerMap(currentLayer)}]; fuel = Math.min(run.maxFuel ?? 10,fuel+3); }
  const runElves = (run.runElves ?? []).map((elf: any) => {
    const after = team?.find(x => (x.battleId || x.id) === (elf.battleId || elf.id));
    if (!after) return elf;
    return {...elf,maxHp:after.maxHp,survivalRule:after.survivalRule,currentHp:Math.min(after.maxHp,isAliveBySurvivalRule(after.currentHp,after.survivalRule)?after.currentHp:Math.max(0,after.currentHp)),skills:elf.skills.map((s: any,i: number)=>({...s,pp:after.skills[i]?.pp??s.pp})),explorationVitals:true};
  });
  return { ...run, layers, currentLayer, fuel, runElves, piratePrincipal:win||winner==='p2'?0:run.piratePrincipal, saerBeans:run.saerBeans+beans+(win?(run.piratePrincipal??0):0), earnedExp:run.earnedExp+exp, vouchers,
    collectibles:collectible ? [...run.collectibles,collectible] : run.collectibles, pendingBattle:null,
    lastBattleResult:{ isWin:win,outcome:winner,beans,exp,collectible,recoveredPrincipal:win?(run.piratePrincipal??0):0 }, lastSettledBattleId:id };
}
export function settleStoredBattle(storage: Storage, runId: string, id: string, winner: string, team?: any[]): any {
  const run = loadRun(storage); if (!run || run.runId !== runId) return null;
  const next = settleBattle(run,id,winner,team); return next === run ? run : saveRun(storage,next);
}
export function consumePotion(storage: Storage, runId: string, id: string, max: number): boolean {
  const run=loadRun(storage); if (!run || run.runId!==runId || run.pendingBattle?.id!==id || (run.potionUsage??0)>=max) return false;
  saveRun(storage,{...run,potionUsage:(run.potionUsage??0)+1}); return true;
}
export function moveRun(run: any, targetId: string): any | null {
  const layer=run.layers.find((l: any)=>l.id===run.currentLayer);
  const from=layer?.nodes.find((n: any)=>n.status==='current') ?? layer?.nodes.find((n: any)=>n.id.endsWith('-start'));
  const target=layer?.nodes.find((n: any)=>n.id===targetId);
  if (run.fuel<1 || run.pendingBattle || !target || !from?.connections.includes(targetId)) return null;
  return {...run,fuel:run.fuel-1,layers:run.layers.map((l: any)=>l!==layer?l:{...l,nodes:l.nodes.map((n: any)=>n===target?{...n,status:'current'}:n===from?{...n,status:n.occupied?'occupied':'unvisited'}:n)})};
}
/** 招募確認才原子扣券／鑽石；失敗不改任何資源。 */
export function recruitRun(run: any, tier: string, elf: any, cost: number, replaceIndex: number): any | null {
  if (!Number.isFinite(cost) || cost<0 || run.diamonds<cost || !(run.vouchers[tier]>0)) return null;
  const team=[...run.runElves];
  if(replaceIndex>=0) {if(replaceIndex>=team.length)return null;team[replaceIndex]=elf;}
  else {if(team.length>=6)return null;team.push(elf);}
  return {...run,diamonds:run.diamonds-cost,vouchers:{...run.vouchers,[tier]:run.vouchers[tier]-1},runElves:team};
}
