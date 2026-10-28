// 星蝕回廊第 2 階段：招募令、重複招募、遺物倍增、深度曲線與固定值縮放、套裝特權、舊存檔遷移。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
const E = await server.ssrLoadModule('/src/modes/interstellar/v2/engine.ts');
const R = await server.ssrLoadModule('/src/modes/interstellar/v2/recruit.ts');
const Rel = await server.ssrLoadModule('/src/modes/interstellar/v2/relics.ts');
const P = await server.ssrLoadModule('/src/modes/interstellar/v2/suitPerks.ts');
const { SUIT_CATALOG } = await server.ssrLoadModule('/src/data/suitsAndEyewears.ts');
const { N_LEVELS, nEffects } = await server.ssrLoadModule('/src/modes/interstellar/v2/levels.ts');
const { Dice } = await server.ssrLoadModule('/src/modes/interstellar/v2/rng.ts');
const pool: any[] = DEFAULT_ELVES;
const usable: any[] = E.usablePool(pool);
const tok = (spec: any, id = 't') => ({ id, tier: undefined, types: [], match: 'has', ...spec });
const mkRun = (o: any = {}) => {
  let r = E.createRun({ pool, equipType: 'suit', equipId: o.equipId ?? '', modifiers: o.modifiers ?? [], startingShards: o.tokens ?? 0, seed: o.seed ?? 9, nLevel: o.nLevel, bans: o.bans });
  if (r.scene.kind === 'draft') for (const id of r.scene.offer.slice(0, 3)) r = E.toggleDraft(r, id);
  return { ...E.confirmDraft(r, pool), scene: { kind: 'map' } } as any;
};

// ───────── 招募令篩選
{
  const compound = usable.filter(e => R.elfTypes(e).length >= 2);
  assert.ok(compound.length >= 3, '測試池裡要有複合屬性精靈');
  // 單屬性令（has）：含該屬性的全部，複合屬性也算
  const types = [...new Set(usable.flatMap(R.elfTypes))];
  for (const t of types) {
    const token = tok({ kind: 'types', types: [t], match: 'has' });
    for (const e of usable) assert.equal(R.tokenMatches(token, e), R.elfTypes(e).includes(t), `${t}系令對 ${e.name}(${e.type})`);
  }
  const t0 = types.find(t => compound.some(e => R.elfTypes(e).includes(t)) && usable.some(e => R.elfTypes(e).length === 1 && e.type === t))!;
  const hit = usable.filter(e => R.tokenMatches(tok({ kind: 'types', types: [t0], match: 'has' }), e));
  assert.ok(hit.some(e => R.elfTypes(e).length === 1) && hit.some(e => R.elfTypes(e).length >= 2), `${t0}系令同時包含單屬性與複合屬性`);
  // 雙屬性令（exact）：屬性恰為這兩個，與順序無關，單屬性與三屬性都不算
  const pair = R.elfTypes(compound.find(e => R.elfTypes(e).length === 2));
  const ex = tok({ kind: 'types', types: pair, match: 'exact' }), exRev = tok({ kind: 'types', types: [...pair].reverse(), match: 'exact' });
  const exHit = usable.filter(e => R.tokenMatches(ex, e));
  assert.ok(exHit.length >= 1);
  for (const e of usable) {
    const ts = R.elfTypes(e), want = ts.length === 2 && pair.every(p => ts.includes(p));
    assert.equal(R.tokenMatches(ex, e), want); assert.equal(R.tokenMatches(exRev, e), want, '順序無關');
  }
  assert.ok(!usable.filter(e => R.elfTypes(e).length === 1).some(e => R.tokenMatches(ex, e)), '雙屬性令不含單屬性精靈');
  assert.ok(R.tokenMatches(tok({ kind: 'types', types: [pair[0]], match: 'has' }), exHit[0]) && !R.tokenMatches(ex, usable.find(e => R.elfTypes(e).length === 1)!));
  // 任一屬性令
  const [a, b] = types.slice(0, 2), ei = tok({ kind: 'types', types: [a, b], match: 'either' });
  for (const e of usable) assert.equal(R.tokenMatches(ei, e), R.elfTypes(e).some(x => x === a || x === b));
  assert.ok(usable.every(e => R.tokenMatches(tok({ kind: 'any' }), e)));
  // 標籤
  assert.equal(R.tokenLabel(ex), `${pair.join('/')}雙屬性招募令`); assert.equal(R.tokenLabel(tok({ kind: 'any', repeat: true })), '重複招募令');
}

// ───────── 候選：被禁用排除、已持有排除、強度上限是硬限制
{
  const run = mkRun({ seed: 3 });
  const anyTok = tok({ kind: 'any' }), all = E.eligibleElves(run, pool, anyTok);
  const owned = new Set(run.team.map((e: any) => String(e.id)));
  assert.ok(all.length > 5 && all.every((e: any) => !owned.has(String(e.id))), '已持有的不可再招募');
  const banned = all.slice(0, 3).map((e: any) => String(e.id));
  const run2 = { ...run, bans: banned };
  assert.ok(E.eligibleElves(run2, pool, anyTok).every((e: any) => !banned.includes(String(e.id))), '被 ban 的精靈不可選');
  assert.equal(E.eligibleElves(run2, pool, anyTok).length, all.length - banned.length);
  for (const cap of ['low', 'mid', 'high', 'apex'] as const) {
    const lst = E.eligibleElves(run, pool, tok({ kind: 'any', tier: cap }));
    assert.ok(lst.every((e: any) => R.tierRank(E.tierOf(pool, e)) <= R.tierRank(cap)), `強度上限 ${cap}`);
  }
  assert.ok(E.eligibleElves(run, pool, tok({ kind: 'any', tier: 'low' })).length < all.length + 1);
  // 用令招募：被 ban 的 id 即使硬塞也不行；令不消耗
  const withTok = E.mintToken({ ...run2, tokens: [] }, { kind: 'any', types: [], match: 'has', tier: 'apex' });
  const bad = E.recruitWithToken(withTok, withTok.tokens[0].id, banned[0], pool);
  assert.equal(bad, withTok, '被 ban 的精靈不能招募，令也不消耗');
  const good = E.recruitWithToken(withTok, withTok.tokens[0].id, String(all.find((e: any) => !banned.includes(String(e.id))).id), pool);
  assert.equal(good.team.length, withTok.team.length + 1); assert.equal(good.tokens.length, 0, '成功才消耗');
  // 不符條件的精靈不可選
  const dual = withTok.tokens[0];
  const typed = E.mintToken({ ...run, tokens: [] }, { kind: 'types', types: [R.elfTypes(all[0])[0]], match: 'has', tier: 'apex' });
  const wrong = all.find((e: any) => !R.tokenMatches(typed.tokens[0], e));
  assert.equal(E.recruitWithToken(typed, typed.tokens[0].id, String(wrong.id), pool), typed, '屬性不符不能招募');
  void dual;
}

