import assert from 'node:assert/strict';
import { DEFAULT_ELVES } from '../src/data/defaultElvesLoaded';
import { SUIT_CATALOG } from '../src/data/suitsAndEyewears';
import * as E from '../src/modes/interstellar/v2/engine';
import { EVENT_BY_ID } from '../src/modes/interstellar/v2/content';
import { encodeRunCode, parseSeedInput, hashSeed, deriveSeed } from '../src/modes/interstellar/v2/seed';
import { N_LEVELS, MAX_N, nEffects, banCap } from '../src/modes/interstellar/v2/levels';
import { SUIT_PERKS, PERK_BUDGET, perkCost, perkText } from '../src/modes/interstellar/v2/suitPerks';

const pool = DEFAULT_ELVES;
type Opts = { seed: number; nLevel?: number; bans?: string[]; equipId?: string };
const start = (o: Opts) => {
  let run = E.createRun({ pool, equipType: 'suit', equipId: o.equipId ?? '', modifiers: [], startingShards: 3, seed: o.seed, nLevel: o.nLevel, bans: o.bans });
  if (run.scene.kind === 'draft') for (const id of run.scene.offer.slice(0, 3)) run = E.toggleDraft(run, id);
  return E.confirmDraft(run, pool);
};
/** 固定策略的完整對局；每一步呼叫 seen(run) 讓測試收集出現過的精靈。stopAfter：只玩前 N 步。 */
function play(o: Opts, opts: { stopAfter?: number; seen?: (r: E.RunV2) => void; roundTripAt?: number; from?: E.RunV2 } = {}) {
  let run = opts.from ?? start(o);
  const trail: string[] = [];
  for (let step = 0; step < 500 && run.scene.kind !== 'end'; step++) {
    if (opts.stopAfter !== undefined && step >= opts.stopAfter) break;
    if (opts.roundTripAt === step) run = JSON.parse(JSON.stringify(run));
    opts.seen?.(run);
    const sc = run.scene; trail.push(sc.kind);
    if (sc.kind === 'map') run = E.moveTo(run, E.movesFrom(run)[0].id, pool);
    else if (sc.kind === 'event') { if (sc.outcome) { run = E.backToMap(run); continue; } const ev = EVENT_BY_ID[sc.eventId]; run = E.chooseEvent(run, ev.choices.findIndex(c => !c.require?.(run)), pool); }
    else if (sc.kind === 'shop') { run = E.shopBuy(run, 0, pool); run = E.shopBuy(run, 3, pool); run = E.backToMap(run); }
    else if (sc.kind === 'rest') run = sc.done ? E.backToMap(run) : E.restAction(run, 'mend');
    else if (sc.kind === 'treasure') run = sc.done ? E.backToMap(run) : E.takeTreasure(run, sc.offer[0]);
    else if (sc.kind === 'altar') run = sc.done ? E.backToMap(run) : E.altarPact(run, 'dark');
    else if (sc.kind === 'recruit') run = E.recruitFromOffer(run, sc.offer[0] ?? null, pool);
    else if (sc.kind === 'prelude') {
      const id = E.battleIdOf(run); const b = E.startBattle(run, pool, id)!; assert.ok(b);
      opts.seen?.(b.run);
      run = E.settleBattleV2(b.run, id, 'p1', b.p1, pool);
    } else if (sc.kind === 'reward') {
      if (sc.reward.relicChoices[0] && !sc.reward.relicTaken) run = E.takeRewardRelic(run, sc.reward.relicChoices[0]);
      if (sc.reward.recruitChoices[0] && !sc.reward.recruitTaken) run = E.takeRewardRecruit(run, sc.reward.recruitChoices[0], pool);
      run = E.leaveReward(run, pool);
    }
  }
  return { run, trail };
}
const idsIn = (r: E.RunV2): string[] => {
  const s = r.scene, out: string[] = [...r.team.map(e => String(e.id))];
  if (s.kind === 'draft') out.push(...s.offer);
  if (s.kind === 'recruit') out.push(...s.offer);
  if (s.kind === 'shop') out.push(...s.stock.filter(i => i.kind === 'elf').map(i => i.ref!));
  if (s.kind === 'reward') out.push(...s.reward.recruitChoices);
  if (s.kind === 'prelude') out.push(...s.encounter.enemies.map(e => e.id));
  if (r.pendingBattle) out.push(...r.pendingBattle.encounter.enemies.map(e => e.id));
  return out;
};

