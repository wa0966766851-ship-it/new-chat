import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKILL_STONE_ATTRIBUTES as attrs, SKILL_STONE_GRADES as grades, PERFECT_SKILL_STONE_EFFECTS as effects,
  createSkillStone, toSSStone, stoneBasePp, distinctStoneCount, isStoneThrower, equipSkillStone, stoneIconUrl } from '../src/data/skillStones';
import { getMaxPp, isPpCostFree, isZeroPpExempt } from '../src/utils/battleHelpers';
import { resetElfStateForBattle, getTypeMatchup } from '../src/utils/statCalculator';
import { stoneAfterHit, stoneBeforeDamage, stonePriorityBonus } from '../src/effects/skillStoneEffects';
import { handleStoneThrowerSoul } from '../src/effects/elves/wuxu/stoneThrowerSoul';
import { TraitsEngine } from '../src/utils/traitsEngine';
import { calculateDamage } from '../src/utils/damageCalculator';
import { parseElfBlueprint } from '../src/utils/elfBlueprint';
import { tickTimers } from '../src/battle/timers';
import { DEFAULT_ELVES } from '../src/data/defaultElves';

const ordinary: any = { name: '等待', type: '普通', category: '屬性', description: '', effectType: 'none', effectDetail: '', power: 0, pp: 20, maxPp: 20 };
const make = (name = '驗收精靈'): any => ({ id: name, battleId: name, name, type: '普通', level: 100,
  baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
  calculatedStats: { hp: 1000, atk: 500, def: 500, spatk: 500, spdef: 500, speed: 500 },
  currentHp: 500, maxHp: 1000, statStages: {}, skills: [{ ...ordinary }], effects: [] });
