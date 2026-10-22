import assert from 'node:assert/strict';
import {createServer} from 'vite';
import history from '../src/data/legacyBuiltinDescriptions.json';
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try{
  const {DEFAULT_ELVES:defaults}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {applySavedSkillCorrections:correct}=await server.ssrLoadModule('/src/data/savedSkillCorrections.ts');
  const {validateKit}=await server.ssrLoadModule('/src/effects/kitValidation.ts');
  for(const old of history){
    assert.ok(old.evidence.length,'每個舊版原文有Git來源證據');
    const canonical=defaults.find((e:any)=>String(e.id)===old.elfId&&e.name===old.elfName);assert.ok(canonical);
    const source=old.kind==='soul'?canonical.soulMark:[...canonical.skills,...canonical.skillPool||[]].find((s:any)=>s.name===old.name);assert.ok(source?.kit?.length);
    const seed=structuredClone(canonical);delete seed.kit;seed.isCustom=true;
    const def={...structuredClone(source),description:old.description,effectMode:undefined,kit:undefined,pp:2,currentPp:1};
    if(old.kind==='soul')seed.soulMark=def;else{seed.skills=[def];seed.skillPool=[structuredClone(def)];}
    const before=structuredClone(seed),fixed=correct(seed,defaults),actual=old.kind==='soul'?fixed.soulMark:fixed.skills[0];
    assert.deepEqual(seed,before);assert.deepEqual(actual.kit,source.kit);assert.equal(actual.description,source.description);validateKit(actual.kit);assert.equal(correct(fixed,defaults),fixed);
    if(old.kind==='skill'){assert.equal(actual.pp,2);assert.equal(actual.currentPp,1);assert.deepEqual(fixed.skillPool[0].kit,source.kit);}
    for(const mode of ['kit','registry','none']){const edited=structuredClone(seed),d=old.kind==='soul'?edited.soulMark:edited.skills[0];d.effectMode=mode;const out=correct(edited,defaults);assert.equal(old.kind==='soul'?out.soulMark:out.skills[0],d);}
    const edited=structuredClone(seed),d=old.kind==='soul'?edited.soulMark:edited.skills[0];d.description+='自訂';const out=correct(edited,defaults);assert.equal(old.kind==='soul'?out.soulMark:out.skills[0],d);
  }
  console.log(`✓ ${history.length}份真實歷史原文恢復，技能池、PP、不可變、冪等、自訂文字及明確模式保護`);
}finally{await server.close();}