// ───────── 重複招募：+40%／層、上限 3 層（特權 +1）、PP×2 只作用 PP>0 且只能一次
{
  let run = mkRun({ seed: 5 });
  // 讓第二隻有一個 PP 為 0 的技能（例如無限 PP），其他技能為正常 PP
  const target = run.team[0];
  const skills = target.skills.map((s: any, i: number) => i === 1 ? { ...s, pp: 0, maxPp: 0 } : { ...s, pp: 10, maxPp: 10 });
  run = { ...run, team: run.team.map((e: any, i: number) => i === 0 ? { ...e, skills } : e) };
  const tid = E.bagIdOf(run.team[0]);
  const base = E.snapshotElf(run, run.team[0]).calculatedStats;
  const give = (r: any, n: number) => { for (let i = 0; i < n; i++) r = E.mintToken(r, { kind: 'any', types: [], match: 'has', repeat: true }); return r; };
  run = give(run, 5);
  const layer = (r: any) => E.snapshotElf(r, r.team[0]).calculatedStats;
  const use = (r: any, how: 'stat' | 'pp') => E.recruitWithToken(r, r.tokens[0].id, tid, pool, how);
  let r1 = use(run, 'stat');
  for (const k of ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed']) assert.ok(Math.abs(layer(r1)[k] / base[k] - 1.4) < 0.01, `第 1 層 ${k} +40%：${layer(r1)[k]} / ${base[k]}`);
  let r2 = use(r1, 'stat'), r3 = use(r2, 'stat');
  assert.ok(Math.abs(layer(r2).atk / base.atk - 1.8) < 0.01 && Math.abs(layer(r3).atk / base.atk - 2.2) < 0.01, '每層 +40%（相對原值線性疊加）');
  assert.equal(R.dupOf(r3.team[0]).stat, 3);
  const r4 = use(r3, 'stat');
  assert.equal(r4, r3, '第 4 層被拒，令不消耗'); assert.equal(r3.tokens.length, 2);
  assert.equal(r1.team.length, run.team.length, '重複招募不新增個體、不吃背包格');
  // 套裝特權「重複招募上限 +1 層」
  const pr = give({ ...r3, equipId: 'shadow_judgment' }, 0);
  assert.equal(E.dupCapOf(pr), 4); const r4p = use(pr, 'stat'); assert.notEqual(r4p, pr); assert.equal(R.dupOf(r4p.team[0]).stat, 4);
  assert.equal(E.dupCapOf({ ...pr, nLevel: 12 }), 3, 'N12 起特權失效');
  // 雙倍 PP：只能一次
  const pp1 = use(run, 'pp'); assert.equal(R.dupOf(pp1.team[0]).pp, true);
  assert.equal(use(pp1, 'pp'), pp1, 'PP×2 只能選一次');
  assert.equal(pp1.team[0].skills[0].pp, 10, '存檔原值不變');
  // 進戰鬥才加倍：PP>0 的 ×2（含上限），PP=0 的不變；存檔不被改
  const enc = { kind: 'combat', title: 't', enemies: [{ id: String(usable[10].id), affixes: [] }], scale: 1 };
  const pre = { ...pp1, scene: { kind: 'prelude', encounter: enc } };
  const b = E.startBattle(pre, pool, 'b1')!;
  const f = b.p1[0];
  assert.equal(f.skills[0].pp, 20); assert.equal(f.skills[0].maxPp, 20, '上限也翻倍'); assert.equal(f.skills[1].pp, 0); assert.equal(f.skills[1].maxPp, 0, '0PP 技能不變');
  assert.equal(b.run.team[0].skills[0].maxPp, 10, '存檔副本不受影響');
  assert.equal(E.startBattle({ ...pre, team: run.team }, pool, 'b0')!.p1[0].skills[0].pp, 10, '沒選 PP×2 時不變');
  // 結算折回：戰鬥剩 15 → 存檔 8（不超過原上限 10）；剩 40 → 10
  const after = b.p1.map((e: any, i: number) => i === 0 ? { ...e, skills: e.skills.map((s: any, j: number) => j === 0 ? { ...s, pp: 15 } : j === 2 ? { ...s, pp: 40 } : s) } : e);
  const settled = E.settleBattleV2(b.run, 'b1', 'p1', after, pool);
  assert.equal(settled.team[0].skills[0].pp, 8); assert.equal(settled.team[0].skills[2].pp, 10); assert.equal(settled.team[0].skills[1].pp, 0);
  // 層數不影響 PP；兩種可以並存
  const both = use(use(run, 'pp'), 'stat'); assert.deepEqual(R.dupOf(both.team[0]), { stat: 1, pp: true });
  // 不是隊員、或沒指定強化類型都不可
  assert.equal(E.recruitWithToken(run, run.tokens[0].id, 'nobody', pool, 'stat'), run); assert.equal(E.recruitWithToken(run, run.tokens[0].id, tid, pool), run);
}

// ───────── 遺物倍增：加算先結算再乘、軟上限、黑日之心
// （2026-10-24 遺物數值翻倍：能量珠 +50→+100、稜鏡 ×1.15→×2.3、晶簇 ×1.5→×3、雙生之核 ×2→×4、黑日之心 ×3/×0.5→×6/×0.25；斷言隨之改寫，行為規則不變）
{
  const s = { hp: 1000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 };
  assert.equal(Rel.applyRelicPanel(s, ['atk_bead']).atk, 200);
  assert.equal(Rel.applyRelicPanel(s, ['atk_bead', 'twin_core']).atk, 800, '先 +100 再 ×4');
  assert.equal(Rel.applyRelicPanel(s, ['twin_core']).hp, 4000);
  assert.equal(Rel.applyRelicPanel(s, ['mul_prism', 'mul_cluster']).atk, Math.floor(100 * 2.3 * 3 + 1e-9));
  const sun = Rel.applyRelicPanel(s, ['black_sun_heart']); assert.deepEqual([sun.atk, sun.spatk, sun.def, sun.spdef, sun.hp], [600, 600, 25, 25, 1000]);
  assert.equal(Rel.softCapMul(64), 64); assert.ok(Math.abs(Rel.softCapMul(256) - 128) < 1e-9, '超過 64 的部分以 √ 計'); assert.ok(Rel.softCapMul(100) < 100 && Rel.softCapMul(100) > 64);
  const stack = Rel.applyRelicPanel(s, Array(40).fill('twin_core')); assert.equal(stack.atk, Math.floor(100 * Rel.softCapMul(4 ** 40)));
  assert.ok(Rel.RELICS.filter((r: any) => r.panelMul).length === 4);
  // 帳冊用的總倍率
  assert.equal(Rel.relicMulTotals(['twin_core']).atk, 4);
}

// ───────── 敵方深度曲線與 N 疊乘
{
  assert.equal(R.depthOf(1, 1), 1); assert.equal(R.depthOf(1, 99), 12, '欄數上限 12'); assert.equal(R.depthOf(6, 99), 72);
  assert.ok(Math.abs(R.depthMul(1) - 1) < 1e-12 && Math.abs(R.depthMul(72) - 100) < 1e-9);
  for (const [L, v] of [[12, 2.04], [24, 4.45], [36, 9.73], [48, 21.08], [60, 45.9]] as const) assert.ok(Math.abs(R.depthMul(L) - v) < 0.05, `L${L} 與設計表一致：${R.depthMul(L)}`);
  for (let L = 2; L <= 72; L++) assert.ok(R.depthMul(L) > R.depthMul(L - 1), '嚴格遞增');
  const s1 = E.enemyScales('combat', 1, 0), s72 = E.enemyScales('boss', 72, 0);
  assert.ok(Math.abs(s1.scale - 1) < 1e-9 && Math.abs(s1.hpScale - 2.5) < 1e-9);
  assert.ok(Math.abs(s72.scale - 130) < 1e-6 && Math.abs(s72.hpScale - 700) < 1e-6, '王座 ×1.3、體力係數 7');
  assert.ok(Math.abs(E.enemyScales('elite', 24, 0).scale / E.enemyScales('combat', 24, 0).scale - 1.15) < 1e-9);
  // 實際遭遇 = 曲線 × (1+N)
  const reach = (n: number) => {
    let r = mkRun({ seed: 8, nLevel: n });
    for (let i = 0; i < 80 && r.scene.kind !== 'prelude'; i++) {
      if (r.scene.kind === 'map') r = E.moveTo(r, (E.movesFrom(r).find((m: any) => m.kind === 'combat') ?? E.movesFrom(r)[0]).id, pool);
      else if (r.scene.kind === 'event' && r.scene.outcome) r = E.backToMap(r);
      else if (r.scene.kind === 'event') r = E.chooseEvent(r, 0, pool);
      else r = E.backToMap({ ...r, scene: { kind: 'map' } } as any);
    }
    assert.equal(r.scene.kind, 'prelude'); return r;
  };
  for (const n of [0, 9, 18]) {
    const r = reach(n), enc = r.scene.encounter, lv = nEffects(n);
    const exp = E.enemyScales(enc.kind, enc.depth, r.eclipse);
    assert.equal(enc.depth, R.depthOf(r.act, E.currentNode(r).col));
    assert.ok(Math.abs(enc.scale - Math.round(exp.scale * (1 + lv.enemyStat) * 100) / 100) < 1e-9, `N${n} 能力＝曲線×(1+N)`);
    assert.ok(Math.abs(enc.hpScale - Math.round(exp.hpScale * (1 + lv.enemyHp) * 100) / 100) < 1e-9, `N${n} 體力＝曲線×(1+N)`);
  }
  const e0 = reach(0).scene.encounter, e18 = reach(18).scene.encounter;
  assert.ok(Math.abs(e18.scale / e0.scale - 1.25) < 0.02 && Math.abs(e18.hpScale / e0.hpScale - 1.45) < 0.02, 'N18 疊乘 +25% / +45%');
}

// ───────── 固定值 √ 縮放（護盾、固定傷害、藥劑；敵我同一曲線）
{
  assert.ok(Math.abs(R.fixedMulAt(1) - 1) < 1e-12 && Math.abs(R.fixedMulAt(72) - 10) < 1e-9);
  assert.ok(Math.abs(R.fixedMulAt(37) - Math.sqrt(R.depthMul(37))) < 1e-12);
  assert.equal(R.fixedMulOf(['a', 'fixed_mul:3.162']), 3.162); assert.equal(R.fixedMulOf(['a']), 1);
  const deep = (extra: any = {}) => {
    const run = mkRun({ seed: 11, ...extra });
    const enc = { kind: 'boss', title: 't', enemies: [{ id: String(usable[12].id), affixes: ['affix_sapping'] }], scale: 1, depth: 72 };
    return { ...run, relics: ['void_shield_gen'], act: 6, scene: { kind: 'prelude', encounter: enc } } as any;
  };
  const b = E.startBattle(deep(), pool, 'x')!;
  assert.deepEqual(b.relics.filter((r: string) => r.startsWith('fixed_mul')), ['fixed_mul:10'], '我方帶固定值倍率');
  assert.ok(b.enemyRelics.includes('fixed_mul:10') && b.enemyRelics.includes('affix_sapping'), '敵方同一曲線');
  assert.equal(b.p1[0].shield, 10000, '虛空護盾 1000（2026-10-24 由 500 翻倍）× √100');
  const shallow = E.startBattle({ ...deep(), scene: { kind: 'prelude', encounter: { kind: 'combat', title: 't', enemies: [{ id: String(usable[12].id), affixes: [] }], scale: 1, depth: 1 } } }, pool, 'y')!;
  assert.equal(shallow.p1[0].shield, 1000); assert.deepEqual(shallow.relics.filter((r: string) => r.startsWith('fixed_mul')), ['fixed_mul:1']);

  // 戰鬥內：固定傷害、藥劑回復隨倍率；由最大體力百分比換算者（汲魂）不重複縮放
  const wait = { name: '等', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' };
  const fixedSkill = { ...wait, name: '固傷', effectMode: 'kit', kit: [{ codeId: 'extra_damage', node: 'on_skill_use', source: 'skill', role: 'attached', order: 0, params: { amount: 1000, damageType: 'fixed', target: 'opponent' } }] };
  const mk = (id: string, speed: number, skills: any[], hp = 1_000_000, cur = hp): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: cur, maxHp: hp,
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, calculatedStats: { hp, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, statStages: {}, skills });
  const run = async (mul: string | null, enemyRelics: string[] = [], act: (en: any) => void) => {
    delete (globalThis as any).__BATTLE_SEED__;
    const engine = createBattleEngine({ initialP1Team: [mk('A', 200, [fixedSkill, wait], 1_000_000, 500_000)], initialP2Team: [mk('X', 100, [wait])], p1StarterId: 'A', p2StarterId: 'X', battleMode: 'PVE', preparedTeams: true, isFast: () => true, randomSeed: 5,
      interstellarOptions: { relics: mul ? [mul] : [], enemyRelics: [...enemyRelics, ...(mul ? [mul] : [])], onPotionUse: () => true, maxPotionUsage: 9 } });
    engine.mount(); engine.start(); await engine.idle(); act(engine); await engine.idle(); const st = engine.getState(); engine.unmount(); return st;
  };
  const dmg = async (mul: string | null) => { const st = await run(mul, [], en => { en.onSkillSelect('p1', en.getState().p1.skills[0]); en.onSkillSelect('p2', en.getState().p2.skills[0]); }); return 1_000_000 - st.p2.currentHp; };
  const d1 = await dmg(null), d4 = await dmg('fixed_mul:4');
  assert.ok(d1 >= 400 && d1 <= 1000, `固定傷害基準 ${d1}`); assert.ok(Math.abs(d4 / d1 - 4) < 0.02, `固定傷害 ×4：${d1} → ${d4}`);
  const { BATTLE_ITEMS } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const potion = BATTLE_ITEMS.find((i: any) => i.id === 'hp_300');
  const heal = async (mul: string | null) => { const st = await run(mul, [], en => { en.onUseItem('p1', potion); en.onSkillSelect('p2', en.getState().p2.skills[0]); }); return st.p1.currentHp - 500_000; };
  const h1 = await heal(null), h4 = await heal('fixed_mul:4');
  assert.equal(h1, 300); assert.equal(h4, 1200, '藥劑 300 × 4：深層不失效');
  // 汲魂（5% 最大體力）：與倍率無關
  const sap = async (mul: string | null) => { const st = await run(mul, ['affix_sapping'], en => { en.onSkillSelect('p1', en.getState().p1.skills[1]); en.onSkillSelect('p2', en.getState().p2.skills[0]); }); return 500_000 - st.p1.currentHp; };
  const s1 = await sap(null), s4 = await sap('fixed_mul:4');
  assert.equal(s1, 50_000); assert.equal(s4, 50_000, '百分比換算的固定傷害不二次縮放');
}

// ───────── 套裝特權：預算、每套獨特、功能
{
  const ids = Object.keys(SUIT_CATALOG);
  const keysOf = (id: string) => P.perkKeys(P.SUIT_PERKS[id].perk);
  const holders = new Map<string, string[]>();
  for (const id of ids) for (const k of keysOf(id)) holders.set(k, [...(holders.get(k) ?? []), id]);
  const sigs = new Set<string>();
  for (const id of ids) {
    const p = P.SUIT_PERKS[id]; assert.ok(p, `${id} 缺特權`);
    const c = P.perkCost(p.perk);
    assert.ok(c <= P.PERK_BUDGET[p.tier] + 1e-9, `${id} 超出預算 ${c}`); assert.ok(c >= P.PERK_BUDGET[p.tier] - .76, `${id} 過弱 ${c}`);
    assert.ok(keysOf(id).some(k => holders.get(k)!.length === 1), `${id} 沒有獨特功能`);
    const sig = keysOf(id).sort().join('|'); assert.ok(!sigs.has(sig), `${id} 與他套特權完全相同`); sigs.add(sig);
    assert.ok(P.perkItems(p.perk).length > 0);
  }
  // 指定的新功能都有人擁有
  for (const f of ['typeToken', 'dualToken', 'repeatTokens', 'tokenTierUp', 'dupCap', 'banBonus', 'openShield', 'freeReroll', 'bossHeal', 'lifeline']) assert.ok([...holders.keys()].some(k => k.startsWith(f)), `特權 ${f} 無人使用`);
  assert.deepEqual(Object.fromEntries(['strong', 'mid', 'support'].map(t => [t, ids.filter(i => P.SUIT_PERKS[i].tier === t).length > 0])), { strong: true, mid: true, support: true });

  const mk = (equipId: string, o: any = {}) => mkRun({ equipId, tokens: 3, ...o });
  // 起始令
  const dk = E.createRun({ pool, equipType: 'suit', equipId: 'dark_angel', modifiers: [], startingShards: 3, seed: 4 });
  assert.deepEqual(dk.tokens.filter((t: any) => t.kind === 'types').map((t: any) => [t.types, t.match]), [[['暗影'], 'has']]);
  const cr = E.createRun({ pool, equipType: 'suit', equipId: 'corrupter', modifiers: [], startingShards: 3, seed: 4 });
  assert.deepEqual(cr.tokens.filter((t: any) => t.match === 'exact').map((t: any) => t.types), [['暗影', '混沌']]);
  assert.equal(E.createRun({ pool, equipType: 'suit', equipId: 'nuclear_armor', modifiers: [], startingShards: 3, seed: 4 }).tokens.filter((t: any) => t.repeat).length, 1);
  assert.equal(E.anyTokenCount(E.createRun({ pool, equipType: 'suit', equipId: 'eternal_starlight', modifiers: [], startingShards: 3, seed: 4 })), 1, '任意令 +1 保持有效（免費招募一次）');
  // N12 起全失效
  const dk12 = E.createRun({ pool, equipType: 'suit', equipId: 'dark_angel', modifiers: [], startingShards: 3, seed: 4, nLevel: 12 });
  assert.equal(dk12.tokens.filter((t: any) => t.kind === 'types').length, 0); assert.equal(E.runPerk(dk12), null);
  // 招募令強度上限 +1 階
  assert.equal(E.tokenTierCap(mk('')), 'mid'); assert.equal(E.tokenTierCap(mk('sky_cloud')), 'high'); assert.equal(E.tokenTierCap({ ...mk('sky_cloud'), act: 5 }), 'apex');
  // 禁用名額 +1
  const ban6 = usable.slice(0, 7).map((e: any) => String(e.id));
  assert.equal(E.createRun({ pool, equipType: 'suit', equipId: 'proud_peak', modifiers: [], startingShards: 3, seed: 4, bans: ban6 }).bans.length, 7);
  assert.equal(E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: [], startingShards: 3, seed: 4, bans: ban6 }).bans.length, 6);
  assert.equal(E.banCapFor(18, null), 0);
  // 商店每層免費刷新 1 次
  const shopRun = (equipId: string) => { const r = mk(equipId); return { ...r, beans: 1000, scene: { kind: 'shop', stock: [] } } as any; };
  let sr = E.shopReroll(shopRun('destiny_armor'), pool); assert.equal(sr.beans, 1000, '第一次免費'); assert.equal(sr.scene.freeUsed, true);
  const cost2 = E.shopRerollCost(sr); assert.ok(cost2 > 0); const sr2 = E.shopReroll(sr, pool); assert.equal(sr2.beans, 1000 - cost2);
  assert.ok(E.shopRerollCost(shopRun('')) > 0, '沒有特權就要付費');
  // 每章首戰護盾（一章一次）
  const enc = { kind: 'combat', title: 't', enemies: [{ id: String(usable[3].id), affixes: [] }], scale: 1, depth: 1 };
  const pre = { ...mk('berserker'), scene: { kind: 'prelude', encounter: enc } } as any;
  const b1 = E.startBattle(pre, pool, 'a')!; assert.equal(b1.p1[0].shield, P.OPEN_SHIELD_BASE);
  assert.equal(E.startBattle({ ...b1.run, pendingBattle: null, scene: pre.scene }, pool, 'b')!.p1[0].shield, 0, '同一章第二場沒有');
  assert.equal(E.startBattle({ ...b1.run, pendingBattle: null, act: 2, scene: pre.scene }, pool, 'c')!.p1[0].shield, P.OPEN_SHIELD_BASE, '新章再來一次');
  // 首領戰前回滿
  const hurt = (r: any) => ({ ...r, team: r.team.map((e: any) => ({ ...e, currentHp: Math.floor(e.maxHp / 3), skills: e.skills.map((s: any) => ({ ...s, pp: 1 })) })) });
  const bossEnc = { ...enc, kind: 'boss' };
  const hb = E.startBattle({ ...hurt(mk('emperor_armor')), scene: { kind: 'prelude', encounter: bossEnc } } as any, pool, 'h')!;
  assert.ok(hb.p1.every((e: any) => e.currentHp === e.maxHp) && hb.p1[0].skills[0].pp === (hb.p1[0].skills[0].maxPp ?? 1), '首領戰前回滿');
  const nb = E.startBattle({ ...hurt(mk('')), scene: { kind: 'prelude', encounter: bossEnc } } as any, pool, 'n')!;
  assert.ok(nb.p1.every((e: any) => e.currentHp < e.maxHp), '無特權不回滿');
  // 致命時不扣生命（生命制 2026-10-24：生命只剩 3、本場倒下 3 隻＝將歸零；逆命者特權每局一次）
  const doomed = (equipId: string, used = false) => { const r = { ...hurt(mk(equipId)), lives: 3, tempLives: 0, lifelineUsed: used, scene: { kind: 'prelude', encounter: bossEnc } } as any; const bb = E.startBattle(r, pool, 'l')!; return E.settleBattleV2(bb.run, 'l', 'p2', bb.p1.map((e: any) => ({ ...e, currentHp: 0 })), pool); };
  const kept = doomed('fate_defier'); assert.notEqual(kept.scene.kind, 'end'); assert.equal(kept.lifelineUsed, true); assert.ok(kept.team.every((e: any) => e.currentHp >= Math.floor(e.maxHp * .3)));
  assert.equal(kept.scene.kind, 'prelude', '首領戰敗北後回到戰前');
  assert.equal(doomed('fate_defier', true).scene.kind, 'end', '第二次不再保留'); assert.equal(doomed('').scene.kind, 'end');
}

