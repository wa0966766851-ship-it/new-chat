// 效能重構護欄（計數式、不量時間，不會因機器快慢而飄）：
// 1) 每項快取／捷徑都有「與原始完整實作逐項相同」的對拍（oracle 為重構前的原始碼）；
// 2) 以計數界線鎖住引擎的熱路徑成本不得回退（提交次數、執行期驗證次數、整份狀態深拷貝次數）。
import assert from 'node:assert/strict';
import { SEEDED_SCENARIOS, createSeededRunner } from './helpers/seededBattle';

const runner = await createSeededRunner();
const { server } = runner;
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
let passed = 0;
const check = async (name: string, run: () => void | Promise<void>) => { await run(); passed++; console.log(`✓ ${name}`); };

// ───────────────────────── 1. 連鎖驗證快取 ─────────────────────────
await check('cachedSequenceIssue：全部內建子句的結果與 sequenceIssue 逐項相同（含節點不符的負例），快取命中後仍相同', async () => {
  const { sequenceIssue } = await server.ssrLoadModule('/src/effects/sequenceContract.ts');
  const { cachedSequenceIssue, sequenceIssueCacheStats } = await server.ssrLoadModule('/src/effects/sequenceIssueCache.ts');
  const rows: [any, string | undefined][] = [];
  for (const e of DEFAULT_ELVES) for (const d of [e.soulMark, e.trait, ...(e.skills || []), ...(e.skillPool || [])]) for (const k of d?.kit || [])
    if (k.codeId === 'effect_sequence' && k.params?.clause) rows.push([k.params.clause, k.node], [k.params.clause, undefined], [k.params.clause, 'no_such_node']);
  assert.ok(rows.length > 1000, `內建子句數量 ${rows.length}`);
  for (let pass = 0; pass < 2; pass++) for (const [clause, node] of rows) assert.equal(cachedSequenceIssue(clause, node), sequenceIssue(clause, node));
  assert.ok(sequenceIssueCacheStats.hits >= rows.length / 2, '第二輪應全數命中');
});
await check('cachedSequenceIssue：以內容為鍵——原地修改子句後不會讀到過期結果；undefined／NaN 與缺漏可區分', async () => {
  const { sequenceIssue } = await server.ssrLoadModule('/src/effects/sequenceContract.ts');
  const { cachedSequenceIssue } = await server.ssrLoadModule('/src/effects/sequenceIssueCache.ts');
  const source = DEFAULT_ELVES.flatMap((e: any) => (e.soulMark?.kit || [])).find((k: any) => k.codeId === 'effect_sequence' && !sequenceIssue(k.params.clause, k.node));
  assert.ok(source);
  const clause = structuredClone(source.params.clause), node = source.node;
  assert.equal(cachedSequenceIssue(clause, node), null);
  clause.trig = '不存在的觸發';                       // 原地改壞
  assert.equal(cachedSequenceIssue(clause, node), sequenceIssue(clause, node));
  assert.notEqual(cachedSequenceIssue(clause, node), null);
  const withUndefinedKey = { ...structuredClone(source.params.clause), extraKey: undefined };
  assert.equal(cachedSequenceIssue(withUndefinedKey, node), sequenceIssue(withUndefinedKey, node), '值為 undefined 的多餘鍵仍須被判為不支援欄位');
  assert.notEqual(cachedSequenceIssue(withUndefinedKey, node), null);
});

