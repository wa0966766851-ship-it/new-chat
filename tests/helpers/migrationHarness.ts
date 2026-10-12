// 積木遷移測試共用：以 headless 引擎跑 P1／P2 正式戰鬥，取真實 DEFAULT_ELVES 的技能（含已切換的 Kit）。
import assert from 'node:assert/strict';
import { createServer } from 'vite';

export async function createHarness() {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { hasSkillHandler, getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { effectRoute } = await server.ssrLoadModule('/src/effects/effectConnection.ts');
  const quiet = console.error; console.error = (...a: any[]) => { if (String(a[0]).includes('[onNode]')) quiet(...a); };
  const S = getSoulMarkRegistry();
  const wait = () => ({ name: '等待', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' });
  const find = (elfId: string, name: string): any => {
    const elf = DEFAULT_ELVES.find((e: any) => String(e.id) === elfId);
    assert.ok(elf, `找不到精靈 ${elfId}`);
    const skill = [...elf.skills, ...(elf.skillPool || [])].find((s: any) => s.name === name);
    assert.ok(skill, `找不到技能 ${elfId}/${name}`);
    return skill;
  };
  const unit = (id: string, hp: number, skills: any[], o: any = {}): any => ({ id, name: id, battleId: id, type: o.type || '普通', level: 100, currentHp: hp, maxHp: o.maxHp ?? hp,
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 },
    calculatedStats: { hp: o.maxHp ?? hp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: o.speed ?? 100 }, statStages: o.statStages || {}, skills, ...(o.extra || {}) });
  /** 單一路徑斷言：已是 Kit、沒有同名專屬 handler、編譯路由為 kit。 */
  const assertKitOnly = (skill: any) => {
    assert.equal(skill.effectMode, 'kit', `${skill.name} effectMode`);
    assert.ok(skill.kit?.length, `${skill.name} 有 kit`);
    assert.equal(hasSkillHandler(skill.name), false, `${skill.name} 不得再有 handler 分支`);
    assert.equal(effectRoute(skill, false), 'kit');
  };
  /**
   * 跑一個回合。selfSide 的 self 出 selfSkill，對手出 oppSkill。self 速度 200 先手、對手 100。
   * setup 可在開戰前改兩隻精靈；回傳回合後狀態與日誌。
   */
  async function play(selfSide: 'p1' | 'p2', mk: { self: any; opp: any; selfBench?: any[]; oppBench?: any[]; turns?: (engine: any, turn: number) => [number | { switch: number }, number | { switch: number }] | null }, turns = 1) {
    (globalThis as any).__BATTLE_SEED__ = 11;
    const other = selfSide === 'p1' ? 'p2' : 'p1';
    const p1 = selfSide === 'p1' ? mk.self : mk.opp, p2 = selfSide === 'p2' ? mk.self : mk.opp;
    const engine = createBattleEngine({ initialP1Team: [p1, ...((selfSide === 'p1' ? mk.selfBench : mk.oppBench) || [])], initialP2Team: [p2, ...((selfSide === 'p2' ? mk.selfBench : mk.oppBench) || [])], p1StarterId: p1.id, p2StarterId: p2.id, battleMode: 'PVP', preparedTeams: true, isFast: () => true });
    engine.mount(); engine.start();
    const history: any[] = [];
    for (let t = 1; t <= turns; t++) {
      await engine.idle();
      const pick = mk.turns?.(engine, t) ?? [0, 0];
      const st = engine.getState();
      const idx: Record<string, number | { switch: number }> = { [selfSide]: pick![0], [other]: pick![1] };
      for (const side of ['p1', 'p2'] as const) {
        const a = idx[side];
        if (typeof a === 'object') engine.onSwitchElf(side, a.switch); else engine.onSkillSelect(side, st[side].skills[a]);
      }
      await engine.idle();
      const s = engine.getState();
      history.push({ self: s[selfSide], opp: s[other], logs: s.logs.map((l: any) => String(l.text ?? l.message ?? '')), state: s, turn: s.turnNumber });
    }
    engine.unmount();
    return history;
  }
  const { getStatuses } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const statuses = (elf: any): string[] => Object.keys(getStatuses(elf) || {});
  /** 讓持有者擁有一個可被「消除回合類效果」清除的回合類效果（4回合免疫非附屬類異常）。 */
  const turnEffectSkill = () => ({ ...wait(), name: '立盾', effectMode: 'kit', kit: [{ codeId: 'effect_sequence', node: 'on_skill_use', source: 'skill', role: 'attached', order: 0, customText: '測試用回合類效果',
    params: { clause: { raw: '測試用回合類效果', marker: '🎯', trig: 'use', parsed: true, body: [{ acts: [{ op: 'immune_status_turns', p: { turns: 4, cls: '非附屬類', reflect: false }, label: 'x' }] }] } } }] });
  const kitSkill = (name: string, acts: any[], o: any = {}) => ({ ...wait(), ...o, name, effectMode: 'kit', kit: [{ codeId: 'effect_sequence', node: 'on_skill_use', source: 'skill', role: 'attached', order: 0, customText: '測試用',
    params: { clause: { raw: '測試用', marker: '🎯', trig: 'use', parsed: true, body: [{ acts: acts.map(a => ({ label: a.op, ...a })) }] } } }] });
  const healSkill = (amount = 1000) => kitSkill('補', [{ op: 'heal_flat', p: { amount } }]);
  const timers = (state: any, side: string) => (state[`${side}Timers`] || []).map((t: any) => `${t.name}:${t.remaining}`);
  return { server, S, statuses, turnEffectSkill, kitSkill, healSkill, timers, wait, find, unit, assertKitOnly, play, close: async () => { console.error = quiet; await server.close(); } };
}