// ───────── 取得：開局、獎勵、商店、事件
{
  // 獎勵：首領 2 張任意令＋至少一個倍增遺物選項；夢魘 1 張單屬性或雙屬性；入帳且 id 唯一
  const base = mkRun({ seed: 21, tokens: 0 });
  const settle = (kind: string, act = 3) => {
    const enc = { kind, title: 't', enemies: [{ id: String(usable[3].id), affixes: [] }], scale: 1, depth: 1 };
    const r = { ...base, act, scene: { kind: 'prelude', encounter: enc } } as any; const b = E.startBattle(r, pool, 'r')!;
    return E.settleBattleV2(b.run, 'r', 'p1', b.p1, pool) as any;
  };
  const boss = settle('boss');
  assert.equal(boss.scene.kind, 'reward'); assert.equal(boss.scene.reward.tokens.filter((t: any) => t.kind === 'any' && !t.repeat).length, 1, '首領 1 張任意令（限定招募券）');
  assert.equal(boss.scene.reward.shards, 3, '首領 3 星晶'); assert.equal(boss.shards, base.shards + 3, '星晶入帳');
  assert.deepEqual(boss.scene.reward.tokens.map((t: any) => t.id), boss.tokens.slice(0, boss.scene.reward.tokens.length).map((t: any) => t.id), '獎勵顯示的就是入帳的令');
  assert.equal(new Set(boss.tokens.map((t: any) => t.id)).size, boss.tokens.length, '令 id 不重複');
  for (let a = 1; a <= 6; a++) assert.ok(settle('boss', a).scene.reward.relicChoices.some(Rel.isMulRelic), `第 ${a} 章首領獎勵至少有一個倍增遺物`);
  const elite = settle('elite'); assert.equal(elite.scene.reward.shards, 1, '夢魘 1 星晶'); assert.ok(elite.scene.reward.tokens.length >= 1 && elite.scene.reward.tokens[0].kind === 'types');
  let combatTokens = 0, combatShards = 0; for (let s = 0; s < 60; s++) { const r = { ...base, seed: 100 + s, scene: { kind: 'prelude', encounter: { kind: 'combat', title: 't', enemies: [{ id: String(usable[3].id), affixes: [] }], scale: 1, depth: 1 } } } as any; const bb = E.startBattle(r, pool, 'r')!; const o = E.settleBattleV2(bb.run, 'r', 'p1', bb.p1, pool) as any; combatTokens += o.scene.reward.tokens.filter((t: any) => !t.repeat).length; combatShards += o.scene.reward.shards; }
  assert.ok(combatTokens >= 2 && combatTokens < 20, `一般戰鬥約 15% 給單屬性令：${combatTokens}/60`);
  assert.ok(combatShards >= 5 && combatShards <= 22, `一般戰鬥約 20% 給 1 星晶：${combatShards}/60`);
  // 商店：招募令用賽爾豆買，單屬性令必定有候選
  let shop = E.moveTo; void shop;
  const sd = new Dice(3, 0); const sr = { ...base, beans: 5000 };
  const stock = (E as any).tokenBasePrice ? null : null; void stock;
  const hold = { ...sr, scene: { kind: 'shop', stock: [{ kind: 'token', token: { kind: 'types', types: ['水'], match: 'has', tier: 'mid' }, price: 70, currency: 'beans' }] } } as any;
  const bought = E.shopBuy(hold, 0, pool); assert.equal(bought.beans, 5000 - 70); assert.equal(bought.tokens.length, 1); assert.equal(bought.scene.stock[0].sold, true);
  assert.equal(E.shopBuy(bought, 0, pool), bought, '已售');
  assert.equal(E.shopBuy({ ...hold, beans: 69 }, 0, pool).tokens.length, 0, '錢不夠');
  void sd;
  // 事件：任意令 ±n、給指定款式的令
  const evs = await server.ssrLoadModule('/src/modes/interstellar/v2/content.ts');
  const frozen = evs.EVENTS.find((e: any) => e.choices.some((c: any) => /雙屬性/.test(c.hint ?? '')));
  const ci = frozen.choices.findIndex((c: any) => /雙屬性/.test(c.hint ?? ''));
  const out = E.chooseEvent({ ...base, scene: { kind: 'event', eventId: frozen.id } } as any, ci, pool) as any;
  assert.equal(out.tokens.length, 1); assert.ok(out.tokens[0].kind === 'types');
  // 舊結構「押注」會花一張任意令，沒有則不可選
  const gamble = evs.EVENTS.find((e: any) => e.choices.some((c: any) => /押 1 星晶/.test(c.label)));
  const gc = gamble.choices.find((c: any) => /押 1/.test(c.label)); assert.ok(gc.require({ tokens: [] })); assert.equal(gc.require(mkRun({ tokens: 2 })), null);
  const two = E.mintToken(E.mintToken(mkRun({ tokens: 0 }), { kind: 'any', types: [], match: 'has' }), { kind: 'any', types: [], match: 'has' });
  assert.equal(E.spendAnyTokens(two, 3), null); assert.equal(E.anyTokenCount(E.spendAnyTokens(two, 1)!), 1);
}

