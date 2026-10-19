// 專屬機制包裝（legacy_handler）的首頁精簡封裝：用精靈自己的原文還原，結果必須與完整來源逐一深比較相同；原文變更即不套用。
import assert from 'node:assert/strict';
import {DEFAULT_ELVES} from '../src/data/defaultElves';
import {MIGRATED_LEGACY_WRAPPED_KITS} from '../src/data/migratedLegacyWrappedKits';
import {applyReviewedSkillKits} from '../src/data/reviewedKitCatalogue';
import {isLegacyWrappedKit} from '../src/blocks/ops/legacyHandler';
import {validateKit} from '../src/effects/kitValidation';
const isDeferred=(id:string)=>/^(arena_|wiki_)/.test(id);
const homeDefs=MIGRATED_LEGACY_WRAPPED_KITS.filter(d=>d.elfIds.every(id=>!isDeferred(id)));
// 包裝份數會隨遷移（拆成真 Kit）持續減少，不能釘死固定下限；只要還有首頁包裝，就逐份驗證（下方迴圈）。全部遷完時此檢查自然不再有對象。
assert.ok(homeDefs.length>0||MIGRATED_LEGACY_WRAPPED_KITS.length===0,'首頁包裝定義不應為空（除非整份包裝清單已全部遷移完）');
const pick=(elf:any,d:any):any=>d.kind==='soul'?elf.soulMark:d.kind==='trait'
  ?[elf.trait,elf.alienTraits?.gen2Trait,elf.alienTraits?.exclusiveTrait,...(elf.alienTraits?.exclusiveTraits||[]),elf.alienTraits?.alienTrait,elf.alienTraits?.generalTrait].filter(Boolean).find((t:any)=>t.name===d.name&&t.description===d.description)
  :[...elf.skills,...(elf.skillPool||[])].find((s:any)=>s.name===d.name&&s.description===d.description);
let checks=0;
for(const d of homeDefs){
  const elf=DEFAULT_ELVES.find(e=>String(e.id)===d.elfIds[0]);assert.ok(elf,`找不到精靈 ${d.elfIds[0]}`);
  const target=pick(elf,d);assert.ok(target,`${d.elfIds[0]}/${d.name} 原文需存在`);
  assert.deepEqual(target.kit,d.kit,`${d.elfIds[0]}/${d.name} 還原結果需與完整來源相同`);
  assert.equal(target.effectMode,'registry');assert.ok(isLegacyWrappedKit(target.kit));validateKit(target.kit);
  // 原文只改一個字：不得套用
  const edited=structuredClone(elf);const t2=pick(edited,d);t2.description+='。';t2.effectMode='auto';delete t2.kit;
  const reapplied=applyReviewedSkillKits(edited);const t3=pick(reapplied,{...d,description:t2.description});
  assert.ok(t3&&!t3.kit?.length,`${d.elfIds[0]}/${d.name} 原文變更後不得沿用包裝`);
  checks++;
}
console.log(`首頁專屬機制包裝精簡封裝：${checks}份依精靈原文完整還原、原文變更即不套用。`);
