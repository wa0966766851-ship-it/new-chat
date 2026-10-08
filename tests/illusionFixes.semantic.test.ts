import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true, hmr: false, watch: null },
  plugins: [{ name: 'headless-illusion-fixes', configResolved(c) { c.server.hmr = false; c.server.watch = null; } }] });
const errors: unknown[][] = [], originalError = console.error;
console.error = (...args) => { errors.push(args); originalError(...args); };
let checks = 0;
try {
  const { startIllusion, endIllusion, illusionSkill } = await server.ssrLoadModule('/src/battle/illusion.ts');
  const { SoulMarkRegistry, transformSkillBeforeResolve, getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { buildStateAPIs } = await server.ssrLoadModule('/src/battle/contextBuilders.ts');
  const { battleReducer } = await server.ssrLoadModule('/src/components/BattleManager.ts');
  const { STAGED_ARENA_ELVES } = await server.ssrLoadModule('/src/data/stagedArenaElves.ts');
  const { getElfAdvancedMechanics } = await server.ssrLoadModule('/src/data/traitsRegistry.ts');
  const { effectDefinitionEntries } = await server.ssrLoadModule('/src/battle/effectSources.ts');
  const { elfForViewer, visibleSkills, viewerMaskTerms, maskViewerText } = await server.ssrLoadModule('/src/battle/viewerPerspective.ts');
  const { isZeroPpExempt, BATTLE_ITEMS } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const { applyBattleItem } = await server.ssrLoadModule('/src/battle/itemInventory.ts');
  const { restorePP, ppOf, key } = await server.ssrLoadModule('/src/effects/elves/staged-arena/shared.ts');
  const { acquiredEffectContext } = await server.ssrLoadModule('/src/battle/acquiredEffectContext.ts');
  const { soulPassiveEvade } = await server.ssrLoadModule('/src/blocks/registry.ts');
  const stat = (n: number) => ({ hp: n, atk: n, def: n, spatk: n, spdef: n, speed: n });
  const make = (id: string, n = 100): any => ({ id, battleId: id, name: id, type: '超能', level: 100,
    currentHp: n, maxHp: n, calculatedStats: stat(n), baseStats: stat(n), effects: [], battleStatuses: {},
    statStages: {}, soulMark: { name: '自身魂印', description: '' }, trait: { name: '自身特性', description: '' },
    alienTraits: { gen2Trait: { name: '豪邁', description: '' } },
    skills: Array.from({ length: 5 }, (_, i) => ({ name: `原技能${i}`, type: '超能', category: '屬性', power: 0, pp: 3, currentPp: 0, maxPp: 20, description: '' })) });
  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const owner = make(`幻化修復持有者-${side}`), enemy = make(`對手-${side}`, 300);
    const ref: any = { current: { p1: side === 'p1' ? owner : enemy, p2: side === 'p2' ? owner : enemy,
      p1Team: side === 'p1' ? [owner] : [enemy], p2Team: side === 'p2' ? [owner] : [enemy],
      p1ActiveIndex: 0, p2ActiveIndex: 0, p1Timers: [], p2Timers: [], p1Marks: [], p2Marks: [],
      p1RegistryState: {}, p2RegistryState: {}, turnNumber: 1, logs: [] } };
    let reduced = ref.current;
    let ctx: any;
    const shared: any = { side, targetSide: other, isP1: side === 'p1', self: owner, opp: enemy, isHit: true,
      syncStateRef: ref, dispatch: (a: any) => reduced = battleReducer(reduced, a), pushEffect() {}, getBattleEventContext: () => ctx };
    const apis = buildStateAPIs(shared);
    ctx = { ...apis, actor: side, targetSide: other, roundNumber: 1, get self() { return ref.current[side]; },
      get target() { return ref.current[other]; }, get activeP1() { return ref.current.p1; }, get activeP2() { return ref.current.p2; },
      get p1Timers() { return ref.current.p1Timers; }, get p2Timers() { return ref.current.p2Timers; },
      addLog() {}, rng: () => 0, getStatuses: (e: any) => e.battleStatuses || {}, clearTurnEffectsOf: () => false,
      applyHeal() {}, applyStatChange() {}, queueExtraAction() {} };

    startIllusion(ctx, enemy, '能力分層');
    apis.updateElf(side, { calculatedStats: stat(100), maxHp: 100 });
    endIllusion(ctx);
    assert.deepEqual(ctx.self.calculatedStats, stat(100), '整份面板重算後解除不能六維歸1');
    assert.equal(ctx.self.maxHp, 100); assert.equal(ctx.self.name, owner.name); checks++;

    startIllusion(ctx, enemy, '保留自身變化');
    apis.updateAnyElf(side, owner.battleId, { calculatedStats: { ...ctx.self.calculatedStats, atk: 425 }, maxHp: 420 });
    endIllusion(ctx);
    assert.equal(ctx.self.calculatedStats.atk, 125); assert.equal(ctx.self.maxHp, 120);
    assert.deepEqual(reduced[side].calculatedStats, ctx.self.calculatedStats, '同步狀態與React reducer還原結果一致'); checks++;

    // 真實無為龍者魂印：舊名稱的技能選擇→同槽轉化→完成／失敗均交換原槽PP。
    const target = structuredClone(STAGED_ARENA_ELVES.find((e: any) => e.name === '無為龍者'));
    target.calculatedStats = stat(300); target.maxHp = 300; target.currentHp = 300;
    apis.updateElf(side, { calculatedStats: stat(100), maxHp: 100 });
    startIllusion(ctx, target, '真實無為取得', 10);
    apis.updateElf(side, { skills: ctx.self.skills.map((s: any, i: number) => ({ ...s,
      priority: i === 0 ? 3 : 0, isSureHit: i === 0, description: i === 0 ? '■ 先制+3\n■ 必中\n🎯 原技能附加不得重跑' : '' })) });
    const projected = illusionSkill(ctx.self, { ...ctx.self.skills[0], battleSlot: 0 });
    assert.equal(projected.priority, (target.skills[0].priority || 0) + 3);
    assert.equal(projected.isSureHit, true);
    assert.ok(!projected.description.includes('原技能附加不得重跑'), '固有保留不等於複製原技能附加'); checks++;
    assert.equal(ctx.self.trait.name, '自身特性', '原特性不被取得特性覆蓋');
    assert.equal(isZeroPpExempt(ctx.self, { ...ctx.self.skills[0], pp: 0 }), true);
    const entries = effectDefinitionEntries(ctx.self);
    assert.ok(entries.some((e: any) => !e.acquired && e.name === '自身魂印'));
    assert.ok(entries.some((e: any) => e.acquired && e.soul)); checks++;
    for (const finish of ['AFTER_ACTION', 'ACTION_FAILED']) {
      apis.updateElf(side, { skills: ctx.self.skills.map((s: any, i: number) => ({ ...s, pp: i === 0 ? 3 : 8 })) });
      ctx.skill = { ...ctx.self.skills[0], battleSlot: 0 };
      const ppCostComp = { base: 1 };
      SoulMarkRegistry[ctx.self.name](ctx, 'BEFORE_SKILL', { ppCostComp });
      assert.equal(ppCostComp.base, 0);
      ctx.skill = transformSkillBeforeResolve(ctx, ctx.skill);
      assert.equal(ctx.skill.name, target.skills[0].name);
      assert.equal(ctx.skill.pp, 3, '轉化使用持有者PP，不用目標快照PP');
      SoulMarkRegistry[ctx.self.name](ctx, finish, { skill: ctx.skill });
      assert.equal(ctx.self.skills[0].pp, 27, '原槽上限30減出招前3＝27');
      assert.equal(ctx.self.skills[1].pp, 8, '其他技能槽不被改寫');
      assert.equal(ctx.self.skills[0].currentPp, 27); checks++;
    }
    apis.updateElf(side, { skills: ctx.self.skills.map((s: any) => ({ ...s, pp: 0, currentPp: 0 })) });
    applyBattleItem(ctx, BATTLE_ITEMS.find((i: any) => i.id === 'pp_10'), side);
    assert.equal(ppOf(ctx.self.skills[0]), 10); assert.equal(ctx.self.skills[0].currentPp, 10);
    restorePP(ctx, side, 4); assert.equal(ppOf(ctx.self.skills[0]), 14);
    assert.equal(ctx.self.skills[0].currentPp, 14); checks++;
    applyBattleItem(ctx, BATTLE_ITEMS.find((i: any) => i.id === 'pp_35'), side);
    assert.equal(ctx.self.skills[0].pp, 30, '幻化+10上限也適用藥劑');
    endIllusion(ctx); assert.equal(ctx.self.skills[0].pp, 20); assert.equal(ctx.self.skills[0].currentPp, 20);
    assert.equal(isZeroPpExempt(ctx.self, { ...ctx.self.skills[0], pp: 0 }), false); checks++;

    const source = { ...make('取得戰士來源', 200), type: '龍', alienTraits: { exclusiveTraits: [{ name: '戰士', description: '取得戰士' }] } };
    startIllusion(ctx, source, '來源並存');
    const mechanics = getElfAdvancedMechanics(ctx.self);
    assert.equal(mechanics.ignoreDefPercent, .5, '自身豪邁仍生效');
    assert.equal(mechanics.alwaysWeaknessDamage, true, '取得陣列特質戰士也生效');
    const shown = elfForViewer(ctx.self, 'p2');
    assert.equal(shown.name, source.name); assert.equal(shown.type, '龍');
    assert.equal(shown.trait.name, source.trait.name); assert.equal(shown.illusion, undefined);
    assert.equal(ctx.self.type, '超能', '迷霧不能更改真正結算屬性');
    assert.equal(elfForViewer(ctx.self, 'p1'), ctx.self);
    assert.equal(visibleSkills(ctx.self)[0].name, source.skills[0].name);
    assert.equal(illusionSkill(ctx.self, { ...ctx.self.skills[0], battleSlot: 0 }).battleSlot, 0);
    assert.equal(maskViewerText(ctx.self.name, viewerMaskTerms([ctx.self])), source.name); checks++;
    ctx.skill = visibleSkills(ctx.self)[0]; const beforeKey = key(ctx, 'used');
    endIllusion(ctx); startIllusion(ctx, source, '再次取得'); ctx.skill = visibleSkills(ctx.self)[0];
    assert.notEqual(key(ctx, 'used'), beforeKey, '再次取得不沿用上次競技場私有計數'); checks++;
    endIllusion(ctx); assert.equal(getElfAdvancedMechanics(ctx.self).alwaysWeaknessDamage, undefined); checks++;

    // 正式接點：來源辨識P1/P2必須保持物件身分，直接寫入持有者不能被丟棄。
    const acquired = { ...make(`舊式取得來源-${side}`, 200), soulMark: { name: '舊式來源', description: '' } };
    apis.setPlayerState('borrowedPrivate', 9);
    startIllusion(ctx, acquired, '取得作用域');
    const copy = acquiredEffectContext(ctx);
    assert.equal(copy.self, side === 'p1' ? copy.activeP1 : copy.activeP2);
    copy.self.currentHp = 73;
    assert.equal(ctx.self.currentHp, 73);
    assert.equal(reduced[side].currentHp, 73, '直接寫入亦同步reducer');
    assert.equal(copy.self.name, acquired.name); assert.equal(ctx.self.name, owner.name); checks++;
    getSoulMarkRegistry()[acquired.name] = (c: any, event: string) => {
      assert.equal(c.self, side === 'p1' ? c.activeP1 : c.activeP2);
      if (event !== 'ROUND_START') return;
      c.setPlayerState('borrowedPrivate', 7);
      c.setPlayerState('borrowedOnly', true);
      c.setPlayerState('nextElfAllowedTransfer', 2);
    };
    SoulMarkRegistry[ctx.self.name](ctx, 'ROUND_START');
    assert.equal(apis.getPlayerState('borrowedPrivate'), 7);
    apis.setPlayerState('borrowedOnly', true); // 自身後來取得同值，也不能因解除被刪掉。
    endIllusion(ctx);
    assert.equal(apis.getPlayerState('borrowedPrivate'), 9, '原有同名私有值還原');
    assert.equal(apis.getPlayerState('borrowedOnly'), true, '自身後续寫入保留');
    assert.equal(apis.getPlayerState('nextElfAllowedTransfer'), 2, '明文下隻傳遞不能回收'); checks++;
    startIllusion(ctx, acquired, '再次取得作用域');
    const nextCopy = acquiredEffectContext(ctx);
    nextCopy.setPlayerState('borrowedNewGeneration', 8);
    endIllusion(ctx);
    assert.equal(apis.getPlayerState('borrowedNewGeneration'), undefined, '取得私有值不能殘留到下次'); checks++;
    delete getSoulMarkRegistry()[acquired.name];

    // 真實帝皇之盾條件被動：既有護盾符合條件時，弱化是對手，不是持有者。
    startIllusion(ctx, { ...make('5002', 200), name: '帝皇之盾' }, '盾之取得');
    apis.updateElf(side, { shield: 60 });
    const changes: any[] = [];
    ctx.applyStatChange = (s: string, delta: any) => { changes.push({ side: s, delta }); };
    SoulMarkRegistry[ctx.self.name](ctx, 'ROUND_START');
    assert.equal(changes.length, 1); assert.equal(changes[0].side, other);
    assert.equal(changes[0].delta.atk, -1); checks++;
    endIllusion(ctx);

    const evadeSource = { ...make('5006', 200), soulMark: { name: '借用閃避', description: '50%閃避對手所有攻擊技能' } };
    startIllusion(ctx, evadeSource, '常駐閃避查詢');
    assert.equal(soulPassiveEvade(ctx.self, { category: '物理' }), 50);
    assert.equal(soulPassiveEvade(ctx.self, { category: '屬性' }), 0);
    endIllusion(ctx);
    assert.equal(soulPassiveEvade(ctx.self, { category: '物理' }), 0); checks++;

    const fatalSource = { ...make('5004', 200), soulMark: { name: '共享魂印', description: '首次受到致命傷害時：保留1點體力' } };
    apis.setPlayerState('blkOnce:共享魂印:0', true);
    startIllusion(ctx, fatalSource, '致命次數來源');
    apis.updateElf(side, { currentHp: 0 });
    SoulMarkRegistry[ctx.self.name](ctx, 'FATAL_RESIST');
    assert.equal(ctx.self.currentHp, 1, '原魂印同名首次旗標不吞掉取得魂印');
    apis.updateElf(side, { currentHp: 0 });
    SoulMarkRegistry[ctx.self.name](ctx, 'FATAL_RESIST');
    assert.equal(ctx.self.currentHp, 0, '同一取得世代首次不能重複觸發'); checks++;
    endIllusion(ctx);
  }
  assert.equal(errors.length, 0, '正式註冊表錯誤不可被吞掉');
  console.log(`幻化還原／取得效果／真實無為PP／藥劑／視角：${checks}個雙側情境通過。`);
} finally { console.error = originalError; await server.close(); }
