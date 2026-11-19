/** 百科名詞預作積木（2026-11-16）：放逐、能力提升效果失效；P1／P2 各驗一次。 */
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let checks = 0;
try {
  const { switchRestrictions } = await h.server.ssrLoadModule('/src/battle/actionRestrictions.ts');
  const { sequenceIssue } = await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
  const clause = (op: string, p: any) => ({ raw: op, trig: 'use', parsed: true, body: [{ acts: [{ op, p }] }] });
  assert.equal(sequenceIssue(clause('banish_turns', { turns: 2 })), null);
  assert.equal(sequenceIssue(clause('boost_invalid_turns', { side: 'opp', turns: 2 })), null);
  assert.ok(sequenceIssue(clause('boost_invalid_turns', { side: 'both', turns: 2 })), '需指定自身或對手');
  assert.ok(sequenceIssue(clause('banish_turns', { turns: 0 })), '回合數需為正整數');
  checks++;
  const attack = { name: '測擊', category: '物理', type: '普通', power: 100, pp: 20, maxPp: 20, isSureHit: true, description: '' };
  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    // 放逐：對手全隊無法主動切換（含背包精靈），強制換人不受影響
    {
      const banish = h.kitSkill('放逐術', [{ op: 'banish_turns', p: { turns: 2 } }]);
      const r = await h.play(side, { self: h.unit('放逐者', 100000, [banish]), opp: h.unit('受放逐', 100000, [h.wait()]), oppBench: [h.unit('背包', 100000, [h.wait()])] }, 1);
      const st = r[0].state;
      const res = switchRestrictions(st, other);
      assert.ok(res.blocked && res.list.some((x: any) => x.scope === 'team'), `${side} 放逐：對手全隊無法主動切換`);
      assert.equal(switchRestrictions(st, other, { forcedReplace: true }).blocked, false, `${side} 強制換人不受放逐影響`);
      assert.equal(switchRestrictions(st, side).blocked, false, `${side} 施放方不受影響`);
      checks++;
    }
    // 能力提升效果失效：提升等級不參與傷害公式，但等級數值保留
    {
      const dmg = async (defStage: number, invalidOnDefender: boolean, atkStage = 0, invalidOnAttacker = false) => {
        const self = h.unit(`攻_${defStage}_${invalidOnDefender}_${atkStage}_${invalidOnAttacker}`, 100000, [attack], { speed: 200, statStages: { atk: atkStage } });
        const opp = h.unit(`守_${defStage}_${invalidOnDefender}_${atkStage}_${invalidOnAttacker}`, 1000000, [h.wait()], { statStages: { def: defStage } });
        const add = (c: any) => c.addTimerTo(c.actor, { id: '驗收提升失效', name: '能力提升效果失效', remaining: 3, kind: 'turn_effect', source: 'skill', tickAt: 'round_end', payload: { block: { boostInvalid: true } } }, false);
        h.S[opp.name] = (c: any, e: string) => { if (e === 'ON_ENTRANCE' && invalidOnDefender) add(c); };
        h.S[self.name] = (c: any, e: string) => { if (e === 'ON_ENTRANCE' && invalidOnAttacker) add(c); };
        const [r] = await h.play(side, { self, opp }, 1);
        return { lost: 1000000 - r.opp.currentHp, defStage: r.opp.statStages.def || 0, atkStage: r.self.statStages.atk || 0 };
      };
      const boosted = await dmg(6, false), invalid = await dmg(6, true), plain = await dmg(0, false);
      assert.ok(boosted.lost < plain.lost, `${side} 對照：防禦+6 應減傷`);
      assert.equal(invalid.lost, plain.lost, `${side} 受方提升失效＝視同 0 級`);
      assert.equal(invalid.defStage, 6, `${side} 等級本身保留（仍算處於能力提升）`);
      const dropped = await dmg(-2, false), droppedInvalid = await dmg(-2, true);
      assert.equal(droppedInvalid.lost, dropped.lost, `${side} 能力下降不受影響`);
      const atkUp = await dmg(0, false, 6), atkUpInvalid = await dmg(0, false, 6, true);
      assert.ok(atkUp.lost > plain.lost, `${side} 對照：攻擊+6 應增傷`);
      assert.equal(atkUpInvalid.lost, plain.lost, `${side} 攻方提升失效＝視同 0 級`);
      checks++;
    }
  }
  // 複製技能：自身下1次使用技能改用對手當回合選擇的技能（PP 扣原技能），用完不再複製
  for (const side of ['p1', 'p2'] as const) {
    const grant = h.kitSkill('鏡像', [{ op: 'copy_opp_skill', p: { uses: 1 } }]);
    const own = { ...h.wait(), name: '原招', pp: 10, maxPp: 10 };
    const heavy = { name: '重擊', category: '物理', type: '普通', power: 150, pp: 20, maxPp: 20, isSureHit: true, description: '' };
    const r = await h.play(side, { self: h.unit('複製者', 100000, [grant, own], { speed: 200 }), opp: h.unit('被複製', 1000000, [heavy], { speed: 100 }), turns: (_e, t) => (t === 1 ? [0, 0] : [1, 0]) }, 3);
    assert.ok(r[1].logs.some(l => l.includes('改用了對手的【重擊】')), `${side} 第2回合複製對手重擊`);
    assert.ok(r[1].opp.currentHp < r[0].opp.currentHp, `${side} 複製的攻擊造成傷害`);
    assert.equal(r[1].self.skills[1].pp, 9, `${side} PP 扣原技能欄位`);
    assert.equal(r[2].logs.filter(l => l.includes('改用了對手的【重擊】')).length, 1, `${side} 用完不再複製（第3回合不再改用）`);
    checks++;
  }
  // 調用技能：使用外殼時改以指定技能結算（PP 扣外殼），與複製技能同一讀取端
  // 解封：sealedUntilUnseal 技能初始不可選（「尚未解封」），unseal_skill 後可選
  {
    const { skillSelectionBlock } = await h.server.ssrLoadModule('/src/battle/ai/legalActions.ts');
    assert.ok(sequenceIssue(clause('invoke_skill', { name: '重擊', uses: 1 })) === null && sequenceIssue(clause('unseal_skill', { name: '封印斬' })) === null);
    assert.ok(sequenceIssue(clause('invoke_skill', { uses: 1 })), '調用需指定技能');
    for (const side of ['p1', 'p2'] as const) {
      const grant = h.kitSkill('起手', [{ op: 'invoke_skill', p: { name: '重擊', shell: '外殼', uses: 1 } }]);
      const shell = { ...h.wait(), name: '外殼', pp: 10, maxPp: 10 };
      const heavy = { name: '重擊', category: '物理', type: '普通', power: 150, pp: 5, maxPp: 5, isSureHit: true, description: '' };
      const self = { ...h.unit('調用者', 100000, [grant, shell], { speed: 200 }), skillPool: [heavy] };
      const r = await h.play(side, { self, opp: h.unit('受調用', 1000000, [h.wait()]), turns: (_e, t) => (t === 1 ? [0, 0] : [1, 0]) }, 3);
      assert.ok(r[1].logs.some(l => l.includes('以【外殼】調用了【重擊】')), `${side} 外殼調用重擊`);
      assert.ok(r[1].opp.currentHp < 1000000, `${side} 調用的攻擊造成傷害`);
      assert.equal(r[1].self.skills[1].pp, 9, `${side} PP 扣外殼`);
      assert.equal(r[2].logs.filter(l => l.includes('調用了【重擊】')).length, 1, `${side} 次數用完不再調用`);

      const sealed = { name: '封印斬', category: '物理', type: '普通', power: 80, pp: 5, maxPp: 5, isSureHit: true, description: '', sealedUntilUnseal: true };
      const unseal = h.kitSkill('解封術', [{ op: 'unseal_skill', p: { name: '封印斬' } }]);
      const u = await h.play(side, { self: h.unit('解封者', 100000, [unseal, sealed], { speed: 200 }), opp: h.unit('受解封', 1000000, [h.wait()]), turns: (e, t) => {
        if (t === 1) assert.equal(skillSelectionBlock(e.getState(), side, e.getState()[side], 1), '尚未解封', `${side} 初始不可選`);
        return [0, 0];
      } }, 1);
      assert.equal(skillSelectionBlock(u[0].state, side, u[0].self, 1), '', `${side} 解封後可選`);
      checks++;
    }
  }
  console.log(`百科名詞積木（放逐／能力提升效果失效／複製／調用／解封）：${checks} 項通過`);
} finally { await h.close(); }
