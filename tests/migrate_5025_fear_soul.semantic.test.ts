// 5025 恐懼的化身·咤克斯 魂印「懼」真 Kit 拆解驗收（DSH 20261018 第十三批·第一波）。
// 雙側（P1/P2）正式 headless 引擎實戰；合成精靈帶真名（恐懼的化身·咤克斯）與真 soulMark
// （structuredClone 後只改身份／技能／數值）。恐懼之種/花的其餘語句由引擎既有讀取端承載
// （免疫害怕PP歸0／擋異常／禁秒殺／非真實傷害倍率／攻擊保底機率），本測試驗證 Kit 寫入端
// 與讀取端串接後的整套行為。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const zf = DEFAULT_ELVES.find((e: any) => String(e.id) === '5025');
  const { MIGRATED_ZHAKESI_FEAR_SOUL_KIT } = await h.server.ssrLoadModule('/src/data/migratedZhakesiFearSoulKit.ts');
  const { kitEntryIssue } = await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  assert.equal(zf.name, '恐懼的化身·咤克斯');
  assert.equal(zf.soulMark?.name, '懼');
  assert.equal(zf.soulMark?.effectMode, 'kit', '魂印 effectMode=kit');
  assert.ok(!JSON.stringify(zf.soulMark.kit || []).includes('legacy_handler'), '不得殘留包裝');
  assert.equal(zf.soulMark.description, MIGRATED_ZHAKESI_FEAR_SOUL_KIT.description, 'Kit description 與實際載入原文逐字相同');
  assert.equal(zf.soulMark.name, MIGRATED_ZHAKESI_FEAR_SOUL_KIT.name);
  assert.deepEqual(zf.soulMark.kit, structuredClone(MIGRATED_ZHAKESI_FEAR_SOUL_KIT.kit), '套用的 Kit 條目與來源定義完全一致');
  for (const e of MIGRATED_ZHAKESI_FEAR_SOUL_KIT.kit) assert.equal(kitEntryIssue(e), null, 'kitEntryIssue: ' + e.customText);
  for (const k of ['5025', '1019', '1037', '咤克斯', '恐懼的化身·咤克斯', '恐懼的化身.咤克斯'])
    assert.ok(!(k in h.S), 'SOUL_MARK_MAPPING 不得殘留 5025 鍵：' + k);
  checks++; console.log('OK 5025 魂印「懼」已是真 Kit（無包裝、無舊映射、合約全過）');

  const fearUnit = (id: string, hp: number, skills: any[], o: any = {}) => {
    const base = structuredClone(zf); // 真 5025 定義：structuredClone 後僅改身份／技能／數值
    base.id = id; base.battleId = id; base.name = '恐懼的化身·咤克斯'; // 真名（魂印以名稱派發）
    base.maxHp = o.maxHp ?? hp; base.currentHp = hp;
    base.baseStats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 };
    base.calculatedStats = { hp: base.maxHp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: o.speed ?? 100 };
    base.skills = skills; base.statStages = o.statStages || {}; base.shield = 0; base.barrier = 0;
    base.soulMark = zf.soulMark; // 真 soulMark（已套用真 Kit）
    return base;
  };
  const ppSkill = { ...h.wait(), name: '蓄能', pp: 3, maxPp: 5 };
  const fixedAtk = (n: number) => h.kitSkill('固傷' + n, [{ op: 'dmg', p: { flat: n, type: '固定' } }]);
  const percentImmuneTrait = {
    name: '免百分比', effectMode: 'kit', kit: [{
      codeId: 'effect_sequence', node: 'before_damage', source: 'mechanic', role: 'innate', order: 0, customText: '百分比免疫',
      params: { clause: { raw: '百分比免疫', trig: 'incoming', parsed: true, body: [{ acts: [{ op: 'dmg_mod', p: { dir: 'in', kind: '百分比', reduce: 1 }, label: '免疫' }] }] } },
    }],
  };

  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const oppMarks = (r: any) => r.state[other + 'Marks'];
    // ① 戰鬥開始種下恐懼之種（count 1、效果欄位、禁秒殺）＋每回合全場吸取體力上限＋
    //    戰鬥階段結束：恢復已損失50%＋1PP＋等量(×1.4)百分比傷害＋對手未滿→全屬性-1
    {
      const self = fearUnit('S', 40000, [ppSkill, h.wait()], { maxHp: 50000 });
      const opp = h.unit('E', 90000, [h.wait(), h.wait()], { maxHp: 100000 }); // 預先不滿→階段結束走全屬性-1 分支
      const [r] = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      const seed = oppMarks(r).find((m: any) => m.id === 'fear_seed');
      assert.ok(seed, side + ' 戰鬥開始種下恐懼之種');
      assert.equal(seed.count, 1, side + ' 初始 1 層');
      assert.equal(seed.effects.nonTrueDamageDealtMultiplier, 0.8, side + ' 造成非真實傷害×0.8');
      assert.equal(seed.effects.nonTrueDamageTakenMultiplier, 1.4, side + ' 受到非真實傷害×1.4');
      assert.equal(seed.effects.guaranteedMaxHpDamageChance, 0.2, side + ' 保底機率 20%');
      assert.equal(seed.effects.instantKillDisabled, true, side + ' 禁秒殺旗標');
      assert.equal(r.self.maxHp, 50020, side + ' 吸取：自身 50000-20+40=50020');
      assert.equal(r.opp.maxHp, 99980, side + ' 對手體力上限 -20');
      assert.equal(r.self.skills[0].pp, 3, side + ' 使用消耗1PP後戰鬥階段結束+1PP（3→2→3）');
      const healed = 50020 - 40000; // 戰鬥階段結束時已損失體力（吸取後上限50020，體力40000未受擊）
      assert.equal(r.self.currentHp, 40000 + Math.floor(healed / 2), side + ' 恢復已損失體力50%');
      const expectPink = Math.floor(Math.floor(healed / 2) * 1.4);
      assert.ok(Math.abs(r.opp.currentHp - (90000 - expectPink)) <= 1, side + ' 對手受等量×1.4 百分比傷害（實收 ' + r.opp.currentHp + '，期望 ~' + (90000 - expectPink) + '）');
      const stages = Object.entries(r.opp.statStages || {}).filter(([, v]) => v === -1);
      assert.equal(stages.length, 6, side + ' 對手未滿→全屬性-1（六項）：' + JSON.stringify(r.opp.statStages));
      assert.ok(!h.statuses(r.opp).includes('害怕'), side + ' 恐懼之種免疫害怕（未附加成功）');
      checks++;
    }
    // ② 回合開始自身滿體力→100%害怕：恐懼之種免疫但所選技能PP歸0（無法行動）；未觸發→消除雙方能力變化；
    //    對手滿體力（免疫百分比傷害保滿）→未觸發全屬性-1 → 對手下2回合無法主動切換
    {
      const self = fearUnit('S', 50000, [h.wait()], { maxHp: 50000 });
      const opp = h.unit('E', 100000, [ppSkill, h.wait()], { speed: 300, extra: { trait: structuredClone(percentImmuneTrait) } });
      const [r] = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      assert.ok(!h.statuses(r.opp).includes('害怕'), side + ' 害怕被恐懼之種免疫');
      assert.equal(r.opp.skills[0].pp, 0, side + ' 免疫害怕但所選技能PP歸0');
      assert.ok(r.logs.some(l => l.includes('無法行動') || l.includes('PP歸零') || l.includes('PP值歸零')), side + ' 當回合PP為0無法行動：' + r.logs.slice(-6).join('｜'));
      assert.deepEqual(r.self.statStages, {}, side + ' 未觸發→消除雙方能力變化');
      assert.deepEqual(r.opp.statStages, {}, side + ' 對手滿體力→未觸發全屬性-1（無能力變化）');
      // 4.10 寫入 2；同回合 5.x 通用回合扣減後回合末讀值為 1（與舊 handler setOpponentState 同值）。
      assert.equal(r.state[other + 'RegistryState'].noSwitchTurns, 1, side + ' 未觸發→對手下2回合無法主動切換（回合末剩餘1）');
      assert.equal(r.self.currentHp, 50000, side + ' 滿體力吸取夾血後回復（49980+20）');
      checks++;
    }
    // ③ 恐懼之種造成非真實傷害×0.8：對手固傷1000→自身傷800；對照場（無魂印普通精靈）1000
    {
      const mkSelf = (plain: boolean) => plain
        ? h.unit('P', 40000, [h.wait(), h.wait()], { maxHp: 50000 })
        : fearUnit('S', 40000, [h.wait(), h.wait()], { maxHp: 50000 });
      const [withFear] = await h.play(side, { self: mkSelf(false), opp: h.unit('E', 100000, [fixedAtk(1000), h.wait()], { speed: 300 }), turns: () => [0, 0] }, 1);
      const [plain] = await h.play(side, { self: mkSelf(true), opp: h.unit('E2', 100000, [fixedAtk(1000), h.wait()], { speed: 300 }), turns: () => [0, 0] }, 1);
      // 對照場：無魂印 → 無吸取、無恢復 → 40000-1000=39000
      assert.equal(plain.self.currentHp, 39000, side + ' 對照場淨傷 1000');
      // 魂印場：吸取後上限50020；固傷×0.8=800；戰鬥階段結束恢復已損失50%
      const afterHit = 40000 - 800;
      assert.equal(withFear.self.currentHp, afterHit + Math.floor((50020 - afterHit) / 2), side + ' 固傷×0.8＋階段結束恢復（=800+回復）');
      assert.ok(withFear.logs.some(l => l.includes('使造成的非真實傷害調整為 80%')), side + ' 倍率日誌');
      checks++;
    }
    // ④ 恐懼之種受到非真實傷害×1.4：自身固傷1000→對手傷1400
    {
      const self = fearUnit('S', 49999, [fixedAtk(1000), h.wait()], { maxHp: 50000 });
      const opp = h.unit('E', 100000, [h.wait()]);
      const [r] = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      // 吸取：自身上限 50000→49980（49999 夾至 49980）→+40=50020；對手上限 99980
      // 固傷1000×1.4=1400；階段結束：自身恢復20、對手受20×1.4=28
      assert.ok(Math.abs(r.opp.currentHp - (99980 - 1400 - 28)) <= 1, side + ' 受到非真實傷害×1.4（+等量反饋，實收 ' + r.opp.currentHp + '）');
      assert.equal(r.self.currentHp, 50000, side + ' 自身夾血後恢復');
      assert.ok(r.logs.some(l => l.includes('使受到的非真實傷害調整為 140%')), side + ' 受方倍率日誌');
      checks++;
    }
    // ⑤ 恐懼之種層數：對手每次精靈登場（主動換人於選擇階段完成，正式登場事件即時計數）+1層、
    //    每層機率+2%；達4層再登場→轉變為恐懼之花
    {
      const self = fearUnit('S', 40000, [h.wait(), h.wait()], { maxHp: 50000 });
      // 對手兩隻皆預先不滿：戰鬥階段結束走全屬性-1 分支（若對手滿體力會觸發「下2回合無法主動切換」而擋住後續換人）
      const e = h.unit('E', 90000, [h.wait()], { maxHp: 100000 });
      const e2 = h.unit('E2', 90000, [h.wait()], { maxHp: 100000 });
      const picks = (_, t: number) => [0, t <= 4 ? { switch: t % 2 === 1 ? 1 : 0 } : 0] as [any, any];
      const r = await h.play(side, { self, opp: e, oppBench: [e2], turns: picks }, 5);
      const seedAt = (i: number) => r[i].state[other + 'Marks'].find((m: any) => m.id === 'fear_seed');
      assert.equal(seedAt(0)?.count, 2, side + ' 首次換人即計數→2層');
      const near = (v: number, want: number) => Math.abs(v - want) < 1e-9;
      assert.ok(near(seedAt(0)?.effects.guaranteedMaxHpDamageChance, 0.22), side + ' 每層機率+2%（0.20+0.02）：' + seedAt(0)?.effects.guaranteedMaxHpDamageChance);
      assert.equal(seedAt(1)?.count, 3, side + ' 換人2次→3層');
      assert.ok(near(seedAt(1)?.effects.guaranteedMaxHpDamageChance, 0.24), side + ' 3層=0.24：' + seedAt(1)?.effects.guaranteedMaxHpDamageChance);
      assert.equal(seedAt(2)?.count, 4, side + ' 換人3次→4層');
      assert.ok(near(seedAt(2)?.effects.guaranteedMaxHpDamageChance, 0.26), side + ' 4層=0.26：' + seedAt(2)?.effects.guaranteedMaxHpDamageChance);
      const flower = r[3].state[other + 'Marks'].find((m: any) => m.id === 'fear_flower');
      assert.ok(flower, side + ' 達到5層時轉變為恐懼之花');
      assert.ok(!r[3].state[other + 'Marks'].some((m: any) => m.id === 'fear_seed'), side + ' 恐懼之種已移除');
      assert.equal(flower.count, 1);
      assert.equal(flower.effects.nonTrueDamageDealtMultiplier, 0.5, side + ' 恐懼之花造成×0.5');
      assert.equal(flower.effects.nonTrueDamageTakenMultiplier, 2, side + ' 恐懼之花受到×2');
      assert.equal(flower.effects.guaranteedMaxHpDamageChance, 0.5, side + ' 恐懼之花保底50%');
      assert.equal(flower.effects.instantKillDisabled, true, side + ' 恐懼之花禁秒殺');
      assert.ok(!h.statuses(r[3].opp).includes('害怕'), side + ' 恐懼之花擋附加異常（自身令害怕也被擋）');
      assert.ok(!h.statuses(r[4].opp).includes('害怕'), side + ' 轉生後續回合仍擋附加異常');
      checks++;
    }
    // ⑥ 自身位於背包（場下）：戰鬥開始照樣種下恐懼之種；每回合吸取照常運作、自身淨增體力上限
    {
      const bench = fearUnit('Z', 30000, [h.wait()], { maxHp: 30000 });
      const plain = h.unit('P', 40000, [h.wait()], { maxHp: 50000 });
      const opp = h.unit('E', 100000, [h.wait()]);
      const [r] = await h.play(side, { self: plain, selfBench: [bench], opp, turns: () => [0, 0] }, 1);
      assert.ok(r.state[other + 'Marks'].some((m: any) => m.id === 'fear_seed'), side + ' 場下照樣種下恐懼之種');
      const z = r.state[side + 'Team'].find((e: any) => e.id === 'Z');
      assert.equal(z.maxHp, 30040, side + ' 場下自身 30000-20+60=30040');
      assert.equal(z.currentHp, 29980, side + ' 場下自身體力同樣被夾至上限');
      assert.equal(r.self.maxHp, 49980, side + ' 在場普通精靈也被吸取 -20');
      assert.equal(r.opp.maxHp, 99980, side + ' 對手也被吸取 -20');
      assert.equal(r.self.currentHp, 40000, side + ' 場下魂印不執行戰鬥階段結束恢復（普通在場者無恢復）');
      checks++;
    }
  }
  console.log('OK 種印／吸取／害怕免疫PP歸0／滿體力分支／層數轉生／倍率／場下 雙側通過');
  console.log('5025 魂印「懼」：' + checks + ' 項通過');
} finally { await h.close(); }