// ───────── 舊存檔遷移
{
  const old = mkRun({ seed: 33, tokens: 0 }); const legacy: any = { ...old, shards: 5 }; delete legacy.tokens; delete legacy.tokenSeq; delete legacy.shardsV3;
  legacy.scene = { kind: 'shop', stock: [{ kind: 'elf', ref: String(usable[0].id), price: 2, currency: 'shards' }, { kind: 'potion', price: 40, currency: 'beans' }] };
  const mem: any = { v: JSON.stringify(legacy), getItem(k: string) { return k === E.RUN_KEY_V2 ? this.v : null }, setItem(_k: string, v: string) { this.v = v } };
  const loaded = E.loadRunV2(mem)!;
  assert.equal(loaded.shards, 5, '星晶保持原數量，不轉成任意令'); assert.equal(loaded.tokens.length, 0, '沒有任何令被憑空產生');
  assert.deepEqual(loaded.scene.stock.map((s: any) => s.kind), ['potion'], '舊商店以星晶標價的精靈商品移除');
  const again = E.loadRunV2({ getItem: () => JSON.stringify(loaded) })!; assert.deepEqual([again.shards, again.tokens], [loaded.shards, loaded.tokens], '遷移冪等');
  // 第 2 階段（星晶→任意令）的存檔：把那批頂階任意令撤回，星晶維持原數；之後取得的令保留
  let p2: any = { ...old, shards: 5, tokens: [], tokenSeq: 0 }; delete p2.shardsV3;
  for (let i = 0; i < 5; i++) p2 = E.mintToken(p2, { kind: 'any', types: [], match: 'has', tier: 'apex' });
  p2 = E.mintToken(p2, { kind: 'types', types: ['火'], match: 'has' }); p2 = E.mintToken(p2, { kind: 'any', types: [], match: 'has', repeat: true });
  const lp2 = E.migrateRun(p2); assert.equal(lp2.shards, 5); assert.deepEqual(lp2.tokens.map((t: any) => [t.kind, !!t.repeat]), [['types', false], ['any', true]], '只撤回遷移產生的任意令');
  assert.equal(E.migrateRun(lp2).tokens.length, 2, '第二次載入不再撤回（shardsV3）');
  // 第 2 階段的新局（沒有 shards 欄位）：星晶 0、令全保留
  const fresh: any = { ...old, tokens: [], tokenSeq: 0 }; delete fresh.shards; delete fresh.shardsV3;
  const lf = E.migrateRun(E.mintToken(fresh, { kind: 'any', types: [], match: 'has', tier: 'apex' })); assert.equal(lf.shards, 0); assert.equal(lf.tokens.length, 1);
  // 沒有星晶欄位的更舊存檔
  const bare: any = { ...old }; delete bare.tokens; delete bare.shards; delete bare.shardsV3; const lb = E.migrateRun(bare); assert.equal(lb.tokens.length, 0); assert.equal(lb.shards, 0);
  // 進行中的獎勵（舊格式 shards/recruitChoices）仍可顯示與領取
  const rew: any = { ...old, shards: 0, scene: { kind: 'reward', title: 't', reward: { beans: 1, shards: 2, potions: 0, exp: 1, relicChoices: [], recruitChoices: [String(usable[5].id)] } } }; delete rew.tokens;
  const lr = E.migrateRun(rew); const took = E.takeRewardRecruit(lr, String(usable[5].id), pool); assert.equal(took.team.length, lr.team.length + 1);
}

