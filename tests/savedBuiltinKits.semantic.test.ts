import assert from 'node:assert/strict';
import {DEFAULT_ELVES} from '../src/data/defaultElvesLoaded';
import {applySavedSkillCorrections} from '../src/data/savedSkillCorrections';
import {effectDefinitionEntries} from '../src/battle/effectSources';
import {defaultEffectKit} from '../src/effects/effectPresets';
import {syncOtherworldReyDescriptions} from '../src/data/otherworldReyDescriptions';

let restored=0;
for(const canonical of DEFAULT_ELVES){
  const legacy=structuredClone(canonical);
  const definitions=(elf:typeof legacy)=>[...effectDefinitionEntries(elf),...elf.skills,...elf.skillPool||[]];
  // entries 是顯示視圖；需清理真正存檔中的定義。
  for(const d of [legacy.soulMark,legacy.trait,...Object.values(legacy.alienTraits||{}).flat(),...legacy.skills,...legacy.skillPool||[]]){
    if(!d||typeof d!=='object'||!('name' in d))continue;
    delete (d as any).kit;delete (d as any).effectMode;
  }
  delete legacy.kit;
  legacy.isCustom=true; // 改配裝的內建 ID 也走這條路。
  legacy.skills[0].pp=1;
  const snapshot=structuredClone(legacy);
  const fixed=syncOtherworldReyDescriptions(applySavedSkillCorrections(legacy,DEFAULT_ELVES));
  assert.deepEqual(legacy,snapshot,'載入修復不得修改原存檔');
  assert.equal(fixed.skills[0].pp,1);
  for(const def of definitions(canonical).filter(d=>d.kit?.length)){
    const match=definitions(fixed).find(d=>d.name===def.name&&d.description===def.description);
    assert.ok(match,`${canonical.id}/${def.name}存在`);
    assert.deepEqual(match.kit,def.kit,`${canonical.id}/${def.name}真正積木完整恢復`);
    const draft=defaultEffectKit(match,'power' in match?'skill':'soul');
    assert.equal(draft.origin,'authored');assert.equal(draft.complete,true,`${canonical.id}/${def.name}唯讀不再誤顯示0積木`);
    restored++;
  }
}
assert.ok(restored>=397);
console.log(`✓ ${DEFAULT_ELVES.length}隻內建精靈舊存檔（含改配裝）恢復${restored}份出戰／技能池／魂印／特質定義；唯讀路由、原資料與PP保留`);
