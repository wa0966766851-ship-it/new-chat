import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  for (const side of ['p1', 'p2'] as const) {
    const { createBattleEngine } = await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
    const defender = h.unit('active', 10000, [h.wait()], { maxHp: 20000, speed: 200 });
    defender.battleId = 'battle-active';
    const wuji = h.unit('arena_14', 10000, [h.wait()]); wuji.name = '無極聖武'; wuji.battleId = 'battle-wuji';
    const opp = h.unit('enemy', 20000, [h.kitSkill('真傷', [{ op: 'dmg', p: { flat: 1000, type: '真實' } }])]);
    opp.battleId = 'battle-enemy';
    const p1 = side === 'p1' ? [defender, wuji] : [opp], p2 = side === 'p2' ? [defender, wuji] : [opp];
    const engine = createBattleEngine({ initialP1Team: p1, initialP2Team: p2, p1StarterId: p1[0].id, p2StarterId: p2[0].id,
      battleMode: 'PVP', preparedTeams: true, isFast: () => true });
    engine.mount(); engine.start();
    try {
      await engine.idle(); let st = engine.getState();
      assert.ok(h.statuses(st.p1).includes('砥礪')); assert.ok(h.statuses(st.p2).includes('砥礪'));
      const { StatusBadgePanel } = await h.server.ssrLoadModule('/src/components/StatusBadgePanel.tsx');
      assert.ok(renderToStaticMarkup(React.createElement(StatusBadgePanel, { elf: st[side] })).includes('砥礪'), `${side}: 正式狀態元件顯示砥礪`);
      checks += 2;
      assert.equal(st[side].currentHp, 10000);
      engine.onSkillSelect('p1', st.p1.skills[0]); engine.onSkillSelect('p2', st.p2.skills[0]); await engine.idle();
      st = engine.getState();
      assert.equal(st[side].currentHp, 9800, `${side}: 真傷1000後砥礪增加800體力`); checks++;
      const marks = st[`${side}Marks`];
      assert.ok(marks.some((m: any) => m.name === '亮節' && m.ownerBattleId === 'battle-active'), `${side}: 成功判定亮節綁持有者`); checks++;
      assert.ok(st[`${side === 'p1' ? 'p2' : 'p1'}Marks`].some((m: any) => m.name === '威怯'), `${side}: 未受真傷者轉威怯`); checks++;
    } finally { engine.unmount(); }
    for (const target of ['self', 'opp']) {
      const tryStatus = h.kitSkill('嘗試附加異常', [{ op: 'status', p: { side: target, status: '砥礪', turns: 1, chance: 100 } }]);
      const results = await h.play(side, {
        self: h.unit('active', 10000, [tryStatus], { maxHp: 20000, speed: 200 }),
        selfBench: [structuredClone(wuji)], opp: structuredClone(opp),
      });
      assert.equal(results[0].self.currentHp, 9000, `${side}/${target}: 當回合自己執行附加後砥礪不調整體力`);
      assert.ok(results[0].state[`${side}Marks`].some((m: any) => m.name === '威怯'));
      checks++;
    }
  }
} finally { await h.close(); }
console.log(`${checks} Wuji Dili headless integration checks passed`);
