import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('', { url: 'http://localhost:3000' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
try {
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { launchBattle } = await server.ssrLoadModule('/src/shell/battleLaunch.ts');
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { resetElfStateForBattle } = await server.ssrLoadModule('/src/utils/statCalculator.ts');
  const canonical = DEFAULT_ELVES.find((elf: any) => elf.id === 'arena_14');
  const wait = { name: '等待', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' };
  const unit = (id: string): any => ({ id, battleId: id, name: id, type: '普通', level: 100,
    baseStats: { hp: 100, atk: 100, spatk: 100, def: 100, spdef: 100, speed: 100 },
    calculatedStats: { hp: 1000, atk: 400, spatk: 193, def: 300, spdef: 301, speed: 100 },
    maxHp: 1000, currentHp: 1000, statStages: {}, skills: [structuredClone(wait)] });
  for (const side of ['p1', 'p2']) {
    const holder = { ...unit('holder'), id: canonical.id, name: canonical.name,
      baseStats: structuredClone(canonical.baseStats), soulMark: structuredClone(canonical.soulMark),
      inscriptions: Array.from({ length: 3 }, (_, i) => ({ id: `default_max_insc_${i + 1}`, name: `刻印${i}`,
        stats: { hp: 150, atk: 150, spatk: 0, def: 60, spdef: 60, speed: 45 } })) };
    const roster = [holder, ...Array.from({ length: 11 }, (_, i) => unit(`ally${i}`))];
    const stale = structuredClone(roster);
    stale[0].soulMark = { name: '舊空魂印', description: '', kit: [] };
    stale[0].inscriptions.forEach((i: any) => { i.stats.atk = 75; i.stats.spatk = 75; });
    const enemy = unit('enemy');
    dom.window.localStorage.clear();
    for (const s of ['p1', 'p2']) {
      dom.window.localStorage.setItem(`seer_${s}_annual_bonus`, '0');
      const team = s === side ? stale : [enemy];
      dom.window.localStorage.setItem(`seer_last_used_${s}_team`, JSON.stringify({ team, starterId: team[0].battleId }));
    }
    for (const [slot, value] of [['suit', 'eternal_starlight'], ['eyewear', 'roamer_ah'], ['title', 'chaoneng_xiongdi']]) {
      dom.window.localStorage.setItem(`seer_${side}_${slot}`, value);
    }
    let engine: any;
    const bridge = {
      battleMode: 'PVP', battleFormat: 'normal_6v6', setBattleFormat() {}, allElvesCombined: [...roster, enemy],
      handleStartBattle(mode: any, t1: any[], t2: any[], st1: string, st2: string,
        suit1: string, eye1: string, suit2: string, eye2: string, title1: string, title2: string, format: string) {
        // 與 App 相同的重置邊界，不能用 preparedTeams 跳過正式初始化。
        const reset = (team: any[], starter: string, suit: string) => team.map(elf => resetElfStateForBattle(elf, elf.battleId === starter, suit));
        engine = createBattleEngine({ initialP1Team: reset(t1, st1, suit1), initialP2Team: reset(t2, st2, suit2),
          p1StarterId: st1, p2StarterId: st2, p1Suit: suit1, p1Eyewear: eye1, p2Suit: suit2, p2Eyewear: eye2,
          p1Title: title1, p2Title: title2, battleMode: mode, battleFormat: format, isFast: () => true });
      },
    };
    assert.equal(launchBattle(bridge).ok, true);
    try {
      engine.mount(); engine.start(); await engine.idle();
      const state = engine.getState(), actual = state[side];
      assert.equal(state[`${side}Team`].length, 6, '候補不能混入戰局');
      assert.deepEqual(actual.calculatedStats, { hp: 1772, atk: 991, spatk: 261, def: 1030, spdef: 1030, speed: 1047 });
      assert.equal(actual.currentHp, 1772);
      assert.equal(holder.inscriptions[0].stats.atk, 150);
      assert.equal(stale[0].inscriptions[0].stats.atk, 75);
      console.log(`✓ ${side}: 舊12隻快照 → 最新倉庫/三件配裝 → App重置 → 正式引擎，5層、HP1772`);
    } finally { engine.unmount(); }
  }
} finally { await server.close(); dom.window.close(); }