// ───────────────────────── 2. 被動連鎖讀取捷徑 ─────────────────────────
await check('readPassiveSoulMechanic：捷徑與原始完整掃描對全部內建精靈（含幻化視角）逐項相同', async () => {
  const { readPassiveSoulMechanic } = await server.ssrLoadModule('/src/battle/finalExtraSoulMechanics.ts');
  const { effectDefinitionEntries } = await server.ssrLoadModule('/src/battle/effectSources.ts');
  const { finalExtraTraitActionIssue } = await server.ssrLoadModule('/src/blocks/ops/finalExtraTraits.ts');
  // 重構前的原始實作（oracle）。
  const reference = (elf: any, op: string) => {
    for (const def of effectDefinitionEntries(elf)) {
      if (def.effectMode !== 'kit') continue;
      for (const e of def.kit || []) {
        if (e.node !== 'passive_always' || e.codeId !== 'effect_sequence' || e.disabled) continue;
        const clause = e.params?.clause; if (!clause?.parsed || clause.trig !== 'passive') continue;
        for (const segment of clause.body || []) {
          if (segment.cond?.length || segment.chain || segment.elseActs?.length) continue;
          const a = segment.acts?.find((a: any) => a.op === op && !finalExtraTraitActionIssue(a.op, a.p));
          if (a) return a.p;
        }
      }
    }
  };
  const ops = new Set<string>(['team_stat_anchor', 'special_attack_panel_formula', 'no_such_op']);
  for (const e of DEFAULT_ELVES) for (const d of [e.soulMark, e.trait, e.alienTraits?.gen2Trait, e.alienTraits?.exclusiveTrait, ...(e.alienTraits?.exclusiveTraits || []), e.alienTraits?.alienTrait, e.alienTraits?.generalTrait])
    for (const k of d?.kit || []) if (k.node === 'passive_always') for (const b of k.params?.clause?.body || []) for (const a of b.acts || []) if (a.op) ops.add(a.op);
  let hits = 0;
  const elves = [...DEFAULT_ELVES];
  for (let i = 0; i < elves.length; i++) {
    const other = elves[(i + 7) % elves.length];
    const illusioned = { ...elves[i], illusion: { target: other, original: { trait: elves[i].trait, alienTraits: elves[i].alienTraits } } };
    for (const elf of [elves[i], illusioned]) for (const op of ops) {
      const got = readPassiveSoulMechanic(elf, op), want = reference(elf, op);
      assert.equal(got, want, `${elf.name}/${op}`);   // 同一個 p 物件（不是複製品）
      if (want) hits++;
    }
  }
  assert.ok(hits > 0, '至少有一組真的讀得到被動連鎖，否則對拍沒有鑑別力');
  // 原地移除條目後須立即讀不到（不得有物件身分快取）。
  const owner = elves.find((e: any) => ['team_stat_anchor', 'special_attack_panel_formula'].some(op => reference(e, op)));
  if (owner) {
    const op = ['team_stat_anchor', 'special_attack_panel_formula'].find(o => reference(owner, o))!;
    const copy = structuredClone(owner);
    assert.ok(readPassiveSoulMechanic(copy, op));
    for (const d of [copy.soulMark, copy.trait, copy.alienTraits?.gen2Trait, copy.alienTraits?.exclusiveTrait, copy.alienTraits?.alienTrait, copy.alienTraits?.generalTrait, ...(copy.alienTraits?.exclusiveTraits || [])]) if (d?.kit) d.kit.length = 0;
    if (copy.kit) copy.kit.length = 0;
    assert.equal(readPassiveSoulMechanic(copy, op), undefined);
  }
});

