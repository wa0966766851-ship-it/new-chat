/**
 * 趙雲（5052）、晻藹夜靈.布萊克（5053）、虯螭淵玄.索蘭特（5054）P1／P2 驗收（2026-11-21）。
 * 一、赤膽：開戰雙方每隻（含背包）各1層、開戰即登場不重複；己方受到固定傷害時消耗並免疫。
 * 二、趙雲使用技能：對手與自身同一批3項能力-1，自身下降換成2倍提升（淨+2），並獲得1枚龍膽。
 * 三、雙重暗影：致死保留1點，回合結束扣1道。
 * 四、共生循環：布萊克被擊敗後索蘭特登場首回合撐過回合結束 → 布萊克於背包末位重生；共生循環道具不可選用。
 * 五、索蘭特登場：剝離暗影系、獲得純粹暗影、下次受到的技能傷害轉為護盾與護罩。
 * 六、格勞恩斯雲燁竭天：先解除自身異常再令對手麻痺。
 */
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
import { checkElfDead } from '../src/battle/elfAlive';
import { activeBagOf, listBagElves } from '../src/battle/bagTargets';

const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { legalActions } = await h.server.ssrLoadModule('/src/battle/ai/legalActions.ts');
  const seed = (id: string, bid: string, skills?: number[], hp = 5000) => {
    const s = structuredClone(DEFAULT_ELVES.find((e: any) => String(e.id) === id));
    assert.ok(s && s.soulMark.effectMode === 'kit' && s.skills.every((k: any) => k.effectMode === 'kit'), id + ' 魂印與技能皆為 Kit');
    Object.assign(s, { battleId: bid, maxHp: hp, currentHp: hp, calculatedStats: { hp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: 300 }, statStages: {} });
    if (skills) s.skills = skills.map(i => s.skills[i]);
    return s;
  };
  const marks = (state: any, side: string, id: string) => (state[`${side}Marks`] || []).filter((m: any) => m.id === id);
  const fixed = (n: number) => h.kitSkill('固傷', [{ op: 'dmg', p: { flat: n, type: '固定' } }], { priority: 5 });
  const truth = (n: number, hits = 1) => h.kitSkill('真傷', Array.from({ length: hits }, () => ({ op: 'dmg', p: { flat: n, type: '真實' } })), { priority: 5, pp: 99, maxPp: 99, currentPp: 99 });

  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    // 一＋二
    {
      const zy = seed('5052', 'ZY' + side, [1]);
      const r = await h.play(side, { self: zy, selfBench: [h.unit('友' + side, 3000, [h.wait()])], opp: h.unit('敵' + side, 50000, [fixed(300)]), oppBench: [h.unit('敵B' + side, 3000, [h.wait()])] }, 1);
      const st = r[0].state;
      assert.deepEqual(marks(st, side, 'chidanOwn').map((m: any) => [m.ownerBattleId, m.count]), [['友' + side, 1]], `${side} 己方背包隊友1層（開戰即登場只附加一次）`);
      // 對方在場精靈被附加「攻擊命中效果失效」（回合類效果）→ 回合結束消耗並害怕；背包那隻保留1層。
      assert.deepEqual(marks(st, other, 'chidanFoe').map((m: any) => [m.ownerBattleId, m.count]), [['敵B' + side, 1]], `${side} 對方背包1層、在場者已消耗`);
      assert.ok(h.statuses(r[0].opp).includes('害怕'), `${side} 對方持有赤膽消耗時害怕`);
      assert.equal(r[0].self.currentHp, 5000, `${side} 赤膽免疫固定傷害：` + r[0].logs.join('｜'));
      assert.ok(!marks(st, side, 'chidanOwn').some((m: any) => m.ownerBattleId === zy.battleId), `${side} 趙雲的赤膽已消耗`);
      assert.equal(marks(st, side, 'zyGall').find((m: any) => m.ownerBattleId === zy.battleId)?.count, 1, `${side} 使用技能獲得1枚龍膽`);
      const downs = Object.entries(r[0].opp.statStages || {}).filter(([, v]) => Number(v) < 0).map(([k]) => k);
      assert.equal(downs.length, 3, `${side} 對手3項能力-1：` + JSON.stringify(r[0].opp.statStages));
      // 百戰無傷：使用前的提升翻倍（全屬性+2）；共同的3項先-1再轉成+3 → 這3項合計+4。
      for (const k of downs) assert.equal(r[0].self.statStages[k], 4, `${side} 自身同批能力淨提升（${k}）：` + JSON.stringify(r[0].self.statStages));
      checks++;
    }
    // 三
    {
      const blake = seed('5053', 'NB' + side); blake.skills = [h.wait()];
      const r = await h.play(side, { self: blake, opp: h.unit('致死' + side, 50000, [truth(999999, 3)]) }, 1);
      assert.equal(r[0].self.currentHp, 1, `${side} 雙重暗影致死保留1點：` + r[0].logs.join('｜'));
      assert.ok(!checkElfDead(r[0].self), `${side} 存活`);
      assert.equal(marks(r[0].state, side, 'doubleShadow').length, 0, `${side} 回合結束扣除1道（原1道）`);
      checks++;
    }
    // 四：兩個方向的召回都依實戰隊列移到最後，原始背包配對位數維持開局設定。
    for (const [starterId, partnerId] of [['5053', '5054'], ['5054', '5053']]) {
      const starter = seed(starterId, '首' + side), partner = seed(partnerId, '援' + side);
      const reserve = h.unit('友4' + side, 3000, [h.wait()]);
      [starter, partner, reserve].forEach((elf, i) => { elf.initialBagSlot = i; });
      starter.skills = [h.wait()];
      partner.skills = [h.wait()];
      const killer = '連殺' + side;
      h.S[killer] = (_c: any, ev: string, data: any) => { if (ev === 'BEFORE_STATUS_APPLY') data.prevented = true; };
      const lethal = truth(999999, 2);
      // 索蘭特會封對手屬性技能的附加效果，測試傷害用固有條款穿過這項干擾。
      lethal.kit[0].role = 'innate';
      lethal.kit[0].params.clause.marker = '■';
      const r = await h.play(side, { self: starter, selfBench: [partner, reserve], opp: h.unit(killer, 900000, [lethal, h.wait()]),
        turns: (_e, t) => t === 3 ? [{ switch: 1 }, 1] : [0, t >= 4 ? 1 : 0] }, 4);
      const state = r[3].state;
      const team = state[`${side}Team`];
      const revived = team.find((e: any) => e.battleId === starter.battleId);
      assert.ok(r[3].logs.some((l: string) => l.includes('被召回己方背包末位並重生')), `${side}/${starterId} 共生循環觸發：` + r[3].logs.slice(-40).join('｜'));
      assert.equal(revived.currentHp, revived.maxHp, `${side}/${starterId} 重生回滿`);
      assert.deepEqual(team.map((elf: any) => elf.battleId), [partner.battleId, reserve.battleId, starter.battleId]);
      assert.equal(team[state[`${side}ActiveIndex`]].battleId, partner.battleId);
      assert.deepEqual(activeBagOf(team).map(elf => elf.battleId), [starter.battleId, partner.battleId, reserve.battleId]);
      assert.deepEqual(listBagElves({ p1: state.p1Team, p2: state.p2Team }).filter(entry => entry.side === side).map(entry => entry.elf.battleId),
        [partner.battleId, reserve.battleId, starter.battleId]);
      const inv = state[`${side}ItemInventory`];
      assert.ok((inv?.symbiosis_cycle?.left || 0) >= 1, `${side} 道具欄有共生循環`);
      assert.ok(!legalActions(state, side).some((a: any) => a.kind === 'item' && a.id === 'symbiosis_cycle'), `${side} 共生循環不可選用`);
      checks++;
    }
    // 五
    {
      const solant = seed('5054', 'SL5' + side, [1]);
      const hit = h.kitSkill('技打', [], { category: '物理', power: 80, type: '普通', priority: 5 });
      const r = await h.play(side, { self: solant, opp: h.unit('打' + side, 50000, [hit]) }, 1);
      assert.equal(r[0].self.type, '龍', `${side} 剝離暗影系`);
      assert.ok((r[0].state[`${side}ItemInventory`]?.pure_shadow?.left || 0) >= 1, `${side} 獲得純粹暗影`);
      assert.ok(r[0].logs.some((l: string) => l.includes('轉化為等量護盾與護罩')), `${side} 技能傷害轉護盾：` + r[0].logs.join('｜'));
      checks++;
    }
    // 七、長纓破陣：每項能力提升（每枚龍膽視為1項）各附加77
    {
      const gall = { id: 'zyGall', name: '龍膽', displayChar: '膽', unit: '枚', side: 'self', scope: 'elf', persistsOffField: true, maxCount: 7, description: '測試', amount: 2 };
      const probe = h.kitSkill('每項', [{ op: 'resource_mark_add', p: gall }, { op: 'dmg_per_stage_items', p: { flat: 77, type: '真實', perMarkId: 'zyGall' } }]);
      const self = h.unit('每項' + side, 5000, [probe], { statStages: { atk: 1, def: 2, spatk: 0, spdef: 0, speed: 0, accuracy: 0 } });
      const r = await h.play(side, { self, opp: h.unit('受' + side, 50000, [h.wait()]) }, 1);
      assert.equal(50000 - r[0].opp.currentHp, 77 * 4, `${side} 2項提升＋2枚龍膽＝4項×77：` + r[0].logs.join('｜'));
      checks++;
    }
    // 八、王.負咎泯晝封印：下次致死保留觸發後本場不再觸發
    {
      const run = async (sealed: boolean) => {
        const name = (sealed ? '封' : '對照') + side;
        const keep = { name: '多次致死存活', effectMode: 'kit', kit: [{ codeId: 'effect_sequence', node: 'on_entered', source: 'soulmark', role: 'innate', order: 0, customText: '測試',
          params: { clause: { raw: '測試', trig: 'entrance', parsed: true, body: [{ acts: [{ op: 'survive_uses', p: { uses: 5 }, label: 'survive_uses' }] }] } } }] };
        const seal = sealed ? h.kitSkill('封', [{ op: 'seal_fatal_resist', p: { side: 'opp' } }], { priority: 6 }) : { ...h.wait(), priority: 6 };
        const r = await h.play(side, { self: h.unit('封者' + side, 5000, [seal, truth(999999)]), opp: h.unit(name, 5000, [h.wait()], { extra: { soulMark: keep } }),
          turns: (_e, t) => [t === 1 ? 0 : 1, 0] }, 3);
        return r;
      };
      const ctl = await run(false), sealed = await run(true);
      assert.ok(!checkElfDead(ctl[2].opp), `${side} 對照：每回合致死皆存活：` + ctl.map((x: any) => x.logs.slice(-6).join("｜")).join(" ## "));
      assert.ok(!checkElfDead(sealed[1].opp), `${side} 封印後第一次仍觸發`);
      assert.ok(checkElfDead(sealed[2].opp), `${side} 封印後第二次無法再觸發：` + sealed[2].logs.slice(-8).join('｜'));
      checks++;
    }
    // 九、無視對手同等級先制：本回合+1並抵銷對手1點正先制
    {
      const offset = { ...h.wait(), name: '搶' };
      const soul = { name: '先制', effectMode: 'kit', kit: [{ codeId: 'effect_sequence', node: 'modify_priority', source: 'soulmark', role: 'innate', order: 0, customText: '測試',
        params: { clause: { raw: '測試', trig: 'modify_priority', parsed: true, body: [{ acts: [{ op: 'prio_bonus', p: { v: 1 }, label: 'p' }, { op: 'priority_offset_round', p: { amount: 1 }, label: 'o' }] }] } } }] };
      const r = await h.play(side, { self: h.unit('慢' + side, 5000, [offset], { speed: 10, extra: { soulMark: soul } }), opp: h.unit('快' + side, 5000, [{ ...h.wait(), name: '快', priority: 1 }], { speed: 900 }) }, 1);
      const idx = (n: string) => r[0].logs.findIndex((l: string) => l.includes(`【${n}】使用了`));
      assert.ok(idx('慢' + side) >= 0 && idx('慢' + side) < idx('快' + side), `${side} 先制+1且抵銷對手+1 → 先手：` + r[0].logs.join('｜'));
      checks++;
    }
    // 十、純粹暗影：剝離混沌系；激活道具令布萊克的狂暴轉為平靜，下場後消失
    {
      const chaos = seed('5015', 'CB' + side); chaos.skills = [h.kitSkill('剝離', [{ op: 'strip_type_team_named', p: { names: ['布萊克'], type: '混沌' } }])];
      const r0 = await h.play(side, { self: chaos, opp: h.unit('剝' + side, 50000, [h.wait()]) }, 1);
      assert.equal(r0[0].self.type, '暗影', `${side} 混沌系剝離`);
      assert.ok(r0[0].self.skills.every((k: any) => !String(k.type || '').includes('混沌')), `${side} 技能混沌屬性剝離`);
      const blake = h.unit('測試布萊克' + side, 5000, [h.kitSkill('激活', [{ op: 'grant_item', p: { side: 'self', itemId: 'pure_shadow_active', count: 1 } }]), h.wait()], { type: '暗影' });
      const rage = h.kitSkill('狂暴', [{ op: 'status', p: { side: 'opp', status: '狂暴', turns: 3, chance: 100 } }]);
      const r = await h.play(side, { self: blake, selfBench: [h.unit('換' + side, 3000, [h.wait()])], opp: h.unit('激' + side, 50000, [h.wait(), rage]),
        turns: (_e, t) => t === 1 ? [0, 0] : t === 2 ? [1, 1] : [{ switch: 1 }, 0] }, 3);
      assert.ok(h.statuses(r[1].self).includes('平靜') && !h.statuses(r[1].self).includes('狂暴'), `${side} 狂暴轉為平靜：` + r[1].logs.slice(-6).join('｜'));
      assert.ok(Array.isArray(r[1].self.statusRules) && r[1].self.statusRules.some((x: any) => x.whileStatus === '平靜'), `${side} 平靜時取得狂暴的取消規則`);
      assert.equal(r[2].state[`${side}ItemInventory`]?.pure_shadow_active?.left || 0, 0, `${side} 布萊克下場後激活道具消失`);
      checks++;
    }
    // 十二、無法進入異常：任何來源（含自身附加、蓋亞「雙方進入異常時自身進入砥礪」）都不能進入；無法附加：施加方的自我附加也被擋
    {
      const block = h.kitSkill('封異常', [{ op: 'status_entry_block_turns', p: { side: 'opp', turns: 3 } }], { priority: 6 });
      const selfRage = h.kitSkill('自狂暴', [{ op: 'status', p: { side: 'self', status: '狂暴', turns: 3, chance: 100 } }]);
      const r1 = await h.play(side, { self: h.unit('封者' + side, 5000, [block]), opp: h.unit('自附' + side, 5000, [selfRage]) }, 1);
      assert.ok(!h.statuses(r1[0].opp).includes('狂暴'), `${side} 無法進入：自身附加也被擋：` + r1[0].logs.join('｜'));
      const guard = h.kitSkill('禁附加', [{ op: 'status_inflict_guard_turns', p: { side: 'opp', kind: 'all', turns: 3 } }], { priority: 6 });
      const r2 = await h.play(side, { self: h.unit('禁者' + side, 5000, [guard]), opp: h.unit('自附2' + side, 5000, [selfRage]) }, 1);
      assert.ok(!h.statuses(r2[0].opp).includes('狂暴'), `${side} 無法附加：自我附加同樣被擋`);
      const gaia = seed('5043', 'GA' + side); gaia.skills = [h.wait()];
      const both = h.kitSkill('封並自燒', [{ op: 'status_entry_block_turns', p: { side: 'opp', turns: 3 } }, { op: 'status', p: { side: 'self', status: '燒傷', turns: 3, chance: 100 } }], { priority: 6 });
      const r3 = await h.play(side, { self: h.unit('封燒' + side, 50000, [both]), opp: gaia }, 1);
      assert.ok(h.statuses(r3[0].self).includes('燒傷'), `${side} 施放者自己可進入異常`);
      assert.ok(!h.statuses(r3[0].opp).includes('砥礪'), `${side} 蓋亞無法進入砥礪：` + r3[0].logs.join('｜'));
      const gaia2 = seed('5043', 'GB' + side); gaia2.skills = [h.wait()];
      const burnOnly = h.kitSkill('自燒', [{ op: 'status', p: { side: 'self', status: '燒傷', turns: 3, chance: 100 } }], { priority: 6 });
      const r4 = await h.play(side, { self: h.unit('自燒者' + side, 50000, [burnOnly]), opp: gaia2 }, 1);
      assert.ok(h.statuses(r4[0].opp).includes('砥礪'), `${side} 對照：未封鎖時蓋亞進入砥礪：` + r4[0].logs.join('｜'));
      checks++;
    }
    // 六
    {
      const grauen = structuredClone(DEFAULT_ELVES.find((e: any) => e.name === '格勞恩斯'));
      Object.assign(grauen, { battleId: 'GR' + side, maxHp: 5000, currentHp: 5000, skills: [grauen.skills.find((s: any) => s.name === '雲燁竭天')], battleStatuses: { 燒傷: 3 } });
      const r = await h.play(side, { self: grauen, opp: h.unit('受麻' + side, 50000, [h.wait()]) }, 1);
      const cure = r[0].logs.findIndex((l: string) => l.includes('解除了異常狀態')), para = r[0].logs.findIndex((l: string) => l.includes('麻痺'));
      assert.ok(cure >= 0 && para > cure, `${side} 先解除異常再附加麻痺：` + r[0].logs.join('｜'));
      checks++;
    }
  }
  // 十一、異常規則多來源並存（狂暴、平靜、山神守護各自生效，不互相覆蓋）
  {
    const { getEffectiveStatuses } = await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
    const rules = h.kitSkill('規則', [{ op: 'status_rules', p: { whileStatus: '狂暴', cancelExceptCategory: 'AUXILIARY' } }, { op: 'status_rules', p: { whileStatus: '山神守護', cancelEffects: ['CONTROL'] } }]);
    const r = await h.play('p1', { self: h.unit('規則者', 5000, [rules]), opp: h.unit('規則對手', 5000, [h.wait()]) }, 1);
    const list = r[0].self.statusRules;
    assert.ok(Array.isArray(list) && list.length === 2, '兩組規則並存：' + JSON.stringify(list));
    const elf = { ...r[0].self, battleStatuses: { 狂暴: 2, 燒傷: 2 }, effects: [] };
    assert.deepEqual(Object.keys(getEffectiveStatuses(elf)).sort(), ['狂暴'].sort(), '狂暴規則：取消燒傷原有效果' + JSON.stringify(getEffectiveStatuses(elf)));
    checks++;
  }
  console.log(`趙雲／布萊克／索蘭特：${checks} 項通過（P1/P2）`);
} finally { await h.close(); }
