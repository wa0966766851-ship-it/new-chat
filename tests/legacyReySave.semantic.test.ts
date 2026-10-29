import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
const legacy=JSON.parse(readFileSync(new URL('../src/data/legacyReyDescriptions.json',import.meta.url),'utf8'));
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try{
  const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {applySavedSkillCorrections:correct}=await server.ssrLoadModule('/src/data/savedSkillCorrections.ts');
  const {createBattleEngine}=await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const {calculateDamage}=await server.ssrLoadModule('/src/utils/damageCalculator.ts');
  const canonical=DEFAULT_ELVES.find((e:any)=>e.id===legacy.elfId);
  const old=structuredClone(canonical);
  for(const d of [old.soulMark,...old.alienTraits.exclusiveTraits,...old.skills,...old.skillPool||[]]){
    const kind='power' in d?'skill':d===old.soulMark?'soul':'trait';
    const historical=legacy.definitions.find((x:any)=>x.kind===kind&&x.name===d.name);
    if(historical){d.description=historical.description;delete d.kit;delete d.effectMode;}
  }
  old.isCustom=true;old.skills[0].pp=3;old.battleId='legacy-rey';
  const original=structuredClone(old);
  assert.notEqual(old.soulMark.description,canonical.soulMark.description,'使用真實舊原文，不能以新版刪kit假造舊存檔');
  const repaired=correct(old,DEFAULT_ELVES);
  assert.deepEqual(old,original);assert.equal(repaired.skills[0].pp,3);
  assert.equal(repaired.soulMark.kit.length,10);
  assert.deepEqual(repaired.alienTraits.exclusiveTraits.map((t:any)=>t.kit.length),[9,11]);
  assert.ok(repaired.skills.every((s:any)=>s.kit?.length));
  assert.equal(correct(repaired,DEFAULT_ELVES),repaired,'修復冪等');
  const crlf=structuredClone(old);crlf.soulMark.description=crlf.soulMark.description.replace(/\n/g,'\r\n');
  assert.equal(correct(crlf,DEFAULT_ELVES).soulMark.kit.length,10);
  for(const e of [{...old,id:'custom_5029'},{...old,name:'我的雷伊'},
    {...old,soulMark:{...old.soulMark,description:old.soulMark.description.replace('2倍','3倍')}},
    ...['registry','kit','none'].map(effectMode=>({...old,soulMark:{...old.soulMark,effectMode}})),
    {...old,soulMark:{...old.soulMark,kit:[{codeId:'custom',params:{}}]}}]){
    assert.equal(correct(e,DEFAULT_ELVES).soulMark,e.soulMark,'自訂原文／模式／已編輯積木必須保留');
  }
  const wait={name:'等待',description:'',category:'屬性',type:'普通',power:0,pp:99,maxPp:99,isSureHit:true};
  for(const side of ['p1','p2'])for(const preparedTeams of [false,true]){
    const self=structuredClone(repaired);self.skills=[structuredClone(wait)];
    const enemy=structuredClone(canonical);
    Object.assign(enemy,{id:'control',battleId:'control',name:'對照精靈',soulMark:undefined,trait:undefined,alienTraits:undefined,skills:[structuredClone(wait)],kit:undefined,statStages:preparedTeams?{def:2,atk:2}:{}});
    const p1=side==='p1'?self:enemy,p2=side==='p2'?self:enemy;
    const errors:any[]=[];const oldError=console.error;console.error=(...a:any[])=>{errors.push(a);oldError(...a);};
    const engine=createBattleEngine({initialP1Team:[p1],initialP2Team:[p2],p1StarterId:p1.battleId,p2StarterId:p2.battleId,preparedTeams,battleMode:'PVP',isFast:()=>true});
    try{
      engine.mount();engine.start();await engine.idle();
      for(let round=1;round<=3;round++){
        const before=engine.getState();
        engine.onSkillSelect('p1',before.p1.skills[0]);engine.onSkillSelect('p2',before.p2.skills[0]);await engine.idle();
        const s=engine.getState(),actual=s[side];
        assert.equal(actual.soulMark.kit.length,10);
        assert.equal(actual.treatOpponentBoostAsDoubleDrop,true,'不是只恢復圖紙，戰鬥開始旗標必須真正寫入');
        assert.equal(actual.suppressAbnormalSideEffectsWhenParalyzed,true);
        assert.equal(actual.statStages.atk,preparedTeams?2:Math.min(6,round*2),`${side}/${preparedTeams}每回合開始複製或提升`);
        if(preparedTeams)assert.equal(actual.statStages.def,2);
      }
      // 傷害使用正式引擎啟用的旗標，與同數值的真實-4級對照；不以旗標存在代替數值驗證。
      const source=structuredClone(engine.getState()[side]);
      const target=structuredClone(enemy);target.statStages={def:2,atk:2};
      source.statStages={};source.alienTraits=undefined;source.trait=undefined;source.soulMark=undefined;
      const attack={...wait,name:'傷害對照',category:'物理',power:100};
      const damage=(a:any,b:any)=>calculateDamage(a,b,attack,side,undefined,undefined,1,false).damage;
      const plain=structuredClone(source);delete plain.treatOpponentBoostAsDoubleDrop;
      const lowered=structuredClone(target);lowered.statStages={def:-4,atk:-4};
      assert.equal(damage(source,target),damage(plain,lowered),'攻擊：對手防禦+2視為-4');
      assert.equal(damage(target,source),damage(lowered,plain),'受擊：對手攻擊+2視為-4');
      assert.ok(damage(source,target)>damage(plain,target));
      assert.ok(damage(target,source)<damage(target,plain));
      assert.equal(errors.length,0,'不得吞掉掛鉤錯誤');
      console.log(`✓ ${side}/prepared=${preparedTeams} 真實舊原文、連續3回合、雙向2倍弱化傷害數值`);
    }finally{engine.unmount();console.error=oldError;}
  }
}finally{await server.close();}
