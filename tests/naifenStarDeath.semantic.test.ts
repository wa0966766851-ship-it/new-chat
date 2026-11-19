/** 星形鈴鐺草正死亡線：判死後體力定案為0；換下場不因死亡線解除而復活、不卡在換人；無後援則判負（P1／P2）。 */
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let checks = 0;
try {
  const { NAIFEN_FORM_IDS: ids } = await h.server.ssrLoadModule('/src/data/naifenItems.ts');
  const { checkElfDead } = await h.server.ssrLoadModule('/src/battle/elfAlive.ts');
  const { legalActions } = await h.server.ssrLoadModule('/src/battle/ai/legalActions.ts');
  const { authoredEntry: e, actions: act, operation: a } = await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
  const star = { name: '星形持有', effectMode: 'kit', kit: [e('取得星形', 'battle_start', [act(a('grant_item', { side: 'self', itemId: ids[6], count: 1 }))], 0, 'soulmark')] };
  const cut = h.kitSkill('降到兩成', [a('dmg', { type: '真實', flat: 8000 })]);
  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    // 一、有後援：判死→體力0→強制換人；陣亡者離場後仍陣亡、不可再選
    {
      const r = await h.play(side, { self: h.unit('持有者', 10000, [h.wait()], { extra: { soulMark: star } }), selfBench: [h.unit('後援', 10000, [h.wait()])], opp: h.unit('E', 100000, [cut], { speed: 300 }),
        turns: (_e, t) => (t === 1 ? [0, 0] : [{ switch: 1 }, 0]) }, 2);
      const dead = r[0].self;
      assert.ok(checkElfDead(dead) && dead.currentHp === 0, `${side} 判死後體力定案為0：${dead.currentHp}`);
      assert.ok(String(r[0].state.phase).startsWith('forced_switch'), `${side} 進入強制換人：${r[0].state.phase}`);
      const st = r[1].state, team = st[`${side}Team`];
      assert.equal(st[side].name, '後援', `${side} 換上後援`);
      const fallen = team.find((x: any) => x.name === '持有者');
      assert.ok(checkElfDead(fallen) && fallen.currentHp === 0, `${side} 離場解除死亡線後仍陣亡：${fallen.currentHp}`);
      assert.ok(!legalActions(st, side).some((x: any) => x.kind === 'switch' && team[x.index]?.name === '持有者'), `${side} 陣亡者不可再被選上場`);
      checks++;
    }
    // 二、無後援：直接判負，不停在選擇出戰精靈
    {
      const r = await h.play(side, { self: h.unit('孤身', 10000, [h.wait()], { extra: { soulMark: star } }), opp: h.unit('E', 100000, [cut], { speed: 300 }) }, 1);
      assert.equal(r[0].state.winner, other, `${side} 無後援判負：phase=${r[0].state.phase} winner=${r[0].state.winner}`);
      checks++;
    }
  }
  console.log(`星形死亡線定案：${checks} 項通過（P1/P2）`);
} finally { await h.close(); }
