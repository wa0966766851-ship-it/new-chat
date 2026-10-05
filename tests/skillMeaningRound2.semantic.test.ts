import assert from 'node:assert/strict';
import { DEFAULT_ELVES } from '../src/data/defaultElves';
import { DIXIN_SKILLS, DIXIN_DAMAGE_TRANSFORMS, handleDixinSoulMark } from '../src/effects/dixinRegistry';
import { OPEIA_SKILLS, countOpeiaTeam, handleOpeiaSoulMark } from '../src/effects/opeiaRegistry';
import { CANGLAN_SKILLS, CANGLAN_DAMAGE_TRANSFORMS, handleCanglanSoulMark } from '../src/effects/canglanRegistry';
import { handleWuxuSoulMark } from '../src/effects/wuxuRegistry';
import { STARLIGHT_RUS_SKILLS, handleStarlightRusSoulMark } from '../src/effects/starlightRusRegistry';
import { EffectTiming as E } from '../src/effects/types';
import { calculateDamage } from '../src/utils/damageCalculator';
import { skillStageView } from '../src/battle/skillStageView';
import { skillTypeMultiplier, consumeSkillTypeOverride } from '../src/battle/skillTypeOverride';
import { getTypeMatchup } from '../src/utils/statCalculator';
import { TraitsEngine } from '../src/utils/traitsEngine';

function setup(side: 'p1' | 'p2', id: string, skillName: string) {
  const self: any = structuredClone(DEFAULT_ELVES.find(e=>e.id===id)!);
  const target: any = structuredClone(DEFAULT_ELVES.find(e=>e.id==='5005')!);
  self.battleId='owner'; target.battleId='foe'; self.maxHp=self.currentHp=1200; target.maxHp=target.currentHp=1200;
  self.statStages={}; target.statStages={};
  const other=side==='p1'?'p2':'p1', state: any={}, enemyState: any={}, marks: any[]=[], enemyMarks: any[]=[], timers: any[]=[], damages: any[]=[], heals: any[]=[], drains: any[]=[];
  let immune=false, clearResult=false;
  const ctx: any={self,target,actor:side,targetSide:other,roundNumber:1,moveIndex:0,isHit:true,skill:self.skills.find((s:any)=>s.name===skillName),
    activeP1:side==='p1'?self:target,activeP2:side==='p2'?self:target,rng:()=>0,
    getPlayerState:(k:string)=>state[k],setPlayerState:(k:string,v:any)=>state[k]=v,getOpponentState:(k:string)=>enemyState[k],setOpponentState:(k:string,v:any)=>enemyState[k]=v,
    getFullTeam:(s:string)=>[s===side?self:target],addLog:()=>{},
    updateElf:(s:string,p:any)=>Object.assign(s===side?self:target,p),updateAnyElf:(s:string,_id:string,p:any)=>Object.assign(s===side?self:target,p),
    applyStatChange:(s:string,p:any)=>{const e=s===side?self:target;e.statStages={...e.statStages};for(const [key,v]of Object.entries(p))e.statStages[key]=Math.max(-6,Math.min(6,(e.statStages[key]||0)+Number(v)));},
    applyPinkDamage:(s:string,n:number,label:string)=>{damages.push({kind:'percent',n,label});return n;},
    applyFixedDamage:(s:string,n:number,label:string)=>{damages.push({kind:'fixed',n,label});return n;},
    applyTrueDamage:(s:string,n:number,label:string)=>{damages.push({kind:'true',n,label});return n;},
    applyAbsorb:(s:string,n:number,label:string)=>drains.push({s,n,label}),applyHeal:(s:string,n:number)=>heals.push({s,n}),
    getStatuses:(e:any)=>e.battleStatuses||{},applyStatusWithImmunityCheck:(s:string,name:string,n:number)=>{if(immune)return{success:false,immune:true};const e=s===side?self:target;e.battleStatuses={...e.battleStatuses,[name]:n};return{success:true,immune:false};},
    clearTurnEffectsOf:()=>clearResult,
    getMarks:(s:string)=>s===side?marks:enemyMarks,setMark:(m:any,s:string)=>{const list=s===side?marks:enemyMarks;const i=list.findIndex(x=>x.id===m.id);if(i<0)list.push(m);else list[i]=m;},clearMark:()=>{},
    addTimerTo:(s:string,t:any)=>timers.push({...t,side:s}),vanishElf:()=>{},addExtraElf:()=>{},
  };
  return{ctx,self,target,state,enemyState,marks,enemyMarks,timers,damages,heals,drains,immune:(v:boolean)=>immune=v,clear:(v:boolean)=>clearResult=v};
}

