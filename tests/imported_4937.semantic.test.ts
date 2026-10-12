// 4937 星光·雷納多（SeerAPI／BWIKI 匯入，只走自訂系統 Kit、沒有專屬 handler）：P1／P2 正式戰鬥語意驗收。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const otherOf = (s: string) => s === 'p1' ? 'p2' : 'p1';
const STAGES = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'];
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { getSoulMarkRegistry, hasSkillHandler } = await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const elf = DEFAULT_ELVES.find((e: any) => e.name === '星光·雷納多');
  assert.ok(elf, '精靈已匯入');
  const sk = (n: string) => { const s = [...elf.skills, ...elf.skillPool].find((x: any) => x.name === n); assert.ok(s, n); return s; };
  const ray = sk('星光·極速射線'), wall = sk('星光·合金壁壘'), turbo = sk('星光·渦輪增壓'), absorb = sk('星光·能源吸收'), magic = sk('星光·魔動能量');

  await check('只走 Kit：魂印與 5 個攜帶技能都是 kit、沒有任何專屬 handler；資料來源保留', async () => {
    assert.deepEqual(elf.skills.map((s: any) => s.name), ['星光·極速射線', '星光·合金壁壘', '星光·渦輪增壓', '星光·能源吸收', '星光·魔動能量']);
    for (const s of elf.skills) h.assertKitOnly(s);
    assert.equal(elf.soulMark.effectMode, 'kit'); assert.ok(elf.soulMark.kit.length >= 4);
    assert.equal(getSoulMarkRegistry()[elf.name], undefined, '魂印沒有 handler');
    assert.ok(!elf.skillPool.some((s: any) => s.name === '屬性複製'), '未能完整表達的技能不放入技能池');
    assert.equal(hasSkillHandler('星光·魔動能量'), false);
    assert.deepEqual([elf.baseStats.hp, elf.baseStats.atk, elf.baseStats.spatk, elf.baseStats.speed], [171, 70, 141, 130]);
  });

  // self＝雷納多（帶魂印），速度 200 先手；opp 速度 100
  const soul = { soulMark: elf.soulMark };
  const duel = (side: 'p1' | 'p2', o: { selfSkills: any[]; oppSkills?: any[]; selfHp?: number; oppHp?: number; selfStages?: any; oppStages?: any; selfExtra?: any; oppExtra?: any; pick: (t: number) => [number, number]; n?: number; noSoul?: boolean; selfType?: string }) => h.play(side, {
    self: h.unit('S', o.selfHp ?? 20000, o.selfSkills, { maxHp: 20000, speed: 200, statStages: o.selfStages || {}, type: o.selfType || '機械', extra: { ...(o.noSoul ? {} : soul), ...(o.selfExtra || {}) } }),
    opp: h.unit('E', o.oppHp ?? 20000, o.oppSkills ?? [h.wait()], { maxHp: 20000, speed: 100, statStages: o.oppStages || {}, extra: o.oppExtra || {} }),
    turns: (_e: any, t: number) => o.pick(t),
  } as any, o.n ?? 1);

  for (const side of ['p1', 'p2'] as const) {
    const opp = otherOf(side);
    await check(`${side} 魂印①：雙方使用技能時各觸發一次令對手攻擊、特攻-1`, async () => {
      const [t1] = await duel(side, { selfSkills: [h.wait()], pick: () => [0, 0] });
      assert.equal(t1.opp.statStages.atk, -2); assert.equal(t1.opp.statStages.spatk, -2);
      assert.equal(t1.opp.statStages.def || 0, 0);
    });
    await check(`${side} 魂印①未觸發：解除自身異常、本場戰鬥攻擊傷害每次+30%（最高150%，跨回合保留）`, async () => {
      const hist = await duel(side, { selfSkills: [h.wait()], oppStages: { atk: -6, spatk: -6 }, pick: () => [0, 0], n: 3 });
      const reg = (i: number) => hist[i].state[`${side}RegistryState`].battleDamageBoost;
      assert.ok(Math.abs(reg(0) - 0.6) < 1e-9, '一回合雙方各一次 ' + reg(0));
      assert.ok(Math.abs(reg(2) - 1.5) < 1e-9, '上限150% ' + reg(2));
      const cured = (await duel(side, { selfSkills: [h.wait()], oppStages: { atk: -6, spatk: -6 }, selfExtra: { battleStatuses: { 中毒: 3 }, battleStatus: '中毒', battleStatusDuration: 3 }, pick: () => [0, 0] }))[0];
      assert.ok(!h.statuses(cured.self).includes('中毒'), '未觸發則解除自身異常');
    });
    await check(`${side} 魂印②：戰鬥階段結束對手處於能力下降→對手下回合屬性技能無效（下下回合恢復）`, async () => {
      const heal = h.healSkill(5000);
      const hist = await duel(side, { selfSkills: [h.wait()], oppSkills: [heal], oppHp: 10000, pick: () => [0, 0], n: 3 });
      // 回合1：對手補血成功（補到上限前） ；回合1結束時對手處於下降 → 回合2補血無效
      const hp1 = hist[0].opp.currentHp, hp2 = hist[1].opp.currentHp;
      assert.ok(hp1 > 10000, '回合1正常恢復');
      assert.equal(hp2, hp1, '回合2屬性技能無效');
    });
    await check(`${side} 魂印②：對手不處於能力下降→恢復1/3，溢出每10點換下回合受攻擊傷害-1%與10點護盾`, async () => {
      // 回合1：對手取得能力下降免疫（使用前已被魂印①降過）；回合2：魂印①失敗，對手解除自身下降 → 戰鬥階段結束時不處於下降
      const immune = h.kitSkill('免降', [{ op: 'immune_statdown_turns', p: { turns: 5 } }]);
      // 回合1結束時對手處於下降 → 回合2屬性技能無效，所以清除用攻擊技能
      const cleanse = h.kitSkill('清降', [{ op: 'stat_clear', p: { side: 'self', kind: 'down' } }], { category: '物理', power: 1, type: '普通' });
      const hist = await duel(side, { selfSkills: [h.wait()], oppSkills: [immune, cleanse], selfHp: 20000, pick: t => t === 1 ? [0, 0] : [0, 1], n: 2 });
      assert.equal(Object.values(hist[1].opp.statStages).filter((v: any) => v < 0).length, 0, '回合2對手不處於下降');
      const self = hist[1].self;
      // 滿血恢復 6666 全部溢出 → 666 次 → 減傷上限100%、護盾 6660
      assert.equal(self.shield, 6660, '護盾 ' + self.shield);
      assert.ok(h.timers(hist[1].state, side).some((t: string) => t.startsWith('溢出減傷100%')), h.timers(hist[1].state, side).join());
    });
    await check(`${side} 魂印③：自身有護盾時每次受到攻擊後消除對手能力提升`, async () => {
      const atk = { ...h.wait(), name: '打', category: '物理', power: 40, type: '普通' };
      const hist = await duel(side, { selfSkills: [h.wait()], oppSkills: [atk], oppStages: { def: 2 }, selfExtra: { shield: 5000 }, pick: () => [0, 0], noSoul: false });
      assert.equal(hist[0].opp.statStages.def || 0, 0, '對手提升被消除');
    });

    await check(`${side} 極速射線：消除回合類成功→對手下回合攻擊技能無效；雙方先制為0的方數→對手下回合先制-1`, async () => {
      const atk = { ...h.wait(), name: '打', category: '物理', power: 40, type: '普通' };
      const hist = await duel(side, { selfSkills: [ray, h.wait()], oppSkills: [h.turnEffectSkill(), atk], noSoul: true,
        pick: t => t === 1 ? [1, 0] : t === 2 ? [0, 1] : [1, 1], n: 3 });
      const t2 = hist[1];
      assert.ok(h.timers(t2.state, opp).some((t: string) => t.startsWith('攻擊技能無效')), h.timers(t2.state, opp).join());
      assert.ok(h.timers(t2.state, opp).some((t: string) => t.startsWith('先制-1')), '對手先制為0 → -1：' + h.timers(t2.state, opp).join());
      const selfHp2 = t2.self.currentHp, selfHp3 = hist[2].self.currentHp;
      assert.equal(selfHp3, selfHp2, '回合3對手攻擊技能無效');
    });
    await check(`${side} 合金壁壘：300護盾、護盾消失恢復1/3；3回合每回合全能力+1；提升不可被消除`, async () => {
      const big = { ...h.wait(), name: '重擊', category: '物理', power: 1500, type: '普通' };
      const clear = h.kitSkill('消強', [{ op: 'stat_clear', p: { side: 'opp', kind: 'up' } }]);
      const hist = await duel(side, { selfSkills: [wall, h.wait()], oppSkills: [clear, big], selfHp: 10000, noSoul: true,
        pick: t => t === 1 ? [0, 0] : [1, t === 2 ? 0 : 1], n: 4 });
      assert.equal(hist[0].self.shield, 300, '回合1獲得300護盾');
      for (const k of STAGES) assert.equal(hist[0].self.statStages[k], 1, '回合1結束+1 ' + k);
      for (const k of STAGES) assert.equal(hist[1].self.statStages[k], 2, '回合2：對手消強被擋，再+1 ' + k);
      for (const k of STAGES) assert.equal(hist[2].self.statStages[k], 3, '回合3 ' + k);
      for (const k of STAGES) assert.equal(hist[3].self.statStages[k], 3, '3回合後不再提升 ' + k);
      const hp3 = hist[2];
      assert.equal(hp3.self.shield || 0, 0, '回合3被重擊打破護盾');
      assert.ok(hp3.logs.some((l: string) => /恢復了 6666 點體力/.test(l)), '護盾消失時恢復最大體力1/3（20000/3）');
      assert.equal(hist[3].logs.filter((l: string) => /恢復了 6666 點體力/.test(l)).length, 1, '只觸發一次（日誌為累計）');
      // 4回合內免疫並反彈異常
      const poison = h.kitSkill('毒', [{ op: 'status', p: { side: 'opp', status: '中毒', turns: 3, chance: 100 } }]);
      const [r1] = await duel(side, { selfSkills: [wall], oppSkills: [poison], noSoul: true, pick: () => [0, 0] });
      assert.ok(!h.statuses(r1.self).includes('中毒'), '自身免疫'); assert.ok(h.statuses(r1.opp).includes('中毒'), '反彈給對手');
    });
    await check(`${side} 渦輪增壓：全屬性+1（體力低於1/2翻倍）；之後每回合使用技能恢復1/2並造成等量百分比傷害；下2回合先制+2`, async () => {
      const full = await duel(side, { selfSkills: [turbo, h.wait()], noSoul: true, pick: t => t === 1 ? [0, 0] : [1, 0], n: 2, selfHp: 20000 });
      for (const k of STAGES) assert.equal(full[0].self.statStages[k], 1, k);
      const low = await duel(side, { selfSkills: [turbo, h.wait()], noSoul: true, pick: t => t === 1 ? [0, 0] : [1, 0], n: 2, selfHp: 8000 });
      for (const k of STAGES) assert.equal(low[0].self.statStages[k], 2, '低血翻倍 ' + k);
      assert.equal(low[1].self.currentHp, 18000, '回合2使用技能恢復 1/2');
      assert.equal(20000 - low[1].opp.currentHp, 10000, '等量百分比傷害');
      assert.equal(low[1].state[`${side}RegistryState`].ignoreAttackImmunityNext, true, '下次攻擊無視攻擊免疫（尚未用掉）');
      const reg0 = full[0].state[`${side}RegistryState`];
      assert.equal(reg0.priorityBoostValue, 2); assert.equal(reg0.priorityBoostTurns, 2, '下2回合先制+2（回合1結束才啟用）');
    });
    await check(`${side} 能源吸收：吸取對手提升成功→對手癱瘓；吸取250（體力低於對手翻倍）；吸取PP 2點`, async () => {
      const [t1] = await duel(side, { selfSkills: [absorb], noSoul: true, oppStages: { atk: 2 }, selfHp: 5000, pick: () => [0, 0] });
      assert.equal(t1.self.statStages.atk, 2); assert.equal(t1.opp.statStages.atk || 0, 0);
      assert.ok(h.statuses(t1.opp).includes('癱瘓'), h.statuses(t1.opp).join());
      assert.equal(t1.opp.skills[0].pp, 99 - 2, 'PP 吸取2');
      const low = (await duel(side, { selfSkills: [absorb], noSoul: true, selfHp: 5000, pick: () => [0, 0] }))[0];
      const high = (await duel(side, { selfSkills: [absorb], noSoul: true, selfHp: 19000, oppHp: 10000, pick: () => [0, 0] }))[0];
      const lossLow = 20000 - low.opp.currentHp, lossHigh = 10000 - high.opp.currentHp;
      assert.equal(lossLow - lossHigh, 250, `體力低於對手：吸取500，否則250（${lossLow} vs ${lossHigh}）`);
    });
    await check(`${side} 魔動能量：每種能力提升威力+10、對手不處於下降則傷害×2、傷害高於300則1回合對手恢復-100%`, async () => {
      const base = (await duel(side, { selfSkills: [magic], noSoul: true, oppStages: { atk: -1 }, pick: () => [0, 0] }))[0];
      const up = (await duel(side, { selfSkills: [magic], noSoul: true, oppStages: { atk: -1 }, selfStages: { def: 1, spdef: 1 }, pick: () => [0, 0] }))[0];
      const dbl = (await duel(side, { selfSkills: [magic], noSoul: true, pick: () => [0, 0] }))[0];
      const d0 = 20000 - base.opp.currentHp, d1 = 20000 - up.opp.currentHp, d2 = 20000 - dbl.opp.currentHp;
      assert.ok(d1 > d0 && d1 / d0 < 1.2, `兩種提升 威力160→180：${d0}→${d1}`);
      assert.ok(d2 / d0 > 1.8 && d2 / d0 < 2.2, `對手不處於下降 ×2：${d0}→${d2}`);
      // 「1回合內」＝本回合：對手在雷納多之後的恢復無效；回合結束後到期
      const healed = (await duel(side, { selfSkills: [magic], oppSkills: [h.healSkill(5000)], noSoul: true, pick: () => [0, 0] }))[0];
      assert.equal(healed.opp.currentHp, 20000 - d2, '傷害高於300：對手本回合恢復無效');
      assert.ok(!h.timers(healed.state, opp).some((t: string) => t.startsWith('恢復效果')), '回合結束到期');
      const weak = (await duel(side, { selfSkills: [magic], oppSkills: [h.healSkill(5000)], noSoul: true, oppStages: { atk: -1, spdef: 6 }, oppHp: 20000, pick: () => [0, 0] }))[0];
      assert.ok(20000 - weak.opp.currentHp + 5000 > 0 && weak.opp.currentHp === 20000, `傷害不高於300：恢復照常（受傷 ${20000 - weak.opp.currentHp}）`);
    });
  }
  console.log(`${count} checks`);
} finally { await h.close(); }
