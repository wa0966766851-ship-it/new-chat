/**
 * 2026-11-17 底層修正驗收（P1／P2）：
 * 一、回合結束效果期間建立的「下回合」計時器在下回合即生效（滄嵐「下回合開始時解除自身異常」原本永遠不觸發）。
 * 二、強制執行命中效果：連擊次數＝變威力、攻擊方魂印威力條款（outgoing_power）也算變威力 → 對攻擊免疫／攻擊技能無效重算出傷害；
 *     沒有強制執行時，連擊或變威力都不能穿透。
 * 三、「無視對手不高於N的先制」（oppPriorityCeiling）單獨生效，不再依附「對手先制無法高於自身」。
 */
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { authoredEntry: e, actions: act, operation: a } = await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
  const inject = (status: string) => {
    let done = false;
    return (c: any, ev: string) => {
      if (ev !== 'ROUND_END' || done) return; done = true;
      const tgt = c.actor === 'p1' ? 'p2' : 'p1', el = tgt === 'p1' ? c.activeP1 : c.activeP2;
      c.updateElf(tgt, { battleId: el.battleId, battleStatuses: { [status]: 3 }, effects: [...(el.effects || []), { id: status, name: status, duration: 3, stacks: 1 }] });
    };
  };
  const lan = DEFAULT_ELVES.find((x: any) => String(x.id) === '5028');
  for (const side of ['p1', 'p2'] as const) {
    // 一、滄嵐：第1回合結束時（未受技能傷害）建立「下回合開始時解除異常」→ 第2回合開始即解除
    {
      const self = structuredClone(lan);
      Object.assign(self, { battleId: 'LAN' + side, maxHp: 100000, currentHp: 100000, skills: [{ ...h.wait(), name: '等待' }] });
      const opp = 'E_lan' + side; h.S[opp] = inject('麻痺');
      const r = await h.play(side, { self, opp: h.unit(opp, 100000, [h.wait()]) }, 2);
      assert.ok(h.statuses(r[0].self).includes('麻痺'), `${side} 第1回合結束時處於麻痺`);
      assert.ok(!h.statuses(r[1].self).includes('麻痺'), `${side} 下回合開始時解除：` + h.statuses(r[1].self).join(','));
      assert.ok(!r[1].logs.slice(r[0].logs.length).some(l => l.includes('【怒濤·滄嵐】因異常狀態無法行動')), `${side} 第2回合可行動`);
      checks++;
    }
    // 一-b、通用：回合結束建立的「下回合先制+2」在緊接的回合生效，不多等一回合
    {
      const soul = { name: '回合結束下回合先制', effectMode: 'kit', kit: [e('回合結束時下回合先制+2', 'round_end', [act(a('prio_turns', { v: 2, turns: 1, next: true }))], 0, 'soulmark', true)] };
      const r = await h.play(side, { self: h.unit('慢者', 100000, [h.wait()], { speed: 10, extra: { soulMark: soul } }), opp: h.unit('快者', 100000, [h.wait()], { speed: 300 }) }, 2);
      const t2 = r[1].logs.slice(r[0].logs.length), idx = (n: string) => t2.findIndex(l => l.includes(`【${n}】使用了`));
      assert.ok(idx('慢者') >= 0 && idx('慢者') < idx('快者'), `${side} 第2回合先制+2生效：` + t2.filter(l => l.includes('使用了')).join('｜'));
      checks++;
    }
  }
  // 二、強制執行與變威力
  const ent = (trig: string, acts: any[], order: number) => ({ codeId: 'effect_sequence', node: trig === 'before_skill' ? 'before_skill' : 'on_skill_use', source: 'skill', role: 'innate', order, customText: trig, params: { clause: { raw: trig, marker: '🎯', trig, parsed: true, body: [{ acts: acts.map(x => ({ label: x.op, ...x })) }] } } });
  const hits = { codeId: 'skill_property', node: 'before_skill', source: 'skill', role: 'innate', order: 9, customText: '連擊', params: { property: 'attack_hits', value: { min: 3, max: 3 }, conditions: [] } };
  const force = ent('before_skill', [{ op: 'sure_hit_force', p: {} }], 1);
  const atk = (name: string, kit: any[]) => ({ ...h.wait(), name, category: '物理', type: '普通', power: 100, isSureHit: true, effectMode: 'kit', kit });
  const powerSoul = { name: '魂印增威', effectMode: 'kit', kit: [e('攻擊威力翻倍', 'outgoing_power', [act(a('power_mod', { boost: 1, final: true }))], 0, 'soulmark', true)] };
  const guards: Record<string, (n: string) => any> = {
    攻擊免疫: n => { h.S[n] = (c: any, ev: string) => { if (ev === 'ON_ENTRANCE' || ev === 'ROUND_START') c.setPlayerState('blockAttackCount', 9); }; return h.wait(); },
    攻擊技能無效: _n => h.kitSkill('無效', [{ op: 'invalid_turns', p: { kind: '攻擊', turns: 9, next: false } }], { priority: 9 }),
  };
  const cases: [string, any[], any, boolean][] = [
    ['三連', [hits], undefined, false], ['魂印增威', [], powerSoul, false], ['強制', [force], undefined, false],
    ['強制三連', [force, hits], undefined, true], ['強制魂印增威', [force], powerSoul, true],
  ];
  for (const side of ['p1', 'p2'] as const) for (const [gn, guard] of Object.entries(guards)) for (const [cn, kit, soul, dmg] of cases) {
    const n = `D${gn}${cn}${side}`;
    const r = await h.play(side, { self: h.unit(`A${gn}${cn}${side}`, 100000, [atk(cn, kit)], { speed: 10, ...(soul ? { extra: { soulMark: soul } } : {}) }), opp: h.unit(n, 1000000, [guard(n)], { speed: 300 }) }, 1);
    const lost = 1000000 - r[0].opp.currentHp;
    assert.equal(lost > 0, dmg, `${side} ${gn}／${cn}：${dmg ? '強制執行＋變威力應重算出傷害' : '不可穿透'}（${lost}）`);
    checks++;
  }
  // 三、先制封頂單獨生效：自身先制+1、對手先制+3 但被封頂為0 → 自身先出手
  for (const side of ['p1', 'p2'] as const) {
    const me = 'Ceil' + side;
    h.S[me] = (c: any, ev: string) => { if (ev === 'MODIFY_PRIORITY') c.setPlayerState('oppPriorityCeiling', 0); };
    const r = await h.play(side, { self: h.unit(me, 100000, [{ ...h.wait(), priority: 1 }], { speed: 10 }), opp: h.unit('快攻' + side, 100000, [{ ...h.wait(), name: '快', priority: 3 }], { speed: 300 }) }, 1);
    const idx = (n: string) => r[0].logs.findIndex(l => l.includes(`【${n}】使用了`));
    assert.ok(idx(me) >= 0 && idx(me) < idx('快攻' + side), `${side} 對手先制+3被封頂為0：` + r[0].logs.filter(l => l.includes('使用了')).join('｜'));
    checks++;
  }
  console.log(`回合結束下回合計時器／強制執行變威力：${checks} 項通過`);
} finally { await h.close(); }
