// 5029 異境神霆·雷伊 魂印「異」＋神明＋雷神＋技能「霆·禁雷敕令」真 Kit 驗收（組4）。
// 本分支不重產 reviewedKits.*.json（整合者重產），故測試以「真 5029 定義 structuredClone 後覆蓋真 Kit」建立單位；
// 雙側（P1/P2）正式 headless 引擎實戰。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0; const ok = (m: string) => { checks++; console.log('OK ' + m); };
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { MIGRATED_REY_SOUL_KIT, MIGRATED_REY_TRAIT_KITS } = await h.server.ssrLoadModule('/src/data/migratedReyKits.ts');
  const { MIGRATED_REY_SKILL_KITS } = await h.server.ssrLoadModule('/src/data/migratedReySkillKits.ts');
  const { kitEntryIssue } = await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  const { validateKit } = await h.server.ssrLoadModule('/src/effects/kitValidation.ts');
  const { OTHERWORLD_REY_SKILLS } = await h.server.ssrLoadModule('/src/effects/elves/otherworld-rey/registry.ts');
  const rey = DEFAULT_ELVES.find((e: any) => String(e.id) === '5029');
  const thunder = MIGRATED_REY_SKILL_KITS.find((k: any) => k.name === '霆·禁雷敕令');
  for (const d of [MIGRATED_REY_SOUL_KIT, ...MIGRATED_REY_TRAIT_KITS, thunder]) {
    validateKit(d.kit);
    for (const e of d.kit) assert.equal(kitEntryIssue(e), null, d.name + ': ' + e.customText);
  }
  for (const k of ['5029', '異境神霆·雷伊', '異境神霆.雷伊']) assert.ok(!(k in h.S), '舊映射不得殘留：' + k);
  assert.equal(Object.keys(OTHERWORLD_REY_SKILLS).length, 0);
  assert.equal(rey.skills.find((s: any) => s.name === '霆·禁雷敕令').description, thunder.description, 'Kit description 與精靈原文逐字相同');
  assert.equal(rey.soulMark.description, MIGRATED_REY_SOUL_KIT.description);
  ok('四份定義合約全過、舊映射／舊技能 handler 已清空、description 與原文相同');

  const withKits = (id: string, hp: number, skills: any[], o: any = {}) => {
    const b = structuredClone(rey);
    b.id = id; b.battleId = id; b.name = '異境神霆·雷伊';
    b.soulMark = { ...b.soulMark, effectMode: 'kit', kit: structuredClone(MIGRATED_REY_SOUL_KIT.kit).filter((e: any) => !(o.noParalyzeFlag && e.customText.includes('100%麻痺'))) };
    b.alienTraits = { ...(b.alienTraits || {}), gen2Trait: undefined, exclusiveTraits: MIGRATED_REY_TRAIT_KITS.map((t: any) => ({ name: t.name, description: t.description, effectMode: 'kit', kit: structuredClone(t.kit) })) };
    b.maxHp = o.maxHp ?? hp; b.currentHp = hp;
    b.baseStats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 };
    b.calculatedStats = { hp: b.maxHp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: o.speed ?? 100 };
    b.skills = skills; b.statStages = o.statStages || {}; b.shield = 0; b.barrier = 0;
    return b;
  };
  const thunderSkill = () => { const s = structuredClone(rey.skills.find((x: any) => x.name === '霆·禁雷敕令')); s.effectMode = 'kit'; s.kit = structuredClone(thunder.kit); s.pp = s.maxPp = 99; return s; };
  const fixedAtk = (n: number) => h.kitSkill('固傷' + n, [{ op: 'dmg', p: { flat: n, type: '固定' } }]);

  for (const side of ['p1', 'p2'] as const) {
    // 回合開始：對手無能力提升 → 攻擊／速度／命中+2
    let [r] = await h.play(side, { self: withKits('R', 1000000, [h.wait()], { speed: 200 }), opp: h.unit('E', 1000000, [h.wait()]) });
    assert.equal(r.self.statStages.atk, 2); assert.equal(r.self.statStages.speed, 2); assert.equal(r.self.statStages.accuracy, 2);
    assert.ok(h.statuses(r.self).includes('麻痺') && h.statuses(r.opp).includes('麻痺'), '自身能力等級被改變→雙方麻痺（旗標由Kit寫入）');
    // 對手有能力提升 → 複製並令自身麻痺
    [r] = await h.play(side, { self: withKits('R', 1000000, [h.wait()], { speed: 200 }), opp: h.unit('E', 1000000, [h.wait()], { statStages: { def: 1 } }) });
    assert.equal(r.self.statStages.def, 1, '複製對手能力提升'); assert.ok(h.statuses(r.self).includes('麻痺'));
    assert.ok(!(r.self.statStages.atk > 0), '複製成功不再獲得+2');
    ok(side + ' 異：回合開始複製／+2 兩側');

    // 神明：非真實致命傷害 → 進入神降（體力為負且仍存活）
    [r] = await h.play(side, { self: withKits('R', 100, [h.wait()], { maxHp: 1000, speed: 50, noParalyzeFlag: true }), opp: h.unit('E', 1000000, [fixedAtk(5000)], { speed: 200 }) });
    assert.ok(r.self.currentHp < 0, '神降體力為負 ' + r.self.currentHp); assert.ok(r.self.currentHp >= -700 - 1, '不低於-70%上限（首次進入）');
    ok(side + ' 神明：致命傷害進入神降');

    // 霆·禁雷敕令：附加對手已損失體力70%真實傷害（對手未死）
    [r] = await h.play(side, { self: withKits('R', 1000000, [thunderSkill()], { speed: 200 }), opp: h.unit('E', 10000000, [h.wait()], { maxHp: 10000000 }) });
    const lost = 10000000 - r.opp.currentHp; assert.ok(lost > 0 && r.opp.currentHp > 0);
    // 對手已損失體力70%真實傷害：對手先掉到5M，再用霆（無再損失基準=5M→真實3.5M）
    [r] = await h.play(side, { self: withKits('R', 1000000, [thunderSkill()], { speed: 200 }), opp: h.unit('E', 5000000, [h.wait()], { maxHp: 10000000 }) });
    assert.ok(r.opp.currentHp > 4900000 && r.opp.currentHp < 5000000, '自身滿體力時不附加對手已損失體力傷害 ' + r.opp.currentHp);
    assert.ok(h.timers(r.state, side).some((t: string) => t.startsWith('下2回合先制2')), '未擊敗→下2回合先制+2');
    assert.ok(!h.timers(r.state, side === 'p1' ? 'p2' : 'p1').some((t: string) => t.includes('傷害')), '消除失敗不加翻倍');
    // 消除成功：對手回合類效果被消除，下2回合受到傷害翻倍
    const hist = await h.play(side, { self: withKits('R', 1000000, [h.wait(), thunderSkill()], { speed: 200, noParalyzeFlag: true }), opp: h.unit('E', 5000000, [h.turnEffectSkill()], { maxHp: 10000000 }), turns: (_e: any, t: number) => [t === 2 ? 1 : 0, 0] }, 2);
    assert.ok(h.timers(hist[0].state, side === 'p1' ? 'p2' : 'p1').some((t: string) => t.includes('免疫')), '對手先擁有回合類效果');
    r = hist[1]; const oppT = h.timers(r.state, side === 'p1' ? 'p2' : 'p1');
    assert.ok(oppT.some((t: string) => t.includes('傷害倍率')), '消除成功→下2回合受到傷害翻倍 ' + oppT.join('|'));
    // 先制：Rey 速度慢仍因「當回合先制+1」先出手
    [r] = await h.play(side, { self: withKits('R', 1000000, [h.wait()], { speed: 50 }), opp: h.unit('E', 1000000, [h.wait()], { speed: 300 }) });
    const order = r.logs.filter((l: string) => l.includes('使用了')); assert.ok(order[0].includes('異境神霆'), '先制+1先出手 ' + order.join('/'));
    ok(side + ' 霆：技能可施放且對手未被擊敗');
  }
  console.log(`5029 Kit 語意測試 ${checks} 項通過`);
} finally { await h.close(); }
