// 5015 混沌·布萊克 魂印「夜」真 Kit 拆解驗收（DSH 20261018 第十一批·第一波）。
// 雙側（P1/P2）正式 headless 引擎實戰；合成精靈帶真名（混沌·布萊克）與真 soulMark（structuredClone 後只改技能／數值）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const night = DEFAULT_ELVES.find((e: any) => String(e.id) === '5015');
  const { MIGRATED_NIGHT_SOUL_KIT } = await h.server.ssrLoadModule('/src/data/migratedNightSoulKit.ts');
  assert.equal(night.name, '混沌·布萊克');
  assert.equal(night.soulMark?.name, '夜');
  assert.equal(night.soulMark?.effectMode, 'kit', '魂印 effectMode=kit');
  assert.ok(!JSON.stringify(night.soulMark.kit || []).includes('legacy_handler'), '不得殘留包裝');
  assert.equal(night.soulMark.description, MIGRATED_NIGHT_SOUL_KIT.description, 'Kit description 與實際載入原文逐字相同');
  assert.equal(night.soulMark.name, MIGRATED_NIGHT_SOUL_KIT.name);
  assert.deepEqual(night.soulMark.kit, structuredClone(MIGRATED_NIGHT_SOUL_KIT.kit), '套用的 Kit 條目與來源定義完全一致');
  assert.ok(!('混沌·布萊克' in h.S), 'SOUL_MARK_MAPPING 不得殘留 5015 名稱別名');
  assert.ok(!('5015' in h.S), 'SOUL_MARK_MAPPING 不得殘留 5015 鍵');
  assert.ok('1012' in h.S, '1012 舊魂印「混」映射維持原狀');
  checks++; console.log('OK 5015 魂印「夜」已是真 Kit（無包裝、無舊映射）');

  const immuneTrait = { name: '通用異常免疫', effectMode: 'kit', kit: [{ codeId: 'effect_sequence', node: 'on_entered', source: 'mechanic', role: 'innate', order: 0, params: { clause: { raw: '免疫所有異常', trig: 'entrance', parsed: true, body: [{ acts: [{ op: 'immune_status_turns', p: { turns: 9, cls: '', reflect: false }, label: '免疫' }] }] } } }] };
  const nightUnit = (id: string, hp: number, skills: any[], o: any = {}) => {
    const base = structuredClone(night); // 真 5015 定義：structuredClone 後僅改身份／技能／數值
    base.id = id; base.battleId = id; base.name = '混沌·布萊克'; // 真名（魂印以名稱派發）
    base.maxHp = o.maxHp ?? hp; base.currentHp = hp;
    base.baseStats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 };
    base.calculatedStats = { hp: base.maxHp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: o.speed ?? 100 };
    base.skills = skills; base.statStages = o.statStages || {}; base.shield = 0;
    base.soulMark = night.soulMark; // 真 soulMark（已套用真 Kit）
    if (o.statuses) { base.battleStatuses = o.statuses; base.effects = Object.entries(o.statuses).map(([k, v]: any) => ({ id: k, name: k, duration: v, stacks: 1 })); }
    if (o.trait) base.trait = o.trait;
    return base;
  };
  const sureAttack = { ...h.wait(), name: '必中普攻', category: '物理', power: 40, pp: 10, maxPp: 10, description: '' };
  const rawAttack = { ...h.wait(), name: '非必中攻擊', category: '物理', power: 100, pp: 10, maxPp: 10, isSureHit: false, accuracy: 100, description: '' };

  for (const side of ['p1', 'p2'] as const) {
    // ① 能力提升被消除 → 100%令對手害怕
    {
      const self = nightUnit('S', 50000, [h.wait(), sureAttack], { statStages: { atk: 2 } });
      const opp = h.unit('E', 100000, [h.kitSkill('消強', [{ op: 'stat_clear', p: { side: 'opp', kind: 'up' } }]), h.wait()], { speed: 300 });
      const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      assert.ok(h.statuses(r[0].opp).includes('害怕'), side + ' 能力提升被消除→對手害怕：' + r[0].logs.slice(-4).join('｜'));
      checks++;
    }
    // ② 處於狂暴 → 所有技能先制+1（速度100搶在速度500前；無狂暴負例由對手先出手）
    {
      const self = nightUnit('S', 50000, [sureAttack, h.wait()], { speed: 100, statuses: { 狂暴: 3 } });
      const opp = h.unit('E', 100000, [sureAttack, h.wait()], { speed: 500 });
      const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      const me = r[0].logs.findIndex(l => l.includes('【混沌·布萊克】使用了'));
      const foe = r[0].logs.findIndex(l => l.includes('【E】使用了'));
      assert.ok(me >= 0 && foe >= 0, side + ' 有雙方出手日誌');
      assert.ok(me < foe, side + ' 處於狂暴→先制+1→先出手');
      assert.equal(r[0].state[side + 'RegistryState'].actionPriorityThisTurn, 1, side + ' 狂暴先制等級=1');
      checks++;
      const self2 = nightUnit('S2', 50000, [sureAttack, h.wait()], { speed: 100 });
      const opp2 = h.unit('E2', 100000, [sureAttack, h.wait()], { speed: 500 });
      const r2 = await h.play(side, { self: self2, opp: opp2, turns: () => [0, 0] }, 1);
      const me2 = r2[0].logs.findIndex(l => l.includes('【混沌·布萊克】使用了'));
      const foe2 = r2[0].logs.findIndex(l => l.includes('【E2】使用了'));
      assert.ok(foe2 >= 0 && foe2 < me2, side + ' 無狂暴時速度500對手先出手（負例）');
      assert.notEqual(r2[0].state[side + 'RegistryState'].actionPriorityThisTurn, 1, side + ' 無狂暴先制不+1');
      checks++;
    }
    // ③ 死亡 → 殘留1點體力＋100%詛咒＋吸取最大體力1/3＋進入狂暴；回合結束解除自身異常（保留狂暴）
    {
      const self = nightUnit('S', 100, [h.wait()], { maxHp: 10000, statuses: { 害怕: 3 } });
      const opp = h.unit('E', 3000, [h.kitSkill('致死', [{ op: 'dmg', p: { flat: 99999, type: '真實' } }]), h.wait()], { speed: 300 });
      const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      assert.equal(r[0].self.currentHp, 1001, side + ' 死亡殘留1點體力後吸取⅓回復（1+1000）：' + r[0].self.currentHp);
      checks++;
      assert.ok(h.statuses(r[0].opp).includes('詛咒'), side + ' 死亡→100%令對手詛咒');
      checks++;
      assert.equal(r[0].opp.currentHp, 2000, side + ' 吸取對手最大體力1/3（3000→2000）');
      checks++;
      assert.ok(h.statuses(r[0].self).includes('狂暴'), side + ' 死亡→自身進入3回合狂暴');
      assert.ok(!h.statuses(r[0].self).includes('害怕'), side + ' 回合結束解除自身異常（狂暴保留、害怕清除）');
      checks++;
      assert.ok(Object.keys(r[0].state[side + 'RegistryState']).some(k => k.includes('blake-night-death')), side + ' 每場1次旗標已寫入');
      checks++;
    }
    // ④ 死亡分支每場最多1次：第二次致死不再復活（詛咒免疫對手，避免控制干擾第二回合出手；
    //    死亡換人屬 forced_switch 階段，headless 驗收以體力歸零斷言不再觸發殘留）
    {
      const self = nightUnit('S', 100, [h.wait()], { maxHp: 10000 });
      const opp = h.unit('E', 100000, [h.kitSkill('致死', [{ op: 'dmg', p: { flat: 999999, type: '真實' } }]), h.wait()], { speed: 300, extra: { trait: structuredClone(immuneTrait) } });
      const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 2);
      assert.ok(r[0].self.currentHp > 0, side + ' 第一次致死殘留存活');
      assert.ok(r[1].self.currentHp <= 0, side + ' 第二次致死不再觸發（每場戰鬥最多1次；HP=' + r[1].self.currentHp + '）');
      checks++;
    }
    // ⑤ 常駐主權：免疫類效果無法免疫狂暴（對照：麻痺仍被免疫）
    {
      const self = nightUnit('S', 50000, [h.wait()], { trait: structuredClone(immuneTrait) });
      const opp = h.unit('E', 100000, [
        h.kitSkill('附狂暴', [{ op: 'status', p: { side: 'opp', status: '狂暴', turns: 3, chance: 100 } }]),
        h.kitSkill('附麻痺', [{ op: 'status', p: { side: 'opp', status: '麻痺', turns: 3, chance: 100 } }]),
      ]);
      const r = await h.play(side, { self, opp, turns: (_, t) => [0, t === 1 ? 0 : 1] }, 2);
      assert.ok(h.statuses(r[0].self).includes('狂暴'), side + ' 免疫類效果無法免疫狂暴');
      checks++;
      assert.ok(!h.statuses(r[1].self).includes('麻痺'), side + ' 對照：其他異常仍被免疫');
      checks++;
    }
    // ⑥ 常駐主權：狂暴無法被轉化為其他異常（對照：無夜魂印的普通精靈可被轉化）
    {
      const self = nightUnit('S', 50000, [h.wait()], { statuses: { 狂暴: 3 } });
      const opp = h.unit('E', 100000, [h.kitSkill('轉化', [{ op: 'convert_status', p: { side: 'opp', status: '中毒', turns: 3 } }]), h.wait()]);
      const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      assert.ok(h.statuses(r[0].self).includes('狂暴'), side + ' 狂暴未被轉化');
      assert.ok(!h.statuses(r[0].self).includes('中毒'), side + ' 未被轉化為中毒');
      checks++;
      const plain = h.unit('P', 50000, [h.wait()], { extra: { battleStatuses: { 狂暴: 3 }, effects: [{ id: '狂暴', name: '狂暴', duration: 3, stacks: 1 }] } });
      const r2 = await h.play(side, { self: plain, opp, turns: () => [0, 0] }, 1);
      assert.ok(!h.statuses(r2[0].self).includes('狂暴'), side + ' 對照：無夜魂印時狂暴可被轉化');
      assert.ok(h.statuses(r2[0].self).includes('中毒'), side + ' 對照：轉化為中毒成立');
      checks++;
    }
    // ⑦ 100%閃避對手攻擊（必中除外）；閃避成功→下2次攻擊技能先制+2（計時器）且傷害提升50%（計數器）
    {
      const self = nightUnit('S', 50000, [h.wait(), sureAttack]);
      const opp = h.unit('E', 100000, [rawAttack, h.wait()], { speed: 300 });
      const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      assert.equal(r[0].self.currentHp, 50000, side + ' 100%閃避對手攻擊');
      assert.ok(r[0].logs.some(l => l.includes('閃避')), side + ' 閃避日誌');
      checks++;
      const timers = (r[0].state[side + 'Timers'] || []);
      assert.ok(timers.some((t: any) => t.payload?.block?.prio === 2 && t.payload.block.attackOnly === true), side + ' 閃避成功→下2次攻擊技能先制+2');
      assert.ok(timers.some((t: any) => t.payload?.nextAttackDamageModifier?.multiplier === 1.5), side + ' 閃避成功→傷害提升50%（下次攻擊計數）');
      checks++;
    }
    // ⑧ 未閃避（必中命中）→回合結束附加自身攻擊值50%（300×0.5=150）的百分比傷害並回復等量體力
    //    以「同一攻擊的無夜魂印對照場」取差值，不受普攻傷害公式影響。
    {
      const mk = (self: any) => h.play(side, { self, opp: h.unit('E', 100000, [sureAttack, h.wait()], { speed: 300 }), turns: () => [0, 0] }, 1);
      const night = await mk(nightUnit('S', 10000, [h.wait()], { maxHp: 50000 }));
      const plain = await mk(h.unit('P', 10000, [h.wait()], { maxHp: 50000 }));
      const siphon = (100000 - night[0].opp.currentHp) - (100000 - plain[0].opp.currentHp);
      assert.equal(siphon, 150, side + ' 未閃避→回合結束附加攻擊值50%的百分比傷害（差值 ' + siphon + '）');
      const healed = (night[0].self.currentHp - plain[0].self.currentHp);
      assert.ok(healed >= 149 && healed <= 150, side + ' 未閃避→回復等量體力150（差值 ' + healed + '）');
      checks++;
    }
  }
  console.log('OK 消強害怕／狂暴先制／死亡分支／主權雙護／閃避與未閃避分支 雙側通過');
  console.log('5015 魂印「夜」：' + checks + ' 項通過');
} finally { await h.close(); }