// ── 局碼
{
  const setup = { seed: 123456, nLevel: 7, equipType: 'title' as const, equipId: 'kuangzhanshi', modifiers: ['no_potions', 'weak_body'], bans: ['9', '3'], poolSig: 'abc123' };
  const parsed = parseSeedInput(encodeRunCode(setup));
  assert.equal(parsed?.kind, 'code');
  assert.deepEqual(parsed && parsed.kind === 'code' ? parsed.setup : null, { ...setup, modifiers: ['no_potions', 'weak_body'].sort(), bans: ['3', '9'] }, '局碼往返不失真');
  assert.equal(parseSeedInput('ECL1.@@@'), null, '壞局碼不被接受');
  assert.equal(parseSeedInput('  '), null);
  assert.deepEqual(parseSeedInput('42'), { kind: 'seed', seed: 42 });
  assert.equal((parseSeedInput('星蝕') as any).seed, hashSeed('星蝕'), '文字種子穩定雜湊');
  assert.notEqual(hashSeed('a'), hashSeed('b'));
  assert.equal(deriveSeed(5, 'battle', 1), deriveSeed(5, 'battle', 1)); assert.notEqual(deriveSeed(5, 'battle', 1), deriveSeed(5, 'battle', 2));
  const run = start({ seed: 77, nLevel: 4 });
  const again = parseSeedInput(E.runCodeOf(run)) as any;
  assert.equal(again.setup.seed, 77); assert.equal(again.setup.nLevel, 4); assert.equal(again.setup.poolSig, E.poolSigOf(pool));
}

// ── 種子：同種子同操作完全相同；不同種子不同；存讀檔後續一致
{
  const a = play({ seed: 4242 }), b = play({ seed: 4242 }), c = play({ seed: 4243 });
  assert.equal(JSON.stringify(a.run), JSON.stringify(b.run), '同種子同操作：整局狀態逐字相同（地圖、敵人、獎勵、商店、事件）');
  assert.notEqual(JSON.stringify(a.run.map), JSON.stringify(c.run.map), '不同種子不同局');
  assert.equal(a.run.scene.kind, 'end');
  const r1 = start({ seed: 4242 }), r2 = start({ seed: 4242 }), r3 = start({ seed: 4243 });
  assert.equal(JSON.stringify(r1.map), JSON.stringify(r2.map)); assert.notEqual(JSON.stringify(r1.map), JSON.stringify(r3.map));
  assert.deepEqual(r1.team.map(e => e.id), r2.team.map(e => e.id));
  // 存讀檔後續一致：每個階段點做一次 JSON 往返，結果與不中斷相同
  for (const at of [3, 25, 90]) {
    const rt = play({ seed: 4242 }, { roundTripAt: at });
    assert.equal(JSON.stringify(rt.run), JSON.stringify(a.run), `第 ${at} 步存讀檔後與不中斷的結果相同`);
  }
  // 實際走 localStorage 的存讀
  const store = new Map<string, string>(); const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
  const mid = play({ seed: 4242 }, { stopAfter: 40 }).run; E.saveRunV2(storage, mid);
  const loaded = E.loadRunV2(storage)!; const resumed = play({ seed: 4242 }, { from: loaded });
  assert.equal(JSON.stringify({ ...resumed.run, revision: 0 }), JSON.stringify({ ...a.run, revision: 0 }), '從存檔接續與一路玩到底相同');
  // 戰鬥亂數種子
  const p1 = (() => { let r = start({ seed: 4242 }); while (r.scene.kind !== 'prelude') { r = r.scene.kind === 'map' ? E.moveTo(r, E.movesFrom(r)[0].id, pool) : play({ seed: 4242 }, { from: r, stopAfter: 1 }).run; } return r; })();
  const q = E.startBattle(p1, pool, E.battleIdOf(p1))!;
  assert.equal(q.battleSeed, E.battleSeedOf(p1)); assert.equal(q.run.pendingBattle?.battleSeed, q.battleSeed);
  assert.equal(E.startBattle(p1, pool, E.battleIdOf(p1))!.battleSeed, q.battleSeed, '同進度同戰鬥種子');
  assert.notEqual(E.battleSeedOf({ ...p1, seed: p1.seed + 1 }), q.battleSeed, '不同局種子→不同戰鬥種子');
}

