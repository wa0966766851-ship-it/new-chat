import assert from 'node:assert/strict';
import { createServer } from 'vite';

// 正式Vite註冊表＋積木執行器；不以解析率代替效果驗證。
const server = await createServer({ appType: 'custom', optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true, hmr: false, watch: null },
  plugins: [{ name: 'headless-illusion-soul', configResolved(c) { c.server.hmr = false; c.server.watch = null; } }] });
const errors: unknown[][] = [], originalError = console.error;
console.error = (...args) => { errors.push(args); originalError(...args); };
let checks = 0;
try {
  const { SoulMarkRegistry, getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { emitSkillUse, emitStatusApplied, getSoulProgram } = await server.ssrLoadModule('/src/blocks/registry.ts');
  const { SOUL_MODE } = await server.ssrLoadModule('/src/blocks/specs.ts');
  for (const side of ['p1', 'p2']) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const make = (id: string): any => ({ id, battleId: id, name: id, currentHp: 100, maxHp: 1000,
      calculatedStats: { hp: 1000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
      skills: [{ name: '等待', category: '屬性', pp: 10, maxPp: 10 }], effects: [], statStages: {}, battleStatuses: {} });
    const owner = make('幻化持有者'), enemy = make('對手');
    const source = { ...make('5006'), name: '積木魂印来源', soulMark: { name: '測試魂印',
      description: '回合開始時：恢復自身100點體力；\n自身使用技能時：恢復自身20點體力；\n自身受到異常狀態時：恢復自身30點體力；' } };
    owner.illusion = { source: '測試幻化', target: source };
    const registry: any = {}, timers: any[] = [], heals: number[] = [];
    const c: any = { actor: side, targetSide: other, roundNumber: 1, self: owner, target: enemy,
      activeP1: side === 'p1' ? owner : enemy, activeP2: side === 'p2' ? owner : enemy,
      p1Timers: side === 'p1' ? timers : [], p2Timers: side === 'p2' ? timers : [],
      getPlayerState: (key: string) => registry[key], setPlayerState: (key: string, value: any) => registry[key] = value,
      getOpponentState: () => undefined,
      getFullTeam: (s: string) => [s === side ? owner : enemy], getMarks: () => [], getStatuses: (elf: any) => elf.battleStatuses,
      updateElf: (_s: string, patch: any) => Object.assign(owner, patch),
      applyHeal: (s: string, amount: number) => { assert.equal(s, side); owner.currentHp += amount; heals.push(amount); },
      addLog() {}, rng: () => 0, trackCodeExec() {} };
    const foeCtx: any = { ...c, actor: other, targetSide: side, self: enemy, target: owner };
    assert.ok(getSoulProgram(source).clauses.every((clause: any) => clause.parsed), '測試文本必須完整解析');

    // 同側已存在的持續效果只執行一次，不能因新增取得魂印再次執行。
    timers.push({ id: '現有每回合恢復', remaining: 3, scope: 'elf', ownerBattleId: owner.battleId,
      payload: { block: { trig: 'round_start', body: [{ acts: [{ op: 'heal_flat', p: { amount: 7 } }] }] } } });
    SoulMarkRegistry[owner.name](c, 'ROUND_START');
    assert.deepEqual(heals, [7, 100]); assert.equal(owner.currentHp, 207);
    assert.equal(owner.id, '幻化持有者'); assert.equal(owner.name, '幻化持有者'); checks++;

    heals.length = 0;
    emitSkillUse(c, foeCtx, owner.skills[0], false);
    assert.deepEqual(heals, [20], '技能使用獨立接點也必須執行取得的積木魂印'); checks++;
    heals.length = 0;
    emitStatusApplied([c, foeCtx], { side, status: '中毒', duration: 3 });
    assert.deepEqual(heals, [30], '異常附加接點也必須執行取得的魂印'); checks++;

    // 有殘留手寫handler時，目標為全積木模式仍不可重複跑舊handler。
    let staleCalls = 0;
    getSoulMarkRegistry()[source.name] = () => { staleCalls++; };
    heals.length = 0; SoulMarkRegistry[owner.name](c, 'ROUND_START');
    assert.equal(staleCalls, 0); assert.deepEqual(heals, [7, 100]); checks++;
    // 混合模式仍執行手寫部分與選定積木子句，不因全積木修正一併漏掉。
    const oldMode = SOUL_MODE[source.id];
    try {
      SOUL_MODE[source.id] = [0];
      heals.length = 0; SoulMarkRegistry[owner.name](c, 'ROUND_START');
      assert.equal(staleCalls, 1); assert.deepEqual(heals, [7, 100]);
      heals.length = 0; emitSkillUse(c, foeCtx, owner.skills[0], false);
      assert.deepEqual(heals, [], '未選入的積木子句不執行'); checks++;
    } finally { SOUL_MODE[source.id] = oldMode; }
    owner.illusion = undefined;
    heals.length = 0; emitSkillUse(c, foeCtx, owner.skills[0], false);
    assert.deepEqual(heals, [], '解除幻化後不再觸發取得魂印'); checks++;
  }
  assert.equal(errors.length, 0, '積木執行器吞掉的錯誤也必須令驗收失敗');
  console.log(`幻化取得積木魂印：${checks}個雙側情境通過。`);
} finally { console.error = originalError; await server.close(); }