function context(skill: any, side = 'p1'): any {
  const self = make(), target = make('對手'); self.skills = [{ ...skill }, { ...ordinary, pp: 10 }];
  const reg: any = {}, opp: any = {}, calls: any[] = [], timers: any[] = [];
  const ctx: any = { self, target, actor: side, targetSide: side === 'p1' ? 'p2' : 'p1', skill, roundNumber: 1, goesFirst: true, isHit: true,
    calls, timers, reg, opp, getPlayerState: (k: string) => reg[k], setPlayerState: (k: string, v: any) => reg[k] = v,
    getOpponentState: (k: string) => opp[k], setOpponentState: (k: string, v: any) => opp[k] = v,
    updateElf: (s: string, patch: any) => Object.assign(s === side ? self : target, patch),
    updateAnyElf: (s: string, _id: string, patch: any) => Object.assign(s === side ? self : target, patch),
    applyStatChange: (s: string, changes: any) => calls.push(['stat', s, changes]),
    applyStatusWithImmunityCheck: (s: string, status: string, turns: number) => { calls.push(['status', s, status, turns]); return { success: true }; },
    applyFixedDamage: (s: string, amount: number) => calls.push(['fixed', s, amount]),
    applyTrueDamage: (s: string, amount: number) => calls.push(['true', s, amount]),
    applyPinkDamage: (s: string, amount: number, _l: string, _a: any, _b: any, type: string) => calls.push([type, s, amount]),
    applyHeal: (s: string, amount: number) => calls.push(['heal', s, amount]),
    applyTrueDamageToElf: (s: string, id: string, n: number) => calls.push(['bench', s, id, n]),
    addTimerTo: (_s: string, t: any) => timers.push(t), addLog: () => {},
    getEligibleTeam: (s: string) => s === side ? [self] : [target], getFullTeam: (s: string) => s === side ? [self] : [target] };
  return ctx;
}
let checks = 0;
const check = (name: string, fn: () => void) => { fn(); checks++; };
const api = JSON.parse(readFileSync(new URL('../docs/data/skill-stones-seerapi.json', import.meta.url), 'utf8'));
for (const attr of attrs) for (const grade of ['D','C','B','A','S'] as const) for (const category of ['物理','特殊'] as const) {
  check(`${attr}/${grade}/${category}`, () => {
    const sk = createSkillStone(attr, grade, category), i = attrs.indexOf(attr) * 5 + ['D','C','B','A','S'].indexOf(grade);
    assert.equal(sk.power, api.stones[i].power); assert.equal(sk.pp, api.stones[i].max_pp); assert.equal(sk.accuracy, api.stones[i].accuracy);
    assert.equal(getMaxPp(sk), sk.pp); assert.ok(stoneIconUrl(attr, grade));
    const b = readFileSync(new URL(`../public${stoneIconUrl(attr,grade)}`, import.meta.url));
    assert.equal(b.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
    const st = make('無序.墜星'); assert.equal(getMaxPp(sk, st), sk.pp + 10);
    const ss = toSSStone(sk, { [sk.name.replace(/-[A-Z]+$/, '-SS')]: '不應覆蓋' });
    assert.equal(ss.power, 240); assert.equal(stoneBasePp(ss), grades[grade].pp); assert.equal(getMaxPp(ss, st), sk.pp + 10);
    assert.equal(ss.isPerfectSkillStone, false); assert.equal(ss.skillStoneEffect, undefined); assert.notEqual(ss.description, '不應覆蓋');
  });
}
for (const side of ['p1','p2']) for (const fx of effects) {
  const sk = createSkillStone(fx.targetAttribute || '草', 'S', '特殊', true, fx.id);
  check(`${side}/${fx.id}`, () => {
    const c = context(sk, side); stoneAfterHit(c, () => false); assert.equal(c.calls.length, 0); assert.equal(c.timers.length, 0);
    if (fx.detail === 'double_power') {
      assert.equal(stoneBeforeDamage(c, sk, () => false), sk);
      assert.equal(stoneBeforeDamage(c, sk, () => true).skillStoneDamageMultiplier, 2);
    } else if (fx.detail === 'priority_plus_1') {
      let rolls = 0; const roll = () => { rolls++; return true; };
      assert.equal(stonePriorityBonus(c, sk, roll), 1); assert.equal(stonePriorityBonus(c, sk, roll), 1); assert.equal(rolls, 1);
      c.roundNumber++; stonePriorityBonus(c, sk, roll); assert.equal(rolls, 2);
    } else {
      stoneAfterHit(c, () => true);
      if (fx.type === 'status') assert.deepEqual(c.calls[0], ['status', c.targetSide, fx.detail.split(':')[0], fx.id === 'attr_mystery_fatigue' ? 2 : 3]);
      else if (fx.type.startsWith('stat')) assert.equal(c.calls[0][1], fx.type === 'stat_up' ? side : c.targetSide);
      else if (fx.detail === 'add_damage_200') assert.deepEqual(c.calls[0], ['fixed', c.targetSide, 200]);
      else if (fx.detail === 'restore_all_pp_1') { assert.equal(c.self.skills[0].pp, 2); assert.equal(c.self.skills[1].pp, 11); }
      else if (fx.detail === 'reduce_opp_pp_1') assert.equal(c.target.skills[0].pp, 19);
      else assert.equal(c.timers.length, 1);
    }
    const invalid = context(sk, side); invalid.additionalEffectsEnabled = false;
    stoneAfterHit(invalid, () => true); assert.equal(invalid.calls.length, 0); assert.equal(stoneBeforeDamage(invalid, sk, () => true), sk); assert.equal(stonePriorityBonus(invalid, sk, () => true), 0);
    const miss = context(sk, side); miss.isHit = false; stoneAfterHit(miss, () => true); assert.equal(miss.calls.length, 0);
  });
}
check('PP 老存檔及重複開局不疊加；神話不改成99', () => {
  for (const old of [2,12,22,99]) {
    const st = make('無序.墜星'); st.skills = attrs.slice(0,4).map(type => ({ ...createSkillStone(type,'S'), pp: old, maxPp: old }));
    assert.equal(getMaxPp(st.skills[0], st), 12);
    const a = resetElfStateForBattle(st), b = resetElfStateForBattle(a);
    assert.deepEqual(a.skills.map(s=>s.pp), [12,12,12,12]); assert.deepEqual(b.skills.map(s=>s.pp), [12,12,12,12]);
    const c = context(a.skills[0]); c.self = a; TraitsEngine.triggerBeforeAction(c); assert.equal(c.self.skills[0].pp, 12);
    assert.equal(isPpCostFree(a, a.skills[0]), true); assert.equal(isZeroPpExempt(a, {...a.skills[0],pp:0}), true);
    a.skills[3] = {...a.skills[0]}; assert.equal(distinctStoneCount(a),3); assert.equal(isPpCostFree(a,a.skills[0]),false);
  }
  assert.equal(isStoneThrower({...make('無序.六刃'),soulMark:{trait_wuxu_apostle:true}}),false);
});
check('安全裝備、選效校驗、完整草稿 roundtrip', () => {
  const elf = make(), stone = createSkillStone('龍','S','特殊',true,'attr_dragon_dmg');
  const equipped = equipSkillStone(elf, stone, 0); assert.equal(equipped.skillPool[0].name, ordinary.name);
  elf.skills = [...equipped.skills,{...ordinary,name:'第五',isFifthSkill:true}];
  assert.throws(()=>equipSkillStone(elf,createSkillStone('火','S'),1)); assert.throws(()=>equipSkillStone(elf,stone,4));
  assert.throws(()=>createSkillStone('水','S','特殊',true,'attr_dragon_dmg'));
  const st = make('無序.墜星'); st.skills = [stone,{...ordinary}]; assert.throws(()=>equipSkillStone(st,stone,1));
  const draft = {schemaVersion:2,manualElf:{...make(),skills:[stone],skillPool:[]}};
  const json = JSON.stringify(draft), result = parseElfBlueprint(json); assert.equal(result.elf.skills[0].skillStoneEffect,'attr_dragon_dmg');
  draft.manualElf.skills[0] = {...stone,skillStoneEffect:'attr_fire_burn'}; assert.throws(()=>parseElfBlueprint(JSON.stringify(draft)));
});
check('普通傷害翻倍不是威力翻倍；本系加成', () => {
  const sk = createSkillStone('普通','D','物理',true,'attr_normal_double'), c = context(sk);
  const dmg = (elf: any, s: any) => calculateDamage(elf,c.target,s,'p1',undefined,undefined,1,false).damage;
  assert.equal(dmg(c.self,stoneBeforeDamage(c,sk,()=>true)),dmg(c.self,sk)*2);
  const custom = {...sk,skillStoneRuleset:'project' as const}; assert.equal(stoneBeforeDamage(c,custom,()=>true).power,80);
  const fire = createSkillStone('火','S'); assert.equal(dmg(make('無序.墜星'),fire),Math.floor(((42*500*160/250)/50+2)*1.5*getTypeMatchup('火','普通')));
});
check('選定技能歸0才阻止當回合行動', () => {
  const sk = createSkillStone('蟲','S','特殊',true,'attr_bug_pp'), c = context(sk);
  c.target.skills = [{...ordinary,pp:2},{...ordinary,name:'其他',pp:1}]; c.opponentSkill = c.target.skills[0];
  stoneAfterHit(c,()=>true); assert.equal(c.opp.actionPreventedRound,undefined);
  stoneAfterHit(c,()=>true); assert.equal(c.opp.actionPreventedRound,1);
});
check('PP石共用星護耗盡／非弱化清除與PP禁回復入口', () => {
  const c = context(createSkillStone('蟲','S','特殊',true,'attr_bug_pp'));
  c.target.skills = [{...ordinary,pp:1}]; c.opponentSkill = c.target.skills[0];
  c.target.battleStatuses = { 星護:3, 中毒:3, 麻痺:3 };
  stoneAfterHit(c,()=>true);
  assert.equal(c.target.skills[0].pp,20); assert.equal(c.opp.actionPreventedRound,undefined);
  assert.equal(c.target.battleStatuses.星護,undefined); assert.equal(c.target.battleStatuses.麻痺,undefined);
  assert.equal(c.target.battleStatuses.中毒,3);
  const ppEffect = effects.find(e=>e.detail==='restore_all_pp_1')!;
  const healer = context(createSkillStone(ppEffect.targetAttribute || '草','S','特殊',true,ppEffect.id));
  healer.p1Timers = [{ remaining:2, payload:{ ppRecoveryReductionPercent:1 } }];
  const before = healer.self.skills.map((s:any)=>s.pp); stoneAfterHit(healer,()=>true);
  assert.deepEqual(healer.self.skills.map((s:any)=>s.pp),before);
});
check('SS 保留所選效果與專案真傷；下回合計時', () => {
  const sk = createSkillStone('龍','S','特殊',true,'gen_speed_up'), ss = toSSStone(sk);
  assert.equal(ss.skillStoneEffect,'gen_speed_up'); assert.match(ss.description,/100%/);
  const c = context(createSkillStone('龍','S','特殊',true,'attr_dragon_dmg','project')); stoneAfterHit(c,()=>true); assert.equal(c.calls[0][0],'true');
  const fight = context(createSkillStone('戰鬥','S','特殊',true,'attr_fight_crit','project')); stoneAfterHit(fight,()=>true);
  const next = tickTimers(fight.timers,'round_end'); assert.equal(next[0].pendingActivation,false); assert.equal(next[0].remaining,1); assert.equal(tickTimers(next,'round_end').length,0);
});
check('場下傷害、魂印時點、回血與神話階段結束只一次', () => {
  const c = context(createSkillStone('火','S')); c.self.name = '無序.墜星';
  const bench = make('場下'); bench.type = '草'; c.getEligibleTeam = (s: string) => s === c.actor ? [c.self,{...make('傷員'),currentHp:20}] : [c.target,bench];
  TraitsEngine.triggerSkillDamageSettled(c,1000); assert.deepEqual(c.calls[0],['bench',c.targetSide,bench.id,Math.floor(250*getTypeMatchup('火','草'))]);
  c.calls.length = 0; TraitsEngine.triggerActionPhaseEnd(c); assert.equal(c.calls.length,0);
  handleStoneThrowerSoul(c,'ON_SKILL_HIT',{damage:1,settledDamage:500}); assert.deepEqual(c.calls[0],['heal',c.actor,500]);
  handleStoneThrowerSoul(c,'AFTER_ACTION',{hit:true}); assert.equal(c.opp.utilitySkillInvalidTurns,2); assert.equal(c.reg.immuneControlTurns,2); assert.ok(c.calls.some(x=>x[0]==='percent'&&x[2]===250));
  handleStoneThrowerSoul(c,'ON_DAMAGED',{targetSide:c.targetSide,damageType:'skill_attack'}); assert.equal(c.reg.nextAttackPowerBonus,.25);
  const comp={powerComp:{power:240}}; handleStoneThrowerSoul(c,'MODIFY_POWER',comp); assert.equal(comp.powerComp.power,300); assert.equal(c.reg.nextAttackPowerBonus,0);
  c.self.skills = attrs.slice(0,4).map(a=>createSkillStone(a,'S')); c.calls.length=0;
  TraitsEngine.triggerBattlePhaseEnd(c); assert.deepEqual(c.calls,[['heal',c.actor,250]]); TraitsEngine.triggerRoundEnd(c); assert.equal(c.calls.length,1);
  for (let n=0;n<2;n++) { c.self.currentHp=0; assert.equal(TraitsEngine.triggerFatalResist(c),true); assert.equal(c.self.currentHp,1); }
});
check('預設墜星 S 石原級上限2，開局為12',()=>{
  const st = DEFAULT_ELVES.find(e=>e.name.includes('墜星'))!;
  assert.ok(st); assert.deepEqual(st.skills.filter(s=>s.isSkillStone).map(s=>s.pp),[2,2,2,2]);
  assert.deepEqual(resetElfStateForBattle(st).skills.filter(s=>s.isSkillStone).map(s=>s.pp),[12,12,12,12]);
});
console.log(`技能石語意驗收：${checks} 組通過（105 配置×物特、27 效果×P1/P2、PP／SS／裝備／來源／時點）`);
