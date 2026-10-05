import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
(window as any).__BATTLE_FAST__ = true; (globalThis as any).__BATTLE_SEED__ = 841;
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
const errors: unknown[][] = [], originalError = console.error;
console.error = (...args) => { errors.push(args); originalError(...args); };
let checks = 0;
try {
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const { SOUL_MARK_MAPPING, getBattleSkillRegistry, getBattleSkillAfterHitRegistry, getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { getStatuses } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const { targetedDamageAPI } = await server.ssrLoadModule('/src/battle/targetedDamage.ts');
  // 場下測試使用正式 context 提供的指定精靈 API，不自行模擬扣血。
  for (const type of ['fixed', 'percent', 'true', 'skill_extra_action']) {
    getBattleSkillRegistry()[`指定場下-${type}`] = (ctx: any) => {
      const bench = ctx.getFullTeam(ctx.targetSide)[1];
      ctx.applyDamageToElf(ctx.targetSide, bench.battleId || bench.id, 100, type, { elem: '超能' });
    };
  }
  getBattleSkillRegistry()['指定場下-致命'] = (ctx: any) => {
    const bench = ctx.getFullTeam(ctx.targetSide)[1];
    ctx.applyDamageToElf(ctx.targetSide, bench.battleId || bench.id, 999999, 'true');
  };
  getBattleSkillRegistry()['驅逐驗收-致命'] = (ctx: any) => ctx.applyTrueDamage(ctx.targetSide, 999999);
  const switchHooks: string[] = [];
  getSoulMarkRegistry()['驅逐後一般隊員'] = (_ctx: any, timing: string) => { switchHooks.push(timing); return false; };
  assert.equal(SOUL_MARK_MAPPING['5031'], undefined); assert.equal(SOUL_MARK_MAPPING['六界神王'], undefined);
  const wait = { name: '新精靈測試等待', category: '屬性', type: '普通', power: 0, pp: 30, maxPp: 30, description: '', isSureHit: true };
  const make = (id: string): any => ({ id, name: id, battleId: id, type: '普通', level: 100,
    maxHp: 100000, currentHp: 100000, calculatedStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed: 100 },
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }, statStages: {}, effects: [], skills: [{ ...wait }] });
  const elf = (id: string) => { const seed = structuredClone(DEFAULT_ELVES.find((e: any) => e.id === id)); return { ...seed, ...make(id), name: seed.name, skills: seed.skills, type: seed.type }; };
  let driver: any;
  async function mount(key: string, side: string, self: any, enemy: any, bench: any[] = [], enemyBench: any[] = []) {
    await act(async () => root.render(React.createElement(Battle, { key,
      initialP1Team: side === 'p1' ? [self, ...bench] : [enemy, ...enemyBench], initialP2Team: side === 'p2' ? [self, ...bench] : [enemy, ...enemyBench],
      p1StarterId: side === 'p1' ? self.id : enemy.id, p2StarterId: side === 'p2' ? self.id : enemy.id,
      battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onRestartBattle: () => {}, onDriverInit: (d: any) => driver = d })));
  }
  async function turn(side: string, ownIndex: number, enemyIndex = 0) {
    const before = driver.getSyncState().turnNumber;
    await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[side === 'p1' ? ownIndex : enemyIndex]);
      driver.onSkillSelect('p2', driver.getSyncState().p2.skills[side === 'p2' ? ownIndex : enemyIndex]); });
    for (let i = 0; i < 300 && driver.getSyncState().turnNumber === before; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    assert.equal(driver.getSyncState().turnNumber, before + 1, '實際回合應結束');
  }
  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const f = elf('5032'), enemy = make(`enemy-${side}`); enemy.skills[0].name = '幻化目標等待'; enemy.skills[0].priority = 0;
    await mount(`illusion-${side}`, side, f, enemy, [make('own-bench')], [make('enemy-bench')]);
    assert.equal(driver.getSyncState()[side].illusion.target.name, enemy.name); assert.equal(driver.getSyncState()[side].maxHp, 200000);
    assert.ok(getStatuses(driver.getSyncState()[side])['星護']);
    await turn(side, 0);
    let state = driver.getSyncState();
    assert.equal(state[side].skills[0].name, '星核脈衝', '轉化只改使用中的技能，背包槽不被改寫');
    assert.ok(state[other].currentHp < enemy.currentHp, `原槽變思遷憶須真正結算超能技能傷害：${JSON.stringify({ reg: state[`${side}RegistryState`], logs: state.logs })}`);
    assert.ok(state.logs.some((l: any) => /變思遷憶/.test(l.text || '')), '額外行動確實進入佇列');
    checks++;

    const g = elf('5033'); g.initialCounterpart = make('reserve-snapshot');
    await mount(`counterpart-${side}`, side, g, make('g-enemy'));
    assert.equal(driver.getSyncState()[side].illusion.target.name, 'reserve-snapshot');
    assert.equal(driver.getSyncState()[side].globalPpMaxOffset, 10);
    await turn(side, 0); state = driver.getSyncState();
    assert.equal(state[side].skills[0].name, '星軌念刃'); assert.ok(state[other].currentHp < 100000 - 30000);
    checks++;

    for (const id of ['5032', '5033', '5034']) {
      const seed = elf(id);
      for (const skill of seed.skills) assert.equal(typeof getBattleSkillRegistry()[skill.name], 'function', `註冊技能 ${skill.name}`);
      for (let slot = 0; slot < 5; slot++) {
        const self = elf(id); self.name = `技能獨立驗收-${id}-${slot}`; self.skills.push({ ...wait });
        self.skills[slot].isSureHit = true;
        const foe = make(`foe-${id}-${slot}`); foe.skills[0].priority = -10;
        await mount(`skills-${side}-${id}-${slot}`, side, self, foe, [make('skill-bench')], [make('target-bench')]);
        await turn(side, slot); state = driver.getSyncState();
        assert.ok(state.logs.some((l: any) => (l.text || '').includes(self.skills[slot].name)), `${id}槽${slot}使用實際技能`);
        if (id === '5034' && slot === 1) {
          assert.equal(100000 - state[other].currentHp, 80, '背隳誓盟同次使用後讀取40%能力總和');
          assert.ok(state[`${side}Timers`].some((t: any) => t.payload?.immuneStatus));
        }
        if (id === '5032' && slot === 1) assert.ok(100000 - state[other].currentHp >= 300, '星霧迷境使用後固定吸取真正在管線執行');
        if (id === '5033' && slot === 0) assert.ok(state.logs.some((l: any) => /連擊/.test(l.text || '')), '連擊不是額外行動');
        checks++;
      }
    }
    const mogos = elf('5034'), mob = make('mogos-enemy'), bench = make('mogos-bench'); bench.currentHp = 100;
    await mount(`orb-${side}`, side, mogos, mob, [bench]);
    assert.equal(driver.getSyncState()[`${side}RegistryState`].teamMogosOrb.phase, '豐腴期');
    await turn(side, 2); state = driver.getSyncState();
    assert.equal(state[`${other}Marks`].find((m: any) => m.id === 'mogos_residual').ownerBattleId, state[other].battleId);
    assert.ok(state[`${side}RegistryState`].teamOrbHpBonuses['mogos-bench'] > 0);
    assert.ok(state[`${other}Timers`].some((t: any) => t.payload?.stripEntrance), '豐腴期剝奪不是只有日誌');
    assert.ok(100000 - state[other].currentHp >= 350, '350固定吸取實際結算');
    checks++;

    for (const type of ['fixed', 'percent', 'true', 'skill_extra_action']) {
      const source = make(`source-${type}`), receiver = make(`receiver-${type}`), reserve = make(`reserve-${type}`);
      source.skills[0].name = `指定場下-${type}`; source.skills[0].priority = 10;
      reserve.barrier = 20; reserve.shield = 30;
      await mount(`bench-${side}-${type}`, side, source, receiver, [], [reserve]);
      await turn(side, 0); state = driver.getSyncState();
      const bench = state[`${other}Team`][1];
      const loss = type === 'true' ? 100 : type === 'skill_extra_action' ? 70 : 80;
      assert.equal(100000 - bench.currentHp, loss, `場下${type}使用對應護盾／護罩`);
      assert.equal(state[other].currentHp,100000,'場下傷害不扣在場精靈');
      assert.equal(state[other].battleId,receiver.battleId,'投影不改在場身分');
      assert.equal(state[`${other}ActiveIndex`],0);
      checks++;
    }
    const slayer = make('bench-slayer'); slayer.skills[0].name = '指定場下-致命';
    const survivor = structuredClone(DEFAULT_ELVES.find((e:any)=>e.id==='5005'));
    Object.assign(survivor,{battleId:'bench-black',currentHp:910,maxHp:910});
    await mount(`bench-fatal-${side}`,side,slayer,make('active-safe'),[],[survivor]);
    await turn(side,0); state=driver.getSyncState();
    assert.equal(state[`${other}Team`][1].currentHp,1,'場下致命存活寫入持有者而非在場者');
    assert.equal(state[other].currentHp,100000); checks++;

    const fatal = make('orb-fatal-source'); fatal.skills[0].name = '驅逐驗收-致命'; fatal.skills[0].priority = 10;
    const next = make('orb-expel-next'); next.name = '驅逐後一般隊員';
    const extra = make('orb-extra-excluded'); extra.isExtra = true;
    await mount(`orb-expel-${side}`,side,elf('5034'),fatal,[next,extra]);
    switchHooks.length = 0;
    await turn(side,1); state=driver.getSyncState();
    assert.equal(state[`${side}ActiveIndex`],1,'驅逐只選一般存活隊員，不選額外精靈');
    assert.equal(state[side].battleId,next.battleId);
    assert.equal(state[`${side}Team`][0].currentHp,1,'致命存活體力保留在摩哥斯');
    assert.equal(state[`${side}Team`][0].maxHp,125000,'六維提升含體力上限');
    assert.equal(state[side].skills[0].name,wait.name,'下隻不被舊技能覆蓋');
    assert.ok(!switchHooks.some(t=>['ON_ENTRANCE','ON_SWITCH_OUT','BEFORE_SWITCH_OUT'].includes(t)),'驅逐不執行普通切換登場／下場鉤子');
    assert.equal(state[`${side}RegistryState`].teamMogosOrb.phase,'竭擇期','魂珠換人保留但不重抽');
    checks++;
  }
  assert.equal(errors.length, 0, '捕获到的戰鬥handler錯誤不可被catch掩蓋為通過');
  console.log(`新精靈真正戰鬥：${checks} 個双側場景通過`);
} finally { console.error = originalError; await act(async () => root.unmount()); await server.close(); dom.window.close(); }
