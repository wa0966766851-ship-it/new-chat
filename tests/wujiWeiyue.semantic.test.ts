/**
 * 2026-11-22 使用者回報：對手掛著【威怯】，無極聖武的「聖武·虛極拓世」仍沒有讓對手技能無效。
 * 成因：威怯有三份不同的寫法——魂印用層數資源 weiQie（不會倒數），亂武天傀用 arena.weiyue 但單位是「層」；
 * 第五技能讀的是 arena.weiyue 的「剩餘回合」，只認回合型印記 → 永遠讀到 0。
 * 修正：三處共用同一張回合型印記圖紙（wujiMarkPrograms.WEIYUE_PROGRAM）。
 * 另：魂印「無武誅→附加；已有→①~⑤後消除」兩分支改以技能使用前判定，⑤ 只在本次攻擊確實無視攻擊免疫時附加。
 * 2026-11-22 第二輪：①依武誅剩餘回合每回合+20%、④每100護盾／護罩+10%（上限100%）在本次攻擊生效；亮節改為3回合回合型印記。
 */
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const wuji = (bid: string) => {
    const w = structuredClone(DEFAULT_ELVES.find((e: any) => String(e.id) === 'arena_14'));
    Object.assign(w, { battleId: bid, maxHp: 9000, currentHp: 9000, calculatedStats: { hp: 9000, atk: 300, def: 300, spatk: 300, spdef: 300, speed: 300 }, statStages: {} });
    return w;
  };
  const idx = (w: any, name: string) => { const i = w.skills.findIndex((s: any) => s.name === name); assert.ok(i >= 0, name); return i; };
  const marks = (r: any, side: string) => (r.state[side + 'Marks'] || []) as any[];
  const atk = { ...h.wait(), name: '打', category: '物理', power: 80 };
  for (const side of ['p1', 'p2'] as const) {
    const opp = side === 'p1' ? 'p2' : 'p1';
    // 一、亂武天傀（自身體力高於對手）→ 對手 3 回合威怯（回合型）；下回合第五技能依剩餘回合令其技能無效
    for (const withWeiyue of [true, false]) {
      const w = wuji('W' + side);
      const first = withWeiyue ? idx(w, '亂武天傀') : idx(w, '極武稜殺');
      const r = await h.play(side, { self: w, opp: h.unit('靶' + side, 8000, [atk]), turns: (_e, t) => [t === 1 ? first : t === 2 ? idx(w, '聖武·虛極拓世') : idx(w, '極武稜殺'), 0] }, 3);
      const wy = marks(r[0], opp).find(m => m.id === 'arena.weiyue');
      const blocked = r[2].logs.filter((l: string) => l.includes(`【靶${side}】使用的【打】無效`)).length;
      if (withWeiyue) {
        assert.ok(wy && wy.unit === '回合' && wy.remainingRounds === 2, `${side} 威怯為回合型印記：` + JSON.stringify(marks(r[0], opp)));
        assert.ok(!marks(r[0], opp).some(m => m.id === 'weiQie'), `${side} 不再有層數型的第二份威怯`);
        assert.equal(blocked, 2, `${side} 剩 2 回合威怯 → 對手 2 回合技能無效：` + r[2].logs.slice(-12).join('｜'));
      } else {
        assert.equal(blocked, 0, `${side} 對照：沒有威怯時第五技能不令對手技能無效`);
      }
      checks++;
    }
    // 二、魂印：已有武誅的攻擊觸發後消除武誅；⑤ 只在本次攻擊無視攻擊免疫成功時附加威怯
    for (const immune of [false, true]) {
      const w = wuji('V' + side);
      const wuzhu = h.kitSkill('上武誅', [{ op: 'mark_program', p: { id: 'arena.wuzhu', name: '武誅', displayChar: '誅', description: 'x', side: 'opp', scope: 'elf', persistsOffField: true, mode: 'set', unit: '回合', count: 2, maxCount: 99, turns: 2, priorityBonus: -2, vsOpponentName: '無極聖武', rules: [] } }], { priority: 6 });
      w.skills = [...w.skills, wuzhu];
      const guard = immune ? h.kitSkill('免攻', [{ op: 'immune_attack_count', p: { count: 1 } }], { priority: 7 }) : { ...h.wait(), priority: 7 };
      const r = await h.play(side, { self: w, opp: h.unit('盾' + side, 8000, [guard]), turns: (_e, t) => [t === 1 ? w.skills.length - 1 : idx(w, '極武稜殺'), 0] }, 2);
      const ignored = r[1].logs.some((l: string) => l.includes('無視了對手的攻擊免疫'));
      assert.equal(ignored, immune, `${side} 前提：${immune ? '有' : '無'}攻擊免疫可被無視：` + r[1].logs.slice(-10).join('｜'));
      assert.ok(!marks(r[1], opp).some(m => m.id === 'arena.wuzhu'), `${side} 已有武誅的攻擊後消除武誅（不當場重新附加）`);
      assert.equal(marks(r[1], opp).some(m => m.id === 'arena.weiyue'), immune, `${side} ⑤ 威怯僅在無視攻擊免疫成功時附加`);
      checks++;
    }
    // 三、①④：第1回合附加3回合武誅，第2回合攻擊時剩2回合 → +40%；對手 250 點護盾再 +20%（與①各自相乘；護盾被無視，只作計數）
    {
      const dealt = async (turns: number, shield: number) => {
        const w = wuji('D' + side + turns + shield);
        const wz = h.kitSkill('上武誅', turns ? [{ op: 'mark_program', p: { id: 'arena.wuzhu', name: '武誅', displayChar: '誅', description: 'x', side: 'opp', scope: 'elf', persistsOffField: true, mode: 'set', unit: '回合', count: turns, maxCount: 99, turns, rules: [], priorityBonus: -2, vsOpponentName: '無極聖武' } }] : [], { priority: 6 });
        w.skills = [...w.skills, turns ? wz : { ...h.wait(), name: '上武誅', priority: 6 }];
        const r = await h.play(side, { self: w, opp: h.unit('靶' + side, 900000, [h.wait()], { extra: { shield } }), turns: (_e, t) => [t === 1 ? w.skills.length - 1 : idx(w, '極武稜殺'), 0] }, 2);
        return r[0].opp.currentHp - r[1].opp.currentHp;
      };
      const base = await dealt(0, 0), wz = await dealt(3, 0), wzShield = await dealt(3, 250), shieldOnly = await dealt(0, 250);
      assert.ok(base > 0, `${side} 基準傷害`);
      assert.ok(Math.abs(wz / base - 1.4) < .03, `${side} ① 剩2回合武誅 → +40%：${base}→${wz}`);
      // 每個「提升X%」是獨立乘區（damagePipeline 分層 D）：×1.4×1.2
      assert.ok(Math.abs(wzShield / base - 1.4 * 1.2) < .03, `${side} ④ 250護盾 → 再 +20%：${base}→${wzShield}`);
      assert.equal(shieldOnly, base, `${side} 沒有武誅時護盾不增傷`);
      checks++;
    }
    // 四、亮節：3回合回合型印記；每回合結束只為對手 PP 為 0 的技能恢復 5 點
    {
      const { LIANGJIE_PROGRAM } = await h.server.ssrLoadModule('/src/data/wujiMarkPrograms.ts');
      const give = h.kitSkill('賜亮節', [{ op: 'mark_program', p: LIANGJIE_PROGRAM }], { priority: 6, pp: 20, maxPp: 20, currentPp: 20 });
      const empty = { ...h.wait(), name: '空', pp: 0, maxPp: 10, currentPp: 0 };
      const w = wuji('L' + side); w.skills = [h.wait()];
      const r = await h.play(side, { self: w, opp: h.unit('節' + side, 8000, [give, empty, h.wait()]), turns: (_e, t) => [0, t === 1 ? 0 : 2] }, 4);
      const lj = (i: number) => marks(r[i], side).find(m => m.id === 'arena.liangjie');
      assert.ok(lj(0)?.unit === '回合' && lj(0)?.effects?.statusChanceZeroAtMost50, `${side} 亮節為回合型印記：` + JSON.stringify(lj(0)));
      assert.ok(!lj(3), `${side} 亮節 3 回合後消失`);
      const pp = (i: number, n: string) => r[i].opp.skills.find((s: any) => s.name === n).pp;
      assert.equal(pp(0, '空'), 5, `${side} 回合結束為對手 0 PP 技能恢復 5 點`);
      assert.equal(pp(0, '賜亮節'), 19, `${side} 非 0 PP 技能不恢復`);
      checks++;
    }
  }
  console.log(`wujiWeiyue: ${checks} checks passed`);
} finally { await h.close(); }
