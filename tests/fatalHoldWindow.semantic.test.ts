/**
 * 致死保留窗口（2026-11-21 使用者統一規則；battle/fatalHold.ts），P1／P2：
 * 一、「下次致死存活」觸發後，同回合後續致死傷害一律保留體力，不會被靠後的傷害打死；次數只消耗一次。
 * 二、窗口只到當回合結束：下一回合沒有次數就照常死亡。
 * 三、重生（體力回到上限）不開窗口。
 * 四、場下（背包）精靈受到致死傷害同樣適用。
 * 五、柯爾德：受到致死真實傷害 → 當回合每次致死皆保留1點；柯爾霍德：受到致死真實傷害本身即觸發。
 */
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
import { checkElfDead } from '../src/battle/elfAlive';

const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { authoredEntry: e, actions: act, operation: a } = await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
  const surviveOnce = { name: '下次致死存活', effectMode: 'kit', kit: [e('登場時獲得1次致死存活', 'entrance', [act(a('survive_uses', { uses: 1 }))], 0, 'soulmark', true)] };
  const triple = h.kitSkill('三連真傷', [{ op: 'dmg', p: { flat: 999999, type: '真實' } }, { op: 'dmg', p: { flat: 999999, type: '真實' } }, { op: 'dmg', p: { flat: 999999, type: '真實' } }], { priority: 5 });
  const single = h.kitSkill('真傷', [{ op: 'dmg', p: { flat: 999999, type: '真實' } }], { priority: 5 });
  for (const side of ['p1', 'p2'] as const) {
    // 一＋二
    {
      const r = await h.play(side, { self: h.unit('保留者' + side, 100000, [h.wait()], { extra: { soulMark: surviveOnce } }), opp: h.unit('E1' + side, 100000, [triple, single]),
        turns: (_e, t) => [0, t === 1 ? 0 : 1] }, 2);
      assert.equal(r[0].self.currentHp, 1, `${side} 同回合三次致死真傷後仍保留1點：` + r[0].logs.join('｜'));
      assert.equal(checkElfDead(r[0].self), false, `${side} 第1回合存活`);
      assert.ok(checkElfDead(r[1].self), `${side} 下一回合窗口結束且次數已用完 → 死亡`);
      checks++;
    }
    // 三、重生不開窗口：星佑「體力歸0時100%重生一次」，同回合第二次致死照常死亡
    {
      const name = 'E3' + side; let done = false;
      h.S[name] = (c: any, ev: string) => {
        if (ev !== 'ON_ENTRANCE' || done) return; done = true;
        const tgt = c.actor === 'p1' ? 'p2' : 'p1', el = tgt === 'p1' ? c.activeP1 : c.activeP2;
        c.updateElf(tgt, { battleId: el.battleId, battleStatuses: { 星佑: 9 }, effects: [...(el.effects || []), { id: '星佑', name: '星佑', duration: 9, stacks: 1 }] });
      };
      const r = await h.play(side, { self: h.unit('重生者' + side, 100000, [h.wait()]), opp: h.unit(name, 100000, [h.kitSkill('真傷', [{ op: 'dmg', p: { flat: 999999, type: '真實' } }], { priority: 5 })]) }, 1);
      assert.ok(r[0].logs.some((l: string) => l.includes('重生')), `${side} 第一次致死觸發重生：` + r[0].logs.filter((l: string) => /重生|星佑/.test(l)).join('｜'));
      assert.ok(!(r[0].self.fatalHold && r[0].self.fatalHold.round === r[0].state.turnNumber - 1), `${side} 重生（體力回到上限）不開致死保留窗口：` + JSON.stringify(r[0].self.fatalHold));
      checks++;
    }
    // 四、場下精靈
    {
      const benchSoul = { name: '開戰致死存活', effectMode: 'kit', kit: [e('本場首次致死時強制存活', 'fatal', [act(a('once', { key: 'benchFirstFatal', body: [act(a('survive', {}))] }))], 0, 'soulmark', true)] };
      const bench = h.unit('場下保留' + side, 100000, [h.wait()], { extra: { soulMark: benchSoul } });
      const hitBench = h.kitSkill('打背包', [{ op: 'select_elf', p: { side: 'opp', scope: 'bench', state: 'alive', orderBy: 'team_order', direction: 'asc', all: true, body: [{ acts: [{ op: 'damage_selected', p: { flat: 999999, type: 'true' }, label: 'x' }, { op: 'damage_selected', p: { flat: 999999, type: 'true' }, label: 'x' }] }] } }], { priority: 5 });
      const r = await h.play(side, { self: h.unit('在場' + side, 100000, [h.wait()]), selfBench: [bench], opp: h.unit('E4' + side, 100000, [hitBench]) }, 1);
      const b = r[0].state[`${side}Team`].find((x: any) => x.name === '場下保留' + side);
      assert.equal(b.currentHp, 1, `${side} 場下精靈兩次致死同回合皆保留1點（${b.currentHp}）`);
      checks++;
    }
    // 四-b、場下重生：開戰取得「下次死亡重生」，在背包內受到致死傷害 → 重生回滿體力（不開窗口）
    {
      const rebirthSoul = { name: '開戰重生', effectMode: 'kit', kit: [e('戰鬥開始時獲得下次死亡重生', 'battle_start', [act(a('rebirth_once', {}))], 0, 'soulmark', true)] };
      const bench = h.unit('場下重生' + side, 100000, [h.wait()], { extra: { soulMark: rebirthSoul } });
      const hitBench = h.kitSkill('打背包', [{ op: 'select_elf', p: { side: 'opp', scope: 'bench', state: 'alive', orderBy: 'team_order', direction: 'asc', all: true, body: [{ acts: [{ op: 'damage_selected', p: { flat: 999999, type: 'true' }, label: 'x' }] }] } }], { priority: 5 });
      const r = await h.play(side, { self: h.unit('在場R' + side, 100000, [h.wait()]), selfBench: [bench], opp: h.unit('E4b' + side, 100000, [hitBench]) }, 1);
      const b2 = r[0].state[`${side}Team`].find((x: any) => x.name === '場下重生' + side);
      assert.equal(b2.currentHp, 100000, `${side} 場下精靈的重生在背包內生效（${b2.currentHp}）：` + r[0].logs.join('｜'));
      checks++;
    }
    // 五、柯爾德／柯爾霍德
    for (const id of ['5012', '5013']) {
      const seed = structuredClone(DEFAULT_ELVES.find((x: any) => String(x.id) === id));
      Object.assign(seed, { battleId: 'K' + id + side, maxHp: 100000, currentHp: 100000, skills: [{ ...h.wait(), name: '等待' }] });
      const r = await h.play(side, { self: seed, opp: h.unit('E5' + id + side, 50000000, [triple]) }, 1);
      // 柯爾德受真傷會汲取，體力可能被補回；以「存活＋後兩次走致死保留」驗收。
      const holds = r[0].logs.filter((l: string) => l.includes(`【${seed.name}】致死保留`)).length;
      assert.ok(!checkElfDead(r[0].self) && holds === 2, `${side} ${seed.name} 受到致死真實傷害：當回合三次致死皆存活（後兩次走致死保留 ${holds}）` + r[0].logs.join('｜'));
      checks++;
    }
  }
  console.log(`致死保留窗口：${checks} 項通過（P1/P2）`);
} finally { await h.close(); }
