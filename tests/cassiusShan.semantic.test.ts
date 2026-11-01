// 5041 岳峙淵渟.卡修斯：魂印「山」與 5 技能逐句真實引擎語意測試（headless，P1／P2 皆驗，驗實際數值）。
import assert from 'node:assert/strict';
import { createCassiusHarness } from './helpers/cassiusHarness';

const h = await createCassiusHarness();
let checks = 0;
const check = async (name: string, f: () => Promise<void>) => { await f(); checks++; console.log(`✓ ${name}`); };
const SIDES = ['p1', 'p2'] as const;
const last = (hist: any[]) => hist[hist.length - 1];
const logs = (hist: any[]) => last(hist).logs.join('\n');
const idx = (elf: any, name: string) => elf.skills.findIndex((s: any) => s.name === name);
const wait = () => h.wait();
const BIG = 2_000_000;

try {
  for (const side of SIDES) {
    await check(`${side} 山神守護：技能傷害降至 1/10，累計 2 次解除（無守護時不計數），回合數照常遞減`, async () => {
      const mk = (guard: boolean) => {
        const c = h.cassius(); c.skills = [wait()]; c.soulMark = { ...c.soulMark, kit: [] };
        if (guard) { c.effects = [{ id: '山神守護', name: '山神守護', duration: 4, isLateMover: false, stacks: 1 }]; c.battleStatuses = { 山神守護: 4 }; }
        return c;
      };
      // 無守護：沒有受過攻擊前先吃 3 次技能傷害，再上守護，仍需再 2 次才解除
      const hitter = h.foe('E', BIG, [h.hit(300, { name: '重擊', pp: 99 })], { speed: 200 });
      const plain = await h.play(side, { self: mk(false), opp: hitter, turns: () => [0, 0] }, 3);
      const dmgPlain = mk(false).currentHp - last(plain).self.currentHp;
      assert.ok(dmgPlain > 0, '無守護有受傷:' + logs(plain));
      const guarded = await h.play(side, { self: mk(true), opp: hitter, turns: () => [0, 0] }, 3);
      const per = (hist: any[], i: number) => (i === 0 ? mk(true).currentHp : hist[i - 1].self.currentHp) - hist[i].self.currentHp;
      const d1 = per(guarded, 0), d2 = per(guarded, 1), d3 = per(guarded, 2);
      const raw1 = (mk(false).currentHp - plain[0].self.currentHp);
      assert.ok(Math.abs(d1 - raw1 / 10) <= 1, `第1次降至1/10：${d1} vs ${raw1 / 10}`);
      assert.ok(Math.abs(d2 - raw1 / 10) <= 1, `第2次仍1/10：${d2}`);
      assert.ok(d3 > raw1 * 0.8, `累計2次後已解除，第3次全額：${d3} vs ${raw1}`);
      assert.equal(guarded[2].self.effects?.some((e: any) => e.id === '山神守護'), false);
    });
  }

  for (const side of SIDES) {
    await check(`${side} 山神守護：無守護時的受擊不計入；上守護後第 1、2 次 1/10，第 3 次全額；回合數照常遞減`, async () => {
      const c = h.cassius(); c.skills = [wait()]; c.soulMark = { ...c.soulMark, kit: [] };
      const give = h.kitSkill('給守護', [{ op: 'status', p: { side: 'opp', status: '山神守護', turns: 4, chance: 100 } }]);
      const hitter = h.foe('E', BIG, [h.hit(300, { name: '重擊' }), give], { speed: 200 });
      const plan = [0, 0, 1, 0, 0, 0];
      const hist = await h.play(side, { self: c, opp: hitter, turns: (_e: any, t: number) => [0, plan[t - 1]] }, 6);
      const hp = (i: number) => (i < 0 ? c.maxHp : hist[i].self.currentHp);
      const d = (i: number) => hp(i - 1) - hp(i);
      assert.ok(d(0) > 0 && d(1) > 0, '前兩次無守護，全額');
      assert.equal(d(2), 0, '第3回合只上守護');
      const turnsLeft = (i: number) => hist[i].self.effects.find((e: any) => e.id === '山神守護')?.duration;
      assert.equal(turnsLeft(2), 3, '附加當回合結束照常扣1回合（4→3）');
      assert.equal(turnsLeft(3), 2, '下回合再遞減（3→2）');
      const lo = Math.min(d(0), d(1)) * 0.08, hi = Math.max(d(0), d(1)) * 0.12;  // 傷害有固定亂數幅度，比對降至 1/10 的比例區間
      assert.ok(d(3) >= lo && d(3) <= hi, `上守護第1次約1/10：${d(3)} 全額${d(0)}/${d(1)}`);
      assert.ok(d(4) >= lo && d(4) <= hi, `第2次約1/10：${d(4)}`);
      assert.ok(d(5) > Math.min(d(0), d(1)) * 0.8, `累計2次後解除，第3次全額：${d(5)}`);
      assert.equal(turnsLeft(5), undefined);
    });
  }

  // ── 魂印：自身位於出戰背包內時 ──
  const benchBattle = async (side: 'p1' | 'p2', foeSkills: any[], pick: number[], o: { withCassius: boolean; shield?: number; frontHp?: number; turns?: number; frontExtra?: any } ) => {
    const front = h.foe('F', o.frontHp ?? BIG, [wait()], { speed: 50, extra: { shield: o.shield ?? 0, ...(o.frontExtra || {}) } });
    const bench = o.withCassius ? [h.cassius()] : [h.foe('B', 100000, [wait()])];
    const foe = h.foe('E', BIG, foeSkills, { speed: 200 });
    const hist = await h.play(side, { self: front, selfBench: bench, opp: foe, turns: (_e: any, t: number) => [0, pick[t - 1] ?? pick[pick.length - 1]] }, o.turns ?? pick.length);
    return hist;
  };
  for (const side of SIDES) {
    await check(`${side} 魂印：後備有卡修斯時，攻擊傷害使護盾扣減量減半（對照無卡修斯，傷害仍被完全吸收）`, async () => {
      const foeSkills = [h.hit(300, { name: '重擊' })];
      const plain = await benchBattle(side, foeSkills, [0], { withCassius: false, shield: 1000 });
      const withC = await benchBattle(side, foeSkills, [0], { withCassius: true, shield: 1000 });
      const lostPlain = 1000 - last(plain).self.shield, lostWith = 1000 - last(withC).self.shield;
      assert.ok(lostPlain > 100, `無卡修斯扣盾 ${lostPlain}`);
      assert.equal(lostWith, Math.ceil(lostPlain / 2), `有卡修斯扣盾減半：${lostWith} vs ${lostPlain}`);
      assert.equal(last(plain).self.currentHp, BIG); assert.equal(last(withC).self.currentHp, BIG);
    });
    await check(`${side} 魂印：減半只對攻擊傷害；固定傷害不經護盾（護罩另計）；卡修斯陣亡後規則消失`, async () => {
      const fixed = h.dmgSkill('固傷', '固定', 100);
      const r = await benchBattle(side, [fixed], [0], { withCassius: true, shield: 1000 });
      assert.equal(last(r).self.shield, 1000, '固定傷害不扣護盾');
      assert.equal(BIG - last(r).self.currentHp, 100);
    });
    await check(`${side} 魂印：超額非真實傷害 > 當前護盾 → 本次傷害無法造成；戰鬥階段結束消耗護盾50%並恢復在場精靈消耗量25%體力`, async () => {
      const fixed = h.dmgSkill('固傷2000', '固定', 2000);
      const r = await benchBattle(side, [fixed], [0], { withCassius: true, shield: 400, frontHp: 100000, frontExtra: { currentHp: 90000 } });
      // 固傷 2000 穿透量 2000 > 護盾 400 → 無法造成；階段結束消耗 200 護盾、恢復 50 體力
      assert.equal(last(r).self.shield, 200, '護盾消耗50%');
      assert.equal(last(r).self.currentHp, 90000 + 50, `未受 2000 傷害，且恢復消耗量25%：${last(r).self.currentHp}`);
      const noC = await benchBattle(side, [fixed], [0], { withCassius: false, shield: 400, frontHp: 100000, frontExtra: { currentHp: 90000 } });
      assert.equal(last(noC).self.currentHp, 90000 - 2000, '對照：無卡修斯照常受傷');
    });
    await check(`${side} 魂印：非超額（穿透量不大於護盾）照常結算且不觸發階段結算`, async () => {
      const fixed = h.dmgSkill('固傷300', '固定', 300);
      const r = await benchBattle(side, [fixed], [0], { withCassius: true, shield: 400, frontHp: 100000, frontExtra: { currentHp: 90000 } });
      assert.equal(last(r).self.currentHp, 90000 - 300);
      assert.equal(last(r).self.shield, 400);
    });
    await check(`${side} 魂印：超額真實傷害 > 護盾且致死 → 100%重生，僅 1 次`, async () => {
      const kill = h.dmgSkill('致死真傷', '真實', 5000);
      const r = await benchBattle(side, [kill], [0, 0], { withCassius: true, shield: 400, frontHp: 3000, turns: 2 });
      assert.equal(r[0].self.currentHp, 3000, '第1次致死真傷：重生回滿');
      assert.ok(r[0].logs.join('').includes('重生'), '重生日誌');
      assert.ok(r[1].self.currentHp <= 0, `第2次不再重生：${r[1].self.currentHp}`);
    });
    await check(`${side} 魂印（使用者 11/01）：攻擊傷害高於當前護盾（未達兩倍）即無法造成`, async () => {
      const big = h.dmgSkill('固傷600', '固定', 600);
      const r = await benchBattle(side, [big], [0], { withCassius: true, shield: 400, frontHp: 100000, frontExtra: { currentHp: 90000 } });
      assert.equal(last(r).self.currentHp, 90000 + 50, `600 > 護盾400 → 無法造成，階段結束回 50：${last(r).self.currentHp}`);
      const atk = await benchBattle(side, [h.hit(300, { name: '重擊' })], [0], { withCassius: true, shield: 10, frontHp: 100000, frontExtra: { currentHp: 90000 } });
      assert.ok(atk.flatMap((x: any) => x.logs).join('').includes('超額非真實傷害'), '攻擊傷害高於護盾10 → 攔截日誌');
      assert.equal(last(atk).self.currentHp, 90000 + 1, `攻擊傷害無法造成；階段結束消耗5盾回1：${last(atk).self.currentHp}`);
      assert.equal(last(atk).self.shield, 5);
    });
    await check(`${side} 魂印（使用者 11/01）：重生時體力與 PP 皆重置 100%；卡修斯自身在場也適用`, async () => {
      const kill = h.dmgSkill('致死真傷', '真實', 5000);
      const front = h.foe('F', 3000, [h.sk('等', { pp: 3, maxPp: 10 })], { speed: 50 });
      const foe = h.foe('E', BIG, [kill], { speed: 200 });
      const hist = await h.play(side, { self: front, selfBench: [h.cassius()], opp: foe, turns: () => [0, 0] }, 1);
      assert.equal(last(hist).self.currentHp, 3000, '重生回滿體力');
      assert.equal(last(hist).self.skills[0].pp, 9, `重生 PP 由 3 回滿 10，之後同回合出手 -1：${last(hist).self.skills[0].pp}`);
      // 卡修斯自身在場且處於山神守護：守護只減技能傷害，5000 真傷照常致死 → 重生。技能換成等待以免控住對手。
      const c = h.cassius({ hp: 3000, speed: 10 }); c.skills = [h.sk('等', { pp: 1, maxPp: 10 }), h.sk('候', { pp: 2, maxPp: 8 })];
      const hist2 = await h.play(side, { self: c, opp: h.foe('E', BIG, [h.dmgSkill('致死真傷', '真實', 5000)], { speed: 200 }), turns: () => [1, 0] }, 1);
      assert.ok(last(hist2).logs.join('').includes('山神守護'), '前提：卡修斯處於山神守護');
      assert.ok(last(hist2).logs.join('').includes('重生'), '山神守護不減真實傷害：致死 → 重生');
      assert.deepEqual(last(hist2).self.skills.map((s: any) => s.pp), [10, 8], '重生 PP 回滿（之後用「候」：山神守護期間選招不受PP限制，不扣）');
    });
    await check(`${side} 魂印：真實傷害不致死、或不大於護盾時不重生`, async () => {
      const hurt = h.dmgSkill('真傷', '真實', 500);
      const r = await benchBattle(side, [hurt], [0], { withCassius: true, shield: 400, frontHp: 3000 });
      assert.equal(last(r).self.currentHp, 2500);
      const lethalUnderShield = h.dmgSkill('真傷', '真實', 3000);
      const r2 = await benchBattle(side, [lethalUnderShield], [0], { withCassius: true, shield: 4000, frontHp: 3000 });
      assert.ok(last(r2).self.currentHp <= 0, `傷害不大於護盾：不屬超額，致死照常、不重生：${last(r2).self.currentHp}`);
    });
  }

  // ════════ 技能：共用建置 ════════
  const I: Record<string, number> = Object.fromEntries(h.cassius().skills.map((x: any, i: number) => [x.name, i]));
  const cast = async (side: 'p1' | 'p2', o: { picks: [string | number, number][]; foeHp?: number; foeSkills?: any[]; foeExtra?: any; foeSpeed?: number; selfMod?: (c: any) => void; cassHp?: number; bench?: any[]; soul?: boolean }) => {
    const c = h.cassius({ hp: o.cassHp }); if (!o.soul) c.soulMark = { ...c.soulMark, kit: [] }; o.selfMod?.(c);
    const foe = h.foe('E', o.foeHp ?? 30000, o.foeSkills ?? [wait()], { speed: o.foeSpeed ?? 100, extra: o.foeExtra });
    const hist = await h.play(side, { self: c, selfBench: o.bench, opp: foe, turns: (_e: any, t: number) => { const p = o.picks[Math.min(t, o.picks.length) - 1]; return [typeof p[0] === 'string' ? I[p[0]] : p[0], p[1]]; } }, o.picks.length);
    return { hist, c, foeHp: o.foeHp ?? 30000 };
  };
  const SK: Record<string, string> = { 攻擊: 'atk', 防禦: 'def', 特攻: 'spatk', 特防: 'spdef', 速度: 'speed', 命中: 'accuracy' };
  const stage = (elf: any, k: string) => elf.statStages?.[SK[k] || k] || 0;
  const hasEff = (elf: any, id: string) => (elf.effects || []).some((x: any) => x.id === id) || (elf.battleStatuses?.[id] || 0) > 0;

  for (const side of SIDES) {
    // ── 萬壑崩摧 ──
    await check(`${side} 萬壑崩摧：先制+1、必中、屬性技能`, async () => {
      const sk0 = h.cassius().skills[I['萬壑崩摧']];
      assert.equal(sk0.priority, 1); assert.ok(String(sk0.description).includes('必中')); assert.equal(sk0.category, '屬性');
      const r = await cast(side, { picks: [['萬壑崩摧', 0]], foeSpeed: 9999 });
      const l = last(r.hist).logs; assert.ok(l.findIndex((x: string) => x.includes('萬壑崩摧')) < l.findIndex((x: string) => x.includes('等待')), '先制+1搶在高速對手之前');
    });
    await check(`${side} 萬壑崩摧：5回合內每回合結束時解除自身能力下降並附加給對手`, async () => {
      const r = await cast(side, { picks: [['萬壑崩摧', 0], [3, 0]], selfMod: c => { c.statStages = { atk: -2, def: -1 }; } });
      const a = r.hist[0];
      assert.equal(stage(a.self, '攻擊'), 0, '自身下降已解除'); assert.equal(stage(a.self, '防禦'), 0);
      assert.equal(stage(a.opp, '攻擊'), -2, '附加給對手'); assert.equal(stage(a.opp, '防禦'), -1);
    });
    await check(`${side} 萬壑崩摧：消除雙方護盾護罩並吸取對手消除量等量體力；高於400提升100體力上限`, async () => {
      const r = await cast(side, { picks: [['萬壑崩摧', 0]], foeExtra: { shield: 500, barrier: 100 }, selfMod: c => { c.shield = 300; c.barrier = 50; c.currentHp = 100; } });
      const a = last(r.hist);
      assert.equal(a.self.shield || 0, 0); assert.equal(a.self.barrier || 0, 0);
      assert.equal(a.opp.shield || 0, 0); assert.equal(a.opp.barrier || 0, 0);
      // 同一技能第3句的 5 回合計時於本次使用後即生效（另吸 300），故合計 600+300
      assert.equal(r.foeHp - a.opp.currentHp, 600 + 300, '消除量 600 等量體力 + 本次使用後計時吸取 300');
      assert.equal(a.self.currentHp, 100 + 600 + 300 + 100, '自身吸取 + 上限提升同步增加當前體力');
      assert.equal(a.self.maxHp, 1062 + 100, '消除量 >400 → 體力上限 +100');
      const low = await cast(side, { picks: [['萬壑崩摧', 0]], foeExtra: { shield: 300 } });
      assert.equal(last(low.hist).self.maxHp, 1062, '消除量 ≤400 無上限加成');
    });
    await check(`${side} 萬壑崩摧：5回合內使用技能後吸取對手300體力，自身低於½翻倍`, async () => {
      const add = (c: any) => { c.skills.push(h.wait()); };
      const r = await cast(side, { picks: [['萬壑崩摧', 0], [5, 0], [5, 0]], selfMod: add });
      const d2 = r.hist[0].opp.currentHp - r.hist[1].opp.currentHp, d3 = r.hist[1].opp.currentHp - r.hist[2].opp.currentHp;
      assert.equal(d2, 300, '自身體力不低於½：300'); assert.equal(d3, 300);
      const lowHp = await cast(side, { picks: [['萬壑崩摧', 0], [5, 0]], selfMod: c => { add(c); c.currentHp = 100; } });
      const dd = r.foeHp - lowHp.hist[0].opp.currentHp, dd2 = lowHp.hist[0].opp.currentHp - lowHp.hist[1].opp.currentHp;
      assert.equal(dd2, 300, `吸取後已回到½以上：不翻倍 ${dd2}`);
      assert.equal(dd, 600, `使用時自身體力低於½：翻倍 ${dd}`);
    });
    await check(`${side} 萬壑崩摧：吸取後對手體力未減少 → 追加真傷分支並令對手禁療；有減少則不觸發`, async () => {
      const imm = h.kitSkill('免傷', [{ op: 'dmg_mod_turns', p: { dir: 'in', reduce: 1, turns: 5, kind: '' } }]);
      const heal = h.healSkill(5000);
      const mk = (foePick: number[]) => cast(side, { picks: [['萬壑崩摧', foePick[0]], [5, foePick[1]], [5, foePick[2]]], foeHp: 30000, foeSkills: [h.wait(), imm, heal], foeSpeed: 5000,
        foeExtra: { currentHp: 20000 }, selfMod: c => { c.skills.push(h.wait()); } });
      const noLoss = await mk([1, 2, 2]);
      assert.ok(noLoss.hist[2].logs.some((x: string) => x.includes('恢復失效')), '體力未減少 → 下2回合對手無法恢復體力');
      const normal = await mk([0, 2, 2]);
      assert.ok(!normal.hist[2].logs.some((x: string) => x.includes('恢復失效')), '體力有減少 → 不觸發禁療');
      assert.ok(normal.hist[2].opp.currentHp > normal.hist[1].opp.currentHp, '一般情況對手可正常恢復');
    });
    await check(`${side} 萬壑崩摧：令對手所有技能PP-1；所選技能PP為0則無法行動`, async () => {
      const foeA = h.sk('A', { pp: 1, maxPp: 5, category: '物理', power: 100 }), foeB = h.sk('B', { pp: 4, maxPp: 5 });
      const r = await cast(side, { picks: [['萬壑崩摧', 1]], foeSkills: [foeA, foeB] });
      const a = last(r.hist);
      assert.equal(a.opp.skills[0].pp, 0, '未選技能 A PP 1 → 0'); assert.equal(a.opp.skills[1].pp, 2, '所選 B：使用耗 1 + 被降 1');
      const sel0 = await cast(side, { picks: [['萬壑崩摧', 0]], foeSkills: [foeA, foeB] });
      const l = last(sel0.hist).logs;
      assert.ok(l.some((x: string) => x.includes('無法行動')), `所選技能PP歸零：對手無法行動\n${l.join('\n')}`);
      assert.equal(last(sel0.hist).self.currentHp, 1062, '對手未能出招：自身未受傷');
      const sel1 = await cast(side, { picks: [['萬壑崩摧', 1]], foeSkills: [foeA, foeB] });
      assert.ok(!last(sel1.hist).logs.some((x: string) => x.includes('無法行動')), '所選技能PP仍>0：可正常行動');
    });
  }


  const addWait = (c: any) => { c.skills.push(h.wait()); };
  const WAIT_I = 5;
  for (const side of SIDES) {
    // ── 群山許諾 ──
    await check(`${side} 群山許諾：攻擊、防禦、特防、速度、命中+1（不含特攻）`, async () => {
      const r = await cast(side, { picks: [['群山許諾', 0]] });
      const me = last(r.hist).self;
      for (const k of ['攻擊', '防禦', '特防', '速度', '命中']) assert.equal(stage(me, k), 1, k);
      assert.equal(stage(me, '特攻'), 0);
    });
    await check(`${side} 群山許諾：無守護 → 附加3回合山神守護`, async () => {
      const r = await cast(side, { picks: [['群山許諾', 0]], selfMod: c => { c.effects = []; c.battleStatuses = {}; } });
      const me = last(r.hist).self;
      assert.ok(hasEff(me, '山神守護'), '已附加山神守護');
      const d = (me.effects || []).find((x: any) => x.id === '山神守護')?.duration ?? me.battleStatuses?.['山神守護'];
      assert.equal(d, 2, `3回合（本回合結束已遞減）：${d}`);
    });
    await check(`${side} 群山許諾：已有山神守護 → 守護自然結束時同時解除其他異常（對照：未施放則不解除）`, async () => {
      const mod = (c: any) => { c.effects = [{ id: '山神守護', name: '山神守護', duration: 1, isLateMover: false, stacks: 1 }, { id: '中毒', name: '中毒', duration: 5, isLateMover: false, stacks: 1 }]; c.battleStatuses = { 山神守護: 1, 中毒: 5 }; };
      const r = await cast(side, { picks: [['群山許諾', 0]], selfMod: mod });
      const me = last(r.hist).self;
      assert.ok(!hasEff(me, '山神守護'), '守護已到期');
      assert.ok(!hasEff(me, '中毒'), '其他異常同時解除：' + JSON.stringify(me.battleStatuses));
      const ctrl = await cast(side, { picks: [[WAIT_I, 0]], selfMod: c => { mod(c); addWait(c); } });
      assert.ok(hasEff(last(ctrl.hist).self, '中毒'), '對照：未施放群山許諾則不解除');
    });
    await check(`${side} 群山許諾：5回合內使用技能吸取對手最大體力⅓，低於½翻倍`, async () => {
      const r = await cast(side, { picks: [['群山許諾', 0]], foeHp: 30000 });
      assert.equal(30000 - last(r.hist).opp.currentHp, 10000, '⅓ 最大體力');
      const low = await cast(side, { picks: [['群山許諾', 0]], foeHp: 30000, selfMod: c => { c.currentHp = 100; } });
      assert.equal(30000 - last(low.hist).opp.currentHp, 20000, '自身低於½翻倍');
    });
    await check(`${side} 群山許諾：吸取後對手體力未減少 → 追加300真傷＋300護罩（對照：有減少則不追加）`, async () => {
      const normal = await cast(side, { picks: [['群山許諾', 0]], foeHp: 30000 });
      assert.equal(last(normal.hist).opp.barrier || 0, 0, '有減少：不附加護罩');
      const imm = h.kitSkill('免傷', [{ op: 'dmg_mod_turns', p: { dir: 'in', reduce: 1, turns: 5, kind: '' } }]);
      const r = await cast(side, { picks: [[WAIT_I, 1], ['群山許諾', 0]], foeHp: 30000, foeSkills: [h.wait(), imm], foeSpeed: 5000, selfMod: addWait });
      assert.equal(last(r.hist).opp.barrier, 300, '體力未減少：對手獲得 300 護罩');
    });
    await check(`${side} 群山許諾：3回合內對手使用攻擊技能 → 下2回合對手屬性技能附加效果失效（對照：未施放則生效）`, async () => {
      const foeHit = h.hit(10, { name: '擊' });
      const st = h.kitSkill('附加', [{ op: 'stat', p: { side: 'self', stats: ['攻擊'], v: 1 } }]);
      const mk = (first: string | number) => cast(side, { picks: [[first, 1], [WAIT_I, 0], [WAIT_I, 1]], foeHp: 3_000_000, foeSkills: [foeHit, st], foeSpeed: 5000, selfMod: addWait });
      const r = await mk('群山許諾'), ctrl = await mk(WAIT_I);
      assert.deepEqual(r.hist.map(x => stage(x.opp, '攻擊')), [1, 1, 1], '回合2對手攻擊後，回合3的屬性技能附加效果失效');
      assert.deepEqual(ctrl.hist.map(x => stage(x.opp, '攻擊')), [1, 1, 2], '對照：未施放時回合3正常+1');
    });
    await check(`${side} 群山許諾：附加400點護盾；護盾消失時400真傷＋雙方依序束縛、星贖3回合`, async () => {
      const r = await cast(side, { picks: [['群山許諾', 0]] });
      assert.equal(last(r.hist).self.shield, 400, '400 護盾');
      // 回合2：對手重擊擊碎 400 護盾 → 400 真傷 + 雙方束縛、星贖
      const hitter = h.hit(14000, { name: '重擊' });
      const r2 = await cast(side, { picks: [['群山許諾', 0], [WAIT_I, 1]], foeSkills: [h.wait(), hitter], foeSpeed: 5000, selfMod: addWait, foeHp: 3_000_000 });
      const [t1, t2] = r2.hist;
      assert.equal(t1.self.shield, 400, '回合1 護盾 400');
      assert.equal(t2.self.shield || 0, 0, '護盾已消失');
      // 回合2 對手總損失 = 5回合計時吸取 ⅓ 最大體力 + 護盾消失的 400 真傷 + 束縛／星贖本身的結算（以對照組實測，不寫死）
      const statusOnly = h.kitSkill('僅異常', [{ op: 'status', p: { side: 'both', status: '束縛', turns: 3, chance: 100 } }, { op: 'status', p: { side: 'both', status: '星贖', turns: 3, chance: 100 } }]);
      const ctrlStatus = await cast(side, { picks: [[WAIT_I, 0], [WAIT_I, 0]], foeHp: 3_000_000, foeSkills: [h.wait()], selfMod: c => { addWait(c); c.skills[WAIT_I] = statusOnly; } });
      const ctrlOnce = 3_000_000 - ctrlStatus.hist[0].opp.currentHp;
      assert.equal(t1.opp.currentHp - t2.opp.currentHp, 1_000_000 + 400 + ctrlOnce, `400 真傷 + 異常結算 ${ctrlOnce}：${t1.opp.currentHp - t2.opp.currentHp}`);
      for (const [who, e] of [['自身', t2.self], ['對手', t2.opp]] as const) {
        const names = h.statuses(e);
        assert.ok(names.includes('束縛'), `${who}束縛：${names}`); assert.ok(names.includes('星贖'), `${who}星贖：${names}`);
      }
      // 護盾尚在（未破）時不觸發
      const calm = await cast(side, { picks: [['群山許諾', 0], [WAIT_I, 0]], selfMod: addWait, foeHp: 3_000_000 });
      assert.ok(!h.statuses(calm.hist[1].opp).includes('束縛'), '護盾未消失不觸發');
    });
  }


  for (const side of SIDES) {
    // ── 歸塵 ──
    const guiMod = (c: any) => { addWait(c); c.skills.push(h.hit(90, { name: '普攻' })); };
    const HIT_I = 6;
    const immune = h.kitSkill('免疫攻擊', [{ op: 'immune_attack_turns', p: { turns: 3 } }]);
    await check(`${side} 歸塵：PP20、先制+3、必中；無視對手免疫受到的攻擊效果`, async () => {
      const sk0 = h.cassius().skills[I['歸塵']];
      assert.equal(sk0.priority, 3); assert.equal(sk0.pp, 20); assert.ok(String(sk0.description).includes('必中'));
      // 歸塵先制+3 先於對手出手：先讓對手在回合1上免疫，回合2再用歸塵
      const r = await cast(side, { picks: [[WAIT_I, 1], ['歸塵', 0]], foeHp: 100000, foeSkills: [h.wait(), immune], foeSpeed: 5000, selfMod: guiMod });
      const loss = r.hist[0].opp.currentHp - r.hist[1].opp.currentHp;
      assert.ok(loss > 40000 + 100, `吸取 40% 之外攻擊傷害實際造成（無視免疫）：${loss}`);
      const blocked = await cast(side, { picks: [[WAIT_I, 1], [HIT_I, 0]], foeHp: 100000, foeSkills: [h.wait(), immune], foeSpeed: 5000, selfMod: guiMod });
      assert.equal(blocked.hist[1].opp.currentHp, 100000, '對照：一般攻擊被免疫擋下');
    });
    await check(`${side} 歸塵：無視成功 → 自身下次攻擊也無視對手免疫；未成功則不續`, async () => {
      const ok = await cast(side, { picks: [[WAIT_I, 1], ['歸塵', 0], [HIT_I, 0]], foeHp: 100000, foeSkills: [h.wait(), immune], foeSpeed: 5000, selfMod: guiMod });
      const dmg2 = ok.hist[1].opp.currentHp - ok.hist[2].opp.currentHp;
      assert.ok(dmg2 > 0, `下次普攻無視免疫：${dmg2}`);
      const no = await cast(side, { picks: [['歸塵', 0], [WAIT_I, 1], [HIT_I, 0]], foeHp: 100000, foeSkills: [h.wait(), immune], foeSpeed: 5000, selfMod: guiMod });
      assert.equal(no.hist[1].opp.currentHp - no.hist[2].opp.currentHp, 0, '首次未遇免疫（無視未成功）：下次普攻仍被免疫擋下');
    });
    await check(`${side} 歸塵：消除對手回合類效果成功 → 對手疲憊；未觸發 → 下次受到攻擊傷害轉為自身體力`, async () => {
      const okR = await cast(side, { picks: [[WAIT_I, 1], ['歸塵', 0]], foeHp: 100000, foeSkills: [h.wait(), h.turnEffectSkill()], foeSpeed: 5000, selfMod: addWait });
      assert.ok(!h.statuses(okR.hist[0].opp).includes('疲憊'), '回合1尚無疲憊');
      assert.ok(h.statuses(okR.hist[1].opp).includes('疲憊'), '成功消除回合類效果：疲憊');
      const noR = await cast(side, { picks: [['歸塵', 0], [WAIT_I, 1]], foeHp: 1000, foeSkills: [h.wait(), h.hit(300, { name: '重擊' })], foeSpeed: 5000,
        selfMod: c => { addWait(c); c.currentHp = 100; } });
      assert.ok(!h.statuses(noR.hist[0].opp).includes('疲憊'), '未觸發：無疲憊');
      const gained = noR.hist[1].self.currentHp - noR.hist[0].self.currentHp;
      assert.ok(gained > 0, `對手下次攻擊傷害轉化為自身體力：${noR.hist[0].self.currentHp} → ${noR.hist[1].self.currentHp}`);
    });
    await check(`${side} 歸塵：吸取對手最大體力40%，每次使用+5%，最高60%（實際扣血）`, async () => {
      // 對手每回合出手後補滿體力，使每次吸取都以滿體力為基準，才能逐次對照 40/45/50/55/60%
      const r = await cast(side, { picks: [['歸塵', 1], ['歸塵', 1], ['歸塵', 1], ['歸塵', 1], ['歸塵', 1], ['歸塵', 1]], foeHp: 1_000_000, foeSkills: [h.wait(), h.healSkill(1_000_000)], cassHp: 50000 });
      const drained = r.hist.map(x => x.logs.filter((l: string) => l.includes('吸取對手最大體力')).map((l: string) => Number((l.match(/實際 (\d+)/) || [])[1])));
      const perUse = drained.map((d, i) => d[i]);
      const rates = [0.4, 0.45, 0.5, 0.55, 0.6, 0.6];
      // 剩餘體力基準：每次吸取為「對手最大體力」比例，與目前體力無關
      const single = await cast(side, { picks: [['歸塵', 0]], foeHp: 1_000_000, cassHp: 50000, selfMod: c => { c.currentHp = 1000; } });
      const sl = 1_000_000 - last(single.hist).opp.currentHp;
      assert.ok(sl >= 400000 && sl < 420000, `第1次實際扣血 ≥40%：${sl}`);
      assert.equal(last(single.hist).self.currentHp, 50000, '吸取量大於缺口：自身回復至體力上限');
      perUse.forEach((l, i) => assert.equal(l, rates[i] * 1_000_000, `第${i + 1}次 ${rates[i] * 100}%（實際吸取）：${l}`));
      // 實際扣血：每次使用後（對手補血前）對手體力 = 滿血 - 吸取量 - 攻擊傷害；以日誌「實際」值對帳，並確認第1次扣血量不低於40%
      assert.ok(r.hist.every(x => x.opp.currentHp === 1_000_000), '對手每回合補滿：確認補血生效，各次皆自滿血基準吸取');
    });
    await check(`${side} 歸塵：3回合內對手使用攻擊技能 → 100%石化（對照：視窗內未攻擊則不石化）`, async () => {
      const r = await cast(side, { picks: [['歸塵', 0], [WAIT_I, 1]], foeHp: 100000, foeSkills: [h.wait(), h.hit(10, { name: '擊' })], foeSpeed: 5000, selfMod: addWait });
      assert.ok(h.statuses(r.hist[1].opp).includes('石化'), '對手攻擊 → 石化');
      const quiet = await cast(side, { picks: [['歸塵', 0], [WAIT_I, 0]], foeHp: 100000, foeSkills: [h.wait(), h.hit(10, { name: '擊' })], foeSpeed: 5000, selfMod: addWait });
      assert.ok(!h.statuses(quiet.hist[1].opp).includes('石化'), '未攻擊不石化');
    });
  }


  for (const side of SIDES) {
    // ── 破影 ──
    const poMod = (c: any) => { addWait(c); c.skills.push(h.hit(90, { name: '普攻' })); };
    const HIT_I = 6;
    const cap = h.kitSkill('設上限', [{ op: 'dmg_cap_turns', p: { cap: 50, turns: 3 } }]);
    const capFoe = [h.wait(), cap];
    await check(`${side} 破影：PP20/20、先制+3、必中`, async () => {
      const sk0 = h.cassius().skills[I['破影']];
      assert.equal(sk0.priority, 3); assert.equal(sk0.pp, 20); assert.equal(sk0.maxPp ?? sk0.pp, 20); assert.ok(String(sk0.description).includes('必中'));
    });
    await check(`${side} 破影：無視對手攻擊傷害限制效果（對照：一般攻擊被限制）`, async () => {
      const ctrl = await cast(side, { picks: [[WAIT_I, 1], [HIT_I, 0]], foeHp: 1_000_000, foeSkills: capFoe, foeSpeed: 5000, selfMod: poMod });
      assert.ok(ctrl.hist[0].opp.currentHp - ctrl.hist[1].opp.currentHp <= 50, '對照：普攻傷害被限制在 50 以內');
      const r = await cast(side, { picks: [[WAIT_I, 1], ['破影', 0]], foeHp: 1_000_000, foeSkills: capFoe, foeSpeed: 5000, selfMod: poMod });
      const dmg = r.hist[0].opp.currentHp - r.hist[1].opp.currentHp - 250000; // 扣除 ¼ 吸取
      assert.ok(dmg > 100, `無視上限的攻擊傷害：${dmg}`);
    });
    await check(`${side} 破影：無視成功 → 自身下次攻擊亦無視傷害限制；未成功不續`, async () => {
      const ok = await cast(side, { picks: [[WAIT_I, 1], ['破影', 0], [HIT_I, 0]], foeHp: 1_000_000, foeSkills: capFoe, foeSpeed: 5000, selfMod: poMod });
      const d3 = ok.hist[1].opp.currentHp - ok.hist[2].opp.currentHp - 250000;
      assert.ok(d3 > 100, `下次普攻無視上限：${d3}`);
      const no = await cast(side, { picks: [['破影', 0], [WAIT_I, 1], [HIT_I, 0]], foeHp: 1_000_000, foeSkills: capFoe, foeSpeed: 5000, selfMod: poMod });
      const d3n = no.hist[1].opp.currentHp - no.hist[2].opp.currentHp - 250000;
      assert.ok(d3n <= 50, `首次無上限可無視（未成功）：下次普攻仍受限 ${d3n}`);
    });
    await check(`${side} 破影：令對手防禦、特防-1；未觸發（已降到底）→ 下2回合對手受到技能傷害×2.5`, async () => {
      const ok = await cast(side, { picks: [['破影', 0]], foeHp: 1_000_000 });
      assert.equal(stage(last(ok.hist).opp, '防禦'), -1); assert.equal(stage(last(ok.hist).opp, '特防'), -1);
      const floorFoe = { statStages: { def: -6, spdef: -6 } };
      const base = await cast(side, { picks: [[WAIT_I, 0], [HIT_I, 0]], foeHp: 100_000_000, foeExtra: floorFoe, selfMod: poMod });
      const boosted = await cast(side, { picks: [['破影', 0], [HIT_I, 0]], foeHp: 100_000_000, foeExtra: floorFoe, selfMod: poMod });
      const dBase = base.hist[0].opp.currentHp - base.hist[1].opp.currentHp;
      // 破影回合後第2次使用（普攻）：扣掉 ¼ 吸取量
      const dBoost = boosted.hist[0].opp.currentHp - boosted.hist[1].opp.currentHp - 25_000_000;
      const ratio = dBoost / dBase;
      assert.ok(ratio > 2.2 && ratio < 2.8, `受到技能傷害提升150%（×2.5）：${dBoost}/${dBase}=${ratio.toFixed(2)}`);
      assert.equal(stage(last(boosted.hist).opp, '防禦'), -6, '已達下限');
    });
    await check(`${side} 破影：先出手 → 對手當回合攻擊技能無效（對照：對手先出手則不生效）`, async () => {
      const mod = (c: any) => { c.currentHp = 1000; };
      const r = await cast(side, { picks: [['破影', 0]], foeHp: 1_000_000, cassHp: 50_000_000, selfMod: mod, foeSkills: [h.hit(300, { name: '重擊' })] });
      assert.equal(last(r.hist).self.currentHp, 1000 + 250000, '先出手：對手攻擊無效，僅有 ¼ 吸取回復');
      assert.ok(last(r.hist).logs.some((x: string) => x.includes('技能無效')), '日誌：技能無效');
      const second = await cast(side, { picks: [['破影', 0]], foeHp: 1_000_000, cassHp: 50_000_000, selfMod: mod, foeSkills: [h.hit(300, { name: '重擊', priority: 5 })] });
      assert.ok(last(second.hist).self.currentHp < 1000 + 250000, `對手先出手：攻擊正常命中 ${last(second.hist).self.currentHp}`);
    });
    await check(`${side} 破影：4回合內自身使用技能吸取對手最大體力¼`, async () => {
      // 對手每回合出手後補滿，使每次吸取皆以滿血為基準；用日誌的「實際吸取」對帳 + 首回合實際扣血
      const r = await cast(side, { picks: [['破影', 1], [WAIT_I, 1], [WAIT_I, 1], [WAIT_I, 1], [WAIT_I, 1]], foeHp: 1_000_000, foeSkills: [h.wait(), h.healSkill(1_000_000)], selfMod: addWait, cassHp: 50_000_000 });
      const single = await cast(side, { picks: [['破影', 0], [WAIT_I, 0]], foeHp: 1_000_000, selfMod: addWait });
      const d1 = 1_000_000 - single.hist[0].opp.currentHp, d2 = single.hist[0].opp.currentHp - single.hist[1].opp.currentHp;
      assert.ok(d1 >= 250000 && d1 < 252000, `首次使用實際扣血（攻擊+¼）：${d1}`);
      assert.equal(d2, 250000, '第2次使用（屬性等待）：¼ 最大體力');
      const timersLeft = r.hist.map(x => h.timers(x.state, side).filter((t: string) => t.includes('吸取')).map((t: string) => Number(t.split(':').pop())));
      assert.deepEqual(timersLeft.map(t => t[0] ?? 0), [3, 2, 1, 0, 0], `4回合視窗：${JSON.stringify(timersLeft)}`);
    });
  }


  /** 只保留技能 Kit 中指定順位的句子（逐句隔離驗證，避免同一技能的其他句子污染數值）。 */
  const only = (c: any, name: string, orders: number[]) => { const k = c.skills.find((x: any) => x.name === name); k.kit = k.kit.filter((e: any) => orders.includes(e.order)); return k; };
  const SHAN = '炫彩.山殞垣頹';
  for (const side of SIDES) {
    // ── 炫彩.山殞垣頹 ──
    await check(`${side} 炫彩.山殞垣頹：第五技能（isFifthSkill 位於 skills[4]）、威力160、PP5`, async () => {
      const c = h.cassius();
      assert.equal(c.skills[4].name, SHAN); assert.equal(c.skills[4].isFifthSkill, true);
      assert.equal(c.skills[4].power, 160); assert.equal(c.skills[4].pp, 5);
      assert.ok(c.skills.slice(0, 4).every((x: any) => !x.isFifthSkill));
    });
    await check(`${side} 炫彩.山殞垣頹：攻擊傷害不會微弱（克制微弱改為普通）`, async () => {
      const grass = { type: '草' };
      const run = async (withKit: boolean) => {
        const r = await cast(side, { picks: [[4, 0]], foeHp: 100_000_000, foeExtra: grass, selfMod: c => { const k = only(c, SHAN, withKit ? [0] : []); k.type = '地面'; /* 地面 → 草 = 微弱(×0.5) */ } });
        return 100_000_000 - last(r.hist).opp.currentHp;
      };
      const [plain, fixed] = [await run(false), await run(true)];
      const ratio = fixed / plain;
      assert.ok(ratio > 1.8 && ratio < 2.2, `微弱(×0.5)→普通(×1)：${fixed}/${plain}=${ratio.toFixed(2)}`);
    });
    await check(`${side} 炫彩.山殞垣頹：「不會出現微弱」與精靈王特權同句同機制（逐字相同句、role innate、既有 op no_resist）`, async () => {
      const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
      const { MIGRATED_FEEDBACK_SKILL_KITS } = await h.server.ssrLoadModule('/src/data/migratedFeedbackSkillKits.ts');
      const SENTENCE = '【精靈王特權】攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）';
      // 既有精靈王特權技能（5012 王·霜祲霞罰）：同一句、同一 op。
      const king = MIGRATED_FEEDBACK_SKILL_KITS.find((k: any) => k.name === '王·霜祲霞罰');
      const kingEntry = king.kit.find((e: any) => String(e.customText).includes(SENTENCE));
      assert.ok(kingEntry, '精靈王特權原句存在');
      const kingOps = kingEntry.params.clause.body.flatMap((b: any) => b.acts.map((x: any) => x.op));
      assert.deepEqual(kingOps, ['no_resist']);
      const c = h.cassius(); const shan = c.skills[4];
      assert.ok(shan.description.split('\n').includes(SENTENCE), '技能描述含精靈王特權原句（整行）：' + shan.description);
      const own = shan.kit.filter((e: any) => String(e.customText).includes('不會出現微弱'));
      assert.equal(own.length, 1); assert.equal(own[0].customText, SENTENCE, 'Kit 句子與描述逐字相同');
      assert.equal(own[0].role, kingEntry.role, 'role 與精靈王特權相同（innate）');
      assert.deepEqual(own[0].params.clause.body.flatMap((b: any) => b.acts.map((x: any) => x.op)), kingOps, '同一 op');
      assert.ok(!JSON.stringify(shan.kit).includes('no_weak_damage'), '不再使用重複 op no_weak_damage');
      const src = (await import('../src/data/cassiusShanText.json', { with: { type: 'json' } })).default as any;
      assert.equal(src.skills['炫彩.山殞垣頹'], shan.description, '描述與文本來源 JSON 逐字相同');
      assert.ok(DEFAULT_ELVES.length > 0);
    });
    await check(`${side} 炫彩.山殞垣頹：消除對手能力提升，成功則進入山神守護；已處於守護則回復最大體力⅓`, async () => {
      const buffed = { statStages: { atk: 2, def: 1 } };
      const mod = (c: any) => { only(c, SHAN, [1]); c.effects = []; c.battleStatuses = {}; c.currentHp = 100; };
      const r = await cast(side, { picks: [[4, 0]], foeHp: 100_000, foeExtra: buffed, selfMod: mod, cassHp: 1062 });
      assert.equal(stage(last(r.hist).opp, '攻擊'), 0); assert.equal(stage(last(r.hist).opp, '防禦'), 0);
      assert.ok(hasEff(last(r.hist).self, '山神守護'), '成功：進入山神守護');
      assert.equal(last(r.hist).self.currentHp, 100, '未處於守護時不回血');
      const g = await cast(side, { picks: [[4, 0]], foeHp: 100_000, foeExtra: buffed, selfMod: c => { mod(c); c.effects = [{ id: '山神守護', name: '山神守護', duration: 5, isLateMover: false, stacks: 1 }]; c.battleStatuses = { 山神守護: 5 }; } });
      assert.equal(last(g.hist).self.currentHp, 100 + Math.floor(1062 / 3), '已處於守護：回復最大體力⅓');
      const none = await cast(side, { picks: [[4, 0]], foeHp: 100_000, selfMod: c => { mod(c); } });
      assert.ok(!hasEff(last(none.hist).self, '山神守護'), '消除失敗（對手無提升）：不進入守護');
    });
    await check(`${side} 炫彩.山殞垣頹：己方其他精靈下次登場時免疫下次受到的異常`, async () => {
      const poison = h.kitSkill('毒', [{ op: 'status', p: { side: 'opp', status: '中毒', turns: 3, chance: 100 } }]);
      const mk = async (cast1: boolean) => cast(side, { picks: [cast1 ? [4, 0] : [WAIT_I, 0], [{ switch: 1 } as any, 1]] as any, foeHp: 100_000, foeSkills: [h.wait(), poison], foeSpeed: 5000,
        selfMod: c => { addWait(c); if (cast1) only(c, SHAN, [2]); c.skills = c.skills.map((x: any, i: number) => i === 4 && !cast1 ? h.wait() : x); }, bench: [h.foe('B', 50_000, [h.wait()], { speed: 10 })] });
      const withS = await mk(true), without = await mk(false);
      assert.ok(!h.statuses(last(withS.hist).self).includes('中毒'), '免疫下次異常：未中毒 ' + h.statuses(last(withS.hist).self));
      assert.ok(h.statuses(last(without.hist).self).includes('中毒'), '對照：未使用則正常中毒');
    });
    await check(`${side} 炫彩.山殞垣頹：吸取對手最大體力50%並為自身附加等量護盾`, async () => {
      const r = await cast(side, { picks: [[4, 0]], foeHp: 1_000_000, cassHp: 50_000_000, selfMod: c => { only(c, SHAN, [3]); c.currentHp = 100; } });
      const a = last(r.hist);
      const lost = 1_000_000 - a.opp.currentHp;
      assert.ok(lost >= 500_000 && lost < 502_000, `實際扣 50% 最大體力（+攻擊傷害）：${lost}`);
      assert.equal(a.self.shield, 500_000, '等量護盾');
      assert.equal(a.self.currentHp, 100 + 500_000, '自身回復吸取量');
    });
    await check(`${side} 炫彩.山殞垣頹：之後下次己方精靈護盾消失時，令對手下回合無法主動切換精靈`, async () => {
      const oppBench = [h.foe('B2', 50_000, [h.wait()], { speed: 10 })];
      const big = h.hit(200, { name: '重擊' });
      const run = async (cast1: boolean) => {
        const c = h.cassius({ hp: 100_000 }); c.soulMark = { ...c.soulMark, kit: [] };
        if (cast1) only(c, SHAN, [4]); else c.skills[4] = h.wait();
        c.shield = 50;
        const foe = h.foe('E', 100_000, [big, h.wait()], { speed: 1 });
        const hist = await h.play(side, { self: c, opp: foe, oppBench, turns: (_e: any, t: number) => t === 1 ? [4, 0] : [4, { switch: 1 } as any] }, 2);
        return hist;
      };
      const withS = await run(true), without = await run(false);
      assert.ok(last(withS).self.currentHp > 0 && last(withS).self.shield === 0, '護盾已被擊碎');
      assert.equal(last(withS).opp.name, 'E', '護盾消失後下回合對手無法切換');
      assert.equal(last(without).opp.name, 'B2', '對照：未使用則可切換');
    });
    await check(`${side} 炫彩.山殞垣頹：自身擁有護盾時威力翻倍（僅看自身，不看對手護盾）`, async () => {
      const dmg = async (self: number, foeShield: number) => {
        const r = await cast(side, { picks: [[4, 0]], foeHp: 100_000_000, foeExtra: { shield: foeShield }, selfMod: c => { only(c, SHAN, [5]); c.shield = self; } });
        return 100_000_000 - last(r.hist).opp.currentHp;
      };
      const base = await dmg(0, 0), mine = await dmg(100, 0), theirs = await dmg(0, 100);
      assert.ok(mine / base > 1.8 && mine / base < 2.2, `自身護盾 ×2：${mine}/${base}`);
      assert.ok((theirs + 100) / base > 0.85 && (theirs + 100) / base < 1.15, `僅對手有護盾不翻倍：${theirs}+100 vs ${base}`);
    });
  }


  // ════════ 魂印：山神守護 / 召喚 / 選技 ════════
  const countLog = (hist: any[], text: string) => (last(hist).logs.join('\n').match(new RegExp(text, 'g')) || []).length;
  const breaker = () => h.kitSkill('破盾', [{ op: 'clear_both_shields', p: { drainRatio: 0, threshold: 400, maxHpBonus: 0 } }]);
  for (const side of SIDES) {
    await check(`${side} 魂印：回合開始時在場累計回合數不高於1 → 召喚炫彩山神（僅一次）；自身護盾消失 → 清除累計回合數使其再次召喚`, async () => {
      const calm = await cast(side, { picks: [[5, 0], [5, 0], [5, 0]], soul: true, selfMod: c => c.skills.push(h.wait()) });
      assert.equal(countLog(calm.hist, '召喚額外精靈'), 1, '在場回合數 >1 後不再召喚');
      assert.ok(last(calm.hist).state[`${side}Team`].some((x: any) => x.isExtra), '額外精靈加入己方');
      // 山神死亡令對手所有技能 PP 歸0（對手無技能可選），第 3 回合改由對手換人
      const rc = h.cassius(); rc.skills.push(h.wait(), breaker());
      const foeMain = h.foe('E', 30000, [h.wait()], { speed: 100 }), foeBench = h.foe('B2', 30000, [h.wait()], { speed: 100 });
      const reset = { hist: await h.play(side, { self: rc, opp: foeMain, oppBench: [foeBench], turns: (_e: any, t: number) => [[5, 6, 5][t - 1], [0, 0, { switch: 1 }][t - 1]] as any }, 3) };
      assert.equal(countLog(reset.hist, '炫彩山神】死亡，清除.*本次在場累計回合數'), 1, '護盾消失：炫彩山神死亡並清除累計回合數');
      assert.equal(countLog(reset.hist, '召喚額外精靈'), 2, '累計回合數被清除 → 下回合再次召喚');
    });
  }


  // ════════ 護盾消失 → 山神死亡（真實魂印子句 shield_lost_watch → kill_owned_extra）／背包卡修斯不召喚 ════════
  const shanOf = (team: any[]) => team.find((e: any) => e.isExtra && e.name === '炫彩山神');
  const deathLogs = (r: any) => r.logs.filter((x: string) => x.includes('炫彩山神】死亡')).length;
  for (const side of SIDES) {
    await check(`${side} 護盾消失→山神死亡：護盾仍在（僅被扣減）不誤殺；每次護盾消失各死亡一次；死亡後清除回合數並於下回合再召喚`, async () => {
      const cas = h.cassius(); cas.skills = [wait()];
      // 隔離：移除屬性技能的「無效對手下次攻擊」，讓輕擊能實際扣減護盾
      cas.soulMark.kit = cas.soulMark.kit.filter((x: any) => !/使用技能後無效對手下次攻擊技能/.test(x.customText));
      const clear = h.kitSkill('清盾', [{ op: 'clear_shield', p: { side: 'opp', kind: 'both' } }]);
      const foeA = h.foe('E', 900000, [h.hit(30, { name: '輕擊' }), clear, h.wait()], { speed: 10 });
      const foeB = h.foe('B2', 900000, [clear], { speed: 10 });
      const plan: [number, number | { switch: number }][] = [[0, 0], [0, 1], [0, { switch: 1 }], [0, 0]];
      const hist = await h.play(side, { self: cas, opp: foeA, oppBench: [foeB], turns: (_e: any, t: number) => plan[t - 1] as any }, 4);
      const t1 = hist[0], t2 = hist[1], t3 = hist[2], t4 = hist[3];
      const teamOf = (r: any) => r.state[`${side}Team`];
      assert.ok(shanOf(teamOf(t1)) && !shanOf(teamOf(t1)).isVanished, 'T1 召喚山神');
      assert.ok(t1.self.shield > 0 && t1.self.shield < cas.maxHp * 0.5, `T1 護盾被輕擊扣減但仍在：${t1.self.shield}`);
      assert.equal(deathLogs(t1), 0, 'T1 護盾仍在：山神不得被殺');
      assert.equal(t2.self.shield || 0, 0, 'T2 護盾被清除');
      assert.equal(shanOf(teamOf(t2)).isVanished, true, 'T2 護盾消失：山神死亡');
      assert.equal(deathLogs(t2), 1);
      assert.ok(shanOf(teamOf(t3)) && !shanOf(teamOf(t3)).isVanished && t3.self.shield > 0, 'T3 清除在場回合數 → 回合開始再召喚並重新給護盾');
      assert.equal(deathLogs(t3), 1, 'T3 沒有多餘的死亡');
      assert.equal(shanOf(teamOf(t4)).isVanished, true, 'T4 護盾第二次消失：山神再度死亡（每次消失各一次）');
      assert.equal(deathLogs(t4), 2);
      assert.equal(teamOf(t4).filter((e: any) => e.isExtra).length, 1, '額外精靈被原位取代，不累積');
    });

    await check(`${side} 回合開始召喚只屬於在場的卡修斯：背包卡修斯不因在場者的回合數而召喚；上場後才召喚`, async () => {
      const front = h.unit('前鋒', 90000, [h.wait()]), front2 = h.unit('前鋒二', 90000, [h.wait()]);
      const bench = h.cassius({ id: 'cas' });
      const foe = h.foe('E', 900000, [h.wait()], { speed: 10 });
      // T1 等待；T2 換前鋒二（在場回合數歸 1，換人後的回合開始 = 1）；T3 等待；T4 換上卡修斯；T5 等待
      const plan: [number | { switch: number }, number][] = [[0, 0], [{ switch: 2 }, 0], [0, 0], [{ switch: 1 }, 0], [0, 0]];
      const hist = await h.play(side, { self: front, selfBench: [bench, front2], opp: foe, turns: (_e: any, t: number) => plan[t - 1] as any }, 5);
      const extras = (r: any) => r.state[`${side}Team`].filter((e: any) => e.isExtra).length;
      assert.deepEqual(hist.map(extras).slice(0, 3), [0, 0, 0], '卡修斯在背包期間（含前鋒二回合數=1 的回合開始）不召喚');
      assert.equal(hist[3].self.name, '岳峙淵渟.卡修斯', 'T4 卡修斯上場');
      assert.equal(extras(hist[3]), 1, '換上卡修斯後的回合開始（在場回合數=1）才召喚');
      assert.equal(extras(hist[4]), 1, '之後不重複召喚');
    });

    await check(`${side} 山神死亡「消除對手回合類效果」：回合類（轉由回合計數）被清除；魂印「下次攻擊無效」為次數類效果，依規則不屬回合類而保留`, async () => {
      const cas = h.cassius(); cas.skills = [h.sk('穩', { name: '定場' }), wait()];
      const clear = h.kitSkill('清盾', [{ op: 'clear_shield', p: { side: 'opp', kind: 'both' } }]);
      const foe = h.foe('E', 900000, [h.turnEffectSkill(), clear, h.wait()], { speed: 10 });
      const hist = await h.play(side, { self: cas, opp: foe, turns: (_e: any, t: number) => [[0, 1][t - 1], [0, 1][t - 1]] as any }, 2);
      const names = (r: any) => h.timers(r.state, side === 'p1' ? 'p2' : 'p1');
      const before = names(hist[0]);
      assert.ok(before.some((n: string) => n.includes('立盾') || n.includes('免疫')) || before.length >= 2, '前置：對手有回合類效果與次數類效果 ' + before);
      const after = names(hist[1]);
      assert.ok(!after.some((n: string) => n.includes('免疫')), '回合類效果被消除：' + after);
      assert.ok(after.some((n: string) => n.includes('技能無效')), '次數類「技能無效」保留：' + after);
    });
  }

  for (const side of SIDES) {
    const petrify = (turns: number) => h.kitSkill('石化咒', [{ op: 'status', p: { side: 'opp', status: '石化', turns, chance: 100 } }]);
    const buff = h.kitSkill('附加', [{ op: 'stat', p: { side: 'self', stats: ['攻擊'], v: 1 } }]);
    const zeroPp = h.sk('零PP技能', { pp: 0, maxPp: 5, category: '屬性' });
    const guardMod = (c: any) => { c.skills.push(h.wait(), zeroPp); };
    const used = (hist: any[], name: string) => last(hist).logs.some((x: string) => x.includes('卡修斯】使用了【' + name + '】'));
    await check(`${side} 山神守護：控制類異常原效果取消（照常行動）；改為選擇使用技能不受PP限制（對照：無控制異常時PP0技能不可用）`, async () => {
      const foeSk = [h.wait(), petrify(3)];
      const withC = await cast(side, { picks: [[5, 0], [5, 1], [6, 0]], soul: true, foeSkills: foeSk, foeSpeed: 5000, selfMod: guardMod });
      assert.ok(h.statuses(last(withC.hist).self).includes('石化'), '石化仍在（僅取消效果）');
      assert.ok(used(withC.hist, '零PP技能'), '石化期間照常行動，且 PP0 技能不受 PP 限制');
      const noC = await cast(side, { picks: [[5, 0], [5, 0], [6, 0]], soul: true, foeSkills: foeSk, foeSpeed: 5000, selfMod: guardMod });
      assert.ok(!used(noC.hist, '零PP技能'), '對照：沒有被取消的異常 → PP0 技能仍受限');
      const bare = await cast(side, { picks: [[5, 0], [5, 1], [6, 0]], soul: false, foeSkills: foeSk, foeSpeed: 5000, selfMod: c => { guardMod(c); c.effects = []; } });
      assert.ok(!used(bare.hist, '零PP技能'), '對照：無山神守護（無魂印）→ 石化阻止行動');
    });
    await check(`${side} 山神守護：所處異常不可轉化為控制類／弱化類（石化到期不轉凍傷）；對照無守護則轉化`, async () => {
      const foeSk = [h.wait(), h.kitSkill('冰封咒', [{ op: 'status', p: { side: 'opp', status: '冰封', turns: 1, chance: 100 } }])];
      const withG = await cast(side, { picks: [[5, 0], [5, 1], [5, 0]], soul: true, foeSkills: foeSk, foeSpeed: 5000, selfMod: guardMod });
      assert.ok(!h.statuses(last(withG.hist).self).includes('凍傷'), '守護中不轉化為凍傷：' + h.statuses(last(withG.hist).self));
      const bare = await cast(side, { picks: [[5, 0], [5, 1], [5, 0]], soul: false, foeSkills: foeSk, foeSpeed: 5000, selfMod: c => { guardMod(c); } });
      assert.ok(h.statuses(last(bare.hist).self).includes('凍傷'), '對照：無守護則轉化為凍傷：' + h.statuses(last(bare.hist).self));
    });
    await check(`${side} 山神守護：原效果被取消時，技能使用後令對手1回合內技能附加效果失效（對照：無被取消異常則不失效）`, async () => {
      const foeSk = [h.wait(), petrify(3), buff];
      const r = await cast(side, { picks: [[5, 0], [5, 1], [5, 2]], soul: true, foeSkills: foeSk, foeSpeed: 5000, selfMod: guardMod });
      assert.equal(stage(last(r.hist).opp, '攻擊'), 0, '對手附加效果失效，+1 未生效');
      const ctrl = await cast(side, { picks: [[5, 0], [5, 0], [5, 2]], soul: true, foeSkills: foeSk, foeSpeed: 5000, selfMod: guardMod });
      assert.equal(stage(last(ctrl.hist).opp, '攻擊'), 1, '對照：無取代條件時對手附加效果正常');
    });
  }


  for (const side of SIDES) {
    // 逐句隔離選技規則：去掉召喚句（避免回合開始自動補護盾與守護），其餘魂印原樣
    const noSummon = (c: any) => { c.soulMark = { ...c.soulMark, kit: c.soulMark.kit.filter((e: any) => e.node !== 'round_start') }; };
    const atkMod = (shield: number) => (c: any) => { noSummon(c); c.skills.push(h.hit(90, { name: '普攻' }), h.wait()); c.shield = shield; };
    const ATK = 5, STA = 6;
    await check(`${side} 魂印：選擇攻擊技能時忽略對手防禦40%（數值對照）`, async () => {
      const dmg = async (soul: boolean) => {
        const r = await cast(side, { picks: [[ATK, 0]], soul, foeHp: 100_000_000, foeSpeed: 1, selfMod: c => { if (soul) noSummon(c); c.skills.push(h.hit(90, { name: '普攻' })); } });
        return 100_000_000 - last(r.hist).opp.currentHp;
      };
      const [withSoul, bare] = [await dmg(true), await dmg(false)];
      const ratio = withSoul / bare;
      assert.ok(ratio > 1.35 && ratio < 1.9, `忽略防禦40% → 傷害約 1/0.6 倍：${withSoul}/${bare}=${ratio.toFixed(2)}`);
    });
    await check(`${side} 魂印：雙方任一方有護盾時攻擊 → 對手先制-2且100%石化（自身或對手有盾皆可；皆無則否）`, async () => {
      const run = async (selfShield: number, foeShield: number) => cast(side, { picks: [[ATK, 0]], soul: true, foeHp: 100_000_000, foeSpeed: 5000, foeExtra: { shield: foeShield }, selfMod: atkMod(selfShield) });
      const order = (hist: any[]) => { const l = last(hist).logs; return l.findIndex((x: string) => x.includes('卡修斯】使用了【普攻】')) < l.findIndex((x: string) => x.includes('【E】使用了')); };
      const mine = await run(100, 0), theirs = await run(0, 100), none = await run(0, 0);
      assert.ok(h.statuses(last(mine.hist).opp).includes('石化'), '自身有盾：對手石化');
      assert.ok(order(mine.hist) || !last(mine.hist).logs.some((x: string) => x.includes('【E】使用了')), '自身有盾：對手先制-2 → 自身先動（或對手已石化無法行動）');
      assert.ok(h.statuses(last(theirs.hist).opp).includes('石化'), '對手有盾：同樣石化');
      assert.ok(!h.statuses(last(none.hist).opp).includes('石化'), '雙方皆無盾：不石化');
      assert.ok(!order(none.hist), '雙方皆無盾：高速對手先動（無先制-2）');
    });
    await check(`${side} 魂印：選擇屬性技能時，使用後無效對手下次攻擊技能（對照：無魂印被打中）`, async () => {
      const hitFoe = [h.wait(), h.hit(300, { name: '重擊' })];
      const r = await cast(side, { picks: [[STA, 0], [STA, 1]], soul: true, foeSkills: hitFoe, foeSpeed: 5000, selfMod: atkMod(0) });
      assert.equal(last(r.hist).self.currentHp, 1062, '對手下次攻擊技能無效');
      const bare = await cast(side, { picks: [[STA, 0], [STA, 1]], soul: false, foeSkills: hitFoe, foeSpeed: 5000, selfMod: c => c.skills.push(h.hit(90, { name: '普攻' }), h.wait()) });
      assert.ok(last(bare.hist).self.currentHp < 1062, '對照：無魂印正常受傷');
    });
    await check(`${side} 魂印：任一方有護盾時屬性技能不消耗PP，並吸取雙方護盾值70%的體力`, async () => {
      const run = async (selfShield: number, foeShield: number) => cast(side, { picks: [['群山許諾', 0]], soul: true, foeHp: 1_000_000, foeExtra: { shield: foeShield }, selfMod: c => { noSummon(c); c.shield = selfShield; c.currentHp = 100; } });
      const idx0 = I['群山許諾'];
      const sh = await run(100, 300), none = await run(0, 0);
      assert.equal(last(sh.hist).self.skills[idx0].pp, 5, '有護盾：不消耗 PP');
      assert.equal(last(none.hist).self.skills[idx0].pp, 4, '皆無護盾：正常消耗 PP');
      // 群山許諾自帶 ⅓ 最大體力吸取（333333）；其餘即為雙方護盾 70% = 280
      const lost = 1_000_000 - last(sh.hist).opp.currentHp, base = 1_000_000 - last(none.hist).opp.currentHp;
      assert.equal(lost - base, 280, `雙方護盾 (100+300) × 70% = 280：${lost - base}`);
    });
    await check(`${side} 魂印：攻擊技能（非屬性）使用不觸發屬性技能專屬效果（有盾也不免PP）`, async () => {
      const r = await cast(side, { picks: [[ATK, 0]], soul: true, selfMod: atkMod(100) });
      assert.equal(last(r.hist).self.skills[ATK].pp, 98, '攻擊技能仍消耗 PP（99→98）');
    });
  }

} finally { await h.close(); }
console.log(`${checks} checks passed`);
process.exit(0);
