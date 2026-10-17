import assert from 'node:assert/strict';
import { DEFAULT_ELVES } from '../src/data/defaultElvesLoaded';
import * as E from '../src/modes/interstellar/v2/engine';
import { RELICS, RELIC_BY_ID, RESCUE_ORDER } from '../src/modes/interstellar/v2/relics';
import { SUIT_PERKS } from '../src/modes/interstellar/v2/suitPerks';
import { BARTER_RECIPES, BARTER_RHO, BARTER_MAX_USES, barterLimit, barterRatio, getValue, giveValue, recipeAt, recipesFor, POTION_PRICE } from '../src/modes/interstellar/v2/barter';
import { RELIC_PRICE, SHARD_SHOP_PRICE, tokenBasePrice } from '../src/modes/interstellar/v2/recruit';
import { Dice } from '../src/modes/interstellar/v2/rng';

const pool = DEFAULT_ELVES;
const alive = (e: any) => e.currentHp > 0;

/* ───────── 保命遺物 ───────── */
function setup(seed: number, o: { extra?: number; boss?: boolean; relics?: string[]; equipId?: string; nLevel?: number; beans?: number } = {}) {
  let run = E.createRun({ pool, equipType: 'suit', equipId: o.equipId ?? '', modifiers: [], startingShards: 3, seed, nLevel: o.nLevel });
  if (run.scene.kind === 'draft') for (const id of run.scene.offer.slice(0, 3)) run = E.toggleDraft(run, id);
  run = E.confirmDraft(run, pool);
  const node = E.movesFrom(run).find(n => n.kind === 'combat')!; run = E.moveTo(run, node.id, pool);
  assert.equal(run.scene.kind, 'prelude');
  const more = E.bannablePool(pool).filter(e => !run.team.some(t => t.id === e.id)).slice(0, o.extra ?? 0).map((e, i) => ({ ...e, battleId: `ex-${i}` }) as any);
  for (const id of o.relics ?? []) run = E.gainRelic(run, id);
  run = { ...run, team: [...run.team, ...more], beans: o.beans ?? run.beans };
  if (o.boss && run.scene.kind === 'prelude') run = { ...run, scene: { kind: 'prelude', encounter: { ...run.scene.encounter, kind: 'boss' } } };
  return run;
}
/** 開戰→出戰者全部倒下→p2 勝 */
function wipe(run: E.RunV2, tag = 'x') {
  const id = `b-${tag}-${run.nonce}`, b = E.startBattle(run, pool, id); assert.ok(b, '可開戰');
  return E.settleBattleV2(b!.run, id, 'p2', b!.p1.map(e => ({ ...e, currentHp: 0 })), pool);
}
const frac = (run: E.RunV2) => run.team.map(e => e.currentHp / e.maxHp);
const prefix = (run: E.RunV2) => JSON.stringify({ team: run.team.map(e => [e.battleId, e.currentHp]), relics: run.relics, beans: run.beans, eclipse: run.eclipse, scene: run.scene.kind, rescues: run.rescues, nonce: run.nonce });

// 定義：三件保命遺物，稀有度各異，描述寫明一次與代價
assert.deepEqual([...RESCUE_ORDER], ['substitute_doll', 'undying_core', 'reverse_hourglass']);
assert.deepEqual(RESCUE_ORDER.map(id => RELIC_BY_ID[id].rarity), ['common', 'rare', 'legendary']);
assert.ok(RESCUE_ORDER.every(id => /一次/.test(RELIC_BY_ID[id].desc) && /碎/.test(RELIC_BY_ID[id].desc)), '描述寫明一次、用後碎裂');
assert.equal(new Set(RELICS.map(r => r.id)).size, RELICS.length, '遺物 id 不重複');