// ───────── 星晶經濟：招募價格、持令免費、進階價格與上限
{
  const T = (tier: 'low' | 'mid' | 'high' | 'apex') => tier;
  // 價格公式：基價 2 + 已用星晶招募次數 + ⌊(章−1)/2⌋ + 強度加價（Ⅲ+1、Ⅳ+2）
  assert.equal(R.recruitPriceOf(0, 1, T('low')), 2); assert.equal(R.recruitPriceOf(0, 1, T('mid')), 2);
  assert.equal(R.recruitPriceOf(0, 1, T('high')), 3); assert.equal(R.recruitPriceOf(0, 1, T('apex')), 4);
  assert.equal(R.recruitPriceOf(3, 1, T('mid')), 5, '每招募一次 +1'); assert.equal(R.recruitPriceOf(0, 2, T('mid')), 2); assert.equal(R.recruitPriceOf(0, 3, T('mid')), 3, '每兩章 +1'); assert.equal(R.recruitPriceOf(0, 5, T('high')), 5);
  for (let n = 0; n < 8; n++) assert.ok(R.recruitPriceOf(n + 1, 1, T('mid')) > R.recruitPriceOf(n, 1, T('mid')), '價格隨次數遞增');
  assert.deepEqual(R.ADVANCE_STAT_PRICES, [3, 5, 8, 12]); assert.equal(R.ADVANCE_PP_PRICE, 4);

  const rich = (o: any = {}) => ({ ...mkRun({ seed: 41, ...o }), shards: 40 }) as any;
  // 星晶招募：任選（含頂階，不受令的強度上限）、扣價、次數 +1、下次更貴
  let r = rich(); const apex = r.team.length ? E.shardCandidates(r, pool).find((e: any) => E.tierOf(pool, e) === 'apex')! : null; assert.ok(apex, '候選含頂階');
  assert.equal(E.tokenTierCap(r), 'mid'); const pa = E.recruitPrice(r, pool, apex); assert.equal(pa, 4);
  const mids = E.shardCandidates(r, pool).filter((e: any) => R.tierRank(E.tierOf(pool, e)) <= 1);
  let paid = 0; const prices: number[] = [];
  for (let i = 0; i < 4; i++) { const e = mids[i]; const pr = E.recruitPrice(r, pool, e); prices.push(pr); const nx = E.recruitWithShards(r, String(e.id), pool); assert.equal(nx.shards, r.shards - pr, `第 ${i + 1} 次扣 ${pr}`); assert.equal(nx.team.length, r.team.length + 1); assert.equal(nx.recruitCount, i + 1); assert.equal(nx.tokens.length, r.tokens.length, '星晶招募不動令'); r = nx; paid += pr; }
  assert.deepEqual(prices, [2, 3, 4, 5], '同階價格逐次 +1'); assert.equal(r.shards, 40 - paid);
  const r2 = E.recruitWithShards(r, String(apex.id), pool); assert.equal(r2.shards, r.shards - 8, '頂階 2+4 次+2 加價'); assert.ok(r2.team.some((e: any) => String(e.id) === String(apex.id)), '頂階也能用星晶直接招募');
  // 拒絕情形：星晶不足、已持有、被禁用、不是候選；一律回傳原局面
  const poor = { ...rich(), shards: 1 }; assert.equal(E.recruitWithShards(poor, String(mids[0].id), pool), poor, '星晶不足');
  assert.equal(E.recruitWithShards(r, String(r.team[0].id), pool), r, '已持有'); assert.equal(E.recruitWithShards(r, 'nobody', pool), r);
  const banned = { ...rich(), bans: [String(mids[5].id)] }; assert.equal(E.recruitWithShards(banned, String(mids[5].id), pool), banned, '被禁用'); assert.ok(!E.shardCandidates(banned, pool).some((e: any) => String(e.id) === String(mids[5].id)));
  const exact = { ...rich(), shards: E.recruitPrice(rich(), pool, mids[6]) }; assert.equal(E.recruitWithShards(exact, String(mids[6].id), pool).shards, 0, '剛好夠');
  // 持令免費：不扣星晶、不推高價格；沒有令才花星晶
  let tk = E.mintToken({ ...rich(), recruitCount: 2 }, { kind: 'any', types: [], match: 'has', tier: 'mid' });
  const tgt = mids[7]; const viaTok = E.recruitWithToken(tk, tk.tokens[0].id, String(tgt.id), pool);
  assert.equal(viaTok.team.length, tk.team.length + 1); assert.equal(viaTok.shards, tk.shards, '持令不花星晶'); assert.equal(viaTok.recruitCount, 2, '持令不推高價格'); assert.equal(viaTok.tokens.length, 0);
  assert.equal(E.tokenFor(tk, pool, tgt)?.id, tk.tokens[0].id); assert.equal(E.tokenFor(rich(), pool, tgt), null, '無令時 tokenFor 為 null → 走星晶');
  const typed = E.mintToken(E.mintToken(rich(), { kind: 'any', types: [], match: 'has', tier: 'mid' }), { kind: 'types', types: [R.elfTypes(tgt)[0]], match: 'has', tier: 'mid' });
  assert.equal(E.tokenFor(typed, pool, tgt)?.kind, 'types', '優先用限制較多的令，留住任意令');
  assert.ok(E.recruitPrice(viaTok, pool, mids[8]) === E.recruitPrice(tk, pool, mids[8]), '之後的星晶價格不受持令招募影響');
  // 令的強度上限仍是硬限制；星晶不受限
  const lowTok = E.mintToken(rich(), { kind: 'any', types: [], match: 'has', tier: 'low' }); const hiElf = E.shardCandidates(rich(), pool).find((e: any) => E.tierOf(pool, e) === 'high')!;
  assert.equal(E.recruitWithToken(lowTok, lowTok.tokens[0].id, String(hiElf.id), pool), lowTok, '令有強度上限'); assert.notEqual(E.recruitWithShards(lowTok, String(hiElf.id), pool), lowTok);
  // 背包結算中不可招募
  const busy = { ...rich(), pendingBattle: { id: 'x', nodeId: null, encounter: { kind: 'combat', title: 't', enemies: [], scale: 1 } } }; assert.equal(E.recruitWithShards(busy, String(mids[0].id), pool), busy);

  // ── 進階：強化 3/5/8（上限 3 層；特權 +1 層為 12）、PP×2 4（一次）
  const base = rich(); const id0 = E.bagIdOf(base.team[0]); const statOf = (x: any) => E.snapshotElf(x, x.team[0]).calculatedStats.atk;
  const a0 = statOf(base);
  let g = E.advanceElf(base, id0, 'stat'); assert.equal(g.shards, 40 - 3); assert.equal(R.dupOf(g.team[0]).stat, 1); assert.ok(Math.abs(statOf(g) / a0 - 1.4) < .01);
  g = E.advanceElf(g, id0, 'stat'); assert.equal(g.shards, 40 - 3 - 5); g = E.advanceElf(g, id0, 'stat'); assert.equal(g.shards, 40 - 3 - 5 - 8); assert.ok(Math.abs(statOf(g) / a0 - 2.2) < .01, '3 層 +120%');
  assert.equal(E.advanceElf(g, id0, 'stat'), g, '第 4 層被拒，星晶不扣'); assert.equal(E.advanceInfo(g, g.team[0]).stat, null);
  const capped = E.advanceElf({ ...g, equipId: 'shadow_judgment' }, id0, 'stat'); assert.equal(R.dupOf(capped.team[0]).stat, 4, '重複招募上限 +1 層對進階也有效'); assert.equal(capped.shards, g.shards - 12);
  const g12 = { ...g, equipId: 'shadow_judgment', nLevel: 12 }; assert.equal(E.advanceElf(g12, id0, 'stat'), g12, 'N12 特權失效，第 4 層被拒');
  assert.equal(E.advanceInfo({ ...g, equipId: 'shadow_judgment', nLevel: 12 }, g.team[0]).stat, null, 'N12 起特權失效，上限回 3');
  const pp = E.advanceElf(base, id0, 'pp'); assert.equal(pp.shards, 40 - 4); assert.equal(R.dupOf(pp.team[0]).pp, true); assert.equal(E.advanceElf(pp, id0, 'pp'), pp, 'PP×2 只能一次'); assert.equal(E.advanceInfo(pp, pp.team[0]).pp, null);
  assert.equal(R.dupOf(E.advanceElf(pp, id0, 'stat').team[0]).stat, 1, '兩種可並存');
  // 星晶不足或不是隊員：原局面
  const p2 = { ...base, shards: 2 }; assert.equal(E.advanceElf(p2, id0, 'stat'), p2); const three = { ...base, shards: 3 }; assert.equal(E.advanceElf(three, id0, 'pp'), three, '3 星晶買不起 PP×2（4）');
  assert.equal(E.advanceElf(base, 'nobody', 'stat'), base);
  // 0PP 技能不受影響（進戰鬥）；其他技能 ×2
  const zeroed = { ...base, team: base.team.map((e: any, i: number) => i === 0 ? { ...e, skills: e.skills.map((s: any, j: number) => j === 1 ? { ...s, pp: 0, maxPp: 0 } : { ...s, pp: 10, maxPp: 10 }) } : e) };
  const zp = E.advanceElf(zeroed, id0, 'pp'); const enc = { kind: 'combat', title: 't', enemies: [{ id: String(usable[10].id), affixes: [] }], scale: 1 };
  const bt = E.startBattle({ ...zp, scene: { kind: 'prelude', encounter: enc } } as any, pool, 'z')!;
  assert.equal(bt.p1[0].skills[1].pp, 0); assert.equal(bt.p1[0].skills[1].maxPp, 0, '0PP 不變'); assert.equal(bt.p1[0].skills[0].maxPp, 20);
  // 重複招募令＝免費進階一次（消耗令、不扣星晶），之後回到付費
  let withRep = E.mintToken(base, { kind: 'any', types: [], match: 'has', repeat: true });
  const fr = E.advanceElf(withRep, id0, 'stat'); assert.equal(fr.shards, base.shards, '持有重複招募令免費'); assert.equal(fr.tokens.length, 0); assert.equal(R.dupOf(fr.team[0]).stat, 1);
  const fr2 = E.advanceElf(fr, id0, 'stat'); assert.equal(fr2.shards, base.shards - 5, '第二層回到付費（第 2 層 5 星晶）');
  const paidAnyway = E.advanceElf(withRep, id0, 'stat', { useToken: false }); assert.equal(paidAnyway.shards, base.shards - 3); assert.equal(paidAnyway.tokens.length, 1, 'useToken:false 保留令');
  const noMoney = E.mintToken({ ...base, shards: 0 }, { kind: 'any', types: [], match: 'has', repeat: true }); assert.equal(E.advanceElf(noMoney, id0, 'pp').shards, 0, '0 星晶也能用令免費進階');
  // 價格遞增與上限在 advanceInfo 上一致
  const inf = [0, 1, 2].map(k => { const t = { ...base.team[0], dup: { stat: k, pp: false } }; return E.advanceInfo(base, t).stat; }); assert.deepEqual(inf, [3, 5, 8]);
  void R;
}

