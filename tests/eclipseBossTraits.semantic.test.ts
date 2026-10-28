/** 星蝕回廊 × 原廠 BOSS 特性：抽取規則、可重現、分級、神話並存、帶入戰鬥。 */
import assert from 'node:assert/strict';
import { DEFAULT_ELVES } from '../src/data/defaultElvesLoaded';
import { EVENT_BY_ID } from '../src/modes/interstellar/v2/content';
import * as E from '../src/modes/interstellar/v2/engine';
import { Dice } from '../src/modes/interstellar/v2/rng';
import { drawBossTraits, traitCount, maxTier, traitScore, traitParams, traitDice } from '../src/modes/interstellar/v2/bossTraitDraw';
import { BOSS_TRAITS, BOSS_TRAIT_BY_ID } from '../src/data/bossTraits';
import { bossTraitsOf } from '../src/blocks/ops/bossTraits';

const pool = DEFAULT_ELVES;
let checks = 0; const ok = (c: unknown, m: string) => { checks++; assert.ok(c, m); };

// 一、規則表
for (const act of [1, 2, 3, 4, 5, 6]) for (const n of [0, 6, 12, 18]) {
  const s = traitScore(act, n);
  ok(traitCount('combat', s) === 0, '一般遭遇不帶特性');
  for (const k of ['elite', 'boss'] as const) { const c = traitCount(k, s); ok(c >= 1 && c <= 3, `${k} 數量 1–3（章${act} N${n}＝${c}）`); }
  ok(traitCount('boss', s, true) === Math.max(0, traitCount('boss', s) - 1), '王座隨行少 1 條');
  ok(maxTier('elite', s) <= 3, '夢魘不出現分級 4'); ok(maxTier('boss', s) <= 4, '分級上限');
  if (maxTier('boss', s) === 4) ok(s >= 6, '分級 4 只在 s≥6');
}
ok(traitCount('elite', traitScore(1, 0)) === 1 && traitCount('boss', traitScore(1, 0)) === 1, '起點 1 條');
ok(traitCount('boss', traitScore(6, 18)) === 3, '終局王座 3 條');
ok(maxTier('boss', traitScore(1, 0)) === 1, '第 1 章僅溫和特性');

// 二、抽取：同種子同結果；分級／不重複／不含神話；參數隨等級
const draw = (seed: number, kind: 'elite' | 'boss', act: number, n: number, fm = 1) => drawBossTraits(new Dice(seed, 0), kind, act, n, fm);
for (let seed = 1; seed <= 200; seed++) for (const [kind, act, n] of [['elite', 1, 0], ['elite', 4, 9], ['boss', 1, 0], ['boss', 3, 6], ['boss', 6, 18]] as const) {
  const a = draw(seed, kind, act, n), b = draw(seed, kind, act, n);
  assert.deepEqual(a, b, '同種子同結果'); checks++;
  const s = traitScore(act, n); ok(a.length === traitCount(kind, s), '數量符合規則');
  ok(new Set(a.map(t => t.id)).size === a.length, '不重複');
  for (const t of a) { ok(BOSS_TRAIT_BY_ID[t.id].tier <= maxTier(kind, s), `${t.id} 分級在上限內`); ok(t.id !== 'myth', '不抽神話'); if (kind === 'boss') ok(t.id !== 'immune', '王座不抽免傷'); }
}
const seenLow = new Set<string>(), seenHigh = new Set<string>();
for (let seed = 1; seed <= 400; seed++) { draw(seed, 'boss', 1, 0).forEach(t => seenLow.add(t.id)); draw(seed, 'boss', 6, 18).forEach(t => seenHigh.add(t.id)); }
ok([...seenLow].every(id => BOSS_TRAIT_BY_ID[id].tier === 1), '第 1 章只抽到分級 1');
ok([...seenHigh].some(id => BOSS_TRAIT_BY_ID[id].tier === 4), '終局能抽到分級 4');
ok(seenHigh.size >= 25, `終局池夠廣（${seenHigh.size}）`);
// 參數：lv 表、固定值乘倍率
ok(traitParams('mend', 0).x === 20 && traitParams('mend', 6).x === 8, '癒合隨等級加強（分母變小）');
ok(traitParams('sharp', 2, 1).x === 220 && traitParams('sharp', 2, 2).x === 440, '固定點數乘固定值倍率');
ok(traitParams('drain', 2, 2).x === BOSS_TRAIT_BY_ID.drain.lv![1] * 2, '生命汲取（真實傷害）預乘固定值倍率');
ok(traitParams('amp', 2, 5).x === BOSS_TRAIT_BY_ID.amp.lv![1], '百分比類不乘倍率');
ok(BOSS_TRAITS.every(t => !t.lv || t.lv.length === 4), 'lv 表長度 4');