// ── 禁用：禁用者不出現在任何池
{
  const seen = new Set<string>();
  const base = play({ seed: 909 }, { seen: r => idsIn(r).forEach(x => seen.add(x)) });
  const draft = (start({ seed: 909 }).team).map(e => String(e.id));
  assert.ok(seen.size > 20 && draft.length === 3);
  const known = new Set(E.bannablePool(pool).map(e => String(e.id)));
  const bans = [...seen].filter(id => known.has(id)).slice(0, 6);
  assert.equal(bans.length, 6);
  const appeared = new Set<string>();
  const banned = play({ seed: 909, bans }, { seen: r => idsIn(r).forEach(x => appeared.add(x)) });
  assert.deepEqual(banned.run.bans, bans);
  assert.ok(banned.run.scene.kind === 'end' || banned.run.stats.steps > 20, '禁用後仍可正常推進');
  for (const id of bans) assert.ok(!appeared.has(id), `被禁用的 ${id} 不得出現在選秀、招募、商店、獎勵、敵方`);
  // 逐一禁用同一種子的所有已出現者：池縮小仍可通關（更嚴苛）
  const heavy = [...seen].filter(id => known.has(id)).slice(0, 6);
  for (const seed of [11, 12, 13]) {
    const ap = new Set<string>(); const g = play({ seed, bans: heavy }, { seen: r => idsIn(r).forEach(x => ap.add(x)) });
    assert.ok(g.run.stats.steps > 20); for (const id of heavy) assert.ok(!ap.has(id), `seed ${seed} 禁用 ${id}`);
  }
  // 禁用名額隨 N 等級減少；超額截斷；不存在者忽略
  assert.deepEqual([0, 2, 3, 6, 9, 12, 15, 17, 18].map(banCap), [6, 6, 5, 4, 3, 2, 1, 1, 0]);
  const over = E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: [], startingShards: 3, seed: 5, nLevel: 15, bans: [...bans, 'nope'] });
  assert.deepEqual(over.bans, bans.slice(0, 1), 'N15 只能禁 1 隻，不存在的 id 被忽略');
  assert.deepEqual(E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: [], startingShards: 3, seed: 5, nLevel: 18, bans }).bans, []);
  // 舊存檔（沒有 nLevel／bans）讀入視為 N0、無禁用
  const old = JSON.parse(JSON.stringify(start({ seed: 3 }))); delete old.nLevel; delete old.bans; delete old.poolSig;
  const store = { getItem: () => JSON.stringify(old) }; const loaded = E.loadRunV2(store)!;
  assert.equal(loaded.nLevel, 0); assert.deepEqual(loaded.bans, []);
  assert.equal(E.levelOf(loaded).enemyStat, 0);
  const moved = E.moveTo(loaded, E.movesFrom(loaded)[0].id, pool); assert.ok(moved.stats.steps === 1, '舊存檔可繼續遊玩');
}