// ───────── 星晶來源與一局的招募／進階次數
{
  const inc = R.SHARD_INCOME;
  assert.equal(inc.boss, 3); assert.equal(inc.elite, 1); assert.equal(inc.combat, 1); assert.equal(inc.combatChance, .2);
  // 期望總量（一局約 30 場一般戰、8 場夢魘、6 場首領，加上事件與商店 8 個）
  const expected = 4 + 30 * inc.combatChance * inc.combat + 8 * inc.elite + 6 * inc.boss + 8;
  assert.ok(expected >= 35 && expected <= 50, `一局預期星晶 ${expected}`);
  // 以價格表貪心支出：2…的招募與進階，約 8–14 次
  let bank = Math.floor(expected), n = 0, rec = 0, act = 1; const layers = [0, 0, 0];
  const plan: string[] = [];
  for (let step = 0; step < 40; step++) {
    act = Math.min(6, 1 + Math.floor(step / 2));
    const recP = R.recruitPriceOf(rec, act, 'mid'); const adv = layers.map((l, i) => l < 3 ? [i, R.advanceStatPrice(l)] : null).filter(Boolean) as number[][];
    const advBest = adv.sort((a, b) => a[1] - b[1])[0];
    if (step % 2 === 0 && bank >= recP) { bank -= recP; rec++; n++; plan.push(`招${recP}`); } else if (advBest && bank >= advBest[1]) { bank -= advBest[1]; layers[advBest[0]]++; n++; plan.push(`進${advBest[1]}`); } else if (bank >= recP) { bank -= recP; rec++; n++; plan.push(`招${recP}`); }
  }
  assert.ok(n >= 7 && n <= 14, `一局約能招募／進階 ${n} 次：${plan.join(' ')}`);
  // 商店買星晶：2 欄、每顆底價 70，可買、扣豆加星晶
  const shopRun = { ...mkRun({ seed: 51 }), beans: 1000, scene: { kind: 'shop', stock: [{ kind: 'shard', qty: 1, price: 70, currency: 'beans' }] } } as any;
  const bought = E.shopBuy(shopRun, 0, pool); assert.equal(bought.shards, shopRun.shards + 1); assert.equal(bought.beans, 930); assert.equal(bought.scene.stock[0].sold, true);
  const re = E.shopReroll({ ...shopRun, scene: { kind: 'shop', stock: [] } }, pool) as any; assert.equal(re.scene.stock.filter((x: any) => x.kind === 'shard').length, 2, '商店固定兩欄星晶'); assert.ok(re.scene.stock.filter((x: any) => x.kind === 'shard').every((x: any) => x.price === Math.round(R.SHARD_SHOP_PRICE * 1)));
  // 事件：黑月 +3 星晶、押注花 1 星晶、星晶不足不可選
  const evs = await server.ssrLoadModule('/src/modes/interstellar/v2/content.ts'); const moon = evs.EVENTS.find((e: any) => e.id === 'twin_moons');
  const base = { ...mkRun({ seed: 52 }), shards: 3 } as any; const o = E.chooseEvent({ ...base, scene: { kind: 'event', eventId: 'twin_moons' } } as any, 1, pool) as any; assert.equal(o.shards, base.shards + 3);
  const gam = evs.EVENTS.find((e: any) => e.choices.some((c: any) => /押 1 星晶/.test(c.label))); const gi = gam.choices.findIndex((c: any) => /押 1 星晶/.test(c.label));
  const lost = E.chooseEvent({ ...base, scene: { kind: 'event', eventId: gam.id } } as any, gi, pool) as any; assert.equal(lost.shards, base.shards - 1);
  assert.ok(gam.choices[gi].require({ ...base, shards: 0 }), '0 星晶不可押'); void moon;
  // 祭壇暗契約：星晶 +3、蝕度 +15
  const al = E.altarPact({ ...base, scene: { kind: 'altar' } } as any, 'dark') as any; assert.equal(al.shards, base.shards + 3); assert.equal(al.eclipse, base.eclipse + 15);
}