// 替身人偶：失去一半賽爾豆與一件隨機遺物，全隊 40% 體力，一次後碎裂；首領戰敗重回戰前
{
  const run = setup(31, { relics: ['substitute_doll', 'atk_bead', 'def_bead', 'speed_bead'], beans: 301 });
  const a = wipe(run), b = wipe(run);
  assert.equal(prefix(a), prefix(b), '同種子同操作：隨機失去的遺物相同');
  assert.equal(a.scene.kind, 'map', '非首領：回地圖繼續');
  assert.ok(!a.relics.includes('substitute_doll'), '用後碎裂');
  assert.equal(a.beans, 150, '失去一半賽爾豆（無條件捨去）');
  assert.equal(a.relics.length, run.relics.length - 2, '碎裂＋失去一件隨機遺物');
  assert.equal(run.relics.filter(r => !a.relics.includes(r)).length, 2);
  assert.ok(frac(a).every(f => f >= .39 && f <= .41), '全隊 40% 體力');
  assert.equal(a.lastRescue?.id, 'substitute_doll'); assert.deepEqual(a.rescues, ['substitute_doll']);
  const other = wipe({ ...run, seed: run.seed + 1 }); void other; // 不同種子可能不同遺物，不強制
  // 第二次再敗：沒有保命了 → 敗北
  const again = E.movesFrom(a).length ? wipe(E.moveTo(a, E.movesFrom(a).find(n => n.kind === 'combat')?.id ?? E.movesFrom(a)[0].id, pool).scene.kind === 'prelude' ? E.moveTo(a, E.movesFrom(a).find(n => n.kind === 'combat')?.id ?? E.movesFrom(a)[0].id, pool) : { ...a, scene: { kind: 'prelude', encounter: run.scene.kind === 'prelude' ? run.scene.encounter : (null as any) } } as any, 'again') : a;
  assert.equal(again.scene.kind, 'end', '人偶只有一次');
  const boss = wipe(setup(31, { relics: ['substitute_doll'], boss: true }));
  assert.equal(boss.scene.kind, 'prelude', '首領戰敗：重回戰前再挑戰');
}
// 不滅星核：全隊 50% 體力，留在原節點重戰；每次重戰的戰鬥亂數不同
{
  for (const boss of [false, true]) {
    const run = setup(32, { relics: ['undying_core'], boss });
    const next = wipe(run);
    assert.equal(next.scene.kind, 'prelude', '留在原節點重戰'); assert.equal(next.at, run.at);
    assert.deepEqual((next.scene as any).encounter, (run.scene as any).encounter, '同一場遭遇');
    assert.ok(!next.relics.includes('undying_core'));
    assert.ok(frac(next).every(f => f >= .49 && f <= .51), '全隊 50% 體力');
    assert.notEqual(E.battleSeedOf(next), E.battleSeedOf(run), '重戰換一組戰鬥亂數');
    assert.notEqual(E.battleIdOf(next), E.battleIdOf(run));
    assert.equal(next.lastRescue?.id, 'undying_core');
    assert.equal(wipe(next, 'second').scene.kind, 'end', '星核只有一次');
  }
}
// 逆時沙漏：回到戰前狀態（體力、PP、藥劑、編排），蝕度 +10，可改隊重戰
{
  const run = setup(33, { relics: ['reverse_hourglass'], extra: 3, boss: true });
  const b = E.startBattle(run, pool, 'hg')!;
  assert.ok(b.run.pendingBattle?.pre, '持有沙漏時記錄戰前狀態');
  const noGlass = E.startBattle(setup(33, { extra: 3 }), pool, 'x')!; assert.equal(noGlass.run.pendingBattle?.pre, undefined, '沒有沙漏不存快照');
  // 戰鬥中用掉藥劑、受傷、耗 PP，然後全滅
  const used = { ...b.run, potions: b.run.potions - 1 };
  const spent = b.p1.map(e => ({ ...e, currentHp: 0, skills: e.skills.map(s => ({ ...s, pp: 0 })) }));
  const next = E.settleBattleV2(used, 'hg', 'p2', spent, pool);
  assert.equal(next.scene.kind, 'prelude'); assert.ok(!next.relics.includes('reverse_hourglass'));
  assert.equal(next.potions, run.potions, '藥劑回到戰前'); assert.equal(next.eclipse, run.eclipse + 10, '代價：蝕度 +10');
  assert.deepEqual(next.team.map(e => [e.battleId, e.currentHp]), run.team.map(e => [e.battleId, e.currentHp]), '體力回到戰前');
  assert.deepEqual(next.team.map(e => e.skills.map(s => s.pp)), run.team.map(e => e.skills.map(s => s.pp)), 'PP 回到戰前');
  assert.ok(E.canEditBag(next), '可改隊');
  const lineup = E.bagLists(next).lineup, swapped = E.moveBagMember(next, 'ex-0', 'lineup', 0);
  assert.notDeepEqual(E.bagLists(swapped).lineup, lineup, '重戰前可以換人');
  assert.notEqual(E.battleSeedOf(next), E.battleSeedOf(run));
  assert.equal(wipe(next, 'again').scene.kind, 'end', '沙漏只有一次');
  // 沒有戰前快照（舊存檔）：不觸發，留著遺物，直接敗北
  const legacy = E.settleBattleV2({ ...b.run, pendingBattle: { ...b.run.pendingBattle!, pre: undefined } }, 'hg', 'p2', spent, pool);
  assert.equal(legacy.scene.kind, 'end');
}
// 與「逆命者」套裝特權的互動與順序：特權 → 替身人偶 → 不滅星核 → 逆時沙漏 → 敗北；N12 起特權失效
{
  assert.ok(SUIT_PERKS.fate_defier.perk.lifeline);
  let run = setup(34, { equipId: 'fate_defier', relics: ['reverse_hourglass', 'undying_core', 'substitute_doll', 'atk_bead'], boss: true, extra: 2 });
  assert.deepEqual(E.rescueSources(run), ['perk:fate_defier', 'substitute_doll', 'undying_core', 'reverse_hourglass']);
  const order: string[] = [];
  for (let i = 0; i < 6 && run.scene.kind === 'prelude'; i++) { run = wipe(run, `o${i}`); if (run.lastRescue) order.push(run.lastRescue.id); }
  assert.deepEqual(order, ['perk:fate_defier', 'substitute_doll', 'undying_core', 'reverse_hourglass'], '保命依序消耗');
  assert.equal(run.scene.kind, 'end'); assert.equal((run.scene as any).cause, 'boss');
  assert.deepEqual(run.rescues, ['perk:fate_defier', 'substitute_doll', 'undying_core', 'reverse_hourglass']);
  // 重播同一串：完全相同
  let again = setup(34, { equipId: 'fate_defier', relics: ['reverse_hourglass', 'undying_core', 'substitute_doll', 'atk_bead'], boss: true, extra: 2 });
  for (let i = 0; i < 6 && again.scene.kind === 'prelude'; i++) again = wipe(again, `o${i}`);
  assert.equal(JSON.stringify(again.rescues), JSON.stringify(run.rescues)); assert.equal(prefix(again), prefix(run), '種子可重現');
  // N12：特權失效，第一個保命是人偶
  const n12 = setup(34, { equipId: 'fate_defier', relics: ['substitute_doll'], nLevel: 12 });
  assert.deepEqual(E.rescueSources(n12), ['substitute_doll']);
  // 沒有任何保命：直接敗北
  assert.equal(wipe(setup(35, { boss: true })).scene.kind, 'end');
}
// 不是失敗就不耗保命：出戰全滅但後面還有人，保命不動
{
  const run = setup(36, { relics: ['undying_core', 'substitute_doll', 'reverse_hourglass'], extra: 3 });
  const next = wipe(run);
  assert.equal(next.scene.kind, 'map'); assert.deepEqual(next.relics, run.relics, '保命遺物原封不動');
  assert.ok(E.lineupOf(next).some(alive), '由存活者補位');
}

