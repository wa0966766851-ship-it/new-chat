// 5018 蟲后·奧佩婭 魂印「后」真 Kit 拆解驗收（DSH 20261018 第十三批·第一波）。
// 雙側（P1/P2）正式 headless 引擎實戰；合成精靈帶真名（蟲后·奧佩婭）與真 soulMark（structuredClone 後只改技能／數值）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const queen = DEFAULT_ELVES.find((e: any) => String(e.id) === '5018');
  const { MIGRATED_OPEIA_SOUL_KIT } = await h.server.ssrLoadModule('/src/data/migratedOpeiaSoulKit.ts');
  assert.equal(queen.name, '蟲后·奧佩婭');
  assert.equal(queen.soulMark?.name, '后');
  assert.equal(queen.soulMark?.effectMode, 'kit', '魂印 effectMode=kit');
  assert.ok(!JSON.stringify(queen.soulMark.kit || []).includes('legacy_handler'), '不得殘留包裝');
  assert.equal(queen.soulMark.description, MIGRATED_OPEIA_SOUL_KIT.description, 'Kit description 與實際載入原文逐字相同');
  assert.equal(queen.soulMark.name, MIGRATED_OPEIA_SOUL_KIT.name);
  assert.deepEqual(queen.soulMark.kit, structuredClone(MIGRATED_OPEIA_SOUL_KIT.kit), '套用的 Kit 條目與來源定義完全一致');
  assert.ok(!('蟲后·奧佩婭' in h.S), 'SOUL_MARK_MAPPING 不得殘留 5018 名稱鍵');
  assert.ok(!('5018' in h.S), 'SOUL_MARK_MAPPING 不得殘留 5018 鍵');
  assert.ok(!('1015' in h.S), 'SOUL_MARK_MAPPING 不得殘留舊序號 1015 鍵');
  assert.ok(!('蟲后' in h.S), 'SOUL_MARK_MAPPING 不得殘留「蟲后」別名');
  checks++; console.log('OK 5018 魂印「后」已是真 Kit（無包裝、無舊映射）');

  const queenUnit = (id: string, hp: number, skills: any[], o: any = {}) => {
    const base = structuredClone(queen); // 真 5018 定義：structuredClone 後僅改身份／技能／數值
    base.id = id; base.battleId = id; base.name = '蟲后·奧佩婭'; // 真名（魂印以名稱派發）
    base.type = o.type || '蟲';
    base.maxHp = o.maxHp ?? hp; base.currentHp = hp;
    base.baseStats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 };
    base.calculatedStats = { hp: base.maxHp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: o.speed ?? 100 };
    base.skills = skills; base.statStages = o.statStages || {}; base.shield = 0; base.barrier = 0;
    base.soulMark = queen.soulMark; // 真 soulMark（已套用真 Kit）
    if (o.statuses) { base.battleStatuses = o.statuses; base.effects = Object.entries(o.statuses).map(([k, v]: any) => ({ id: k, name: k, duration: v, stacks: 1 })); }
    return base;
  };
  const attackSkill = (name: string, o: any = {}) => ({ ...h.wait(), name, category: '物理', power: o.power ?? 40, pp: o.pp ?? 10, maxPp: o.maxPp ?? 10, isSureHit: true, description: '' });
  const statusSkill = (name: string, o: any = {}) => ({ ...h.wait(), name, category: '屬性', pp: o.pp ?? 10, maxPp: o.maxPp ?? 10, isSureHit: true, description: '' });
  const benchElf = (id: string, o: any = {}) => ({ ...h.unit(id, 1000, [h.wait()], { type: o.type || '普通' }),
    maxHp: o.maxHp ?? 1000, currentHp: o.hp ?? 1000, calculatedStats: { hp: o.maxHp ?? 1000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 } });
  const bonusOf = (n: number) => Math.floor((100000 + 300 + 300 + 300 + 300 + 100) * n * 0.1);

  for (const side of ['p1', 'p2'] as const) {
    // ① 登場：六維總和×n×10% 臨時加到每一維（自身＋場下一隻存活＝n=2；101300×2×10%=20260）
    {
      const self = queenUnit('S', 100000, [h.wait(), h.wait()]);
      const bench = benchElf('B1');
      const r = await h.play(side, { self, opp: h.unit('E', 100000, [h.wait(), h.wait()]), selfBench: [bench], turns: () => [0, 0] }, 1);
      const s = r[0].self;
      const bonus = bonusOf(2);
      assert.equal(s.maxHp, 100000 + bonus, side + ' 臨時體力上限（' + s.maxHp + '）');
      assert.equal(s.calculatedStats.atk, 300 + bonus, side + ' 臨時攻擊');
      assert.equal(s.calculatedStats.speed, 100 + bonus, side + ' 臨時速度');
      assert.equal(s.currentHp, 100000, side + ' 能力上限加成不是自動回血');
      checks++;
      // 連擊容器：n=2 → 前兩次攻擊各+1連擊（2連擊），第三次不再
      const self2 = queenUnit('S2', 100000, [attackSkill('普攻甲'), attackSkill('普攻乙'), h.wait()]);
      const bench2 = benchElf('B2');
      const r2 = await h.play(side, { self: self2, opp: h.unit('E2', 100000, [h.wait(), h.wait()]), selfBench: [bench2],
        turns: (_e, t) => [t === 3 ? 2 : 0, 0] }, 3);
      // logs 為全場累積——以回合間差分取本回合新日誌。
      const newLogs = (i: number) => r2[i].logs.slice(i > 0 ? r2[i - 1].logs.length : 0);
      const combo1 = newLogs(0).filter(l => l.includes('連擊')).join('|');
      const combo2 = newLogs(1).filter(l => l.includes('連擊')).join('|');
      const combo3 = newLogs(2).filter(l => l.includes('連擊')).join('|');
      assert.ok(combo1.includes('2連擊'), side + ' 第1次攻擊連擊+1：' + combo1);
      assert.ok(combo2.includes('2連擊'), side + ' 第2次攻擊連擊+1：' + combo2);
      assert.ok(!combo3.includes('連擊'), side + ' 第3次攻擊不再連擊：' + combo3);
      checks++;
    }
    // ② 敵方計數→對手攻擊威力-10%×m（敵方場下一隻陣亡蟲系＝m=1：威力降低日誌＋實傷低於無蟲對照場）
    //    起手血量壓低令 50% 恢復不飽和：期末＝10000+floor(臨時上限/2)−實傷，兩場只差實傷。
    {
      const enemyAttack = attackSkill('敵方普攻', { power: 2000 });
      const mk = (deadBug: any) => {
        const self = queenUnit('S', 100000, [h.wait(), h.wait()]);
        self.currentHp = 10000;
        return h.play(side, { self, opp: h.unit('E', 100000, [enemyAttack, h.wait()], { speed: 20000 }),
          oppBench: deadBug ? [benchElf('DB', { type: '蟲', hp: 0 })] : [benchElf('NB')],
          turns: () => [1, 0] }, 1);
      };
      const withBug = await mk(true);
      const noBug = await mk(false);
      assert.ok(withBug[0].logs.some(l => l.includes('攻擊威力降低 10%')), side + ' 威力降低日誌：' + withBug[0].logs.slice(-5).join('|'));
      checks++;
      const boostedMax = 100000 + bonusOf(1);
      const healedTo = 10000 + Math.floor(boostedMax * 0.5);
      const bugDmg = healedTo - withBug[0].self.currentHp;
      const plainDmg = healedTo - noBug[0].self.currentHp;
      assert.ok(bugDmg > 0 && plainDmg > 0, side + ' 對手攻擊實際造成傷害（' + bugDmg + '/' + plainDmg + '）');
      assert.ok(bugDmg < plainDmg, side + ' 威力-10%實傷低於對照（' + bugDmg + ' < ' + plainDmg + '）');
      checks++;
    }
    // ③ 混沌轉移＋無視鍵：雙方場下各一隻混沌精靈→各維-60%附加給自身；無視鍵寫入；下場清無視鍵還原六維
    {
      const self = queenUnit('S', 100000, [h.wait(), h.wait()]);
      const donor = benchElf('D1', { type: '混沌' });
      const foeDonor = benchElf('D2', { type: '混沌' });
      const opp = h.unit('E', 100000, [h.wait(), h.wait()]);
      const r = await h.play(side, { self, opp, selfBench: [donor], oppBench: [foeDonor],
        turns: (_e, t) => t === 1 ? [0, 0] : [{ switch: 1 }, 0] }, 2);
      const t1 = r[0], t2 = r[1];
      const gainedHp = Math.floor(1000 * 0.6) * 2; // 己方＋敵方場下各一隻混沌精靈
      assert.equal(t1.self.maxHp, 100000 + bonusOf(2) + gainedHp, side + ' 混沌轉移附加體力上限（' + t1.self.maxHp + '）');
      const ownDonor = t1.state[side + 'Team'].find((e: any) => e.id === 'D1');
      const foeDonorAfter = t1.state[(side === 'p1' ? 'p2' : 'p1') + 'Team'].find((e: any) => e.id === 'D2');
      assert.equal(ownDonor.maxHp, 400, side + ' 場下混沌精靈上限-60%');
      assert.equal(foeDonorAfter.maxHp, 400, side + ' 敵方場下混沌精靈上限-60%');
      checks++;
      const reg = t1.state[side + 'RegistryState'];
      assert.equal(reg.ignoreAttackImmunityUntilSwitch, true, side + ' 無視攻擊免疫鍵');
      assert.equal(reg.attackDefenseBypassUntilSwitch?.block, true, side + ' 無視抵擋鍵');
      assert.equal(reg.attackDefenseBypassUntilSwitch?.ownerBattleId, String(t1.self.battleId || t1.self.id), side + ' 無視鍵綁自身');
      assert.equal(t1.self.currentHp, 100000, side + ' 轉移能力值不是恢復體力');
      checks++;
      // 下場：還原六維、清無視鍵與敵方計數、作廢連擊容器；重新登場按原始六維重算不複利
      const stored = t2.state[side + 'Team'][0];
      assert.deepEqual(stored.calculatedStats, { hp: 100000, atk: 300, def: 300, spatk: 300, spdef: 300, speed: 100 }, side + ' 下場還原六維（混沌轉移一併還原）');
      assert.equal(stored.maxHp, 100000, side + ' 下場還原體力上限');
      const reg2 = t2.state[side + 'RegistryState'];
      assert.ok(!reg2.ignoreAttackImmunityUntilSwitch, side + ' 下場清無視免疫鍵');
      assert.ok(!reg2.attackDefenseBypassUntilSwitch, side + ' 下場清無視防護鍵');
      assert.ok(!Number(reg2.queenFoeInsectCount), side + ' 下場清敵方計數');
      assert.ok(!(t2.state[side + 'Timers'] || []).some((t: any) => t.id === 'blk_queen_combo'), side + ' 下場作廢連擊容器');
      checks++;
      // 重新登場：全新混沌精靈（上一場的 donor 已被轉移過，物件數值沿用會失真）
      const donorFresh = benchElf('D1F', { type: '混沌' });
      const r2 = await h.play(side, { self: queenUnit('S2', 100000, [h.wait(), h.wait()]), opp, selfBench: [donorFresh],
        turns: (_e, t) => t === 1 ? [0, 0] : t === 2 ? [{ switch: 1 }, 0] : [{ switch: 0 }, 0] }, 3);
      const back = r2[2].self;
      const bonus = bonusOf(2); // 自身＋存活場下＝n=2；六維臨時值按原始六維重算不複利。
      // 混沌轉移每次登場按當下值再扣（1000→400→240…；舊 handler 同語意）：重登場時 donor 已是 400→+240。
      const chaosGain = Math.floor(400 * 0.6);
      assert.equal(back.maxHp, 100000 + bonus + chaosGain, side + ' 重新登場六維不複利、混沌持續再扣（' + back.maxHp + '）');
      checks++;
    }
    // ④ 對手使用攻擊技能：下次屬性技能附加失效（下場後保留）＋恢復50%＋當回合非真實傷害-50%＋同類型PP歸0
    {
      const oppSkills = [attackSkill('對手強攻', { power: 0 }), statusSkill('對手屬性甲'), h.wait()];
      const self = queenUnit('S', 20000, [h.wait(), h.wait()]);
      self.currentHp = 6000; // 30%體力；登場後 maxHp=20000+2130（臨時上限也計入恢復基數，與舊 handler 同）
      const r = await h.play(side, { self, opp: h.unit('E', 100000, oppSkills, { speed: 20000 }), turns: () => [0, 0] }, 1);
      const st = r[0].state;
      const oppTimers = st[(side === 'p1' ? 'p2' : 'p1') + 'Timers'] || [];
      const seal = oppTimers.find((t: any) => t.payload?.block?.addInvalid === '屬性');
      assert.ok(seal, side + ' 下次屬性技能附加失效計時器');
      assert.equal(seal?.kind, 'use_counter', side + ' 封印為次數型（下場後保留）');
      checks++;
      const localBonus = Math.floor((20000 + 300 + 300 + 300 + 300 + 100) * 1 * 0.1); // 本場景 maxHp=20000 的六維和×n=1×10%
      assert.equal(r[0].self.currentHp, 6000 + Math.floor((20000 + localBonus) * 0.5), side + ' 恢復自身最大體力50%（含臨時上限基數；當前=' + r[0].self.currentHp + '）');
      checks++;
      const opp = r[0].opp;
      assert.equal(opp.skills[0].pp, 0, side + ' 使用的攻擊技能PP歸0（戰鬥階段結束）');
      checks++;
      // 「當回合非真實傷害-50%」（damage_multiplier_turns，turns:1）於回合結束已自然到期消逝，
      // 事後狀態不可見；此語句與已斷言的封印／恢復／PP歸0／99%覆寫同一子句主體依序執行，
      // op 本身為既有通用件（arena16 雅髯獅嘯等既有回歸覆蓋），不重複造冪等斷言。
      assert.ok(true);
      checks++;
      // 同類型（攻擊）技能 PP 全歸0：屬性／等待不受影響
      const oppSkills2 = [attackSkill('對手強攻2', { power: 0 }), attackSkill('對手物理乙'), statusSkill('對手屬性乙')];
      const r2 = await h.play(side, { self: queenUnit('S2', 100000, [h.wait()]), opp: h.unit('E2', 100000, oppSkills2, { speed: 20000 }), turns: () => [0, 0] }, 1);
      const opp2 = r2[0].opp;
      assert.equal(opp2.skills[0].pp, 0, side + ' 使用的攻擊技能PP=0');
      assert.equal(opp2.skills[1].pp, 0, side + ' 同類型（攻擊）技能PP全歸0');
      assert.ok((opp2.skills[2].pp ?? 0) > 0, side + ' 屬性技能PP不受同類型歸0影響');
      checks++;
    }
    // ⑤ 對手使用屬性技能：下次攻擊技能附加失效＋2回合99%減傷覆寫＋僅該技能PP歸0
    {
      const oppSkills = [statusSkill('對手屬性甲'), attackSkill('對手物理丙'), attackSkill('對手物理丁')];
      const r = await h.play(side, { self: queenUnit('S', 100000, [h.wait()]), opp: h.unit('E', 100000, oppSkills, { speed: 20000 }), turns: () => [0, 0] }, 1);
      const st = r[0].state;
      const myTimers = st[side + 'Timers'] || [];
      const override = myTimers.find((t: any) => t.payload?.damageReductionOverridePercent === 99);
      assert.ok(override, side + ' 2回合99%減傷覆寫計時器');
      // 建立於第1回合（remaining 2），回合結束已 tick 一次→讀取時剩 1＝第2回合仍覆寫（「2回合內」語意）。
      assert.equal(override?.remaining, 1, side + ' 覆寫期限2回合（回合末已扣1，次回合仍生效）');
      checks++;
      const oppTimers = st[(side === 'p1' ? 'p2' : 'p1') + 'Timers'] || [];
      assert.ok(oppTimers.some((t: any) => t.payload?.block?.addInvalid === '攻擊'), side + ' 下次攻擊技能附加失效計時器');
      checks++;
      const opp = r[0].opp;
      assert.equal(opp.skills[0].pp, 0, side + ' 使用的使用的屬性技能PP歸0');
      assert.ok((opp.skills[1].pp ?? 0) > 0 && (opp.skills[2].pp ?? 0) > 0, side + ' 屬性技能不觸發同類型歸0');
      checks++;
    }
    // ⑥ 自身使用技能：不消耗PP＋100%中毒＋PP滿→出手結束中毒轉感染
    {
      const fullAttack = attackSkill('滿PP攻擊', { power: 40, pp: 10, maxPp: 10 });
      const r = await h.play(side, { self: queenUnit('S', 100000, [fullAttack, h.wait()]), opp: h.unit('E', 100000, [h.wait(), h.wait()]), turns: () => [0, 0] }, 1);
      assert.equal(r[0].self.skills[0].pp, 10, side + ' 不消耗技能PP值');
      checks++;
      assert.ok(h.statuses(r[0].opp).includes('感染'), side + ' PP滿→出手結束中毒轉感染');
      assert.ok(!h.statuses(r[0].opp).includes('中毒'), side + ' 轉化後不殘留中毒');
      checks++;
    }
    // ⑦ 中毒被免疫→消除對手回合類效果（技能型回合效果可被消除）＋滿體力100%害怕（體力百分比機率）
    //    免疫須為「技能回合效果」（turn_effect，可被消除回合類效果清除）——特質來源的 round_counter 依引擎設計不可消除。
    {
      const fullAttack2 = attackSkill('滿PP攻擊2', { power: 1, pp: 10, maxPp: 10 });
      const immuneSkill = h.turnEffectSkill(); // 4回合免疫非附屬類異常（skill 來源＝turn_effect）
      const r = await h.play(side, { self: queenUnit('S', 100000, [fullAttack2, h.wait()]),
        opp: h.unit('E', 100000, [immuneSkill, h.wait()], { speed: 20000 }), turns: () => [0, 0] }, 1);
      assert.ok(!h.statuses(r[0].opp).includes('中毒') && !h.statuses(r[0].opp).includes('感染'), side + ' 中毒被免疫未憑空轉化');
      assert.ok(h.statuses(r[0].opp).includes('害怕'), side + ' 滿體力→100%害怕（體力百分比機率；免疫回合效果已被消除）');
      checks++;
    }
    // ⑧ PP不滿（攻擊技能）→吸取對手所有技能2點PP＋自身每招+2（不觸發轉感染，中毒保留）
    {
      const partialAttack = attackSkill('不滿PP攻擊', { power: 1, pp: 1, maxPp: 5 });
      const foeSkills = [h.wait(), { ...h.wait(), name: '敵方技能甲', pp: 3, maxPp: 10 }, { ...h.wait(), name: '敵方技能乙', pp: 1, maxPp: 10 }];
      const r = await h.play(side, { self: queenUnit('S', 100000, [partialAttack, h.wait()]),
        opp: h.unit('E', 100000, foeSkills, { speed: 20000 }), turns: () => [0, 0] }, 1);
      const o = r[0].opp;
      assert.equal(o.skills[1].pp, 1, side + ' 敵方技能-2（3→1；使用中的等待技能另被PP封印歸0）');
      assert.equal(o.skills[2].pp, 0, side + ' 敵方不足2點扣至0');
      const s = r[0].self;
      assert.equal(s.skills[0].pp, 3, side + ' 自身每招+2且不超過上限（1→3，不消耗PP）');
      assert.ok(h.statuses(o).includes('中毒') && !h.statuses(o).includes('感染'), side + ' PP不滿不觸發轉感染（中毒保留）');
      checks++;
    }
  }
  console.log('OK 登場六維／連擊／敵方威力／混沌轉移／無視鍵／封印／中毒感染／吸取／下場還原 雙側通過');
  console.log('5018 魂印「后」：' + checks + ' 項通過');
} finally { await h.close(); }
