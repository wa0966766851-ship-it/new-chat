// 條件 has_mark 的星光印記（星火之灼／星芳之纏／星海之浸）：這些印記以戰鬥狀態鍵（剩餘回合）記錄、沒有 Mark 實體，
// 修正前 has_mark 只看 Mark，「對手處於星火之灼時…攻擊傷害提升75%」永遠不成立。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const BIG = 1e6;
try {
  const bumie = h.find('5006', '星光·不滅之火');
  const boosts = (r: any) => r.logs.filter((l: string) => /本次攻擊傷害（技能公式） ×/.test(l)).map((l: string) => l.match(/×([\d.]+)/)![1]);
  for (const side of ['p1', 'p2'] as const) {
    const play = (name: string, hp: number, turns: number, pick?: (t: number) => [number, number]) => h.play(side, {
      self: h.unit(name, hp, [{ ...bumie }, h.wait()], { maxHp: BIG, speed: 200 }), opp: h.unit('E', BIG, [h.wait()], { maxHp: BIG, speed: 100 }), turns: (_e: any, t: number) => pick ? pick(t) : [0, 0],
    } as any, turns);
    await check(`${side} 對手處於星火之灼（魂印「灼」登場附加的狀態鍵）→ 不滅之火攻擊傷害 ×1.75；自身體力低於對手 ×2.5；沒有星火之灼則不加成`, async () => {
      const [equal] = await play('星光·魔焰猩猩', BIG, 1), [low] = await play('星光·魔焰猩猩', 800000, 1), [none] = await play('S', BIG, 1);
      assert.deepEqual(boosts(equal), ['1.75']); assert.deepEqual(boosts(low), ['2.5']); assert.deepEqual(boosts(none), []);
    });
    await check(`${side} 星火之灼剩餘回合歸零後不再視為處於該印記（登場 3 回合：第2回合使用仍有加成，第4回合使用已無）`, async () => {
      const early = await play('星光·魔焰猩猩', BIG, 2, t => [t === 2 ? 0 : 1, 0]);
      assert.deepEqual(boosts(early[1]), ['1.75']);
      const late = await play('星光·魔焰猩猩', BIG, 4, t => [t === 4 ? 0 : 1, 0]);
      assert.deepEqual(boosts(late[3]), [], '星火之灼已到期');
    });
  }
  console.log(`${count} checks`);
} finally { await h.close(); }