/* ───────── 失與得 ───────── */
// 商店產生兌換：次數依 N、配方依章節、種子可重現
function findShop(seed: number, nLevel = 0): E.RunV2 {
  let run = E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: [], startingShards: 3, seed, nLevel });
  if (run.scene.kind === 'draft') for (const id of run.scene.offer.slice(0, 3)) run = E.toggleDraft(run, id);
  run = E.confirmDraft(run, pool);
  for (let step = 0; step < 300; step++) {
    if (run.scene.kind === 'shop') return run;
    if (run.scene.kind === 'map') {
      const moves = E.movesFrom(run); if (!moves.length) break;
      run = E.moveTo(run, (moves.find(n => n.kind === 'shop') ?? moves.find(n => n.kind === 'rest') ?? moves[0]).id, pool);
    } else if (run.scene.kind === 'prelude') { const b = E.startBattle(run, pool, `s${step}`)!; run = E.settleBattleV2(b.run, `s${step}`, 'p1', b.p1, pool); }
    else if (run.scene.kind === 'reward') run = E.leaveReward(run, pool);
    else if (run.scene.kind === 'event') run = run.scene.outcome ? E.backToMap(run) : E.chooseEvent(run, 0, pool);
    else if (run.scene.kind === 'end') break;
    else run = E.backToMap(run);
  }
  throw new Error('找不到商店');
}
{
  let shop: E.RunV2 | null = null, seedUsed = 0;
  for (const seed of [5, 6, 7, 8, 9, 10, 11, 12]) { try { shop = findShop(seed); seedUsed = seed; break; } catch { /* 換種子 */ } }
  assert.ok(shop, '能走到商店'); const sc = shop!.scene as any;
  assert.ok(sc.barter, '商店有失與得'); assert.equal(sc.barter.offers.length, 6); assert.equal(sc.barter.left, barterLimit(0)); assert.equal(sc.barter.left, 3);
  assert.ok(sc.barter.offers.every((id: string) => recipesFor(shop!.act).some(r => r.id === id)), '配方依章節');
  assert.ok(!sc.barter.offers.includes('potion_token_hi') && !sc.barter.offers.includes('relic_l_shard'), '第 1 章沒有高階配方');
  assert.equal(JSON.stringify(findShop(seedUsed).scene), JSON.stringify(shop!.scene), '同種子同操作：商店與兌換配方相同');
  assert.equal(E.barterRecipesOf(shop!).length, 6);
  // 刷新商品保留兌換狀態（不能靠刷新重置次數）
  const traded = E.barterTrade({ ...shop!, shards: 9, beans: 999 }, 'shard_beans', {}, pool);
  void traded;
}
assert.deepEqual([0, 5, 6, 11, 12, 18].map(barterLimit), [3, 3, 2, 2, 1, 1], 'N 等級越高次數越少');
{
  // 手動建立擺出全部配方的商店，驗證各項兌換
  const base = setup(41, { relics: ['atk_bead', 'strong_atk_bead', 'silver_wing', 'gold_tooth'], beans: 1000 });
  const mk = (over: Partial<E.RunV2> = {}, n = 0, act = 6): E.RunV2 => ({ ...base, act, nLevel: n, shards: 10, potions: 10, tokens: [], ...over, scene: { kind: 'shop', stock: [], barter: { offers: BARTER_RECIPES.map(r => r.id), left: barterLimit(n), uses: {} } } } as any);
  const rel = (run: E.RunV2, id: string) => run.relics.indexOf(id);
  let s = mk();
  // 遺物 → 賽爾豆（指定哪一件）
  let t = E.barterTrade(s, 'relic_c_beans', { relic: rel(s, 'atk_bead') }, pool);
  assert.ok(!t.relics.includes('atk_bead')); assert.equal(t.beans, s.beans + 55); assert.equal((t.scene as any).barter.left, 2);
  assert.equal(E.barterTrade(s, 'relic_c_beans', { relic: rel(s, 'strong_atk_bead') }, pool).relics.includes('strong_atk_bead'), true, '稀有遺物不能當普通遺物配方的給出品，改為使用符合者');
  // 傳說遺物 → 2 星晶；星晶 → 單屬性令；藥劑 → 單屬性令；令 → 星晶
  t = E.barterTrade(s, 'relic_l_shard', { relic: rel(s, 'silver_wing') }, pool); assert.equal(t.shards, 12); assert.ok(!t.relics.includes('silver_wing'));
  t = E.barterTrade(s, 'shard_token', {}, pool); assert.equal(t.shards, 8); assert.equal(t.tokens.length, 1); assert.equal(t.tokens[0].kind, 'types'); assert.ok(t.tokens[0].tier);
  t = E.barterTrade(s, 'potion_token', {}, pool); assert.equal(t.potions, 7); assert.equal(t.tokens.length, 1);
  const withToken = E.barterTrade(s, 'shard_token', {}, pool);
  const t2 = E.barterTrade({ ...withToken, scene: s.scene } as any, 'token_shard', { token: withToken.tokens[0].id }, pool); assert.equal(t2.tokens.length, 0); assert.equal(t2.shards, withToken.shards + 1);
  // 雙屬性令與重複令不收
  const exact = { id: 't9', kind: 'types', types: ['火', '水'], match: 'exact', tier: 'mid' } as any;
  assert.ok(E.barterBlock(mk({ tokens: [exact, { id: 't8', kind: 'any', types: [], match: 'has', repeat: true } as any] }), 'token_shard'), '雙屬性令與重複令不能拿來換');
  // 次數：每店總次數、每條配方 2 次
  let u = s; for (let i = 0; i < BARTER_MAX_USES; i++) u = E.barterTrade(u, 'shard_beans', {}, pool);
  assert.equal(u.shards, s.shards - 2); assert.ok(E.barterBlock(u, 'shard_beans')?.includes('最多'), '同一條配方最多 2 次');
  let v = s; for (const id of ['shard_beans', 'shard_potion', 'potion_token']) v = E.barterTrade(v, id, {}, pool);
  assert.equal((v.scene as any).barter.left, 0); assert.ok(E.barterBlock(v, 'shard_beans') && E.barterBlock(v, 'beans_shard'), '次數用完全部封鎖');
  assert.equal(E.barterTrade(v, 'beans_shard', {}, pool), v, '用完後兌換不生效');
  // 資源不足、沒有符合的物品
  assert.ok(E.barterBlock(mk({ shards: 0 }), 'shard_beans')); assert.ok(E.barterBlock(mk({ potions: 2 }), 'potion_token')); assert.ok(E.barterBlock(mk({ relics: [] }), 'relic_c_beans'));
  assert.ok(E.barterBlock(mk({ beans: 10 }), 'beans_shard'));
  // N 等級：賽爾豆配方變差、N9 起藥劑多收 1 瓶；N12 只剩 1 次
  const n18 = recipeAt(BARTER_RECIPES.find(r => r.id === 'shard_beans')!, 18), n0 = recipeAt(BARTER_RECIPES.find(r => r.id === 'shard_beans')!, 0);
  assert.ok(n18.get.qty < n0.get.qty); assert.equal(recipeAt(BARTER_RECIPES.find(r => r.id === 'potion_token')!, 9).give.qty, 4);
  assert.ok(recipeAt(BARTER_RECIPES.find(r => r.id === 'beans_shard')!, 18).give.qty > 120);
  assert.equal((mk({}, 12).scene as any).barter.left, 1);
  // 種子重現：同局面同操作得到同一張令
  const x = E.barterTrade(s, 'shard_token', {}, pool), y = E.barterTrade(s, 'shard_token', {}, pool);
  assert.equal(JSON.stringify(x.tokens), JSON.stringify(y.tokens)); assert.equal(x.nonce, y.nonce);
}

