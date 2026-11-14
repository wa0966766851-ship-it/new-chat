import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try {
 const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElves.ts');
 const {HERKA_SEED}=await h.server.ssrLoadModule('/src/data/herka.ts');
 const {NADOLE_SEED}=await h.server.ssrLoadModule('/src/data/nadole.ts');
 const {FINAL_GAIA_SEED}=await h.server.ssrLoadModule('/src/data/finalGaia.ts');
 const {DIFU_SEED}=await h.server.ssrLoadModule('/src/data/difu.ts');
 const {NAIFEN_SEED}=await h.server.ssrLoadModule('/src/data/naifen.ts');
 const {PEGASUS_SEED}=await h.server.ssrLoadModule('/src/data/pegasus.ts');
 const {TIANXIE_SEED}=await h.server.ssrLoadModule('/src/data/tianxie.ts');
 const {sequenceIssue,skillPropertyIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 for(const seed of [HERKA_SEED,NADOLE_SEED,FINAL_GAIA_SEED,DIFU_SEED,NAIFEN_SEED,PEGASUS_SEED,TIANXIE_SEED]) {
  const matches=DEFAULT_ELVES.filter((e:any)=>e.id===seed.id);
  assert.equal(matches.length,1,`${seed.name}正式入口唯一且不與既有ID撞號`);
  const elf=matches[0];
  assert.equal(elf.name,seed.name);assert.deepEqual(elf.baseStats,seed.baseStats);
  assert.equal(elf.soulMark.effectMode,'kit');assert.deepEqual(elf.soulMark.kit,seed.soulMark.kit);
  assert.equal(elf.skills.length,5);assert.equal(elf.skills.filter((s:any)=>s.isFifthSkill).length,1);
  assert.equal(elf.skills[4].isFifthSkill,true);assert.equal(elf.skillPool.length,5);
  for(const s of elf.skills)h.assertKitOnly(s);
  for(const entry of [...elf.soulMark.kit,...elf.skills.flatMap((s:any)=>s.kit)])
   assert.equal(entry.codeId==='effect_sequence'?sequenceIssue(entry.params.clause,entry.node):skillPropertyIssue(entry),null,`${seed.name}/${entry.customText}`);
 }
 assert.equal(new Set(DEFAULT_ELVES.map((e:any)=>e.id)).size,DEFAULT_ELVES.length);
 console.log('newBatchRoster passed: seven authored seeds connected to actual roster, unique IDs and explicit fifth skills');
} finally {await h.close();}