// 三、整局：遭遇可重現、一般遭遇無特性、首領保留神話、特性帶入戰鬥
type Opts = { seed: number; nLevel?: number };
const start = (o: Opts) => {
  let run = E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: [], startingShards: 3, seed: o.seed, nLevel: o.nLevel });
  if (run.scene.kind === 'draft') for (const id of run.scene.offer.slice(0, 3)) run = E.toggleDraft(run, id);
  return E.confirmDraft(run, pool);
};
function encounters(o: Opts) {
  let run = start(o); const out: { enc: E.Encounter; battle: ReturnType<typeof E.startBattle>; act: number }[] = [];
  for (let step = 0; step < 500 && run.scene.kind !== 'end'; step++) {
    const sc = run.scene;
    if (sc.kind === 'map') run = E.moveTo(run, E.movesFrom(run)[0].id, pool);
    else if (sc.kind === 'event') { if (sc.outcome) { run = E.backToMap(run); continue; } const ev = EVENT_BY_ID[sc.eventId]; run = E.chooseEvent(run, ev.choices.findIndex(c => !c.require?.(run)), pool); }
    else if (sc.kind === 'shop') run = E.backToMap(run);
    else if (sc.kind === 'rest') run = sc.done ? E.backToMap(run) : E.restAction(run, 'mend');
    else if (sc.kind === 'treasure') run = sc.done ? E.backToMap(run) : E.takeTreasure(run, sc.offer[0]);
    else if (sc.kind === 'altar') run = sc.done ? E.backToMap(run) : E.altarPact(run, 'dark');
    else if (sc.kind === 'recruit') run = E.recruitFromOffer(run, sc.offer[0] ?? null, pool);
    else if (sc.kind === 'prelude') {
      const id = E.battleIdOf(run), b = E.startBattle(run, pool, id)!; out.push({ enc: sc.encounter, battle: b, act: run.act });
      run = E.settleBattleV2(b.run, id, 'p1', b.p1, pool);
    } else if (sc.kind === 'reward') {
      if (sc.reward.relicChoices[0] && !sc.reward.relicTaken) run = E.takeRewardRelic(run, sc.reward.relicChoices[0]);
      if (sc.reward.recruitChoices[0] && !sc.reward.recruitTaken) run = E.takeRewardRecruit(run, sc.reward.recruitChoices[0], pool);
      run = E.leaveReward(run, pool);
    }
  }
  return out;
}
let withTraits = 0, bosses = 0;
for (const o of [{ seed: 11 }, { seed: 12, nLevel: 9 }, { seed: 13, nLevel: 18 }]) {
  const a = encounters(o), b = encounters(o);
  assert.deepEqual(a.map(x => x.enc), b.map(x => x.enc), '同局碼遭遇（含特性）完全相同'); checks++;
  for (const { enc, battle, act } of a) {
    if (enc.kind === 'combat') { ok(enc.enemies.every(e => !e.traits), '一般遭遇無特性'); continue; }
    ok(enc.enemies[0].traits && enc.enemies[0].traits.length >= 1 && enc.enemies[0].traits.length <= 3, `${enc.kind} 領頭 1–3 條`);
    ok(JSON.stringify(JSON.parse(JSON.stringify(enc))) === JSON.stringify(enc), '遭遇可存檔往返');
    const foe = battle!.p2[0]; const held = bossTraitsOf(foe).map(t => t.key).sort();
    assert.deepEqual(held, enc.enemies[0].traits!.map(t => t.id).sort(), '特性實際掛到戰鬥中的敵方精靈'); checks++;
    withTraits++;
    if (enc.kind === 'boss') { bosses++; ok(battle!.enemyRelics.includes(E.BOSS_MYTH_RELIC), '王座保留神話'); ok(act >= 1, ''); } else ok(!battle!.enemyRelics.includes(E.BOSS_MYTH_RELIC), '夢魘不掛神話');
  }
}
ok(withTraits >= 6 && bosses >= 3, `整局覆蓋夢魘與王座（${withTraits}/${bosses}）`);
// 獨立亂數：特性抽取不消耗主亂數
const dA = new Dice(5, 0), dB = new Dice(5, 0); drawBossTraits(traitDice(5, 1, 'x', 0, 0), 'boss', 3, 0); ok(dA.next() === dB.next(), '抽取不動主亂數流');

console.log(`星蝕回廊 BOSS 特性：${checks} 組檢查通過`);
