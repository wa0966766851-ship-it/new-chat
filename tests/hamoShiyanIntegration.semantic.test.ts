import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
 HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
 IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
 requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
(window as any).__BATTLE_FAST__ = true; (globalThis as any).__BATTLE_SEED__ = 841;
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom',
 plugins: [{ name: 'headless-hamo-check', configResolved(config) { config.server.hmr = false; config.server.watch = null; } }] });
const errors: string[] = [], originalError = console.error;
console.error = (...args: any[]) => { errors.push(args.map(String).join(' ')); originalError(...args); };
let checks = 0;
try {
 const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
 const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
 const { getSoulMarkRegistry, getBattleSkillRegistry, SOUL_MARK_MAPPING } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
 assert.equal(SOUL_MARK_MAPPING['5023'], 'handleShiyanSoulMark');
 assert.equal(SOUL_MARK_MAPPING['無序·蝕言'], 'handleShiyanSoulMark');
 const souls = getSoulMarkRegistry();
 const wait = { name: '驗收等待', category: '屬性', type: '普通', power: 0, pp: 30, maxPp: 30, description: '', isSureHit: true };
 const make = (id: string): any => ({ id, name: id, battleId: id, type: '普通', level: 100,
  maxHp: 100000, currentHp: 100000, calculatedStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 100, speed: 100 },
  baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
  statStages: {}, effects: [], skills: [{ ...wait }] });
 const seed = (id: string) => { const e = structuredClone(DEFAULT_ELVES.find((e: any) => e.id === id));
  return { ...e, ...make(id), name: e.name, type: e.type, skills: e.skills }; };
 const { GameDataProvider, useGameData } = await server.ssrLoadModule('/src/contexts/GameDataContext.tsx');
 const { OTHERWORLD_REY_TEXT } = await server.ssrLoadModule('/src/data/otherworldReyDescriptions.ts');
 const oldRey = structuredClone(DEFAULT_ELVES.find((e: any) => e.id === '5029'));
 oldRey.soulMark.description = '舊版縮寫魂印';
 oldRey.alienTraits = { exclusiveTrait: { name: '神明 / 雷神', description: '舊合併特質' } };
 oldRey.skills = [{ ...oldRey.skills[2], pp: 4, description: '舊技能' }];
 localStorage.setItem('seer_default_elves_overrides', JSON.stringify({ '5029': oldRey }));
 let catalog: any;
 function Probe() { catalog = useGameData().allElves; return null; }
 await act(async () => root.render(React.createElement(GameDataProvider, null, React.createElement(Probe))));
 const shownRey = catalog.find((e: any) => e.id === '5029');
 assert.equal(shownRey.soulMark.description, OTHERWORLD_REY_TEXT.soul, '首頁真正資料入口不得再被舊摘要覆蓋');
 assert.equal(shownRey.alienTraits.exclusiveTraits[1].description, OTHERWORLD_REY_TEXT.thunder);
 assert.equal(shownRey.skills.length, 1); assert.equal(shownRey.skills[0].pp, 4);
 assert.equal(shownRey.skills[0].description, OTHERWORLD_REY_TEXT.skills['同塵祭']);
 localStorage.clear(); checks++;
 let driver: any;
 async function mount(key: string, side: string, own: any, foe: any, bench: any[] = [], enemyBench: any[] = []) {
  await act(async () => root.render(React.createElement(Battle, { key,
   initialP1Team: side === 'p1' ? [own, ...bench] : [foe, ...enemyBench],
   initialP2Team: side === 'p2' ? [own, ...bench] : [foe, ...enemyBench],
   p1StarterId: side === 'p1' ? own.id : foe.id, p2StarterId: side === 'p2' ? own.id : foe.id,
   battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onRestartBattle: () => {},
   onDriverInit: (d: any) => driver = d })));
 }
 async function turn(side: string, slot: number, foeSlot = 0) {
  const before = driver.getSyncState().turnNumber;
  await act(async () => {
   driver.onSkillSelect('p1', driver.getSyncState().p1.skills[side === 'p1' ? slot : foeSlot]);
   driver.onSkillSelect('p2', driver.getSyncState().p2.skills[side === 'p2' ? slot : foeSlot]);
  });
  for (let i = 0; i < 300 && driver.getSyncState().turnNumber === before; i++)
   await act(async () => { await new Promise(r => setTimeout(r, 10)); });
  const settled = driver.getSyncState();
  assert.equal(settled.turnNumber, before + 1, JSON.stringify({ side, slot, phase: settled.phase, winner: settled.winner, p1: { hp: settled.p1.currentHp, pp: settled.p1.skills.map((s: any) => s.pp) }, p2: { hp: settled.p2.currentHp, pp: settled.p2.skills.map((s: any) => s.pp) }, logs: settled.logs.slice(-12) }));
 }
 for (const side of ['p1', 'p2'] as const) {
  const other = side === 'p1' ? 'p2' : 'p1';
  // 完整哈莫、正式第五技：不以timer存在冒充真正無效。先度過登場清回合效果時段。
  for (const first of [true, false]) {
   const hamo = seed('5035'); hamo.skills.push({ ...wait });
   const target = make(`第五無效行為-${side}-${first}`);
   target.maxHp = target.currentHp = target.calculatedStats.hp = 1000000;
   target.skills = ['物理', '屬性'].map(category => ({ ...wait, category, type: '水', power: category === '物理' ? 100 : 0,
    name: `第五無效探針-${side}-${first}-${category}`, priority: first ? -10 : 10 }));
   let executions = 0; const outcomes: any[] = [];
   for (const skill of target.skills) getBattleSkillRegistry()[skill.name] = () => { executions++; };
   souls[target.name] = (_c: any, event: string, data: any) => {
    if (event === 'BEFORE_STATUS_APPLY' && data?.status === '害怕') data.prevented = true;
    if (['ACTION_FAILED', 'ON_SKILL_HIT'].includes(event) && !data?.isIncoming) outcomes.push({ event, ...data });
   };
   await mount(`fifth-real-${side}-${first}`, side, hamo, target);
   await turn(side, 5); await turn(side, 5); executions = 0; outcomes.length = 0;
   await turn(side, 4);
   let state = driver.getSyncState();
   assert.equal(executions, first ? 0 : 1, '先手當次阻止附加handler；後手不能回溯已使用技能');
   assert.equal(outcomes.filter(d => d.event === 'ON_SKILL_HIT').length, first ? 0 : 1);
   assert.equal(outcomes.filter(d => d.event === 'ACTION_FAILED' && d.invalid).length, first ? 1 : 0);
   assert.equal(state[`${other}Timers`].some((t: any) => t.id === 'next_skill_invalid'), !first, '後出手的下次無效跨回合保留');
   outcomes.length = 0; executions = 0;
   await turn(side, 5);
   state = driver.getSyncState();
   assert.equal(executions, 0, first ? '同類附加失效但主攻擊仍可使用' : '下一回合確實阻止整招');
   assert.equal(outcomes.filter(d => d.event === 'ON_SKILL_HIT').length, first ? 1 : 0);
   assert.equal(outcomes.filter(d => d.event === 'ACTION_FAILED' && d.invalid).length, first ? 0 : 1);
   assert.ok(state[`${other}Timers`].some((t: any) => t.id === 'invalid_same_category_followup' && t.payload.block.addInvalid === '物理'));
   executions = 0; await turn(side, 5, 1);
   assert.equal(executions, 1, '物理附加失效不能封鎖不同類型的屬性技能');
   checks++;
  }
  // 無法行動不是技能無效：害怕不能提前花掉「下次」次數；附加封鎖須準時結束。
  {
   const hamo = seed('5035'); hamo.skills.push({ ...wait });
   const target = make('第五控制與期限-' + side);
   target.maxHp = target.currentHp = target.calculatedStats.hp = 1000000;
   target.skills = [{ ...wait, name: '第五期限探針-' + side, category: '物理', type: '水', power: 100, priority: 10 }];
   let executions = 0, starts = 0;
   getBattleSkillRegistry()[target.skills[0].name] = () => { executions++; };
   souls[target.name] = (c: any, event: string, data: any) => {
    if (event === 'BEFORE_STATUS_APPLY' && data?.status === '害怕' && starts !== 4) data.prevented = true;
    if (event === 'ROUND_START' && ++starts === 4) c.applyStatusWithImmunityCheck(c.actor, '害怕', 1);
   };
   await mount('fifth-duration-' + side, side, hamo, target);
   await turn(side, 5); await turn(side, 5); await turn(side, 4);
   executions = 0; await turn(side, 5);
   assert.equal(executions, 0, '害怕不能出手');
   assert.ok(driver.getSyncState()[`${other}Timers`].some((t: any) => t.id === 'next_skill_invalid'), '害怕未使用技能，不得消耗下次無效');
   await turn(side, 5);
   assert.ok(!driver.getSyncState()[`${other}Timers`].some((t: any) => t.id === 'next_skill_invalid'));
   assert.ok(driver.getSyncState()[`${other}Timers`].some((t: any) => t.id === 'invalid_same_category_followup'));
   executions = 0; await turn(side, 5); await turn(side, 5);
   assert.equal(executions, 0, '下2回合的同類附加效果均被擋住');
   assert.ok(!driver.getSyncState()[`${other}Timers`].some((t: any) => t.id === 'invalid_same_category_followup'), '兩回合後不能永久封鎖');
   await turn(side, 5); assert.equal(executions, 1, '到期後附加handler恢復');
   checks++;
  }
  for (const consumed of [false, true]) {
   const hamo = seed('5035'); hamo.skills.push({ ...wait });
   const target = make('封技換人原持有者-' + side + consumed);
   target.skills[0].priority = 10; // 先出手後才被掛上「下次無效」。
   let benchUses = 0;
   const bench = make('封技換人下一隻-' + side + consumed);
   getBattleSkillRegistry()[bench.skills[0].name = '封技換人探針-' + side + consumed] = () => { benchUses++; };
   for (const e of [target, bench]) souls[e.name] = (_c: any, event: string, data: any) => {
    if (event === 'BEFORE_STATUS_APPLY' && data?.status === '害怕') data.prevented = true;
   };
   await mount('fifth-switch-' + side + consumed, side, hamo, target, [], [bench]);
   await turn(side, 5); await turn(side, 5); await turn(side, 4);
   if (consumed) await turn(side, 5);
   const timerId = consumed ? 'invalid_same_category_followup' : 'next_skill_invalid';
   assert.ok(driver.getSyncState()[`${other}Timers`].some((t: any) => t.id === timerId));
   const before = driver.getSyncState().turnNumber;
   await act(async () => {
    if (other === 'p2') driver.onSkillSelect('p1', driver.getSyncState().p1.skills[5]);
    driver.onSwitchElf(other, 1);
    if (other === 'p1') driver.onSkillSelect('p2', driver.getSyncState().p2.skills[5]);
   });
   for (let i = 0; i < 300 && driver.getSyncState().turnNumber === before; i++)
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
   assert.equal(driver.getSyncState()[other].battleId, bench.battleId);
   assert.ok(!driver.getSyncState()[`${other}Timers`].some((t: any) => t.id === timerId), '原受方封技不能串到下一隻');
   await turn(side, 5); assert.equal(benchUses, 1, '下一隻的正式技能handler正常執行');
   checks++;
  }
  for (let slot = 0; slot < 5; slot++) {
   const hamo = seed('5035');
   const target = make('哈莫實招受方-' + side + slot); target.skills[0].priority = -10;
   target.maxHp = target.currentHp = target.calculatedStats.hp = 1000000; // 纏根額外傷害以哈莫最大HP計，須留存活目標以驗證回合末PP吸取。
   const hits: any[] = [];
   const primary = slot === 1 ? '凍傷' : slot === 2 ? '燒傷' : slot === 3 ? '中毒' : undefined;
   souls[target.name] = (_c: any, event: string, data: any) => {
    if (event === 'AFTER_DAMAGE' && data?.isIncoming) hits.push(data);
    if (event === 'BEFORE_STATUS_APPLY' && (data?.status === '害怕' || (primary && data?.status === primary))) data.prevented = true; // 只排除登場害怕，元素技能仍須驗證失敗後的控制異常。
   };
   await mount('hamo-skills-' + side + slot, side, hamo, target);
   await turn(side, slot);
   const state = driver.getSyncState();
   assert.equal(state[side].skills[slot].pp, hamo.skills[slot].pp - (slot === 3 ? 0 : 1), slot === 3 ? '纏根出招扣1PP後，回合末吸取1PP恢復本槽' : '完整哈莫技能只扣本槽一次');
   assert.ok(hits.some(d => d.damageType === 'skill_attack' && d.receipt.settledAmount > 0), '不是只有附加傷害或日誌');
   if (primary) {
    const fallback = slot === 1 ? '冰封' : slot === 2 ? '焚燼' : '感染';
    const statuses = (await server.ssrLoadModule('/src/utils/battleHelpers.ts')).getStatuses(state[other]);
    assert.ok(statuses[fallback], `原生異常被免疫後應附加${fallback}`);
   }
   if (slot === 3) {
    assert.ok(hits.some(d => d.damageType === 'percent' && d.receipt.requestedAmount === state[side].maxHp), '纏根按請求回滿量造成等量百分比傷害');
    assert.equal(state[other].skills[0].pp, 29, '感染禁止出招，因此只扣回合末吸取1PP，不能虛扣20PP');
   }
   if (slot === 4) assert.ok(state[`${other}Timers`].some((t: any) => t.id === 'invalid_same_category_followup' && t.payload.block.addInvalid === '屬性'), '對手本回合後手使用下次技能已消耗無效，須留下對方同類附加失效');
   checks++;
  }
  const rootHamo = seed('5035'), ppTarget = make('纏根PP出招受方-' + side);
  ppTarget.maxHp = ppTarget.currentHp = ppTarget.calculatedStats.hp = 1000000;
  ppTarget.skills[0].priority = -10;
  souls[ppTarget.name] = (_c: any, event: string, data: any) => {
   if (event === 'BEFORE_STATUS_APPLY' && data?.status === '害怕') data.prevented = true;
  }; // 中毒可附加但不控制，這個獨立情境才應消耗20倍PP。
  await mount('hamo-root-pp-' + side, side, rootHamo, ppTarget);
  await turn(side, 3);
  assert.equal(driver.getSyncState()[other].skills[0].pp, 9, '正常出招消耗20PP，回合末再被吸取1PP');
  assert.equal(driver.getSyncState()[side].skills[3].pp, 20, '本槽扣1後吸取恢復1，其他技能不得替代此槽');
  checks++;
  // 真正BattleScreen／魂印入口：敵方只用測試技能提供已知傷害，哈莫不替換handler。
  const { getTypeMatchup } = await server.ssrLoadModule('/src/utils/statCalculator.ts');
  const { getStatuses } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const { changePp } = await server.ssrLoadModule('/src/effects/newElfOperations.ts');
  const skills = getBattleSkillRegistry(), incoming: any[] = [];
  const cycleHamo = seed('5035'); cycleHamo.skills = [{ ...wait }, { ...wait, name: '綠鱗未使用槽', pp: 0 }];
  const caster = make('龍鱗循環受測攻方-' + side);
  const probes = ['普通', '普通', '水', '火', '草'];
  caster.skills = probes.map((type, i) => ({ ...wait, name: '龍鱗循環探針-' + side + i, priority: 10 }));
  caster.skills.push({ ...wait, name: '龍鱗反應探針-' + side, priority: 10 });
  caster.skills.push({ ...wait, name: '綠鱗清PP探針-' + side, priority: 10 });
  caster.skills.forEach((skill: any, i: number) => skills[skill.name] = (c: any) => {
   if (i < probes.length) incoming.push({ type: probes[i], amount: c.applySkillTypeDamage(c.targetSide, 1000, undefined, { elem: probes[i] }) });
   else if (i === 5) {
    c.updateElf(c.actor, { shield: 999, barrier: 999 });
    c.applyStatChange(c.targetSide, { atk: -1, accuracy: -1 });
    incoming.push({ type: 'fixed', amount: c.applyPinkDamage(c.targetSide, 1000, undefined, undefined, undefined, 'fixed') });
    incoming.push({ type: 'percent', amount: c.applyPinkDamage(c.targetSide, 1000, undefined, undefined, undefined, 'percent') });
    incoming.push({ type: 'true', amount: c.applyTrueDamage(c.targetSide, 1000) });
   } else {
    c.updateElf(c.targetSide, { currentHp: 500 });
    changePp(c, c.targetSide, c.target, () => 0, false, 'clear');
   }
  });
  souls[caster.name] = (_c: any, event: string, data: any) => { if (event === 'BEFORE_STATUS_APPLY') data.prevented = true; };
  const dragon = make('龍系場下核對-' + side); dragon.type = '龍';
  const neutral = make('非龍系場下核對-' + side);
  await mount('hamo-cycle-full-' + side, side, cycleHamo, caster, [dragon, neutral]);
  for (let i = 0; i < probes.length; i++) await turn(side, 0, i);
  let cycleState = driver.getSyncState(), reg = cycleState[`${side}RegistryState`];
  assert.deepEqual(reg.hamoScales, ['藍色', '紅色', '綠色']);
  assert.equal(reg.hamoCycle, 3); assert.equal(reg.hamoHalvingCount, 3);
  assert.deepEqual(incoming.slice(0, 2).map(h => h.amount), [0, 0]);
  for (let i = 2; i < probes.length; i++) assert.equal(incoming[i].amount,
   Math.floor(Math.floor(1000 * getTypeMatchup(probes[i], '龍')) * .125), '正式X系傷害須套三次減半，不能當固定傷害');
  assert.equal(cycleState[`${side}Team`][1].maxHp, 144000, '場下龍系體力上限複利');
  assert.equal(cycleState[`${side}Team`][1].calculatedStats.atk, 144);
  assert.equal(cycleState[`${side}Team`][2].maxHp, 100000, '不污染非龍系隊員');
  checks++;
  const hpBefore = cycleState[side].currentHp;
  await turn(side, 0, 5); cycleState = driver.getSyncState(); reg = cycleState[`${side}RegistryState`];
  assert.ok(reg.hamoScales.includes('藍色') && reg.hamoScales.includes('紅色'), '最後無色鱗染色的下一回合仍在2回合保護內');
  assert.equal(cycleState[other].shield || 0, 0, '保護內保留鱗片但仍執行藍鱗削除護盾效果');
  checks++;
  await turn(side, 0, 5); cycleState = driver.getSyncState(); reg = cycleState[`${side}RegistryState`];
  assert.equal(cycleState[side].statStages.atk || 0, 0); assert.equal(cycleState[side].statStages.accuracy || 0, 0, '藍鱗免下降含命中');
  assert.ok(!reg.hamoScales.includes('藍色')); assert.ok(!reg.hamoScales.includes('紅色'), '全染色保護到期後，受觸發者回合末消失');
  assert.ok(reg.hamoScales.includes('綠色'), '未觸發綠鱗不可跟著清空');
  assert.equal(cycleState[side].currentHp, hpBefore, '固定百分比皆被紅鱗擋；真傷扣1000後魂印回滿');
  assert.deepEqual(incoming.slice(-3), [{ type: 'fixed', amount: 0 }, { type: 'percent', amount: 0 }, { type: 'true', amount: 1000 }]);
  assert.equal(cycleState[other].shield || 0, 0);
  assert.ok(!getStatuses(cycleState[side])['害怕'], '普通生命值下魂印保持異常免疫');
  checks++;
  await turn(side, 0, 6); cycleState = driver.getSyncState(); reg = cycleState[`${side}RegistryState`];
  assert.equal(cycleState[side].skills[0].pp, 29, '綠鱗重置後哈莫仍須正常出招扣1PP');
  assert.equal(cycleState[side].skills[1].pp, 30, '原本耗盡且未出招槽也重置回滿，不只回復本槽');
  assert.equal(cycleState[side].currentHp, cycleState[side].maxHp);
  assert.ok(!reg.hamoScales.includes('綠色'));
  assert.equal(cycleState[other].maxHp, 80000, '綠鱗消失削減敵方體力上限20%而非真實傷害');
  checks++;
  const stolen = seed('5023'); stolen.skills = [stolen.skills.find((s: any) => s.name === '械律·置換')];
  const thiefTarget = make('偷藥持有者'); thiefTarget.skills[0].priority = -10;
  souls[thiefTarget.name] = (c: any, event: string) => {
   if (event === 'BEFORE_STATUS_APPLY') return false;
   if (event === 'OPPONENT_ACTION') c.applyTrueDamage(c.targetSide, 500);
  };
  await mount('steal-potion-' + side, side, stolen, thiefTarget);
  await turn(side, 0);
  assert.equal(driver.getSyncState()[`${other}ItemInventory`].hp_150.left, 99, '扣敵方150藥劑一瓶');
  assert.equal(driver.getSyncState()[`${side}ItemInventory`].hp_150.left, 100, '不能消耗自己的背包');
  assert.ok(driver.getSyncState().logs.some((l: any) => /使用了【中級體力藥劑】/.test(l.text)), '偷到後走正式藥劑使用');
  checks++;

  getBattleSkillRegistry()['空庫存偷藥驗收'] = (c: any) => {
   for (let i = 0; i < 102; i++) c.useBattleItem(c.targetSide, 'hp_150', c.actor);
  };
  const exhausted = make('空庫存偷藥'); exhausted.skills[0].name = '空庫存偷藥驗收'; exhausted.skills[0].priority = 10;
  await mount('exhausted-' + side, side, exhausted, make('空库背包'));
  await turn(side, 0);
  assert.equal(driver.getSyncState()[`${other}ItemInventory`].hp_150.left, 0);
  assert.equal(driver.getSyncState().logs.filter((l: any) => /使用了【中級體力藥劑】/.test(l.text)).length, 100, '剩餘兩次不能憑空生藥');
  checks++;
  for (const replacement of [false, true]) {
   const hits: any[] = []; const outcomes: string[] = [];
   const own = seed('5035'); own.name = '重算驗收'; own.skills = [{ ...own.skills[1], power: 100, pp: 20, maxPp: 20 }];
   souls[own.name] = (_c: any, event: string) => { if (['ON_SKILL_HIT', 'AFTER_ACTION', 'ACTION_FAILED'].includes(event)) outcomes.push(event); };
   const foe = make('重算受方'); foe.skills[0].priority = -10;
   souls[foe.name] = (c: any, event: string, data: any) => {
    if (event === 'ON_ENTRANCE') c.addTimerTo(c.targetSide, { id: '驗收一次無效', remaining: 1, kind: 'use_counter', source: 'skill', tickAt: 'never', payload: { block: { invalid: 'all' } } }, false);
    if (event === 'AFTER_DAMAGE') hits.push(data);
   };
   const owner = seed('5023'); owner.id = 'formula-bench'; owner.battleId = 'formula-bench';
   await mount('retry-' + side + replacement, side, own, foe, [], replacement ? [owner] : []);
   await turn(side, 0);
   const state = driver.getSyncState();
   assert.equal(state[side].skills[0].pp, 19, '只扣原招一次PP');
   assert.equal(outcomes.filter(e => e === 'ON_SKILL_HIT').length, 0, '不冒充原技能命中');
   assert.equal(outcomes.filter(e => e === 'ACTION_FAILED').length, 1);
   assert.equal(hits.filter(d => d.damageType === 'skill_attack').length, 1, '完整主攻擊结算入口一次');
   if (replacement) assert.equal(hits.find(d => d.damageType === 'skill_attack').receipt.settledAmount, 180, '雙攻和200 × (1-10%特防)，威力不硬乘公式替換');
   assert.ok(!state[`${side}Timers`].some((t: any) => t.payload?.afterUseDrainRatio), '原技能附加效果不重跑');
   checks++;
  }
  const shiyan = seed('5023'); shiyan.skills = [{ ...shiyan.skills[0], battleSlot: 0 }];
  const foe = make('怨靈受方'); foe.skills[0].priority = -10; foe.isAlienElf = false;
  await mount('wraith-' + side, side, shiyan, foe, [], [make('怨靈場下目標')]);
  await turn(side, 0);
  const state = driver.getSyncState();
  assert.ok(state.logs.some((l: any) => /賽博怨靈.*魔咒|魔咒.*賽博怨靈/.test(l.text || '')), '實際選招後必須進入額外行動');
  assert.ok(state[`${side}Team`].some((e: any) => e.name === '賽博怨靈'));
  assert.ok(state[side].shield > 0 && state[side].barrier > 0, '魔咒已結算而不只是log');
  assert.ok(state[`${other}Team`][1].currentHp < 100000, '場下真傷按最大HP比例');
  checks++;
  const substituteOwner = seed('5023'); substituteOwner.skills = [{ ...wait, battleSlot: 0 }];
  const lethalFoe = make('替死攻方'); lethalFoe.calculatedStats.atk = 1000000;
  souls[lethalFoe.name] = (_c: any, event: string, data: any) => {
    if (event === 'BEFORE_STATUS_APPLY' && data?.status === '詛咒') data.prevented = true;
  }; // 測試攻方免詛咒，才能真正造成致死攻擊；不修改蝕言的異常规则。
  lethalFoe.skills = [{ ...wait, name: '驗收致命攻擊', power: 1000000, priority: 10, category: '物理' }];
  await mount('dead-wraith-' + side, side, substituteOwner, lethalFoe, [], [make('替死場下目標')]);
  await turn(side, 0);
  const afterSub = driver.getSyncState();
  const deadWraith = afterSub[`${side}Team`].find((e: any) => e.name === '賽博怨靈');
  assert.equal(deadWraith.currentHp, 0, JSON.stringify({ hp: afterSub[side].currentHp, logs: afterSub.logs, flags: afterSub[`${side}RegistryState`] })); assert.notEqual(deadWraith.isVanished, true);
  assert.ok(afterSub[side].currentHp > 0 && afterSub[side].shield > 0, '替死後蝕言活著，已死怨靈仍從正式額外行動造成傷害並給盾');
  assert.equal(afterSub[`${side}RegistryState`][`${side}_wraithSubUsed`], true);
  checks++;
 }
 assert.equal(errors.length, 0, '正式戰鬥handler錯誤不能被吞掉後宣稱通過');
 console.log('正式戰鬥註冊／公式重算／蝕言怨靈 ' + checks + ' 情境通過。');
} finally { console.error = originalError; await act(async () => root.unmount()); await server.close(); dom.window.close(); }
