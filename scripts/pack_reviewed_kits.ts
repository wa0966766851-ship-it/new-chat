import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { gunzipSync, strFromU8 } from 'fflate';
import { REVIEWED_SKILL_KITS } from '../src/data/reviewedSkillKits';
import { REVIEWED_SEQUENCE_SKILL_KITS } from '../src/data/reviewedSequenceSkillKits';
import { MIGRATED_SEQUENCE_SKILL_KITS } from '../src/data/migratedSequenceSkillKits';
import { MIGRATED_HOLY_MILES_SKILL_KITS } from '../src/data/migratedHolyMilesKits';
import { MIGRATED_ARENA12_SKILL_KITS } from '../src/data/migratedArena12SkillKits';
import { MIGRATED_ARENA13_FENGHAO_SKILL_KIT } from '../src/data/migratedArena13FenghaoKit';
import { MIGRATED_ARENA16_YOUMO_SKILL_KIT } from '../src/data/migratedArena16YoumoKit';
import { MIGRATED_ARENA16_AIDA_SKILL_KIT } from '../src/data/migratedArena16AidaKit';
import { MIGRATED_ARENA16_YARAN_SKILL_KIT } from '../src/data/migratedArena16YaranKit';
import { MIGRATED_ARENA16_MONSTER_SKILL_KIT } from '../src/data/migratedArena16MonsterKit';
import { MIGRATED_HAMO_YUTIANZHEN_SKILL_KIT } from '../src/data/migratedHamoYutianzhenKit';
import { MIGRATED_HAMO_ELEMENTAL_SKILL_KITS } from '../src/data/migratedHamoElementalKits';
import { MIGRATED_DIMENSIONAL_WANGSHI_SKILL_KIT } from '../src/data/migratedDimensionalWangshiKit';
import { MIGRATED_FINAL_DELU_SOUL_KIT, MIGRATED_FINAL_BELIENTE_SOUL_KIT, MIGRATED_FINAL_ODIN_RAVEN_KIT } from '../src/data/migratedFinalOdinDeluBelienteKits';
import { MIGRATED_FINAL_MARS_SKILL_KITS, MIGRATED_FINAL_DRAGON_SOUL_KIT } from '../src/data/migratedFinalMarsLanDragonKits';
import { MIGRATED_FINAL_EXTRA_TRAIT_KITS, MIGRATED_FINAL_EXTRA_SOUL_KITS } from '../src/data/migratedFinalExtraTraitKits';
import { MIGRATED_ODIN_RAGNAROK_SKILL_KIT } from '../src/data/migratedOdinRagnarokKit';
import { MIGRATED_HAMO_LIN_SOUL_KIT } from '../src/data/migratedHamoLinSoulKit';
import { validateKit } from '../src/effects/kitValidation';
import { REVIEWED_SOUL_KITS } from '../src/data/reviewedSoulKits';
import { MIGRATED_TRAIT_KITS } from '../src/data/migratedTraitKits';
import {packJson} from './lib/packJson';
import {isLegacyWrappedKit} from '../src/blocks/ops/legacyHandler';
import {textFingerprint} from '../src/blocks/ops/legacyWrappedKit';
import {unpackJson} from '../src/data/packedJson';
import {unpackReviewedKits} from '../src/data/packedReviewedKits';
const source = [...REVIEWED_SKILL_KITS, ...REVIEWED_SEQUENCE_SKILL_KITS, ...MIGRATED_SEQUENCE_SKILL_KITS,...MIGRATED_HOLY_MILES_SKILL_KITS,...MIGRATED_ARENA12_SKILL_KITS,...MIGRATED_ARENA13_FENGHAO_SKILL_KIT,...MIGRATED_ARENA16_YOUMO_SKILL_KIT,...MIGRATED_ARENA16_AIDA_SKILL_KIT,...MIGRATED_ARENA16_YARAN_SKILL_KIT,...MIGRATED_ARENA16_MONSTER_SKILL_KIT,...MIGRATED_HAMO_YUTIANZHEN_SKILL_KIT,...MIGRATED_HAMO_ELEMENTAL_SKILL_KITS,...MIGRATED_DIMENSIONAL_WANGSHI_SKILL_KIT,MIGRATED_FINAL_ODIN_RAVEN_KIT,...MIGRATED_FINAL_MARS_SKILL_KITS,...MIGRATED_ODIN_RAGNAROK_SKILL_KIT,...MIGRATED_FINAL_EXTRA_TRAIT_KITS,...REVIEWED_SOUL_KITS,...MIGRATED_TRAIT_KITS];
const identities=new Set<string>();
for(const definition of source)for(const owner of definition.elfIds){
  const key=JSON.stringify([owner,('kind' in definition&&definition.kind)||'skill',definition.name,definition.description]);
  assert.ok(!identities.has(key),`同一來源定義重複：${owner}/${definition.name}`);identities.add(key);
}
for (const definition of source) validateKit(definition.kit);
// 統一物件鍵序提高壓縮率；陣列順序、完整原文及圖紙數值保持不變，下方深比較核對還原。
const isDeferred=(definition:typeof source[number])=>definition.elfIds.every(id=>/^(arena_|wiki_)/.test(id));
// 首頁封裝的「專屬機制包裝」只存種類／持有者／名稱／原文指紋（執行時用精靈自己的原文還原，見 reviewedKitCatalogue）；
// 完整原文仍在來源檔與完整封裝(compressed)、延後封裝(deferred)，並由 tests/legacyWrappedSlim 逐一深比較還原結果。
const slimWrapped=(d:typeof source[number]):any=>isLegacyWrappedKit(d.kit)
  ?{wrapped:true,kind:('kind' in d&&d.kind)||'skill',elfIds:d.elfIds,name:d.name,fp:textFingerprint(d.description)}:d;
const groups=[['reviewedKits.compressed.json',source],['reviewedKits.homepage.json',source.filter(d=>!isDeferred(d)).map(slimWrapped)],['reviewedKits.deferred.json',source.filter(isDeferred)]] as const;
for(const [name,definitions] of groups){
  // 物件鍵順序不影響語意；比較兩種穩定字典順序的等價串流，不改解碼格式。
  const candidates=(['alphabetical','long-first'] as const).map(order=>{
    const raw=JSON.stringify(packJson(definitions,order));
    const zipped=[5,6,7,8,9].map(memLevel=>gzipSync(raw,{level:9,memLevel})).sort((a,b)=>a.length-b.length)[0];
    assert.deepEqual(unpackJson(JSON.parse(strFromU8(gunzipSync(zipped)))),definitions);
    return {raw,zipped};
  });
  const {raw,zipped}=candidates.sort((a,b)=>a.zipped.length-b.zipped.length)[0];
  assert.deepEqual(unpackJson(JSON.parse(strFromU8(gunzipSync(zipped)))),definitions,'封裝不得丟失原文、參數、節點、角色或順序');
  const output=JSON.stringify({schemaVersion:2,gzip:zipped.toString('base64')})+'\n',file=`src/data/${name}`;
  if(process.argv.includes('--check')){
    const saved=JSON.parse(readFileSync(file,'utf8'));
    assert.deepEqual(unpackReviewedKits(saved),definitions,'積木來源已變更，需執行npm run data:kit-pack');
  }else writeFileSync(file,output);
  console.log(`${name}：${definitions.length}份，${Buffer.byteLength(raw)} → ${Buffer.byteLength(output)} bytes；完整原文／參數深比較通過`);
}