// ── N0–N18
{
  assert.equal(N_LEVELS.length, MAX_N); N_LEVELS.forEach((l, i) => { assert.equal(l.n, i + 1); assert.ok(l.text.length > 0); });
  const n0 = nEffects(0); assert.equal(n0.enemyStat, 0); assert.equal(n0.shopMult, 1); assert.equal(n0.startBeans, 0); assert.equal(n0.noRevive, false);
  for (let n = 1; n <= MAX_N; n++) {
    const a = nEffects(n - 1), b = nEffects(n);
    assert.ok(b.enemyStat >= a.enemyStat && b.enemyHp >= a.enemyHp && b.startBeans <= a.startBeans && b.startShards <= a.startShards && b.startPotions <= a.startPotions
      && b.lineupSlots <= a.lineupSlots && b.benchSlots <= a.benchSlots && b.shopMult >= a.shopMult && b.restHealMult <= a.restHealMult && b.eclipsePerMove >= a.eclipsePerMove
      && b.affixBonus >= a.affixBonus && b.rewardChoice <= a.rewardChoice, `N${n} 不得比 N${n - 1} 輕鬆`);
    assert.notDeepEqual(a, b, `N${n} 必須有實際效果`);
  }
  const top = nEffects(18);
  assert.ok(Math.abs(top.enemyStat - .25) < 1e-9 && Math.abs(top.enemyHp - .45) < 1e-9 && top.perksOff && top.startCurse && top.noRevive && top.lineupSlots === -1 && top.benchSlots === -1);
  // 開局差異：N18 資源較少、被詛咒纏身、敵方更強
  const r0 = E.createRun({ pool, equipType: 'suit', equipId: 'dark_angel', modifiers: [], startingShards: 4, seed: 31, nLevel: 0 });
  const r18 = E.createRun({ pool, equipType: 'suit', equipId: 'dark_angel', modifiers: [], startingShards: 4, seed: 31, nLevel: 18 });
  assert.equal(r0.beans, 120 + 60); assert.equal(r0.potions, 3); assert.equal(r0.shards, 4, '星晶保留為貨幣'); assert.equal(r0.tokens.length, 1, '暗影系令隨套裝附贈'); assert.equal(r18.shards, 3, 'N5 起起始星晶 −1'); assert.equal(r18.tokens.length, 0, 'N18 特權失效');
  assert.equal(r18.beans, 120 - 20); assert.equal(E.anyTokenCount(r18), 0); assert.equal(r18.potions, 2, 'N18：套裝特權失效且起始藥劑 −1');
  assert.ok(r18.relics.some(id => id.startsWith('curse_')), 'N17+ 開局帶詛咒');
  const reach = (n: number) => { let r = start({ seed: 8, nLevel: n }); r = { ...r, scene: { kind: 'map' } as any }; while (r.scene.kind !== 'prelude') { r = r.scene.kind === 'map' ? E.moveTo(r, (E.movesFrom(r).find(m => m.kind === 'combat') ?? E.movesFrom(r)[0]).id, pool) : play({ seed: 8, nLevel: n }, { from: r, stopAfter: 1 }).run; } return (r.scene as any).encounter as E.Encounter; };
  const e0 = reach(0), e18 = reach(18);
  assert.ok(e18.scale > e0.scale && (e18.hpScale ?? 0) > (e0.hpScale ?? 0), 'N18 敵方倍率較高');
  const m0 = E.mods(start({ seed: 8, nLevel: 0 })), m14 = E.mods(start({ seed: 8, nLevel: 14 }));
  assert.ok(m14.restHealMult < m0.restHealMult && m14.shopMult > m0.shopMult);
  const s15 = start({ seed: 8, nLevel: 15 }); assert.equal(E.lineupSlots(s15), 2); assert.equal(E.lineupSlots(start({ seed: 8, nLevel: 14 })), 3);
  assert.equal(E.lineupOf(s15).length + E.benchOf(s15).length, 3, 'N15 出戰 2 隻＋待命 1 隻，三位持燈者都在背包');
}

// ── 套裝特權
{
  const ids = Object.keys(SUIT_CATALOG);
  for (const id of ids) {
    const p = SUIT_PERKS[id]; assert.ok(p, `${id} 缺少回廊特權`);
    assert.ok(perkText(p.perk).length > 0); assert.ok(perkCost(p.perk) <= PERK_BUDGET[p.tier] + 1e-9, `${id} 超出 ${p.tier} 預算 ${perkCost(p.perk)}`);
    assert.ok(perkCost(p.perk) >= PERK_BUDGET[p.tier] - 0.76, `${id} 特權過弱`);
  }
  for (const id of Object.keys(SUIT_PERKS)) assert.ok(SUIT_CATALOG[id], `${id} 不是已知套裝`);
  const mk = (id: string) => E.createRun({ pool, equipType: 'suit', equipId: id, modifiers: [], startingShards: 3, seed: 1 });
  assert.equal(E.anyTokenCount(mk('eternal_starlight')), 1); assert.equal(mk('eternal_starlight').shards, 3); assert.equal(mk('shadow_judgment').potions, 4);
  assert.equal(E.mods(mk('venom_armor')).shopMult, .9); assert.equal(E.mods(mk('future_armor')).revealMystery, true);
  assert.equal(E.mods(mk('morning_star')).eclipsePerMove, -1); assert.equal(E.anyTokenCount(mk('')), 0, '無套裝無令'); assert.equal(mk('').shards, 3, '無套裝無加成');
}