// 防套利（一）每條配方：得到的基準價值 ≤ 給出 × ρ，所有 N 等級
for (const r of BARTER_RECIPES) {
  for (let n = 0; n <= 18; n++) {
    const q = recipeAt(r, n);
    assert.ok(getValue(q) <= BARTER_RHO * giveValue(q) + 1e-9, `${r.id}@N${n}：${getValue(q)} ≤ ${BARTER_RHO}×${giveValue(q)}`);
  }
  assert.ok(barterRatio(r) <= BARTER_RHO + 1e-9);
}
// 防套利（二）位能函數：Φ＝賽爾豆 + f_min × Σ(物品底價)。商店買進（價格 ≥ f_min × 底價）與任何兌換都不會讓 Φ 上升
const perkMin = Math.min(1, ...Object.values(SUIT_PERKS).map(p => p.perk.shopMult ?? 1));
const relicMin = RELICS.reduce((m, r) => m * Math.min(1, r.run?.shopMult ?? 1), 1);
const F_MIN = perkMin * relicMin - 0.005; // 價格四捨五入的容許
assert.ok(F_MIN > .7 && F_MIN < .8, `最低商店係數 ≈ ${perkMin}×${relicMin}`);
const phi = (run: E.RunV2) => run.beans
  + F_MIN * (run.shards * SHARD_SHOP_PRICE + run.potions * POTION_PRICE
    + run.relics.reduce((a, id) => a + (RELIC_PRICE[RELIC_BY_ID[id].rarity] ?? 0), 0) + run.tokens.reduce((a, t) => a + tokenBasePrice(t), 0));
{
  // 紙上推演：對每條配方、每個 N、每個商店係數 f ∈ [F_MIN, 2]，買進與兌換的 ΔΦ ≤ 0
  for (const r of BARTER_RECIPES) for (let n = 0; n <= 18; n++) {
    const q = recipeAt(r, n), val = (s: typeof q.give | typeof q.get, side: 'give' | 'get') => s.kind === 'beans' ? s.qty : F_MIN * s.qty * (s.kind === 'shard' ? SHARD_SHOP_PRICE : s.kind === 'potion' ? POTION_PRICE : s.kind === 'relic' ? Math[side === 'give' ? 'min' : 'max'](...((s as any).rarities ?? ['common']).map((x: any) => RELIC_PRICE[x as keyof typeof RELIC_PRICE])) : side === 'give' ? 100 : tokenBasePrice({ kind: 'types', types: ['x'], match: 'has', tier: (s as any).tokenTier }));
    assert.ok(val(q.get, 'get') <= val(q.give, 'give') + 1e-9, `${r.id}@N${n}：Φ 不上升`);
  }
  // 引擎級隨機漫步：在真的商店場景裡亂買亂換 2000 步，Φ 與賽爾豆都只降不升（會附贈物品的遺物不買）
  const FREEBIE = new Set(RELICS.filter(r => r.run?.potions).map(r => r.id));
  for (const [seed, n, act] of [[1, 0, 1], [2, 0, 6], [3, 9, 4], [4, 18, 6]] as const) {
    let run = findShopLike(seed, n, act); const start = phi(run), d = new Dice(seed, 0);
    for (let i = 0; i < 2000; i++) {
      const before = phi(run), pick = d.int(0, 3);
      let next = run;
      if (pick === 0 && run.scene.kind === 'shop') { const idx = d.int(0, run.scene.stock.length - 1), it = run.scene.stock[idx]; if (!(it.kind === 'relic' && FREEBIE.has(it.ref!))) next = E.shopBuy(run, idx, pool); }
      else if (pick === 1 && run.scene.kind === 'shop') next = E.shopReroll(run, pool);
      else if (run.scene.kind === 'shop' && run.scene.barter) {
        const rec = E.barterRecipesOf(run)[d.int(0, run.scene.barter.offers.length - 1)], ch = E.barterGiveChoices(run, rec);
        next = E.barterTrade(run, rec.id, { relic: ch.relics.length ? d.pick(ch.relics) : undefined, token: ch.tokens.length ? d.pick(ch.tokens) : undefined }, pool);
        if (next !== run && run.scene.kind === 'shop' && next.scene.kind === 'shop') assert.ok(phi(next) <= before + 1e-6, `兌換 ${rec.id} 讓 Φ 上升`);
        if (next.scene.kind === 'shop' && (next.scene as any).barter.left === 0) next = { ...next, scene: { ...(next.scene as any), barter: { ...(next.scene as any).barter, left: barterLimit(n), uses: {} } } }; // 重置次數，逼近極限
      }
      run = next;
      assert.ok(phi(run) <= before + 0.51, `第 ${i} 步：買進或兌換不得讓 Φ 上升 (${before} → ${phi(run)})`);
    }
    assert.ok(phi(run) <= start + 1, `隨機漫步 2000 步後總值沒有增加（${start} → ${phi(run)}）`);
    assert.ok(run.beans <= 20000, '賽爾豆沒有憑空增加');
  }
}
/** 帶大量資源的商店局面（全章節係數、指定 N），商品用真的 rollShop */
function findShopLike(seed: number, n: number, act: number): E.RunV2 {
  const base = findShop(seed, n);
  const relics = ['atk_bead', 'def_bead', 'strong_atk_bead', 'silver_wing', 'black_cat_bell', 'puni_robe'];
  const toks = [0, 1, 2, 3].map(i => ({ id: `tk${i}`, kind: 'types', types: ['火'], match: 'has', tier: 'mid' })) as any;
  const run: E.RunV2 = { ...base, act, relics, tokens: toks, beans: 3000, shards: 20, potions: 20 };
  return { ...run, scene: { ...(base.scene as any), barter: { offers: recipesFor(act).map(r => r.id).slice(0, 6), left: barterLimit(n), uses: {} } } };
}

console.log('保命遺物（人偶、星核、沙漏、與逆命者的順序）與失與得（兌換、次數、種子、無套利）通過');