for(const side of ['p1','p2']as const){
  const d=setup(side,'5017','帝怒傾天');d.self.statStages={atk:-1,def:-2,spatk:-3,spdef:-4,speed:-5,accuracy:-6};d.target.statStages={atk:1,def:2,spatk:3,spdef:4,speed:5,accuracy:6};
  const prio={bonus:0};handleDixinSoulMark(d.ctx,E.MODIFY_PRIORITY,{priorityComp:prio});assert.equal(prio.bonus,6);
  for(const key of ['atk','def','spatk','spdef','speed','accuracy']as const){assert.equal(skillStageView(d.self,d.ctx.skill,key),-d.self.statStages[key]);assert.equal(skillStageView(d.target,d.ctx.skill,key,true),-d.target.statStages[key]);}
  const power=DIXIN_DAMAGE_TRANSFORMS['帝怒傾天'](d.ctx,d.ctx.skill);assert.equal(power.power,d.ctx.skill.power+21*30);
  DIXIN_SKILLS['帝怒傾天'](d.ctx);assert.deepEqual(d.damages.map(x=>[x.kind,x.n]),[['fixed',1260]]);
  d.self.isInherentInvalid=true;prio.bonus=0;handleDixinSoulMark(d.ctx,E.MODIFY_PRIORITY,{priorityComp:prio});assert.equal(prio.bonus,0);assert.equal(DIXIN_DAMAGE_TRANSFORMS['帝怒傾天'](d.ctx,d.ctx.skill).power,d.ctx.skill.power);
  const layers=setup(side,'5017','鹿台悲歌');
  for(let n=0;n<=9;n++){
    layers.state.dixinBahuangStacks=n;const comp={power:100};handleDixinSoulMark(layers.ctx,E.MODIFY_POWER,{skill:layers.ctx.skill,powerComp:comp});assert.equal(comp.power,100*(1+n*0.13));
    layers.damages.length=0;handleDixinSoulMark(layers.ctx,E.AFTER_ACTION);assert.deepEqual(layers.damages.map(x=>[x.kind,x.n]),n>=2?[['fixed',n*39]]:[]);
  }
  layers.state.dixinBahuangStacks=4;layers.damages.length=0;DIXIN_SKILLS['鹿台悲歌'](layers.ctx);assert.equal(layers.damages[0].n,556);assert.equal(layers.state.dixinBahuangStacks,6);assert.equal(layers.self.statStages.accuracy,2);
  handleDixinSoulMark(layers.ctx,E.OPPONENT_DAMAGE,{label:'八荒吸取',hpReduced:0});assert.equal(layers.damages.at(-1).kind,'true');
  layers.state.dixinBahuangStacks=3;handleDixinSoulMark(layers.ctx,E.OPPONENT_ACTION);handleDixinSoulMark(layers.ctx,E.ROUND_END);assert.equal(layers.state.dixinBahuangStacks,2);
  assert.equal(layers.damages.some(x=>x.label==='八荒固傷'&&x.kind==='true'),false,'回合末不再用真傷代替固傷');

  const o=setup(side,'5018','毒噬魂絲');o.target.statStages={atk:3,def:-2,accuracy:1};OPEIA_SKILLS['毒噬魂絲'](o.ctx);
  assert.equal(o.self.statStages.atk,3);assert.equal(o.target.statStages.atk,0);assert.equal(o.target.statStages.def,-2);assert.equal(o.target.battleStatuses.沉默,3);assert.equal(o.damages[0].n,800);assert.equal(o.heals[0].n,800);
  const low=setup(side,'5018','毒噬魂絲');low.target.currentHp=600;OPEIA_SKILLS['毒噬魂絲'](low.ctx);assert.equal(low.target.statStages.accuracy,-1);assert.equal(low.damages[0].n,400);
  assert.equal(countOpeiaTeam([{currentHp:0,type:'蟲.混沌'},{currentHp:1,type:'普通'},{currentHp:0,type:'普通'},{currentHp:1,type:'蟲',isVanished:true}]),2);
  assert.equal(countOpeiaTeam([{currentHp:0,type:'蟲'},{currentHp:1,type:'普通'},{currentHp:0,type:'普通'}],true),2);
  handleOpeiaSoulMark(o.ctx,E.SKILL_INVALID,{skill:o.ctx.skill,isIncoming:false});assert.equal(o.state.opeiaTreatInsectAttacks,2);assert.equal(o.heals.at(-1).n,600);

  const c=setup(side,'5028','王·洛浦凌波');c.self.statStages={spatk:-2,accuracy:-1};c.self.shield=100;c.self.barrier=200;c.target.shield=300;c.target.barrier=400;
  CANGLAN_SKILLS['王·洛浦凌波'](c.ctx);assert.equal(c.self.statStages.spatk,2);assert.equal(c.target.statStages.spatk,-2);assert.equal(c.target.statStages.accuracy,-1);
  assert.equal(c.enemyState.nextSkillInvalid,true);assert.equal(c.damages[0].kind,'percent');assert.equal(c.damages[0].n,700);
  const transformed=CANGLAN_DAMAGE_TRANSFORMS['王·洛浦凌波'](c.ctx,c.ctx.skill);assert.equal(transformed.power,c.ctx.skill.power+1000);assert.equal(CANGLAN_DAMAGE_TRANSFORMS['王·洛浦凌波'](c.ctx,c.ctx.skill).power,c.ctx.skill.power);
  assert.equal(c.self.shield+c.self.barrier+c.target.shield+c.target.barrier,0);
  assert.ok(calculateDamage(c.self,c.target,transformed,side,undefined,undefined,1,false).damage>calculateDamage(c.self,c.target,c.ctx.skill,side,undefined,undefined,1,false).damage);
  for(const clear of [true,false])for(const immune of [true,false]){
    const kiss=setup(side,'5028','王·深海之吻');kiss.clear(clear);kiss.immune(immune);kiss.target.battleStatuses={中毒:3};kiss.enemyMarks.push({id:'blk_千秋一淚',ownerBattleId:'foe',count:1});kiss.marks.push({id:'blk_永恆之水',ownerBattleId:'owner',count:1});
    CANGLAN_SKILLS['王·深海之吻'](kiss.ctx);assert.equal(kiss.state.blkImmuneStatusCount,2);assert.equal(kiss.drains[0].n,300);assert.equal(kiss.damages[0].n,720);assert.equal(kiss.self.shield,720);assert.equal(kiss.heals[0].n,720);
    assert.equal(kiss.target.battleStatuses.中毒,immune?3:undefined);
  }
  handleCanglanSoulMark(c.ctx,E.ON_DAMAGED,{targetSide:c.ctx.targetSide,damageType:'skill_attack',hpReduced:100});assert.equal(c.state.blockAttackCount,undefined);
  handleCanglanSoulMark(c.ctx,E.ON_DAMAGED,{targetSide:side,damageType:'percent',hpReduced:100});assert.equal(c.state.blockAttackCount,undefined);
  handleCanglanSoulMark(c.ctx,E.ON_DAMAGED,{targetSide:side,damageType:'skill_attack',hpReduced:100});assert.equal(c.state.blockAttackCount,1);assert.equal(c.heals.at(-1).n,400);

  const w=setup(side,'5023','影契·噬滅');w.self.battleStatuses={詛咒:3,中毒:2,星賜:2};
  handleWuxuSoulMark(w.ctx,E.ROUND_END);assert.equal(w.self.battleStatuses.詛咒,3);
  handleWuxuSoulMark(w.ctx,E.BATTLE_PHASE_END);assert.equal(w.self.battleStatuses.詛咒,6);assert.equal(w.self.battleStatuses.中毒,undefined);assert.equal(w.self.battleStatuses.星賜,2);
  w.self.calculatedStats.spdef=301;handleWuxuSoulMark(w.ctx,E.ENFORCE);assert.equal(w.self.calculatedStats.spdef,31);handleWuxuSoulMark(w.ctx,E.ENFORCE);assert.equal(w.self.calculatedStats.spdef,31);
  w.target.calculatedStats.spatk=200;
  const special={...w.ctx.skill,category:'特殊' as const,power:100};const actual=calculateDamage(w.target,w.self,special,w.ctx.targetSide,undefined,undefined,1,false,side==='p1'?[w.self]:[w.target],side==='p2'?[w.self]:[w.target]);
  assert.equal(actual.damage,138,'200*(1-31%)；最終特防不再除10');
  w.self.currentHp=0;handleWuxuSoulMark(w.ctx,E.ENFORCE);assert.equal(w.self.calculatedStats.spdef,301);
  w.self.currentHp=1200;w.self.battleStatuses={詛咒:6};w.state[side+'_cyberWraithActive']=true;w.state[side+'_wraithCastSpellPending']=true;
  const spells:any[]=[];w.ctx.queueExtraAction=(_s:string,action:any)=>spells.push(action);
  TraitsEngine.triggerActionPhaseEnd(w.ctx);TraitsEngine.triggerActionPhaseEnd(w.ctx);assert.equal(spells.length,1,'魔咒只由特質排一次');
  const magic:any[]=[], offField:any[]=[];const bench={...w.target,battleId:'bench'};
  w.ctx.applySkillTypeDamage=(_s:string,n:number)=>{magic.push(n);return n;};w.ctx.getEligibleTeam=()=>[w.target,bench];
  w.ctx.applyTrueDamageToElf=(_s:string,id:string,n:number)=>offField.push({id,n});
  spells[0].run(w.ctx);assert.equal(magic[0],w.ctx.skill.power+6,'n 是詛咒回合數，沒有乘15');assert.deepEqual(offField,[{id:'bench',n:3}]);

  const r=setup(side,'5010','星光·浪打千擊');STARLIGHT_RUS_SKILLS['星光·浪打千擊'](r.ctx);assert.equal(r.state.attackHitCountThisAction,5);
  // 連擊屬變威力：每擊強化在傷害前結算，命中後不再擲骰
  const atkBefore=r.self.statStages.atk;handleStarlightRusSoulMark(r.ctx,E.AFTER_ATTACK_HIT,{skill:r.ctx.skill});assert.equal(r.self.statStages.atk,atkBefore,'命中後不再擲強化骰');assert.equal(r.state.rusAttackMultiplier,undefined,'星海不等於星火');
}
console.log('第二輪單元文義：雙方、六能力、0至9層威力/固傷、吸取與無強化分枝、盾罩消耗、真正汲取、轉化失敗、受擊時點、特殊公式、連擊強化前置通過。');
let extension: any = { blkTypeOverride: ['水','混沌','水.混沌','普通'], blkTypeOverrideUses: 2 };
assert.equal(skillTypeMultiplier(extension,'火','草'),Math.max(...extension.blkTypeOverride.map((t:string)=>getTypeMatchup(t,'草'))));
extension=consumeSkillTypeOverride(extension,'skill_attribute',10);assert.equal(extension.blkTypeOverrideUses,1);
extension=consumeSkillTypeOverride(extension,'percent',10);assert.equal(extension.blkTypeOverrideUses,1);
extension=consumeSkillTypeOverride(extension,'skill_extra_action',0);assert.equal(extension.blkTypeOverrideUses,1);
extension=consumeSkillTypeOverride(extension,'skill_extra_action',10);assert.equal(extension.blkTypeOverrideUses,0);
assert.equal(skillTypeMultiplier(extension,'火','草'),getTypeMatchup('火','草'));
