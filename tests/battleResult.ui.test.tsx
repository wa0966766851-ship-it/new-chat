// 結算畫面：勝負文字、按鈕行為、圖表資料必須與傷害帳本彙總一致。
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createDamageLedger, recordDamage, recordHeal, summarizeLedger } from '../src/battle/damageLedger';
import { formatBigNumber, formatFullNumber } from '../src/utils/formatBigNumber';
import { outcomeView, kindSlices, heroView, rankMvpSides, labelDisplay, niceScale, trendKind, KIND_COLOR } from '../src/battle/resultView';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window) });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.fetch = (async () => { throw new Error('offline'); }) as any;
const { createRoot } = await import('react-dom/client');
const { BattleResult } = await import('../src/components/battle/BattleResult');

const elf = (id: string, name: string, mark = ''): any => ({ id, battleId: id, name, type: '普通', currentHp: 100, maxHp: 100, ...(mark ? { soulMark: { name: mark, description: '', effectType: 'custom', effectValue: 0 } } : {}) });
const p1Team = [elf('a', '甲', '烈焰印記'), elf('b', '乙')], p2Team = [elf('x', '丙')];
const active = { p1: { battleId: 'a', name: '甲' }, p2: { battleId: 'x', name: '丙' } };
const ledger = createDamageLedger();
const hit = (turn: number, targetSide: 'p1' | 'p2', data: any, hpLost: number, shield = 0) => recordDamage(ledger, {
  turn, targetSide, targetBattleId: targetSide === 'p1' ? 'a' : 'x', targetName: targetSide === 'p1' ? '甲' : '丙', active,
  receipt: { hpLost, shieldAbsorbed: shield, barrierAbsorbed: 0 }, data, damageType: data.damageType || 'skill_attack' });
hit(1, 'p2', { skillName: '烈焰斬', sourceSide: 'p1', sourceBattleId: 'a', sourceElfName: '甲', isCrit: true }, 1200, 300);
hit(1, 'p1', { skillName: '撕咬', sourceSide: 'p2', sourceBattleId: 'x', sourceElfName: '丙' }, 500);
hit(2, 'p2', { label: '星火', sourceSide: 'p1', sourceBattleId: 'a', sourceElfName: '甲', damageType: 'fixed' }, 300);
hit(2, 'p2', { label: '【中毒】', damageType: 'true' }, 90);
hit(3, 'p2', { skillName: '烈焰斬', sourceSide: 'p1', sourceBattleId: 'a', sourceElfName: '甲' }, 2000);
recordHeal(ledger, { turn: 3, side: 'p1', targetBattleId: 'a', targetName: '甲', amount: 150 });
const summary = summarizeLedger(ledger, 3);
const g = (sel: string) => document.querySelector(sel) as HTMLElement;
const gAll = (sel: string) => [...document.querySelectorAll(sel)] as HTMLElement[];