// ── 背包與倉庫
{
  let r = start({ seed: 5 });
  const extra = pool.slice(20, 28).map((e, i) => ({ ...e, battleId: `x${i}`, currentHp: e.maxHp }));
  r = { ...r, scene: { kind: 'map' } as any, team: [...r.team, ...extra] };
  assert.equal(E.bagLists(r).bench.length, 0); for (const id of E.bagLists(r).storage.slice(0, 3)) r = E.moveBagMember(r, id, 'bench');
  const L0 = E.bagLists(r); assert.equal(L0.lineup.length, 3); assert.equal(L0.bench.length, 3); assert.equal(L0.storage.length, 5);
  const pr: E.RunV2 = { ...r, scene: { kind: 'prelude', encounter: { kind: 'combat', title: 't', enemies: [], scale: 1 } } as any };
  // 倉庫成員與出戰成員直接互換（迎戰前也可）
  const stored = L0.storage[0], starter = L0.lineup[0];
  const sw = E.swapBagMembers(pr, stored, starter);
  assert.equal(E.bagLists(sw).lineup[0], stored); assert.ok(E.bagLists(sw).storage.includes(starter), '被換下的進倉庫');
  // 倉庫取出到待命末端（待命滿 → 不動）；待命→倉庫
  assert.equal(E.moveBagMember(r, stored, 'bench'), r, '待命已滿不可再放');
  const out = E.moveBagMember(r, L0.bench[0], 'storage'); assert.equal(E.bagLists(out).bench.length, 2);
  assert.equal(E.bagLists(E.moveBagMember(out, stored, 'bench')).bench.length, 3);
  // 同區互換
  const re = E.moveBagMember(r, L0.lineup[0], 'lineup', 2); assert.deepEqual(E.bagLists(re).lineup, [L0.lineup[2], L0.lineup[1], L0.lineup[0]]);
  // 出戰至少 1 人、陣亡者不可上場
  let one = r; for (const id of L0.lineup.slice(1)) one = E.moveBagMember(one, id, 'storage'); assert.equal(E.bagLists(one).lineup.length, 1);
  assert.equal(E.moveBagMember(one, E.bagLists(one).lineup[0], 'storage'), one, '最後一名不可離開出戰');
  const dead = { ...r, team: r.team.map(e => e.battleId === stored ? { ...e, currentHp: 0 } : e) };
  assert.equal(E.swapBagMembers(dead, stored, L0.lineup[0]), dead, '陣亡者不可上場');
  assert.notEqual(E.swapBagMembers(dead, stored, L0.bench[0]), dead, '陣亡者可以在待命與倉庫之間移動');
  // 戰鬥結算中、選秀中不可整理
  const fighting = { ...pr, pendingBattle: { id: 'x', nodeId: null, encounter: (pr.scene as any).encounter } } as E.RunV2;
  assert.equal(E.moveBagMember(fighting, stored, 'bench'), fighting); assert.equal(E.swapBagMembers(fighting, stored, starter), fighting);
  const drafting = { ...r, scene: { kind: 'draft', offer: [], picks: [] } } as E.RunV2; assert.equal(E.swapBagMembers(drafting, stored, starter), drafting);
  // 整排對調與待命全收
  const sl = E.swapLineupBench(r); assert.deepEqual(E.bagLists(sl).lineup, L0.bench); assert.deepEqual(E.bagLists(sl).bench, L0.lineup);
  assert.equal(E.bagLists(E.stashBench(r)).bench.length, 0); assert.equal(E.bagLists(E.stashBench(r)).storage.length, 8);
  // 星爐只修復背包，倉庫不受影響（原規則維持）
  const hurt = { ...r, team: r.team.map(e => ({ ...e, currentHp: 1 })), scene: { kind: 'rest' } as any } as E.RunV2;
  const healed = E.restAction(hurt, 'mend'); const st = new Set(E.bagLists(hurt).storage);
  assert.ok(healed.team.every(e => st.has(E.bagIdOf(e)) ? e.currentHp === 1 : e.currentHp > 1));
}
console.log('星蝕回廊：局碼、種子重現、禁用名單、N0–N18、套裝特權、背包倉庫通過');
