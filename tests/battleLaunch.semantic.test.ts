import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

/**
 * 戰鬥啟動測試
 *
 * 2026-10-21：點「對戰」只 setView("battle")，但沒有隊伍時
 * LegacyScenes 的 battle 分支不渲染，畫面落回上一頁 → 使用者看到「沒反應」。
 *
 * 這裡鎖住 launchBattle 的三種來源與三種失敗原因。
 */

const dom = new JSDOM('', { url: 'http://localhost:3000/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const { resolveTeams, launchBattle, launchFailureMessage } = await import('../src/shell/battleLaunch');

const mkElf = (n: number): any => ({
  id: `e${n}`, battleId: `e${n}_inst`, name: `精靈${n}`, type: '暗影', level: 100,
  maxHp: 1000, currentHp: 1000,
  calculatedStats: { hp: 1000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
  skills: [],
});
const pool = Array.from({ length: 30 }, (_, i) => mkElf(i + 1));

function makeBridge(overrides: Record<string, any> = {}): any {
  const calls: any[] = [];
  const noop = () => {};
  return {
    view: 'start', setView: noop,
    allElves: pool, allElvesCombined: pool, updateElf: noop,
    handleStartBattle: (...args: any[]) => { calls.push(args); },
    battleMode: 'PVE', setBattleMode: noop,
    battleFormat: 'normal_6v6', setBattleFormat: (f: string) => { (makeBridge as any).__fmt = f; },
    battleKey: 0, restartedRef: { current: false }, handleRestartBattle: noop,
    isTransitioning: false,
    p1Team: [], p2Team: [], p1StarterId: '', p2StarterId: '',
    p1Suit: '', p1Eyewear: '', p2Suit: '', p2Eyewear: '', p1Title: '', p2Title: '',
    hostPlayer: 'p1', setHostPlayer: noop,
    specialMode: undefined, interstellarOptions: null, setInterstellarOptions: noop,
    editingElf: null, setEditingElf: noop, editorTab: undefined, setEditorTab: noop,
    showEncyclopedia: false, setShowEncyclopedia: noop,
    showPerformanceProbe: false, setShowPerformanceProbe: noop,
    ...overrides,
    __calls: calls,
  } as any;
}

const ls = dom.window.localStorage;
const writeRecord = (side: 'p1' | 'p2', n: number) => {
  ls.setItem(`seer_last_used_${side}_team`, JSON.stringify({
    team: Array.from({ length: n }, (_, i) => mkElf(i + 1 + (side === 'p2' ? 100 : 0))),
    starterId: `e${side === 'p2' ? 101 : 1}_inst`,
    timestamp: '12:00',
  }));
};

// ── 沒有存檔、不允許快速配對 → not-ready ──
{
  ls.clear();
  const b = makeBridge();
  const r = resolveTeams(b, { allowQuickMatch: false });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not-ready');
  assert.ok(launchFailureMessage(r.reason).includes('尚未保存陣容'));
}

// ── 沒有存檔、允許快速配對 → 從精靈池對切 ──
{
  ls.clear();
  const b = makeBridge();
  const r = resolveTeams(b, { allowQuickMatch: true });
  assert.equal(r.ok, true);
  assert.equal(r.team1!.length, 6, '一般 6v6 要 6 隻');
  assert.equal(r.team2!.length, 6);
  assert.notEqual(r.team1![0].id, r.team2![0].id, '雙方不能是同一批');
}

// ── 有存檔 → 用存檔的隊伍 ──
{
  ls.clear();
  writeRecord('p1', 12);
  writeRecord('p2', 12);
  const b = makeBridge();
  const r = resolveTeams(b, {});
  assert.equal(r.ok, true);
  assert.equal(r.team1!.length, 6, '一般 6v6 從 12 隻裡取前 6');
  assert.equal(r.team1![0].name, '精靈1');
  assert.equal(r.team2![0].name, '精靈101', 'P2 用自己的存檔');
}

// ── 巔峰 6v6 → 取 12 隻 ──
{
  ls.clear();
  writeRecord('p1', 12);
  writeRecord('p2', 12);
  const b = makeBridge();
  const r = resolveTeams(b, { format: 'peak_6v6' });
  assert.equal(r.ok, true);
  assert.equal(r.team1!.length, 12, '巔峰 6v6 要 12 隻（6 出戰 + 6 待命）');
}

// ── 單挑 → 取 1 隻 ──
{
  ls.clear();
  writeRecord('p1', 12);
  writeRecord('p2', 12);
  const b = makeBridge();
  const r = resolveTeams(b, { format: 'solo_1v1' });
  assert.equal(r.ok, true);
  assert.equal(r.team1!.length, 1, '單挑只要 1 隻');
}

// ── 精靈池太空 → no-elves ──
{
  ls.clear();
  const b = makeBridge({ allElvesCombined: [mkElf(1)] });
  const r = resolveTeams(b, { allowQuickMatch: true });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-elves');
  assert.ok(launchFailureMessage(r.reason).includes('精靈池'));
}

// ── launchBattle 真的呼叫 handleStartBattle ──
{
  ls.clear();
  writeRecord('p1', 12);
  writeRecord('p2', 12);
  const b = makeBridge();
  const r = launchBattle(b, {});
  assert.equal(r.ok, true);
  assert.equal(b.__calls.length, 1, '必須呼叫一次 handleStartBattle');
  const [mode, t1, t2, s1, s2, , , , , , , fmt] = b.__calls[0];
  assert.equal(mode, 'PVE');
  assert.equal(t1.length, 6);
  assert.equal(t2.length, 6);
  assert.ok(s1, '首發 id 不能是空的');
  assert.ok(s2, '首發 id 不能是空的');
  assert.equal(fmt, 'normal_6v6');
}

// ── launchBattle 失敗時不得呼叫 handleStartBattle ──
{
  ls.clear();
  const b = makeBridge();
  const r = launchBattle(b, { allowQuickMatch: false });
  assert.equal(r.ok, false);
  assert.equal(b.__calls.length, 0, '失敗時不能啟動戰鬥');
}

// 舊快照必須採用目前倉庫的完整配置，不能把只讀顯示正確當成啟動正確。
{
  ls.clear();
  writeRecord('p1', 12); writeRecord('p2', 12);
  const original = ls.getItem('seer_last_used_p1_team');
  const latest = { ...mkElf(1),
    baseStats: { hp: 150, atk: 125, def: 110, spatk: 80, spdef: 110, speed: 125 },
    inscriptions: [],
    soulMark: { name: '最新版', effectMode: 'kit', kit: [{ type: 'test-marker' }] },
  };
  for (const side of ['p1', 'p2']) for (const slot of ['suit', 'eyewear', 'title']) {
    ls.setItem(`seer_${side}_${slot}`, `${side}_${slot}`);
  }
  const b = makeBridge({ allElvesCombined: [latest, ...pool.slice(1)] });
  const result = launchBattle(b);
  assert.equal(result.ok, true);
  const args = b.__calls[0];
  assert.deepEqual(args.slice(5, 11), ['p1_suit', 'p1_eyewear', 'p2_suit', 'p2_eyewear', 'p1_title', 'p2_title']);
  assert.equal(args[1].length, 6, '候補六隻不能參戰或被計入隊友計數');
  assert.equal(args[1][0].soulMark.name, '最新版');
  assert.equal(args[1][0].battleId, 'e1_inst', '保留保存陣容的實例身分');
  assert.equal(args[1][0].hasAnnualBonus, true);
  assert.equal(args[1][0].maxHp, args[1][0].calculatedStats.hp);
  assert.notEqual(args[1][0].maxHp, 1000, '正式配置重算，不能沿用快照面板');
  assert.equal(ls.getItem('seer_last_used_p1_team'), original, '開戰不覆寫原保存紀錄');
  assert.notEqual(args[1][0], latest, '戰局不可修改倉庫的物件');
  args[1][0].soulMark.name = '戰局測試';
  assert.equal(latest.soulMark.name, '最新版', '巢狀積木/魂印也必須隔離');
}

// 單挑使用真正首發；一般戰首發在候補時改用出戰區第一隻。
{
  ls.clear(); writeRecord('p1', 12); writeRecord('p2', 12);
  const record = JSON.parse(ls.getItem('seer_last_used_p1_team')!);
  record.starterId = 'e4_inst';
  ls.setItem('seer_last_used_p1_team', JSON.stringify(record));
  const b = makeBridge();
  assert.equal(launchBattle(b, { format: 'solo_1v1' }).ok, true);
  assert.equal(b.__calls[0][1].length, 1);
  assert.equal(b.__calls[0][1][0].battleId, 'e4_inst');
  record.starterId = 'e10_inst';
  ls.setItem('seer_last_used_p1_team', JSON.stringify(record));
  const normal = makeBridge(); launchBattle(normal);
  assert.equal(normal.__calls[0][3], 'e1_inst');
}

// 巔峰的候選池必須先選禁，不能直接發起12v12或錯誤的6v6。
for (const format of ['peak_6v6', 'peak_3v3'] as const) {
  const b = makeBridge();
  assert.equal(launchBattle(b, { format }).reason, 'requires-bp');
  assert.equal(b.__calls.length, 0);
}

// 雙方年費偏好獨立；關閉仍須保留到快速開戰。
{
  ls.setItem('seer_p1_annual_bonus', '0');
  ls.setItem('seer_p2_annual_bonus', '1');
  const b = makeBridge(); launchBattle(b);
  assert.equal(b.__calls[0][1][0].hasAnnualBonus, false);
  assert.equal(b.__calls[0][2][0].hasAnnualBonus, true);
}

console.log('戰鬥啟動：最新倉庫配置、六件配裝、年費、首發、BP隔離及存檔保護 通過');