// ───────── 重複招募令：隨機掉落（不限章節、不綁開關、各來源皆可、種子可重現）
{
  const sources = ['combat', 'elite', 'boss', 'shop', 'event', 'altar', 'treasure'] as const;
  for (const src of sources) {
    const p = R.repeatDropChance(src, 0); assert.ok(p > 0 && p < 1, `${src} 有掉率`);
    let hit = 0; const N = 6000; for (let i = 0; i < N; i++) if (E.rollRepeatDrop({ nLevel: 0 }, new Dice(i + 1, 0), src)) hit++;
    assert.ok(Math.abs(hit / N - p) < .03, `${src} 實測 ${hit / N} ≈ ${p}`);
    assert.ok(R.repeatDropChance(src, 18) < p && R.repeatDropChance(src, 18) >= p * .4 - 1e-9, `N 等級降低掉率但至少保留 40%：${src}`);
    for (let i = 0; i < 50; i++) assert.equal(E.rollRepeatDrop({ nLevel: 0 }, new Dice(i + 1, 0), src), E.rollRepeatDrop({ nLevel: 0 }, new Dice(i + 1, 0), src), '同種子同結果');
  }
  assert.ok(R.repeatDropChance('boss') > R.repeatDropChance('elite') && R.repeatDropChance('elite') > R.repeatDropChance('combat'), '越難的來源掉得越多');
  // 實際流程：第 1 章（無章節門檻、無開關）每個來源都能掉出重複招募令；同局碼再跑一次結果相同
  const hasRep = (r: any) => r.tokens.some((t: any) => t.repeat);
  const fights = (kind: string, seed: number, act = 1) => {
    const base = mkRun({ seed }); const enc = { kind, title: 't', enemies: [{ id: String(usable[3].id), affixes: [] }], scale: 1, depth: 1 };
    const b = E.startBattle({ ...base, act, scene: { kind: 'prelude', encounter: enc } } as any, pool, 'r')!; return E.settleBattleV2(b.run, 'r', 'p1', b.p1, pool) as any;
  };
  for (const kind of ['combat', 'elite', 'boss']) {
    let found = 0; for (let sd = 1; sd <= 160 && !found; sd++) { const o = fights(kind, sd, 1); if (hasRep(o)) { found = sd; assert.ok(o.scene.reward.tokens.some((t: any) => t.repeat), '獎勵面板列出掉落'); } }
    assert.ok(found, `第 1 章 ${kind} 掉落重複招募令`); assert.deepEqual(fights(kind, found, 1).tokens.map((t: any) => t.id), fights(kind, found, 1).tokens.map((t: any) => t.id), '可重現');
  }
  // 商店
  let shopHit = 0; for (let sd = 1; sd <= 160; sd++) { const r = { ...mkRun({ seed: sd }), beans: 999, scene: { kind: 'shop', stock: [] } } as any; const o = E.shopReroll(r, pool) as any; if (o.scene.stock.some((x: any) => x.kind === 'token' && x.token.repeat)) { shopHit++; assert.equal(E.shopReroll(r, pool).scene.stock.length, o.scene.stock.length); } }
  assert.ok(shopHit >= 6 && shopHit <= 45, `第 1 章商店約 14% 出現重複招募令：${shopHit}/160`);
  // 事件（任何選項）
  const evs = await server.ssrLoadModule('/src/modes/interstellar/v2/content.ts'); let evHit = 0;
  for (let sd = 1; sd <= 300; sd++) { const r = { ...mkRun({ seed: sd }), scene: { kind: 'event', eventId: 'lighthouse' } } as any; const o = E.chooseEvent(r, 2, pool) as any; if (hasRep(o)) { evHit++; assert.ok(/重複招募令/.test(o.scene.outcome), '事件結果說明有掉令'); } }
  assert.ok(evHit >= 6 && evHit <= 40, `事件約 6%：${evHit}/300`); void evs;
  // 祭壇、寶匣
  let alHit = 0, trHit = 0;
  for (let sd = 1; sd <= 200; sd++) {
    const r = mkRun({ seed: sd }); if (hasRep(E.altarPact({ ...r, scene: { kind: 'altar' } } as any, 'dark') as any)) alHit++;
    const t = { ...r, scene: { kind: 'treasure', offer: ['atk_bead'] } } as any; if (hasRep(E.takeTreasure(t, 'atk_bead'))) trHit++;
  }
  assert.ok(alHit >= 10 && alHit <= 60, `祭壇約 15%：${alHit}/200`); assert.ok(trHit >= 4 && trHit <= 35, `寶匣約 8%：${trHit}/200`);
  // 遺落的令可立刻用來免費進階
  const got = (() => { for (let sd = 1; sd < 400; sd++) { const o = fights('boss', sd, 2); if (hasRep(o)) return { ...o, scene: { kind: 'map' } } as any; } return null; })(); assert.ok(got);
  const adv = E.advanceElf(got, E.bagIdOf(got.team[0]), 'stat'); assert.equal(adv.shards, got.shards); assert.equal(adv.tokens.length, got.tokens.length - 1);
}
await server.close();
console.log('招募令（複合屬性、雙屬性、ban、強度上限）、星晶招募與進階（價格遞增、持令免費、上限、0PP）、重複招募令隨機掉落、倍增遺物、深度曲線×N、固定值 √ 縮放、特權、取得來源、舊存檔遷移通過');
void N_LEVELS;