// ───────────────────────── 3. 登錄表寫入 ─────────────────────────
await check('writeScopedRegistry：與原始實作對拍（隨機寫入序列），相同值寫入沿用原狀態、不同值產生新狀態', async () => {
  const { writeScopedRegistry, battleIdentity, isTeamRegistryKey } = await server.ssrLoadModule('/src/battle/stateScopes.ts');
  const reference = (state: any, side: string, elf: any, patch: Record<string, unknown>) => {
    const flat = { ...state[`${side}RegistryState`] }, bank = { ...state[`${side}ElfState`] }, id = battleIdentity(elf);
    const snapshot = bank[id] || { registry: {}, timers: [] }, registry = { ...snapshot.registry };
    for (const [key, value] of Object.entries(patch)) { if (isTeamRegistryKey(key) || id === battleIdentity(state[side])) flat[key] = value; else registry[key] = value; }
    bank[id] = { ...snapshot, registry };
    return { ...state, [`${side}RegistryState`]: flat, [`${side}ElfState`]: bank };
  };
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const elves = ['a', 'b', 'c'].map(id => ({ id, battleId: id }));
  const keys = ['x', 'y', 'nextElfFoo', 'teamBar', 'previousActiveElfId', 'z'], values = [0, 1, undefined, 'v', null, { k: 1 }];
  let a: any = { p1: elves[0], p1RegistryState: {}, p1ElfState: undefined }, b: any = structuredClone(a), sameCount = 0;
  for (let i = 0; i < 400; i++) {
    const elf = elves[Math.floor(rnd() * 3)], patch: Record<string, unknown> = {};
    for (let n = Math.floor(rnd() * 3); n >= 0; n--) patch[keys[Math.floor(rnd() * keys.length)]] = values[Math.floor(rnd() * values.length)];
    const before = a;
    a = writeScopedRegistry(a, 'p1', elf, patch); b = reference(b, 'p1', elf, patch);
    if (a === before) sameCount++;
    assert.deepStrictEqual(a, b, `第 ${i} 次寫入後狀態不同`);
  }
  assert.ok(sameCount > 20, `應有大量相同值寫入被沿用（${sameCount}）`);
});

// ───────────────────────── 4. 引擎熱路徑計數界線 ─────────────────────────
await check('整場 6v6 重量級戰鬥：提交次數／執行期驗證／深拷貝都在界線內，快取確實命中', async () => {
  const { sequenceIssueCacheStats } = await server.ssrLoadModule('/src/effects/sequenceIssueCache.ts');
  const native = globalThis.structuredClone; let clones = 0;
  (globalThis as any).structuredClone = (v: any, o: any) => { clones++; return native(v, o); };
  const sc = SEEDED_SCENARIOS[0], turns = 12;
  const setupClones = 12; // createSeededRunner 為雙方各 6 隻建立副本
  const before = { ...sequenceIssueCacheStats }; clones = 0;
  try {
    const { commitsPerTurn, result } = await runner.run({ ...sc, turns });
    const total = commitsPerTurn.reduce((x: number, y: number) => x + y, 0);
    assert.equal(result.turnsPlayed, turns);
    // 基準：重構前後每回合平均 32 次、單回合最多 48 次（每次提交＝一批狀態寫入）。允許 +40%／+50% 浮動，回退到多倍才會失敗。
    assert.ok(total / commitsPerTurn.length <= 45, `每回合平均提交 ${(total / commitsPerTurn.length).toFixed(1)} 次，超過界線 45`);
    assert.ok(Math.max(...commitsPerTurn) <= 72, `單回合最多提交 ${Math.max(...commitsPerTurn)} 次，超過界線 72`);
    // 引擎在回合內不得對整份狀態做深拷貝（整份狀態約 500KB，每次約 4ms）：整場最多少數幾次子句／計時器級別的小拷貝。
    assert.ok(clones - setupClones <= turns * 2, `${turns} 回合內 structuredClone ${clones - setupClones} 次，超過界線 ${turns * 2}`);
    const hits = sequenceIssueCacheStats.hits - before.hits, misses = sequenceIssueCacheStats.misses - before.misses;
    // 執行期連鎖驗證：不同子句只驗一次（misses 與回合數無關，上限＝陣容內的相異子句數），其餘全部命中。
    console.log(`   commits/turn avg ${(total / commitsPerTurn.length).toFixed(1)} max ${Math.max(...commitsPerTurn)}; clones ${clones - setupClones}; seqIssue hits ${hits} misses ${misses}`);
    assert.ok(misses <= 150, `連鎖驗證 miss ${misses} 次，應只與相異子句數有關`);
    assert.ok(hits >= misses * 10, `連鎖驗證命中 ${hits}／miss ${misses}，命中率不足`);
  } finally { (globalThis as any).structuredClone = native; }
});

await runner.close();
console.log(`${passed} checks`);
process.exit(0);
