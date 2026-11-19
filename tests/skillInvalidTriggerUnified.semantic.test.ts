/**
 * 「技能無效時」統一判定（2026-11-16 使用者規範）：
 * 技能無效、未命中、閃避、免疫受到的攻擊、BOSS 技能無效 → 觸發（BOSS 只觸發一次）；
 * 正常命中、抵擋攻擊傷害、附加效果失效 → 不觸發。
 * 兩種寫法都驗：on_invalid 節點（無條件）＋ self_invalid 持續入口帶「技能無效」條件。
 */
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let checks = 0;
try {
  const probe = () => ({
    name: '探針', category: '物理', type: '普通', power: 80, pp: 20, maxPp: 20, accuracy: 100, isSureHit: false, description: '',
    effectMode: 'kit', kit: [
      { codeId: 'effect_sequence', node: 'on_invalid', source: 'skill', role: 'attached', order: 0, customText: '技能無效時自身攻擊+1',
        params: { clause: { raw: '技能無效時自身攻擊+1', marker: '🎯', trig: 'on_invalid', parsed: true, body: [{ acts: [{ op: 'stat', p: { side: 'self', stats: ['攻擊'], v: 1 }, label: 'stat' }] }] } } },
      { codeId: 'effect_sequence', node: 'on_invalid', source: 'skill', role: 'attached', order: 1, customText: '技能無效時自身特攻+1',
        params: { clause: { raw: '技能無效時自身特攻+1', marker: '🎯', trig: 'self_invalid', parsed: true, body: [{ cond: [{ c: 'skill_invalid', p: {}, label: '技能無效' }], acts: [{ op: 'stat', p: { side: 'self', stats: ['特攻'], v: 1 }, label: 'stat' }] }] } } },
    ],
  });
  const bossSkill = h.kitSkill('授予技能無效', [{ op: 'boss_trait', p: { side: 'self', id: 'nullify', x: 100, v: 'A' } }]);
  type Setup = (c: any) => void;
  const run = async (side: 'p1' | 'p2', tag: string, opts: { setup?: Setup; miss?: boolean; boss?: boolean }) => {
    const skill = probe();
    if (opts.miss) skill.accuracy = 0;
    const self = h.unit(`施放_${tag}`, 100000, [skill, h.wait()], { speed: 200 });
    const opp = h.unit(`受方_${tag}`, 100000, [h.wait(), bossSkill], { speed: 100 });
    h.S[opp.name] = (c: any, event: string) => { if (event === 'ON_ENTRANCE' && opts.setup) opts.setup(c); };
    const turns = opts.boss ? 2 : 1;
    const r = await h.play(side, { self, opp, turns: (_e, t) => (opts.boss && t === 1 ? [1, 1] : [0, 0]) }, turns);
    const last = r[r.length - 1];
    return { atk: last.self.statStages.atk || 0, spatk: last.self.statStages.spatk || 0, oppHp: last.opp.currentHp, logs: last.logs };
  };
  for (const side of ['p1', 'p2'] as const) {
    const fired = (x: { atk: number; spatk: number }, tag: string) => {
      assert.equal(x.atk, 1, `${side} ${tag}：on_invalid 觸發一次`);
      assert.equal(x.spatk, 1, `${side} ${tag}：「技能無效」條件成立一次`);
    };
    const silent = (x: { atk: number; spatk: number }, tag: string) => {
      assert.equal(x.atk, 0, `${side} ${tag}：不得觸發 on_invalid`);
      assert.equal(x.spatk, 0, `${side} ${tag}：「技能無效」條件不得成立`);
    };
    const normal = await run(side, '正常', {});
    silent(normal, '正常命中'); assert.ok(normal.oppHp < 100000, `${side} 正常命中有傷害`); checks++;

    fired(await run(side, '無效', { setup: c => c.addTimerTo(c.targetSide, { id: '驗收無效', name: '驗收無效', remaining: 1, kind: 'use_counter', source: 'skill', tickAt: 'never', payload: { block: { invalid: 'all' } } }, false) }), '技能無效'); checks++;
    fired(await run(side, '未命中', { miss: true }), '未命中'); checks++;
    fired(await run(side, '攻擊免疫', { setup: c => c.setPlayerState('blockAttackCount', 1) }), '免疫受到的攻擊'); checks++;

    const blocked = await run(side, '抵擋', { setup: c => c.addTimerTo(c.actor, { id: '驗收抵擋', name: '驗收抵擋', remaining: 1, kind: 'use_counter', source: 'skill', tickAt: 'never', payload: { block: { blockAttack: true } } }, false) });
    silent(blocked, '抵擋攻擊傷害'); assert.equal(blocked.oppHp, 100000, `${side} 抵擋後無傷害`); checks++;

    silent(await run(side, '附加失效', { setup: c => c.addTimerTo(c.targetSide, { id: '驗收附加失效', name: '驗收附加失效', remaining: 1, kind: 'use_counter', source: 'skill', tickAt: 'never', payload: { block: { addInvalid: 'all' } } }, false) }), '附加效果失效'); checks++;

    const boss = await run(side, 'BOSS', { boss: true });

    fired(boss, "BOSS 技能無效"); assert.equal(boss.oppHp, 100000, `${side} BOSS 技能無效：無法造成技能傷害`); checks++;
  }
  console.log(`技能無效時統一判定：${checks} 項通過（P1/P2）`);
} finally { await h.close(); }
