/** 聖靈奧斯卡（5048）：魂印與通用新積木在正式引擎中的 P1／P2 驗收。 */
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { switchRestrictions } = await h.server.ssrLoadModule('/src/battle/actionRestrictions.ts');
  const { getTypeMatchup } = await h.server.ssrLoadModule('/src/utils/statCalculator.ts');
  const seed = DEFAULT_ELVES.find((e: any) => String(e.id) === '5048');
  assert.ok(seed && seed.soulMark.effectMode === 'kit' && seed.skills.every((s: any) => s.effectMode === 'kit'), '5048 魂印與技能皆為 Kit');
  assert.deepEqual(seed.skills.map((s: any) => s.name), ['終審', '禁忌之光', '榮耀聖光', '聖元.神靈恕令', '聖元.破魔']);
  checks++;
  const oscar = (id: string, skills: any[], o: any = {}) => {
    const b = structuredClone(seed);
    Object.assign(b, { id, battleId: id, maxHp: o.hp ?? 100000, currentHp: o.hp ?? 100000, skills, statStages: {},
      baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 },
      calculatedStats: { hp: o.hp ?? 100000, atk: 300, def: 300, spatk: 300, spdef: 300, speed: o.speed ?? 100 } });
    return b;
  };
  const wait = (o: any = {}) => ({ ...h.wait(), name: '等待', pp: 99, maxPp: 99, ...o });
  const hit = (name: string, o: any = {}) => ({ name, category: '物理', type: '普通', power: 60, pp: 20, maxPp: 20, isSureHit: true, accuracy: 100, priority: 0, description: '', ...o });
  const advType = ['龍', '神秘', '暗影', '邪靈', '次元', '光', '聖靈', '混沌', '自然', '神靈', '虛空'].find(t => getTypeMatchup(t, '聖靈') > 1)!;
  assert.ok(advType, '找得到克制聖靈系的屬性');

  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    // 一、使用技能後吸取：0 技能傷害→最低 300（固定）＋300 真實；下回合吸取翻倍
    {
      const r = await h.play(side, { self: oscar('OS1', [wait()]), opp: h.unit('E1', 100000, [wait()]) }, 2);
      assert.equal(100000 - r[0].opp.currentHp, 600, `${side} 最低吸取300＋300真實`);
      assert.equal(r[0].opp.currentHp - r[1].opp.currentHp, 900, `${side} 下回合吸取翻倍600＋300真實`);
      checks++;
    }
    // 二、回合開始：對手選擇技能→當回合先制-3（較快且先制+2的對手改為後出手）
    {
      const r = await h.play(side, { self: oscar('OS2', [wait()], { speed: 50 }), opp: h.unit('E2', 100000, [hit('快攻', { priority: 2 })], { speed: 300 }) }, 1);
      const idx = (n: string) => r[0].logs.findIndex(l => l.includes(`【${n}】使用了`));
      assert.ok(idx('聖靈奧斯卡') >= 0 && idx('聖靈奧斯卡') < idx('E2'), `${side} 對手先制調整為-3後出手：` + r[0].logs.filter(l => l.includes('使用了')).join('｜'));
      checks++;
    }
    // 二-a、先制定值-3為鎖定：之後的封頂（對手先制無法高於自身-5）也不能再降低
    {
      const name = 'E2a' + side;
      h.S[name] = (c: any, ev: string) => { if (ev === 'MODIFY_PRIORITY') c.setOpponentState('capOpponentPriorityThisTurn', true); };
      const r = await h.play(side, { self: oscar('OS2a', [wait({ priority: -5 })], { speed: 300 }), opp: h.unit(name, 100000, [hit('慢攻')], { speed: 10 }) }, 1);
      const idx = (n: string) => r[0].logs.findIndex(l => l.includes(`【${n}】使用了`));
      assert.ok(idx(name) >= 0 && idx(name) < idx('聖靈奧斯卡'), `${side} 鎖定-3不被封頂降到-5（-3先於-5）：` + r[0].logs.filter(l => l.includes('使用了')).join('｜'));
      checks++;
    }
    // 二-b、攻擊且克制自身→失去本系加成與屬性克制（與移除魂印對照）
    {
      const atk = hit('剋擊', { type: advType, power: 100 });
      const run = async (soul: boolean) => {
        const self = oscar(soul ? 'OS3' : 'OS3n', [wait()], { hp: 1000000 });
        if (!soul) self.soulMark = { name: '無', description: '', effectType: 'none', effectValue: 0 };
        const r = await h.play(side, { self, opp: h.unit('E3', 100000, [atk], { type: advType }) }, 1);
        return 1000000 - r[0].self.currentHp;
      };
      const restricted = await run(true), normal = await run(false);
      assert.ok(normal > restricted * 2, `${side} 失去本系（×1.5）與克制（×2 以上）：限制後 ${restricted}／原本 ${normal}`);
      checks++;
    }
    // 二-c、屬性技能→當回合技能附加效果失效
    {
      const heal = h.kitSkill('補血', [{ op: 'heal_flat', p: { amount: 1000 } }]);
      const r = await h.play(side, { self: oscar('OS4', [wait()]), opp: h.unit('E4', 50000, [heal], { maxHp: 100000 }) }, 1);
      assert.equal(r[0].opp.currentHp, 50000 - 600, `${side} 對手屬性技能附加效果失效（未回血），只受魂印吸取600`);
      checks++;
    }
    // 三、戰鬥階段結束：對手選擇技能→所有技能PP-2；未選擇（切換）→下回合無法主動切換
    {
      const r = await h.play(side, { self: oscar('OS5', [wait()]), opp: h.unit('E5', 100000, [hit('普攻', { power: 10 }), hit('備用')]) }, 1);
      assert.deepEqual(r[0].opp.skills.map((s: any) => s.pp), [17, 18], `${side} 使用技能1點＋魂印2點`);
      const s = await h.play(side, { self: oscar('OS6', [wait()]), opp: h.unit('E6', 100000, [wait()]), oppBench: [h.unit('E6b', 100000, [wait()])], turns: (_e, t) => (t === 1 ? [0, { switch: 1 }] : [0, 0]) }, 1);
      assert.equal(switchRestrictions(s[0].state, other).blocked, true, `${side} 對手未選擇技能→下回合無法主動切換`);
      checks++;
    }
    // 四、五行之光的祝福：奧斯卡在背包，在場隊友回合開始處於中毒→轉給對手、解除、3回合星護
    {
      const poisonSelf = h.kitSkill('自毒', [{ op: 'status', p: { side: 'self', status: '中毒', chance: 100, turns: 3 } }]);
      const ally = h.unit('隊友', 100000, [poisonSelf, wait()]);
      const r = await h.play(side, { self: ally, selfBench: [oscar('OS7', [wait()])], opp: h.unit('E7', 100000, [wait()]), turns: (_e, t) => (t === 1 ? [0, 0] : [1, 0]) }, 2);
      assert.ok(h.statuses(r[0].self).includes('中毒'), `${side} 第1回合隊友中毒`);
      assert.ok(h.statuses(r[1].opp).includes('中毒'), `${side} 回合開始中毒轉給對手`);
      assert.ok(!h.statuses(r[1].self).includes('中毒') && h.statuses(r[1].self).includes('星護'), `${side} 隊友解除異常並獲得星護：` + h.statuses(r[1].self).join(','));
      checks++;
    }
    // 四-b、奧斯卡自身在場：回合開始處於六種之「任一種」即觸發（單獨一種、或與感染等其他異常並存都算）→ 轉移該異常、解除全部異常、星護、可行動；
    //       身上沒有六種中的任何一種（例：只有感染）則不觸發。
    for (const list of [...['麻痺', '疲憊', '害怕', '燒傷', '凍傷', '中毒'].map(s => [s]), ['中毒', '感染'], ['感染']]) {
      const name = 'E4b' + side + list.join('');
      let done = false;
      h.S[name] = (c: any, ev: string) => {
        if (ev !== 'ROUND_END' || done) return; done = true;
        const tgt = c.actor === 'p1' ? 'p2' : 'p1', el = tgt === 'p1' ? c.activeP1 : c.activeP2;
        c.updateElf(tgt, { battleId: el.battleId, battleStatuses: Object.fromEntries(list.map(s => [s, 3])), effects: [...(el.effects || []), ...list.map(s => ({ id: s, name: s, duration: 3, stacks: 1 }))] });
      };
      const r = await h.play(side, { self: oscar('OS7b' + list.join(''), [wait()]), opp: h.unit(name, 100000, [wait()]) }, 2);
      assert.deepEqual(h.statuses(r[0].self).filter(s => list.includes(s)).sort(), [...list].sort(), `${side} 第1回合結束處於${list.join('＋')}`);
      const t2 = r[1].logs.slice(r[0].logs.length), acted = t2.some(l => l.includes('【聖靈奧斯卡】使用了'));
      const listed = list.filter(s => s !== '感染');
      if (listed.length) {
        assert.ok(!h.statuses(r[1].self).some(s => list.includes(s)) && h.statuses(r[1].self).includes('星護') && acted, `${side} ${list.join('＋')}：全部解除、星護、可行動：` + h.statuses(r[1].self).join(','));
        assert.ok(listed.every(s => h.statuses(r[1].opp).includes(s)), `${side} ${listed.join('＋')}轉給對手：` + h.statuses(r[1].opp).join(','));
      } else assert.ok(h.statuses(r[1].self).includes('感染') && !acted, `${side} 只有感染：不在六種之內，不觸發`);
      checks++;
    }
    // 五、終審：先出手令對手當回合攻擊技能無效
    {
      const verdict = seed.skills.find((s: any) => s.name === '終審');
      const r = await h.play(side, { self: oscar('OS8', [structuredClone(verdict)]), opp: h.unit('E8', 1000000, [hit('反擊', { power: 120 })], { speed: 10 }) }, 1);
      assert.ok(r[0].logs.some(l => l.includes('【技能無效】') && l.includes('反擊')), `${side} 終審先出手令對手攻擊無效`);
      checks++;
    }
    // 七、神靈恕令：全隊免疫2次；換上的隊友免疫成功→該在場精靈汲取對手200（共2次）
    {
      const pardon = structuredClone(seed.skills.find((s: any) => s.name === '聖元.神靈恕令'));
      assert.equal(seed.skills.find((s: any) => s.name === '禁忌之光').type, '無屬性', '禁忌之光為無屬性');
      assert.equal(seed.skills.find((s: any) => s.name === '榮耀聖光').type, '無屬性', '榮耀聖光為無屬性');
      const poison = h.kitSkill('施毒', [{ op: 'status', p: { side: 'opp', status: '中毒', chance: 100, turns: 3 } }]);
      const os = oscar('OS9', [pardon], { speed: 300 });
      os.soulMark = { name: '無', description: '', effectType: 'none', effectValue: 0 };
      // 第1回合奧斯卡使用恕令（對手等待）；第2回合換上隊友，對手第2、3、4回合施毒。
      const r = await h.play(side, { self: os, selfBench: [h.unit('接棒', 100000, [wait()])], opp: h.unit('E11', 1000000, [wait(), poison], { speed: 10 }),
        turns: (_e, t) => (t === 1 ? [0, 0] : t === 2 ? [{ switch: 1 }, 1] : [0, 1]) }, 4);
      const lg = (i: number) => r[i].logs.join('｜');
      assert.equal(r[1].self.name, '接棒', `${side} 第2回合換上隊友`);
      assert.ok(!h.statuses(r[1].self).includes('中毒') && !h.statuses(r[2].self).includes('中毒'), `${side} 隊友免疫中毒2次：` + lg(1) + lg(2));
      assert.equal(r[0].opp.currentHp - r[1].opp.currentHp, 200, `${side} 隊友免疫成功→汲取200：` + lg(1));
      assert.equal(r[1].opp.currentHp - r[2].opp.currentHp, 200, `${side} 第2次免疫→再汲取200`);
      assert.ok(h.statuses(r[3].self).includes('中毒'), `${side} 免疫次數用完後中毒`);
      assert.equal(r[2].opp.currentHp, r[3].opp.currentHp, `${side} 第3次不再汲取`);
      checks++;
    }
    // 六、通用積木：吸取保留1點體力、隨機能力變化＋等量反向
    {
      const finish = h.kitSkill('留命吸取', [{ op: 'drain', p: { ratio: 1, leaveHp: 1 } }]);
      const r = await h.play(side, { self: h.unit('吸取者', 100000, [finish]), opp: h.unit('E9', 5000, [wait()]) }, 1);
      assert.equal(r[0].opp.currentHp, 1, `${side} 致死吸取保留對方1點體力`);
      const rnd = h.kitSkill('亂數強化', [{ op: 'stat_random', p: { side: 'self', count: 3, v: 1, mirror: 'opp' } }]);
      const q = await h.play(side, { self: h.unit('強化者', 100000, [rnd]), opp: h.unit('E10', 100000, [wait()]) }, 1);
      const sum = (s: any) => Object.values(s || {}).reduce((a: number, v: any) => a + (Number(v) || 0), 0);
      const changed = (s: any) => Object.values(s || {}).filter((v: any) => Number(v) !== 0).length;
      assert.ok(sum(q[0].self.statStages) === 3 && changed(q[0].self.statStages) === 3, `${side} 自身隨機3種+1`);
      assert.ok(sum(q[0].opp.statStages) === -3, `${side} 對手等量下降`);
      checks++;
    }
  }
  console.log(`聖靈奧斯卡：${checks} 項通過（P1/P2）`);
} finally { await h.close(); }
