import assert from 'node:assert/strict';
import { INTERSTELLAR_COLLECTIBLES } from '../src/data/interstellarData';
let passed=0; const t=(n:string,f:()=>void)=>{f();passed++;console.log(`pass ${n}`);};
t('空包收藏品 effect 恆等，文案已標尚未實裝', ()=>{
  for (const id of ['dmg_reduction_bead','justin_arm','silver_wing','six_wing','void_shield_gen']) {
    const c=INTERSTELLAR_COLLECTIBLES.find(x=>x.id===id)!;
    assert.deepEqual(c.effect({atk:1}),{atk:1});
    assert.match(c.description,/尚未實裝/);
  }
});
t('奈米為一次性面板，非每回合', ()=>{
  const c=INTERSTELLAR_COLLECTIBLES.find(x=>x.id==='nanobot_swarm')!;
  assert.deepEqual(c.effect({}),{hp:50});
  assert.match(c.description,/一次性/);
});
console.log(`interstellar collectibles: ${passed} passed`);