const root = createRoot(document.getElementById('root')!);
const calls: string[] = [];
const render = async (winner: any, battleMode: string, sum = summary) => act(async () => root.render(<BattleResult winner={winner} battleMode={battleMode} summary={sum} p1Team={p1Team} p2Team={p2Team} format="單挑 1V1" onRestart={() => calls.push('restart')} onHome={() => calls.push('home')} />));
try {
  for (const [winner, mode, en, zh, tone] of [['p1', 'PVE', 'VICTORY', '勝利', 'win'], ['p2', 'PVE', 'DEFEAT', '敗北', 'lose'], ['p1', 'PVP', 'VICTORY', 'P1 勝利', 'win'], ['p2', 'PVP', 'VICTORY', 'P2 勝利', 'win'], ['draw', 'PVE', 'DRAW', '平手', 'draw'], ['draw', 'PVP', 'DRAW', '平手', 'draw']] as const) {
    await render(winner, mode);
    assert.equal(g('[data-testid="result-title"] .en').textContent, en, `${mode}/${winner}`);
    assert.equal(g('[data-testid="result-zh"]').textContent, zh);
    assert.equal(g('[data-testid="battle-result"]').dataset.tone, tone);
    assert.deepEqual({ en, zh }, { en: outcomeView(winner, mode).en, zh: outcomeView(winner, mode).zh });
  }
  console.log('✓ 勝／敗／雙人同屏 P1・P2／平手 文字與色調');

  await render('p1', 'PVE');
  assert.equal(g('[data-testid="hero-mvp"]').textContent!.includes('甲'), true, 'MVP＝勝方輸出最高者');
  await render('draw', 'PVE');
  assert.ok(g('[data-testid="hero-mvp"]').textContent!.includes('甲') && g('[data-testid="hero-mvp"]').textContent!.includes('丙'), '平手：雙方各自 MVP');
  console.log('✓ MVP 取輸出最高者');

  await render('p1', 'PVE');
  // 圖表資料與帳本一致
  const num = (id: string) => Number(g(`[data-testid="${id}"] [data-value]`).dataset.value);
  assert.equal(num('tile-turns'), 3);
  assert.deepEqual(gAll('[data-testid="tile-dealt"] [data-value]').map(e => Number(e.dataset.value)), [summary.totalDealt.p1, summary.totalDealt.p2]);
  assert.equal(summary.totalDealt.p1, 1200 + 300 + 2000 + 90, '異常傷害記在施加方（對手）');
  assert.equal(num('tile-maxhit'), 2000);
  assert.ok(g('[data-testid="tile-maxhit"]').textContent!.includes('烈焰斬'));
  assert.deepEqual(gAll('[data-testid="tile-crit"] [data-value]').map(e => Number(e.dataset.value)), [1, 0]);
  assert.equal(num('tile-absorb'), 300);
  assert.deepEqual(gAll('[data-testid="tile-heal"] [data-value]').map(e => Number(e.dataset.value)), [150, 0]);
  for (const side of ['p1', 'p2'] as const) {
    const total = summary.totalDealt[side];
    const segs = gAll(`[data-testid="donut-${side}"] circle[data-kind]`);
    assert.deepEqual(segs.map(s => s.dataset.kind).sort(), kindSlices(summary, side).map(s => s.kind).sort());
    if (total) assert.ok(Math.abs(segs.reduce((a, s) => a + Number(s.dataset.pct), 0) - 100) < 0.05, '占比加總＝100%');
    assert.equal(g(`[data-testid="donut-center-${side}"]`).textContent, formatBigNumber(total));
    const rows = gAll(`[data-testid="rank-${side}"]`);
    assert.equal(rows.filter(r => r.dataset.value).reduce((a, r) => a + Number(r.dataset.value), 0), total, '排行加總＝總輸出');
  }
  assert.deepEqual(gAll('[data-testid="top-skill"]').map(e => Number(e.dataset.total)), summary.byLabel.slice(0, 5).map(l => l.total));
  assert.equal(g('[data-testid="trend-svg"]').dataset.points, '3');
  assert.equal(gAll('[data-testid="rank-p1"][data-mvp="true"]').length, 1, 'MVP 只標一位');
  console.log('✓ 圖表與數字＝帳本彙總（占比加總100%、排行、技能榜、走勢點數、tiles）');

  // 點擊甜甜圈切片：中央顯示該類別數值與百分比
  const skillSeg = g('[data-testid="donut-p1"] circle[data-kind="skill"]');
  await act(async () => { skillSeg.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  assert.equal(g('[data-testid="donut-center-p1"]').textContent, formatBigNumber(summary.byKind.p1.skill));
  assert.ok(g('[data-testid="donut-p1"] .br-donut-c').textContent!.includes('%'));
  // 切換「承受」
  const takenBtn = gAll('[data-testid="rank-card"] button').find(b => b.textContent === '承受')!;
  await act(async () => { takenBtn.click(); });
  assert.equal(gAll('[data-testid="rank-p1"]').reduce((a, r) => a + Number(r.dataset.value), 0), summary.hpLostTotal.p1);
  assert.equal(gAll('[data-testid="rank-p2"]').reduce((a, r) => a + Number(r.dataset.value), 0), summary.hpLostTotal.p2);
  console.log('✓ 甜甜圈互動、輸出／承受切換');

  // 按鈕行為
  const btn = (t: string) => gAll('.br-actions button').find(b => b.textContent === t)!;
  await act(async () => { btn('重來').click(); });
  await act(async () => { btn('回到首頁').click(); });
  assert.deepEqual(calls, ['restart', 'home']);
  await act(async () => { btn('查看戰場').click(); });
  assert.ok(!document.querySelector('[data-testid="battle-result"]') && g('[data-testid="battle-result-mini"]'), '收起面板');
  await act(async () => { gAll('.br-mini button').find(b => b.textContent === '返回結算')!.click(); });
  assert.ok(g('[data-testid="battle-result"]'));
  assert.ok(g('dialog[open][data-testid="battle-result"]'), '原生 dialog（開啟狀態）');
  console.log('✓ 重來／回到首頁／查看戰場');

  // 超大數：1e42 量級仍以單位格式顯示，tooltip 有完整值，無 NaN／科學記號亂碼／溢出用字
  const big = createDamageLedger();
  const bigHit = (turn: number, targetSide: 'p1' | 'p2', data: any, hpLost: number) => recordDamage(big, {
    turn, targetSide, targetBattleId: targetSide === 'p1' ? 'a' : 'x', targetName: targetSide === 'p1' ? '甲' : '丙', active,
    receipt: { hpLost, shieldAbsorbed: 0, barrierAbsorbed: 0 }, data, damageType: 'skill_attack' });
  bigHit(1, 'p2', { skillName: '烈焰斬', sourceSide: 'p1', sourceBattleId: 'a', sourceElfName: '甲' }, 2.4975e41);
  bigHit(2, 'p2', { label: '星火', sourceSide: 'p1', sourceBattleId: 'a', sourceElfName: '甲', damageType: 'fixed' }, 1.0306089843750003e42 - 2.4975e41);
  bigHit(2, 'p1', { skillName: '撕咬', sourceSide: 'p2', sourceBattleId: 'x', sourceElfName: '丙' }, 500);
  recordHeal(big, { turn: 2, side: 'p1', targetBattleId: 'a', targetName: '甲', amount: 2.4975e41 });
  const bigSum = summarizeLedger(big, 2);
  await render('p1', 'PVE', bigSum);
  const rootEl = g('[data-testid="battle-result"]');
  assert.ok(!/NaN|Infinity|e\+/.test(rootEl.textContent!), '無 NaN／Infinity／e+');
  const dealtVals = gAll('[data-testid="tile-dealt"] [data-value]');
  assert.equal(dealtVals[0].textContent, formatBigNumber(bigSum.totalDealt.p1));
  assert.match(dealtVals[0].textContent!, /^\d{1,3}(\.\d+)?正$/);
  assert.equal(dealtVals[1].dataset.value, '500');
  assert.equal(dealtVals[0].title, formatFullNumber(bigSum.totalDealt.p1));
  assert.ok(dealtVals[0].title.replace(/,/g, '').length >= 43, 'tooltip 為完整千分位');
  assert.equal(g('[data-testid="tile-maxhit"] [data-value]').textContent, formatBigNumber(bigSum.maxHit!.hpLost));
  assert.equal(g('[data-testid="tile-heal"] [data-value]').textContent, formatBigNumber(2.4975e41));
  assert.equal(g('[data-testid="donut-center-p1"]').textContent, formatBigNumber(bigSum.totalDealt.p1));
  assert.equal(g('[data-testid="donut-center-p1"]').title, formatFullNumber(bigSum.totalDealt.p1));
  assert.ok(g('[data-testid="hero-mvp"] b').textContent!.endsWith('正'));
  assert.ok(g('[data-testid="hero-mvp"] b').title.length > 30);
  const pcts = gAll('[data-testid="donut-p1"] circle[data-kind]').map(c => Number(c.dataset.pct));
  assert.ok(pcts.every(Number.isFinite) && Math.abs(pcts.reduce((a, b) => a + b, 0) - 100) < 0.05, '大數占比仍正確');
  assert.ok(Math.abs(pcts.find((_, i) => gAll('[data-testid="donut-p1"] circle[data-kind]')[i].dataset.kind === 'skill')! - 2.4975e41 / bigSum.totalDealt.p1 * 100) < 0.01);
  assert.ok(gAll('[data-testid="trend-ytick"]').every(t => t.textContent!.length <= 8 && !/e\+/.test(t.textContent!)), '走勢刻度為單位格式');
  assert.ok(gAll('[data-testid="trend-ytick"]').some(t => t.textContent!.includes('正') || t.textContent!.includes('澗')));
  assert.ok(gAll('[data-testid="rank-p1"]').every(r => !/e\+|NaN/.test(r.textContent!)));
  const allBars = gAll('[data-testid^="trend-bar-"]').filter(b => Number(b.dataset.value) > 0);
  assert.ok(allBars.every(b => !!b.querySelector('text') && !/NaN/.test(b.innerHTML)));
  await render('p2', 'PVE', bigSum);
  assert.ok(!/NaN|Infinity|e\+/.test(g('[data-testid="battle-result"]').textContent!));
  console.log('✓ 超大數（1e42）單位格式、tooltip 完整值、無 NaN');

  // 空帳本不當掉
  await render('p1', 'PVE', summarizeLedger(createDamageLedger(), 0));
  assert.ok(g('[data-testid="battle-result"]').textContent!.includes('無傷害紀錄'));
  console.log('✓ 無傷害紀錄時仍可顯示');

  // ── 審查修正 ──
  // 1) 排行：雙方各自成組並有陣營標記；MVP 規則（勝利＝我方 MVP；敗北＝我方最佳＋對手 MVP 小字；雙人同屏＝勝方 MVP）
  await render('p1', 'PVE');
  for (const side of ['p1', 'p2'] as const) {
    const grp = g(`[data-testid="rank-group-${side}"]`);
    assert.equal(grp.dataset.side, side);
    assert.ok(grp.querySelector('.br-rank-tag')!.textContent!.includes(side.toUpperCase()), '陣營標記');
    assert.ok(gAll(`[data-testid="rank-${side}"]`).length > 0 && gAll(`[data-testid="rank-${side}"]`).every(r => grp.contains(r)), '列屬於自己的陣營組');
  }
  assert.ok(g('[data-testid="rank-group-p1"] .br-rank-tag').textContent!.includes('我方') && g('[data-testid="rank-group-p2"] .br-rank-tag').textContent!.includes('對手'));
  assert.equal(g('[data-testid="hero-mvp"] em').textContent, 'MVP');
  assert.ok(g('[data-testid="hero-mvp"]').textContent!.includes('甲'), '勝利：我方（勝方）輸出最高者');
  assert.ok(!document.querySelector('[data-testid="opp-mvp"]'));
  assert.ok(g('[data-testid="hero-sprite-p1"]') && !document.querySelector('[data-testid="hero-sprite-p2"]'), '勝利主視覺為 P1 立繪');
  await render('p2', 'PVE', summary);
  assert.equal(g('[data-testid="hero-mvp"] em').textContent, '我方最佳');
  assert.ok(g('[data-testid="hero-mvp"]').textContent!.includes('甲') && !g('[data-testid="hero-mvp"]').textContent!.includes('丙'), '敗北：頂部是我方最佳，不是對手');
  assert.ok(g('[data-testid="opp-mvp"]').textContent!.includes('對手 MVP') && g('[data-testid="opp-mvp"]').textContent!.includes('丙'));
  assert.ok(g('[data-testid="hero-sprite-p1"]') && !document.querySelector('[data-testid="hero-sprite-p2"]'), '敗北主視覺也是我方立繪');
  assert.equal(gAll('[data-testid="rank-p1"][data-mvp="true"]').length, 1);
  assert.equal(gAll('[data-testid="rank-p2"][data-mvp="true"]').length, 0, '敗北時排行只標我方最佳');
  await render('p2', 'PVP');
  assert.ok(g('[data-testid="hero-mvp"]').textContent!.includes('丙') && g('[data-testid="hero-sprite-p2"]'), '雙人同屏：勝方 MVP');
  assert.ok(!g('[data-testid="rank-group-p1"] .br-rank-tag').textContent!.includes('我方'), '雙人同屏不用我方／對手');
  // 側別判定：勝負、帳本側別與 MVP 一致（P2 勝時不會把 P1 當 MVP，反之亦然）
  for (const [winner, mode, side] of [['p1', 'PVE', 'p1'], ['p2', 'PVP', 'p2'], ['p1', 'PVP', 'p1']] as const) {
    assert.equal(outcomeView(winner, mode).winnerSide, side);
    assert.deepEqual(heroView(summary, outcomeView(winner, mode), { p1: p1Team }).primary.map(e => e.side), [side].filter(sd => summary.byElf.some(e => e.side === sd && e.dealt > 0)));
  }
  assert.deepEqual(rankMvpSides(outcomeView('p2', 'PVE')), ['p1']);
  // 敗北且我方全無輸出：顯示我方首發
  const noP1 = createDamageLedger();
  recordDamage(noP1, { turn: 1, targetSide: 'p1', targetBattleId: 'a', targetName: '甲', active, receipt: { hpLost: 700, shieldAbsorbed: 0, barrierAbsorbed: 0 }, data: { skillName: '撕咬', sourceSide: 'p2', sourceBattleId: 'x', sourceElfName: '丙' }, damageType: 'skill_attack' });
  const noP1Sum = summarizeLedger(noP1, 1);
  const hvZero = heroView(noP1Sum, outcomeView('p2', 'PVE'), { p1: p1Team });
  assert.deepEqual([hvZero.primary[0].name, hvZero.primary[0].dealt, hvZero.primaryLabel, hvZero.opponentMvp!.name], ['甲', 0, '我方最佳', '丙']);
  await render('p2', 'PVE', noP1Sum);
  assert.ok(g('[data-testid="hero-mvp"]').textContent!.includes('甲') && g('[data-testid="opp-mvp"]').textContent!.includes('丙'));
  console.log('✓ 排行陣營標記、勝利／敗北／雙人同屏 MVP 規則、側別一致');

  // 4) 某方無輸出：輸出來源改為矮提示卡，不被撐高
  const only1 = createDamageLedger();
  recordDamage(only1, { turn: 1, targetSide: 'p2', targetBattleId: 'x', targetName: '丙', active, receipt: { hpLost: 900, shieldAbsorbed: 0, barrierAbsorbed: 0 }, data: { skillName: '烈焰斬', sourceSide: 'p1', sourceBattleId: 'a', sourceElfName: '甲' }, damageType: 'skill_attack' });
  await render('p1', 'PVE', summarizeLedger(only1, 1));
  assert.equal(g('[data-testid="donut-p2"]').dataset.empty, 'true');
  assert.ok(g('[data-testid="donut-none-p2"]').textContent!.includes('本局無輸出'));
  assert.ok(!g('[data-testid="donut-p2"]').querySelector('.br-donut, .br-empty'), '空卡不含甜甜圈與大片空白');
  assert.equal(g('[data-testid="donuts"]').dataset.solo, 'true');
  assert.equal(g('[data-testid="donut-p1"]').dataset.empty, 'false');
  console.log('✓ 無輸出的一方：矮提示卡');

  // 5) 走勢：≤4 回合分組柱狀；>4 折線；刻度依資料取整
  const trendLedger = (turns: number, scale = 1) => { const l = createDamageLedger(); for (let t = 1; t <= turns; t++) { recordDamage(l, { turn: t, targetSide: 'p2', targetBattleId: 'x', targetName: '丙', active, receipt: { hpLost: 700 * scale + t * 10, shieldAbsorbed: 0, barrierAbsorbed: 0 }, data: { skillName: '烈焰斬', sourceSide: 'p1', sourceBattleId: 'a', sourceElfName: '甲' }, damageType: 'skill_attack' }); recordDamage(l, { turn: t, targetSide: 'p1', targetBattleId: 'a', targetName: '甲', active, receipt: { hpLost: 300 * scale, shieldAbsorbed: 0, barrierAbsorbed: 0 }, data: { skillName: '撕咬', sourceSide: 'p2', sourceBattleId: 'x', sourceElfName: '丙' }, damageType: 'skill_attack' }); } return summarizeLedger(l, turns); };
  await render('p1', 'PVE', trendLedger(3));
  assert.equal(g('[data-testid="trend-svg"]').dataset.mode, 'bars');
  assert.equal(gAll('[data-testid="trend-bar-p1"]').length, 3); assert.equal(gAll('[data-testid="trend-bar-p2"]').length, 3);
  assert.deepEqual(gAll('[data-testid="trend-bar-p1"]').map(e => Number(e.dataset.value)), [710, 720, 730]);
  await render('p1', 'PVE', trendLedger(4));
  assert.equal(g('[data-testid="trend-svg"]').dataset.mode, 'bars');
  await render('p1', 'PVE', trendLedger(5));
  assert.equal(g('[data-testid="trend-svg"]').dataset.mode, 'line');
  assert.ok(g('[data-testid="trend-p1"]') && g('[data-testid="trend-p2"]'));
  assert.equal(trendKind(4), 'bars'); assert.equal(trendKind(5), 'line');
  for (const [max, top] of [[0, 4], [1, 2], [956, 1000], [1912, 2000], [1120, 1500], [3, 3], [12345, 15000], [87, 100]] as const) {
    const sc = niceScale(max);
    assert.equal(sc.max, top, `niceScale(${max})`);
    assert.ok(sc.max >= max && sc.ticks[0] === 0 && sc.ticks.at(-1) === sc.max && sc.ticks.length >= 3 && sc.ticks.length <= 7, `刻度數 ${max}`);
    assert.ok(sc.ticks.every(v => Number.isInteger(v * 2)), '刻度取整');
  }
  await render('p1', 'PVE', trendLedger(2, 4));
  const yt = gAll('[data-testid="trend-ytick"]').map(e => e.textContent);
  assert.ok(yt.length >= 3 && yt[0] !== yt[1], '多條刻度而不是一條平線');
  console.log('✓ 回合走勢：≤4 柱狀、>4 折線、自動取整刻度');

  // 6) 類別色盤：每種各異，且不再用藍紫相近的組合
  const colors = Object.values(KIND_COLOR);
  assert.equal(new Set(colors).size, colors.length, '類別色互異');
  assert.ok(!colors.includes('#60a5fa') && !colors.includes('#c084fc'), '舊的藍／紫已換掉');
  const hue = (hex: string) => { const [r, g2, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g2, b), mn = Math.min(r, g2, b), d = mx - mn; if (!d) return -1; const h = mx === r ? ((g2 - b) / d) % 6 : mx === g2 ? (b - r) / d + 2 : (r - g2) / d + 4; return (h * 60 + 360) % 360; };
  const lum = (hex: string) => { const [r, g2, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); return .2126 * r + .7152 * g2 + .0722 * b; };
  assert.ok(Math.abs(hue(KIND_COLOR.skill) - 270) > 40 || hue(KIND_COLOR.skill) < 250, '技能不是藍紫');
  assert.ok(Math.abs(lum(KIND_COLOR.skill) - lum(KIND_COLOR.title)) > .1 || Math.abs(hue(KIND_COLOR.skill) - hue(KIND_COLOR.title)) > 30, '技能與稱號可區分');
  assert.ok(gAll('[data-testid="donut-p1"] .br-legend li').every(li => li.querySelector('span')!.textContent && li.querySelector('b')!.textContent), '圖例保留文字與數值');

  // 7) 數字 tiles 標示 P1／P2
  await render('p1', 'PVE');
  for (const id of ['tile-dealt', 'tile-crit', 'tile-heal']) {
    assert.equal(g(`[data-testid="${id}-pp"]`).textContent, 'P1/P2', id);
    assert.ok(g(`[data-testid="${id}"]`).title.includes('P1 / P2'), `${id} tooltip`);
  }

  // 8) 技能貢獻：魂印來源顯示精靈資料的魂印名（原標籤放 tooltip）；技能顯示技能名
  const rows = gAll('[data-testid="top-skill"]');
  const star = rows.find(r => r.dataset.total === String(300))!;
  assert.equal(star.dataset.label, '烈焰印記', '魂印顯示魂印名');
  assert.ok(star.title.includes('星火'), '原標籤在 tooltip');
  assert.ok(rows.some(r => r.dataset.label === '烈焰斬'));
  assert.deepEqual(labelDisplay({ kind: 'soulmark', label: '百分比傷害' }, null), { text: '百分比傷害', tip: '百分比傷害' });
  assert.deepEqual(labelDisplay({ kind: 'soulmark', label: '百分比傷害' }, { soulMark: { name: '無' } }), { text: '百分比傷害', tip: '百分比傷害' });
  assert.deepEqual(labelDisplay({ kind: 'skill', label: '烈焰斬' }, { soulMark: { name: '烈焰印記' } }), { text: '烈焰斬', tip: '烈焰斬' }, '技能不套用魂印名');
  console.log('✓ tiles P1/P2 標示、魂印名顯示、色盤');
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
