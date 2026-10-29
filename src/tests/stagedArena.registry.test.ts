import assert from 'node:assert/strict';
import type { Elf } from '../types';
import type { BattleEventContext } from '../effects/types';
import { EffectTiming } from '../effects/types';
import { STAGED_ARENA_ELVES } from '../data/stagedArenaElves';
import { STAGED_ARENA_SKILLS, STAGED_ARENA_SOULS, TIANFENG_AFTER_HIT } from '../effects/elves/staged-arena/index';
import { read } from '../effects/elves/staged-arena/shared';
import { awake, triggerDragonSoulMarks } from '../effects/elves/staged-arena/dragonHealingRegistry';
import { giveWujiMark, wujiMarkRounds, WUJI_MARK_DEFS } from '../effects/elves/staged-arena/wujiRegistry';
import { statusChanceBlocked } from '../battle/statusChanceRules';
import { finishMoiraiCounter, finishMoiraiFifth, settleYinYangHit } from '../effects/elves/staged-arena/moiraiRegistry';
import { invertPP, transformWuweiSkill, wuweiPower } from '../effects/elves/staged-arena/wuweiRegistry';
import { resolvePetIds, SEER_ID_OVERRIDES } from '../battle/seerAssets';

function setup(name: string) {
  const seed = STAGED_ARENA_ELVES.find(e => e.name === name)!;
  const self = { ...seed, battleId: seed.id, maxHp: 400, currentHp: 400,
    calculatedStats: { hp: 400, atk: 100, spatk: 120, def: 110, spdef: 110, speed: 140 },
    skills: seed.skills.map(s => ({ ...s })) } as Elf;
  const target = { ...self, id: 'foe', battleId: 'foe', name: '對手', maxHp: 600, currentHp: 600, shield: 0, barrier: 0,
    skills: [{ ...self.skills[0], name: '對手技能', pp: 5, currentPp: 5, maxPp: 5 }] } as Elf;
  const state = new Map<string, any>(), damage: Array<{ amount: number; kind: string }> = [], marks: any[] = [], extras: any[] = [];
  const c = {
    self, target, activeP1: self, activeP2: target, actor: 'p1', targetSide: 'p2', skill: self.skills[0],
    getPlayerState: (k: string) => state.get(k), setPlayerState: (k: string, v: any) => state.set(k, v),
    getOpponentState: (k: string) => state.get(`opp.${k}`), setOpponentState: (k: string, v: any) => state.set(`opp.${k}`, v),
    getFullTeam: (side: string) => side === 'p1' ? [self] : [target],
    getStatuses: (elf: Elf) => elf.battleStatuses || {},
    updateElf: (side: string, patch: Partial<Elf>) => Object.assign(side === 'p1' ? self : target, patch),
    applyStatChange: (side: string, changes: Record<string, number>) => {
      const elf = side === 'p1' ? self : target;
      elf.statStages ||= { atk: 0, spatk: 0, def: 0, spdef: 0, speed: 0, accuracy: 0 };
      for (const [stat, n] of Object.entries(changes)) (elf.statStages as any)[stat] = Math.max(-6, Math.min(6, ((elf.statStages as any)[stat] || 0) + n));
    },
    applyPinkDamage: (_side: string, amount: number, _label: string, _p1: unknown, _p2: unknown, kind: string) => { damage.push({ amount, kind }); return amount; },
    applyTrueDamage: (_side: string, amount: number) => { damage.push({ amount, kind: 'true' }); return amount; },
    applyFixedDamage: (_side: string, amount: number) => { damage.push({ amount, kind: 'fixed' }); return amount; },
    applyAbsorb: (_side: string, amount: number) => { target.currentHp -= amount; self.currentHp += amount; },
    applyHeal: (_side: string, amount: number) => { self.currentHp = Math.min(self.maxHp, self.currentHp + amount); },
    adjustHp: (_side: string, amount: number) => { self.currentHp += amount; },
    applyShield: (_side: string, amount: number) => { self.shield = (self.shield || 0) + amount; },
    clearTurnEffectsOf: () => true,
    applyStatusWithImmunityCheck: () => ({ success: true, immune: false }),
    setMark: (m: unknown) => { marks.push(m); }, clearMark: () => {},
    rng: () => .1, addLog: () => {},
    applySkillTypeDamage: (_side: string, amount: number, _label: string, opts: any) => { damage.push({ amount, kind: opts?.category === 'skill_extra_action' ? 'extra' : `typed:${opts?.elem}` }); target.currentHp -= amount; return amount; },
    queueExtraAction: (_owner: string, action: any) => { extras.push(action); },
    updateAnyElf: (side: string, _id: string, patch: Partial<Elf>) => Object.assign(side === 'p1' ? self : target, patch),
    getMarks: () => marks,
  } as unknown as BattleEventContext;
  return { c, self, target, damage, marks, state, extras };
}

