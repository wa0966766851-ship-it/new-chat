// 舊存檔奧丁／卡修斯：存檔升級（六條儲存路徑）、持有者不在場不得附加符文、第五技能重置、第 1 回合換上場。
// P1／P2 都以正式 headless 引擎驗證；舊存檔資料來自 Git 歷史逐版 DEFAULT_ELVES（tests/fixtures/legacyBuiltinSouls.json）。
import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import fixtures from './fixtures/legacyBuiltinSouls.json' with {type: 'json'};
const h = await createHarness();
try {
  const {DEFAULT_ELVES: D} = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {applySavedSkillCorrections: correct} = await h.server.ssrLoadModule('/src/data/savedSkillCorrections.ts');
  const {repairSavedBuiltinStorage: repair, BUILTIN_SAVE_KEYS: keys} = await h.server.ssrLoadModule('/src/data/savedBuiltinStorage.ts');
  const {normalizeElfStats} = await h.server.ssrLoadModule('/src/utils/elfStats.ts');
  const {prepareSavedBattleRoster: prepare} = await h.server.ssrLoadModule('/src/data/prepareSavedBattleRoster.ts');
  const odinCurrent = D.find((e: any) => e.id === '5019'), cassiusCurrent = D.find((e: any) => e.id === '5041');
  const fx = fixtures as any;
  const stable = (v: any) => JSON.stringify(v);
  const runes = (e: any) => e.skills.map((s: any) => (s.skillRune || '') + (s.isRuneActive ? '*' : '')).join(',').replace(/,+$/, '');
  const dummy = (n: string) => h.unit(n, 900000000, [h.wait(), h.wait(), h.wait(), h.wait(), h.wait(), h.wait()], {speed: 50});
  /** 玩家存檔：舊版魂印定義＋玩家自己的配裝／數值／實例身分。 */
  const savedElf = (current: any, variant: string) => {
    const e = structuredClone(current); delete e.builtinEffectBindings; delete e.kit;
    e.soulMark = structuredClone(fx[variant].soulMark);
    e.evs = {hp: 100, atk: 200, def: 10, spatk: 0, spdef: 0, speed: 0};
    e.battleId = 'saved-' + variant; e.skills[0].pp = 30; e.skills[0].maxPp = 30; e.skills[0].currentPp = 25;
    return e;
  };
  const slot = (key: string, v: any) => key === 'seer_custom_elves' ? [v] : key === 'seer_default_elves_overrides' ? {[v.id]: v}
    : key.includes('presets') ? {1: {name: '我的背包', team: [v], starterId: v.battleId}} : {team: [v], starterId: v.battleId};
  const pick = (key: string, value: any, id: string) => key === 'seer_custom_elves' ? value[0] : key === 'seer_default_elves_overrides' ? value[id]
    : key.includes('presets') ? value[1].team[0] : value.team[0];

  // ── D：六條儲存路徑都升級舊魂印，保留玩家的數值／配裝／實例身分；自訂改動不碰 ──
  for (const [variant, current] of [['odinKitless', odinCurrent], ['odinKit1023', odinCurrent], ['odinKit1030', odinCurrent], ['cassiusPre', cassiusCurrent]] as const) {
    const old = savedElf(current, variant);
    const values = new Map<string, string>();
    const storage = {getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }};
    for (const key of keys) storage.setItem(key, JSON.stringify(slot(key, old)));
    const report = repair(storage, D);
    assert.equal(report.length, 6, `${variant}：六條儲存路徑都要被修復`);
    for (const key of keys) {
      const e = pick(key, JSON.parse(storage.getItem(key)!), String(current.id));
      assert.equal(e.soulMark.description, current.soulMark.description, `${variant}/${key} 魂印原文`);
      assert.equal(stable(e.soulMark.kit), stable(current.soulMark.kit), `${variant}/${key} 魂印積木`);
      assert.equal(stable(e.evs), stable(old.evs), '保留玩家努力值');
      assert.equal(e.battleId, old.battleId);assert.equal(e.skills[0].pp, 30, '保留玩家 PP 配裝');
    }
    assert.deepEqual(repair(storage, D), [], `${variant}：再次啟動不重複修改`);
    const custom = savedElf(current, variant); custom.soulMark.description += '（玩家自訂）';
    assert.equal(correct(custom, D).soulMark.description, custom.soulMark.description, '玩家改過的魂印不得被覆蓋');
    assert.equal(correct(custom, D).soulMark.kit?.length ?? 0, custom.soulMark.kit?.length ?? 0);
  }

  // 戰鬥用倉庫與 GameDataContext 相同：內建精靈的覆寫／存檔都先過 applySavedSkillCorrections。
  const warehouseWith = (saved: any) => D.map((e: any) => String(e.id) === String(saved.id) ? correct({...e, ...saved}, D) : e);
  const stale = savedElf(odinCurrent, 'odinKitless');
  const roster = (saved: any, upgraded: boolean) => prepare([saved], upgraded ? warehouseWith(saved) : [saved], true, 'p1');

  for (const side of ['p1', 'p2'] as const) {
    const play = (self: any, bench: any[], turns: number, pickTurn?: (e: any, t: number) => any) =>
      h.play(side, {self, opp: dummy('對手'), selfBench: bench, turns: pickTurn ?? (() => [0, 0])}, turns);
    const asOdin = (saved: any, upgraded = true) => {
      // upgraded=false：不經任何存檔升級，直接把「舊魂印、走舊 handler」的奧丁送進戰鬥（舊 handler 防線）。
      const o = upgraded ? roster(saved, true)[0] : normalizeElfStats({...structuredClone(saved), isExtra: false});
      o.currentHp = o.maxHp; o.battleId = 'odin'; return o;
    };
    for (const upgraded of [true, false]) {
      // E1：奧丁一直在後備、從未出戰 → 任何精靈（含雙方首發）都沒有符文、也沒有ᛏ。
      const o = asOdin(stale, upgraded);
      if (!upgraded) assert.ok(!o.soulMark.kit?.length, '未升級的舊魂印沒有積木（走舊 handler）');
      const never = await play(dummy('我方首發'), [dummy('我方二'), o], 4);
      for (const step of never) {
        assert.equal(runes(step.self), '', `${side} 升級=${upgraded}：奧丁未出戰，我方不得有符文`);
        assert.equal(runes(step.opp), '', `${side} 升級=${upgraded}：奧丁未出戰，對手不得有符文`);
        for (const e of [...step.state.p1Team, ...step.state.p2Team]) if (e.battleId !== 'odin') assert.ok(!e.portableBattleMarks?.tiwaz_rune, 'ᛏ 只在奧丁登場時附加');
      }
    }
    // E2：奧丁在場 → 自己 1~5 位依序有ᚨᛉᚱᚷᛇᛖ，對手有ᛈᛁᚦᚺᚾᛃ；選擇技能時激活該槽。
    const o2 = asOdin(stale);
    const field = await play(o2, [dummy('後備')], 2, (_e, t) => [t === 1 ? 2 : 0, 0]);
    assert.equal(runes(field[0].self).replace(/\*/g, ''), 'ᚨ,ᛉ,ᚱᚷ,ᛇ,ᛖ');
    assert.equal(runes(field[0].opp).replace(/\*/g, ''), 'ᛈ,ᛁ,ᚦᚺ,ᚾ,ᛃ');
    assert.equal(field[0].self.skills[2].isRuneActive, true, '選擇第3招時 ᚱᚷ 激活');
    assert.ok(!field[0].self.skills[1].isRuneActive, '未選的槽不激活');
    assert.ok(field[0].self.skills.every((s: any) => s.portableSkillMark), '符文帶可攜定義');
    // E3：奧丁在後備（現行 Kit）→ 在場者不拿符文；等他出戰後才開始。
    const o3 = asOdin(stale);
    const late = await play(dummy('首發'), [o3], 4, (_e, t) => [t === 3 ? {switch: 1} : 0, 0]);
    assert.equal(runes(late[0].self), '');assert.equal(runes(late[1].self), '');
    assert.equal(runes(late[2].self).replace(/\*/g, ''), 'ᚨ,ᛉ,ᚱᚷ,ᛇ,ᛖ', '出戰後同回合開始附加');
    assert.equal(late[2].state[side + 'Team'][0].portableBattleMarks?.tiwaz_rune, undefined);

    // C2：第 1 回合操作階段換上場、第 3 回合換上場，符文都在「換上後的回合開始」附加（不是晚一回合）。
    for (const switchAt of [1, 3]) {
      const snaps: string[] = [];
      const o4 = asOdin(stale);
      await play(dummy('首發'), [o4], switchAt + 2, (e: any, t: number) => {
        snaps.push(`${t}:${e.getState()[side].name}:${runes(e.getState()[side])}`);
        return [t === switchAt ? {switch: 1} : 0, 0];
      });
      const before = snaps[switchAt - 1], after = snaps[switchAt];
      assert.ok(before.endsWith(':'), `${side} 換上前沒有符文：${before}`);
      assert.ok(after.includes('奧丁') && after.includes('ᚨ,ᛉ,ᚱᚷ,ᛇ,ᛖ'), `${side} 第${switchAt}回合換上，下回合開始前已有符文：${after}`);
    }

    // C1：第五技能（重置在場回合數）後，符文在下一個回合開始重新附加；之後超過2回合不再補。
    const o5 = asOdin(stale);
    const fifth = await play(o5, [dummy('後備')], 7, (e, t) => { const st = e.getState(); for (const who of ['p1', 'p2']) st[who].currentHp = st[who].maxHp; return [t === 4 ? 4 : 0, t >= 5 ? 5 : 0]; });
    // 第5招（索引4）使用後雙方符文被剝離（對手失去有符文槽的全部PP，所以之後改選第6個無符文技能）；重置在場回合數後重新附加
    assert.equal(runes(fifth[2].self).replace(/\*/g, ''), 'ᚨ,ᛉ,ᚱᚷ,ᛇ,ᛖ', '第3回合仍有符文');
    const afterFifth = fifth[3];
    assert.ok(afterFifth.logs.some((l: string) => l.includes('ᚱᚨᚷᚾᚨᚱᛟᚲ')), '第4回合使用第五技能');
    assert.equal(afterFifth.self.skills.filter((s: any) => s.portableSkillMark).length, 0, '第五技能當回合剝離全部符文');
    assert.equal(runes(fifth[4].self).replace(/\*/g, ''), 'ᚨ,ᛉ,ᚱᚷ,ᛇ,ᛖ', '重置在場回合數後，下回合開始重新附加');
    assert.equal(runes(fifth[4].opp).replace(/\*/g, ''), 'ᛈ,ᛁ,ᚦᚺ,ᚾ,ᛃ');
  }

  // ── 舊存檔卡修斯：載入後是現行魂印原文與積木（5041 今天的魂印原文變更）──
  const oldCassius = savedElf(cassiusCurrent, 'cassiusPre');
  assert.notEqual(oldCassius.soulMark.description, cassiusCurrent.soulMark.description, '夾具確實是舊版原文');
  const [loaded] = prepare([oldCassius], warehouseWith(oldCassius), true, 'p1');
  assert.equal(loaded.soulMark.description, cassiusCurrent.soulMark.description);
  assert.equal(stable(loaded.soulMark.kit), stable(cassiusCurrent.soulMark.kit));
  assert.equal(stable(loaded.evs), stable(oldCassius.evs), '玩家努力值保留');
  console.log('舊存檔奧丁／卡修斯：六條儲存路徑升級、自訂保護、未出戰無符文、在場附加與激活、第五技能重置重附、第1回合換上場 P1/P2 通過');
} finally { await h.close(); }
