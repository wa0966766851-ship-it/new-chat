import assert from 'node:assert/strict';
import {BATTLE_ITEMS} from '../src/utils/battleHelpers';
import {StatusRegistry} from '../src/effects/statusRegistry';
import {canonicalStatusName} from '../src/effects/statusIdentity';
// 2026-11-14：每種異常至少有一款藥劑可附加；每款藥劑最多 2 種異常，且同類型（控制／弱化／其他）最多 1 種。
const cls=(s:string)=>{const c=(StatusRegistry as any)[canonicalStatusName(s)]?.categories||[];return c.includes('CONTROL')?'控制':c.includes('WEAKENING')?'弱化':'其他';};
const abnormal=Object.entries(StatusRegistry as any).filter(([k,v]:any)=>canonicalStatusName(k)===k&&!v.categories.includes('AUXILIARY')&&!v.categories.includes('BOSS_ONLY')).map(([k])=>k);
const covered=new Set(BATTLE_ITEMS.flatMap(i=>(i.inflictStatuses||[]).map(s=>canonicalStatusName(s.name))));
const missing=abnormal.filter(s=>!covered.has(s));
assert.deepEqual(missing,[],`缺少藥劑：${missing.join('、')}`);
for(const item of BATTLE_ITEMS){
  const list=(item.inflictStatuses||[]).map(s=>s.name);
  if(!list.length)continue;
  assert.ok(list.length<=2,`${item.name} 超過 2 種異常`);
  const classes=list.map(cls);
  assert.equal(new Set(classes).size,classes.length,`${item.name} 同類型異常重複：${list.join('、')}`);
  for(const s of list)assert.ok((StatusRegistry as any)[canonicalStatusName(s)],`${item.name}：未知異常 ${s}`);
  assert.equal(new Set(BATTLE_ITEMS.map(i=>i.id)).size,BATTLE_ITEMS.length,'藥劑 id 不重複');
}
console.log(`藥劑異常覆蓋：${abnormal.length} 種異常全數可附加；複合藥劑 ≤2 種且不同類型`);