assert.equal(STAGED_ARENA_ELVES.length, 5);
// 技能表只保留「尚未遷 Kit」的舊 handler 入口；已遷者（剛莖棍壓／艷羅劍典／萬蒼書帝錄 20261017、
// 鋒毫浸血雨／幽魔相嘯 20261018）必須不存在於此表——語意由「條目數」改為逐名斷言，避免再因遷移而漂移。
for (const migrated of ['剛莖棍壓', '艷羅劍典', '萬蒼帝書錄', '萬蒼書帝錄', '鋒毫浸血雨', '幽魔相嘯']) {
  assert.ok(!(migrated in STAGED_ARENA_SKILLS), migrated + ' 已轉真 Kit，不應再掛舊 handler');
}
assert.ok(Object.keys(STAGED_ARENA_SKILLS).length > 0, '技能表仍須保留未遷移的舊入口');
for (const e of STAGED_ARENA_ELVES) {
  assert.equal(e.skills.length, 5);
  // 龍錄天鋒魂印已遷移為真 Kit（migratedArena13SoulKit；DSH 20261017）——不再掛 handler。
  // 魂印已遷真 Kit 的精靈不再掛舊 handler（龍錄天鋒 20261017；無為龍者／命運龍輪 20261018）。
  const soulMigrated = ['龍錄天鋒', '無為龍者', '命運龍輪 莫伊萊'];
  assert.ok(STAGED_ARENA_SOULS[e.name] || soulMigrated.includes(e.name), e.name + ' 魂印需有 handler 或已遷 Kit');
  // 已轉真 Kit 的技能（如剛莖棍壓）不再掛舊 handler；原文逐字對上 migratedArena16SkillKits 即算接通
  //（行為由 tests/migrate_arena16_gjgy.semantic.test.ts 以真實引擎驗收；此處僅驗資料接線，語意未放寬）。
  const { MIGRATED_ARENA16_SKILL_KITS } = await import('../data/migratedArena16SkillKits');
  const { MIGRATED_ARENA13_SKILL_KITS } = await import('../data/migratedArena13SkillKits');
  const { MIGRATED_POWER_TIMING_SKILL_KITS } = await import('../data/migratedPowerTimingSkillKits');
  const { MIGRATED_ARENA12_SKILL_KITS } = await import('../data/migratedArena12SkillKits');
  const { MIGRATED_ARENA13_FENGHAO_SKILL_KIT } = await import('../data/migratedArena13FenghaoKit');
  const { MIGRATED_ARENA16_YOUMO_SKILL_KIT } = await import('../data/migratedArena16YoumoKit');
  const { MIGRATED_ARENA16_AIDA_SKILL_KIT } = await import('../data/migratedArena16AidaKit');
  const { MIGRATED_ARENA16_YARAN_SKILL_KIT } = await import('../data/migratedArena16YaranKit');
  const { MIGRATED_ARENA16_MONSTER_SKILL_KIT } = await import('../data/migratedArena16MonsterKit');
  const migrated = [...MIGRATED_ARENA16_SKILL_KITS, ...MIGRATED_ARENA13_SKILL_KITS, ...MIGRATED_POWER_TIMING_SKILL_KITS,
    ...MIGRATED_ARENA12_SKILL_KITS, ...MIGRATED_ARENA13_FENGHAO_SKILL_KIT, ...MIGRATED_ARENA16_YOUMO_SKILL_KIT, ...MIGRATED_ARENA16_AIDA_SKILL_KIT, ...MIGRATED_ARENA16_YARAN_SKILL_KIT, ...MIGRATED_ARENA16_MONSTER_SKILL_KIT].filter(k => k.elfIds.includes(e.id));
  for (const s of e.skills) assert.ok(STAGED_ARENA_SKILLS[s.name]
    || migrated.some(k => k.name === s.name && k.description === s.description), s.name);
}
assert.equal(invertPP(1, 8), 7);
assert.equal(wuweiPower(0, 6, false), 470);
{
  // arena_12 魂印「無為之境」已遷真 Kit（migratedArena12SkillKits；DSH 20261018）——
  // 六維重設／PP 互換／0PP 必中等行為由 Kit 條款驅動，改以「舊 handler 不再掛載＋Kit 存在且原文逐字相同」
  // 斷言（規則3.2：不弱化語意，行為改由 Kit 端承載）。
  const { self } = setup('無為龍者');
  assert.equal(STAGED_ARENA_SOULS[self.name], undefined, '無為龍者魂印不得殘留舊 handler');
  const { MIGRATED_ARENA12_WUWEI_SOUL_KIT } = await import('../data/migratedArena12SkillKits');
  assert.ok(MIGRATED_ARENA12_WUWEI_SOUL_KIT.elfIds.includes('arena_12'));
  assert.equal(MIGRATED_ARENA12_WUWEI_SOUL_KIT.name, '無為之境');
  assert.ok(MIGRATED_ARENA12_WUWEI_SOUL_KIT.kit.length >= 5, '無為之境 Kit 條款數');
  // 技能轉化仍由 transformWuweiSkill 承擔（技能轉化非魂印職責，保留原斷言）。
  const { c } = setup('無為龍者');
  c.skill = self.skills[4];
  assert.equal(transformWuweiSkill(c, self.skills[4]).power, 170);
  assert.equal(transformWuweiSkill(c, self.skills[4]).isSureHit, true);
}
{
  // 龍錄天鋒魂印已遷真 Kit（migratedArena13SoulKit）——段序行為由 tests/migrate_arena13_tf_soul
  // 以實戰雙側驗收（第6次清除／第7次循環）；此處斷言舊 handler 不再掛載。
  const { self } = setup('龍錄天鋒');
  assert.equal(STAGED_ARENA_SOULS[self.name], undefined, '龍錄天鋒魂印不得殘留舊 handler');
}
{
  const { c, self, marks } = setup('無極聖武');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ON_ENTRANCE);
  assert.equal(marks[0].id, 'arena.heroGlory');
}
{
  // 命運龍輪魂印本文（回合開始／結束隨機 2 選 1、對手未用技能全觸發）已遷真 Kit
  //（migratedMoiraiSoulKit；DSH 20261018）——行為由 tests/migrate_arena15_moirai.semantic.test.ts
  // 以真實引擎雙側驗收。此處斷言舊 handler 不再執行魂印本文（僅存技能支援讀取端）：
  const { c, self } = setup('命運龍輪 莫伊萊');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ROUND_START);
  assert.equal(self.statStages?.atk, undefined, '魂印本文已遷 Kit：ROUND_START 不再直接疊能力');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ROUND_END);
  assert.equal(self.shield, undefined, '魂印本文已遷 Kit：ROUND_END 不再直接給護盾');
}
{
  const { c, self, damage, state } = setup('命運龍輪 莫伊萊');
  finishMoiraiFifth(c, 301);
  assert.deepEqual(damage[0], { amount: 100, kind: 'percent' });
  assert.equal(state.get('blkImmuneStatusCount'), 1, '高於300：免疫下一次異常（次數型）');
  (c as any).applyPinkDamage = () => 0; // 對手免疫百分比傷害
  finishMoiraiFifth(c, 299);
  assert.deepEqual(damage[1], { amount: 100, kind: 'true' }, '百分比被免疫時轉真實傷害');
  assert.equal(read(c, 'critFrom'), 1, '低於300：下2回合必定致命一擊');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ROUND_START);
  c.skill = self.skills[0];
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.BEFORE_SKILL);
  assert.equal(state.get('mustCrit'), true);
}
{
  const { c, self, damage } = setup('命運龍輪 莫伊萊');
  assert.equal(settleYinYangHit(c), true); // deterministic 0.1 < 0.2
  assert.deepEqual(damage[0], { amount: 100, kind: 'fixed' });
  c.skill = self.skills[3];
  STAGED_ARENA_SKILLS['陰陽三合'](c);
  assert.equal(c.getPlayerState('attackHitCountThisAction'), 5, '5～10 次攻擊交給通用逐擊流程');
  for (let i = 0; i < 5; i++) STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ATTACK_HIT, { skill: self.skills[3], hitIndex: i, hitCount: 5, damage: 10, additionalEffectsEnabled: true });
  assert.equal(damage.filter(d => d.kind === 'fixed').length, 6, '每次實際命中各判定一次 20%');
  // 日月安屬：抵擋下一次攻擊並反擊抵擋前傷害 100% 百分比傷害
  c.setPlayerState(`arena.${self.battleId}.counter`, 1);
  const damageComp = { base: 200, increasePercent: .5, decreasePercent: 0, multiplier: 1, damageCategory: 'skill_attack', isIncoming: true };
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.BEFORE_DAMAGE, { damageComp });
  assert.equal(damageComp.multiplier, 0);
  assert.deepEqual(damage.at(-1), { amount: 300, kind: 'percent' });
  assert.equal(finishMoiraiCounter(c, 75), 0, '只觸發一次');
  // 恆·蒼穹斗轉：攻擊結算後用累計實際傷害判 300
  c.skill = self.skills[4];
  STAGED_ARENA_SKILLS['恆·蒼穹斗轉'](c);
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ATTACK_HIT, { skill: self.skills[4], hitIndex: 0, hitCount: 1, damage: 350, additionalEffectsEnabled: true });
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ACTION);
  assert.equal(c.getPlayerState('blkImmuneStatusCount'), 1);
  assert.deepEqual(damage.at(-1), { amount: 100, kind: 'percent' });
}
{
  // 鋒毫浸血雨已遷真 Kit（migratedArena13FenghaoKit；DSH 20261018）：舊 handler 與 TIANFENG_AFTER_HIT
  // 皆已移除；「下1回合命中時消耗體力½並造成等量百分比傷害」由 Kit 的 turn_key_set 武裝條款承載，
  // 行為由 migrate_arena13_* 實戰驗收（此處僅驗註冊表不再掛舊入口，語意未放寬）。
  const { self } = setup('龍錄天鋒');
  assert.equal(STAGED_ARENA_SKILLS['鋒毫浸血雨'], undefined, '鋒毫浸血雨不得殘留舊 handler');
  assert.equal(TIANFENG_AFTER_HIT['鋒毫浸血雨'], undefined, '鋒毫浸血雨不得殘留舊命中結算');
  const { MIGRATED_ARENA13_FENGHAO_SKILL_KIT } = await import('../data/migratedArena13FenghaoKit');
  assert.ok(MIGRATED_ARENA13_FENGHAO_SKILL_KIT.some(k => k.name === '鋒毫浸血雨'), '鋒毫浸血雨需有真 Kit');
  assert.ok(self.skills.length >= 1);
}
{
  // 剛莖棍壓已遷移為真 Kit（migratedArena16SkillKits；DSH 20261017）：舊 handler 直呼斷言改為
  // 註冊表不再掛舊入口＋精靈技能已帶 Kit（20% 百分比附加／等量真實fallback／無視成功加成等
  // 行為改由 tests/migrate_arena16_gjgy.semantic.test.ts 以真實引擎驗收，語意未放寬）。
  const { self } = setup('鎮世龍魂・龍之治癒');
  assert.equal(STAGED_ARENA_SKILLS['剛莖棍壓'], undefined, '剛莖棍壓不得殘留舊 handler');
  const sk = self.skills.find(s => s.name === '剛莖棍壓') as any;
  const { MIGRATED_ARENA16_SKILL_KITS } = await import('../data/migratedArena16SkillKits');
  const authored = MIGRATED_ARENA16_SKILL_KITS.find(k => k.name === '剛莖棍壓');
  assert.ok(authored && authored.description === sk.description, '剛莖棍壓原文與真 Kit 逐字一致');
  assert.ok(authored.kit.length >= 8);
  assert.ok(!JSON.stringify(authored.kit).includes('legacy_handler'));
}
{
  // 挨打要立正已遷真 Kit（migratedArena16AidaKit；DSH 20261018）：技能表不再掛舊 handler；
  // 「剝離屬性／失敗加龍魂印記／下場恢復原屬性」是 peelTypes＋stateScopes 的引擎行為，
  // 直接以 peelTypes 驗證（語意未放寬，只是不再經由已移除的技能 handler）。
  const { c, self, target, marks } = setup('鎮世龍魂・龍之治癒');
  target.type = '火.龍'; target.originalType = '火.龍';
  (c as any).applyStatusWithImmunityCheck = () => ({ success: false, immune: true });
  c.skill = self.skills[1];
  assert.equal(STAGED_ARENA_SKILLS['挨打要立正'], undefined, '挨打要立正不得殘留舊 handler');
  const { peelTypes } = await import('../effects/elves/staged-arena/dragonHealingRegistry');
  peelTypes(c);
  assert.equal(target.type, '普通'); assert.equal(target.typePeeled, true);
  peelTypes(c);
  assert.equal(read(c, 'soulMark'), 1, '已剝離不重複剝離');
  assert.equal(read(c, 'soulMark'), 1, '附加失敗：龍魂印記 +1（只 +1 層）');
  assert.equal(marks.at(-1).name, '龍魂印記');
  const { switchBattleSide } = await import('../battle/stateScopes');
  const foeTeam = [target, { ...target, id: 'b', battleId: 'b', type: '水', typePeeled: false }];
  const st: any = { p2: target, p2Team: foeTeam, p2ActiveIndex: 0, p2RegistryState: {}, p2ElfState: {}, p2Timers: [], p2Marks: [] };
  const next = switchBattleSide(st, 'p2', 1);
  assert.equal(next.p2Team[0].type, '火.龍', '下場恢復原屬性');
  assert.equal(next.p2Team[0].typePeeled, false);
}
{
  const { c, self, target, damage, extras } = setup('鎮世龍魂・龍之治癒');
  self.calculatedStats = { hp: 400, atk: 100, spatk: 120, def: 110, spdef: 110, speed: 140 } as any;
  target.calculatedStats = { ...self.calculatedStats } as any;
  c.setPlayerState(`arena.${self.battleId}.dragons`, 15);
  c.setPlayerState(`arena.${self.battleId}.trueDragon`, 1);
  c.skill = self.skills[3]; // 雅髯獅嘯（攻擊）
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ACTION);
  assert.equal(extras.length, 1, '真龍：排入一個額外行動節點');
  target.currentHp = 99999; target.maxHp = 99999;
  extras[0].run(c);
  assert.equal(damage.filter(d => d.kind === 'extra').length, 4, '額外使用 4 次');
  c.skill = self.skills[1]; // 屬性技能
  const before = damage.length;
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ACTION);
  assert.deepEqual(damage.slice(before).map(d => d.kind), ['percent', 'typed:龍', 'typed:龍', 'typed:龍', 'typed:龍'], '真龍：蒼龍 50% 百分比吸取＋屬性技能每條龍 150 龍系');
}
{
  // 無極聖武：砥礪 → 亮節／威怯；三者為印記（官方定義）
  const { c, self, target, marks, state } = setup('無極聖武');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ELF_ENTERED, { enteredSide: 'p2', enteredId: 'foe' });
  c.setOpponentState('teamDiliOutcome.foe', 'success');
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ROUND_END);
  assert.equal(wujiMarkRounds(c, 'p2', 'foe', 'arena.liangjie'), 3, '砥礪觸發成功 → 3 回合亮節');
  assert.equal(marks.at(-1).name, '亮節');
  assert.equal(statusChanceBlocked({ actor: 'p2', getMarks: () => marks.filter((m: any) => m.count > 0) } as any, 30), true, '亮節：≤50% 異常機率降為 0');
  assert.equal(statusChanceBlocked({ actor: 'p2', getMarks: () => marks.filter((m: any) => m.count > 0) } as any, 60), false);
  (c as any).applyStatusWithImmunityCheck = () => ({ success: false, immune: true });
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.ELF_ENTERED, { enteredSide: 'p2', enteredId: 'foe' });
  assert.equal(wujiMarkRounds(c, 'p2', 'foe', 'arena.weiyue'), 3, '砥礪未成功 → 3 回合威怯');
  assert.equal(WUJI_MARK_DEFS['arena.weiyue'].effects.nonTrueDamageDealtMultiplier, 0.4);
  for (let i = 0; i < 3; i++) STAGED_ARENA_SOULS[self.name](c, EffectTiming.ROUND_END);
  assert.equal(wujiMarkRounds(c, 'p2', 'foe', 'arena.weiyue'), 0, '3 回合後消失');
  // 武誅：攻擊時已有武誅 → ①每回合 +20%，使用後消除；無視攻擊免疫成功 → 威怯
  giveWujiMark(c, 'p2', 'foe', 'arena.wuzhu', 2);
  c.skill = self.skills[0];
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.BEFORE_SKILL);
  assert.equal(state.get('oppBoostAsDropThisAction'), true);
  const damageComp = { base: 100, multiplier: 1, increasePercent: 0, decreasePercent: 0, damageCategory: 'skill_attack', isIncoming: false };
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.BEFORE_DAMAGE, { damageComp });
  assert.ok(Math.abs(damageComp.multiplier - 1.4) < 1e-9);
  c.setPlayerState('attackImmunityIgnoredThisAction', true);
  STAGED_ARENA_SOULS[self.name](c, EffectTiming.AFTER_ACTION);
  assert.equal(wujiMarkRounds(c, 'p2', 'foe', 'arena.wuzhu'), 0);
  assert.equal(wujiMarkRounds(c, 'p2', 'foe', 'arena.weiyue'), 3);
  void target;
}
{
  const { c, self, damage } = setup('鎮世龍魂・龍之治癒');
  c.setPlayerState(`arena.${self.battleId}.dragons`, 3);
  c.setPlayerState(`arena.${self.battleId}.soulMark`, 2);
  (c as any).target.maxHp = 99999; (c as any).target.currentHp = 99999;
  triggerDragonSoulMarks(c);
  assert.deepEqual(damage.map(d => [d.amount, d.kind]), Array(4).fill([150, 'typed:龍']), '2 層 × 2 條龍 = 4 次 150 龍系');
  c.setPlayerState(`arena.${self.battleId}.dragonSoulSource`, 1);
  triggerDragonSoulMarks(c);
  assert.equal(damage.at(-1)!.amount, 250, '龍魂之源：每條已喚醒龍 +50');
}
for (const [name, id] of Object.entries({ '無為龍者': 4661, '龍錄天鋒': 4903, '無極聖武': 4800, '命運龍輪 莫伊萊': 4275 })) {
  assert.equal(SEER_ID_OVERRIDES[name], id);
  assert.equal(resolvePetIds({ name, id: 'arena' })[0], id);
}
assert.equal(SEER_ID_OVERRIDES['鎮世龍魂・龍之治癒'], undefined);
console.log('Staged Arena: five registries, PP, entry, random branches, awakening, damage type, image mapping passed.');
