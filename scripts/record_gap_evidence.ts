/** 只為本批重新執行測試後登記部分情境證據；不刷新其他批次、不授予完整驗收。 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { digest } from './lib/effectAudit';
import { MIGRATED_GAP_SKILL_KITS } from '../src/data/migratedGapSkillKits';
const testFile='tests/migratedGapSkillKits.semantic.test.ts';
const paths=[testFile,'tests/helpers/migrationHarness.ts','src/data/migratedGapSkillKits.ts','src/data/migratedSequenceSkillKits.ts',
  'src/data/reviewedKits.compressed.json','src/data/reviewedKitCatalogue.ts','src/data/defaultElves.ts','src/data/defaultElvesLoaded.ts',
  'src/data/reviewedKits.homepage.json','src/data/reviewedKits.deferred.json','src/effects/collectionOperations.ts','src/effects/resourceSnapshotOperations.ts','src/effects/markQueries.ts','src/effects/stageQueries.ts','src/data/savedSkillCorrections.ts','src/battle/damageReduction.ts','src/battle/marks.ts',
  'src/effects/sequenceContract.ts','src/effects/sequenceClosureContract.ts','src/effects/sequenceRuntime.ts','src/effects/effectConnection.ts',
  'src/effects/kitValidation.ts','src/effects/parentheticalSemantics.ts','src/effects/connectedEffects.ts','src/effects/battleEventRegistry.ts','src/effects/skillProperty.ts',
  'src/effects/effectSystem.schema.ts','src/effects/effectNodes.ts','src/effects/types.ts','src/blocks/model.ts',
  'src/effects/statusRegistry.ts','src/effects/elves/canglan/registry.ts','src/blocks/runtime.ts','src/blocks/registry.ts',
  'src/effects/actionMarkScale.ts','src/effects/resourceMarkLocks.ts','src/effects/formationLifecycle.ts','src/effects/formationTimerOwnership.ts','src/data/hamo.ts','src/data/hamoSource.json','src/data/descriptionSources.ts',
  'src/battle/contextBuilders.ts','src/battle/targetedDamage.ts','src/effects/damageBases.ts','src/battle/hpDrain.ts','src/battle/damageSemantics.ts','src/battle/timers.ts','src/battle/stateScopes.ts',
  'src/battle/actionDamageModifiers.ts','src/battle/advancedDamageModifiers.ts','src/battle/markRecovery.ts','src/battle/timedReactions.ts',
  'src/battle/actionDefenseModifiers.ts','src/battle/statusOrigin.ts','src/battle/recoveryOrigin.ts','src/battle/skillSlot.ts',
  'src/battle/timedConstraints.ts','src/battle/attackDefense.ts','src/battle/damageBlocking.ts',
  'src/effects/markProgram.ts','src/effects/statusCollection.ts','src/effects/sequenceClosureOperations.ts','src/effects/newElfOperations.ts','src/effects/newElfLifecycle.ts',
  'src/data/traitsRegistry.ts','src/utils/damageCalculator.ts',
  'src/engine/battleEngine.ts','src/engine/nodes.ts','src/utils/battleHelpers.ts','src/components/BlocklyBuilder.tsx'];
const hashes=()=>paths.map(path=>({path,sha256:digest(readFileSync(path))}));
const before=hashes(),result=spawnSync(process.execPath,['--import','tsx',testFile],{stdio:'inherit'});
assert.equal(result.status,0,'測試未通過，不能寫入證據');
assert.deepEqual(hashes(),before,'測試期间輸入有改動，不能寫入證據');
const scenarios={
  '弱水三千':{anchor:'完整原文匹配、合約及Blockly參數保存重載',scenario:'P1/P2；完整原文/持有者/模式；反轉、弱化失敗、低血邊界、護罩、封印、3回合失效與舊handler不重播',expected:'對手atk+2→-3，自身+2；HP4999吸取8000、5000吸取4000；失效第4回合結束；不清對手免疫計時器'},
  '霜凍之錮':{anchor:'霜凍之錮正式來源路由與Blockly往返',scenario:'P1/P2；完整原文/持有者/模式；異常成功/免疫失敗；低血每回合重判、4回合反彈及吸取、封印、Blockly改值執行',expected:'HP5000/12000首次吸取6000、之後4000；半血吸取4000；第5回合不吸取且可中毒；編輯1回合1/4後只扣3000'},
};
const evidence=MIGRATED_GAP_SKILL_KITS.flatMap(def=>def.kit.map(e=>({
  id:`gap-${def.elfIds[0]}-${def.name}-${e.order}`,elfId:def.elfIds[0],entry:def.name,fragment:e.customText,
  ...scenarios[def.name as keyof typeof scenarios],remaining:'尚待完整交叉情境、BOSS、未命中、下場/繼承、消除及所有固有查詢逐句驗收'+(def.name==='霜凍之錮'?'；霜凍來源為保留的嵌入舊技能，TXT沒有這一招':''),
})));
writeFileSync('docs/audits/gap-skill-evidence.json',JSON.stringify({schemaVersion:1,note:'本批實際重測的部分證據；不是完整定義或精靈驗收。',testFile,
  testSha256:before[0].sha256,lastPassed:new Date().toISOString(),inputs:before.filter(i=>i.path!==testFile),evidence},null,2)+'\n');
console.log(`${evidence.length}筆部分證據已登記，其他批次未刷新`);
