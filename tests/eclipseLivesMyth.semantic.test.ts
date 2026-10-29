import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { DEFAULT_ELVES } from '../src/data/defaultElvesLoaded';
import * as E from '../src/modes/interstellar/v2/engine';
import { RELICS, RELIC_BY_ID, isRescueRelic } from '../src/modes/interstellar/v2/relics';
import { SUIT_PERKS, perkText } from '../src/modes/interstellar/v2/suitPerks';
import { N_LEVELS, startLivesFor, LIFE_BASE, LIFE_MIN } from '../src/modes/interstellar/v2/levels';
import { EVENTS } from '../src/modes/interstellar/v2/content';
import { runRelicEffects } from '../src/effects/relicEffectRegistry';
import { EffectTiming } from '../src/effects/types';
import { StatusRegistry } from '../src/effects/statusRegistry';

/**
 * 星蝕回廊 2026-10-24：生命制、遺物數值翻倍、章末首領「神話」。
 * 規則見 docs/星蝕迴廊改版設計_20261017.md §13–§15。
 */
const pool = DEFAULT_ELVES;
const alive = (e: any) => e.currentHp > 0;
const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

function setup(seed: number, o: { extra?: number; boss?: boolean; relics?: string[]; equipId?: string; nLevel?: number } = {}) {
  let run = E.createRun({ pool, equipType: 'suit', equipId: o.equipId ?? '', modifiers: [], startingShards: 3, seed, nLevel: o.nLevel });
  if (run.scene.kind === 'draft') for (const id of run.scene.offer.slice(0, 3)) run = E.toggleDraft(run, id);
  run = E.confirmDraft(run, pool);
  const node = E.movesFrom(run).find(n => n.kind === 'combat')!; run = E.moveTo(run, node.id, pool);
  assert.equal(run.scene.kind, 'prelude');
  const more = E.bannablePool(pool).filter(e => !run.team.some(t => t.id === e.id)).slice(0, o.extra ?? 0).map((e, i) => ({ ...e, battleId: `ex-${i}`, currentHp: e.maxHp }) as any);
  for (const id of o.relics ?? []) run = E.gainRelic(run, id);
  run = { ...run, team: [...run.team, ...more] };
  if (o.boss && run.scene.kind === 'prelude') run = { ...run, scene: { kind: 'prelude', encounter: { ...run.scene.encounter, kind: 'boss' } } };
  return run;
}
/** 開戰後讓出戰名單的前 n 隻倒下，winner 指定勝負 */
function fight(run: E.RunV2, fall: number, winner: 'p1' | 'p2' | 'exit', tag = 'x') {
  const id = `b-${tag}-${run.nonce}`, b = E.startBattle(run, pool, id); assert.ok(b, '可開戰');
  const team = b!.p1.map((e, i) => i < fall ? { ...e, currentHp: 0 } : e);
  return E.settleBattleV2(b!.run, id, winner, team, pool);
}

// ───────── 一、N 表：初始生命
{
  assert.equal(LIFE_BASE, 5); assert.equal(LIFE_MIN, 2);
  const table = Array.from({ length: 19 }, (_, n) => startLivesFor(n));
  assert.deepEqual(table, [5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], '每 3 階 −1，最低 2');
  for (const n of [3, 6, 9]) assert.ok(N_LEVELS[n - 1].text.includes('初始生命 −1'), `N${n} 文案寫明初始生命 −1`);
  for (const n of [0, 3, 9, 18]) assert.equal(setup(11, { nLevel: n }).lives, startLivesFor(n), `開局生命 N${n}`);
  assert.equal(setup(11).tempLives, 0);
  // 套裝特權：烈焰機甲開局永久生命 +1；星光守護者每章臨時生命 +1（開局即有）；N12 起特權失效
  assert.equal(setup(11, { equipId: 'inferno_mecha' }).lives, 6);
  assert.equal(setup(11, { equipId: 'starlight_guardian' }).tempLives, 1);
  assert.equal(setup(11, { equipId: 'inferno_mecha', nLevel: 12 }).lives, startLivesFor(12));
  assert.ok(perkText(SUIT_PERKS.inferno_mecha.perk).includes('初始生命 +1')); assert.ok(perkText(SUIT_PERKS.starlight_guardian.perk).includes('每章臨時生命 +1'));
}

// ───────── 二、每場結束依「本場倒下」的我方精靈數扣生命
{
  const run = setup(12, { extra: 3 });
  assert.equal(run.lives, 5);
  for (const fall of [0, 1, 2]) {
    const lost = fight(run, fall, 'p2', `f${fall}`);   // 戰敗：回地圖
    assert.equal(lost.lives, 5 - fall, `戰敗倒下 ${fall} 隻 → 扣 ${fall}`); assert.equal(lost.scene.kind, 'map');
    const won = fight(run, fall, 'p1', `w${fall}`);    // 勝利：照樣扣，進獎勵
    assert.equal(won.lives, 5 - fall, `勝利倒下 ${fall} 隻 → 扣 ${fall}`); assert.equal(won.scene.kind, 'reward');
    assert.equal(won.lastLifeLoss?.lost, fall); assert.equal(won.lastLifeLoss?.fallen.length, fall);
  }
  // 戰前就倒下的不重複計：先倒 1 隻，下一場再倒 1 隻，只算新倒下的
  let r2 = fight(run, 1, 'p1', 'a'); assert.equal(r2.lives, 4);
  r2 = E.leaveReward(r2, pool); assert.equal(r2.scene.kind, 'map');
  const again = E.moveTo(r2, E.movesFrom(r2).find(n => n.kind === 'combat')?.id ?? E.movesFrom(r2)[0].id, pool);
  if (again.scene.kind === 'prelude') { const n2 = fight(again, 0, 'p1', 'b'); assert.equal(n2.lives, 4, '本場無人新倒下 → 不扣（先前倒下者不再計）'); }
  // 紀事與戰後結算文字
  const w = fight(run, 2, 'p1', 'text'); assert.ok(E.lifeLossText(w.lastLifeLoss!).includes('生命 −2'));
  assert.ok(w.chronicle[1].includes('生命 −2') || w.chronicle[0].includes('生命 −2'), '紀事記錄扣除量');
  assert.ok(E.lifeLossText({ lost: 0, fromTemp: 0, fromPerm: 0, fallen: [], fights: 0 }).includes('不扣'));
}

// ───────── 三、臨時生命優先扣除、永久後扣；換章清空
{
  let run = setup(13, { extra: 3 }); run = { ...run, tempLives: 2 };
  const a = fight(run, 1, 'p1', 't1'); assert.deepEqual([a.tempLives, a.lives], [1, 5], '先扣臨時');
  const b = fight(run, 3, 'p1', 't3'); assert.deepEqual([b.tempLives, b.lives], [0, 4], '臨時 2 扣完，再扣永久 1');
  assert.deepEqual([b.lastLifeLoss!.fromTemp, b.lastLifeLoss!.fromPerm], [2, 1]);
  assert.ok(E.lifeLossText(b.lastLifeLoss!).includes('臨時 −2') && E.lifeLossText(b.lastLifeLoss!).includes('永久 −1'));
  assert.equal(E.livesOf(run), 7);
  // 換章：臨時歸零（首領獎勵的永久生命 +1 保留）。星光守護者每章重新給 1 點、餘燼燈芯每章 +1
  const bossRun = setup(13, { boss: true, extra: 1, relics: ['ember_wick'] });
  assert.equal(bossRun.tempLives, 1, '餘燼燈芯取得時臨時生命 +1');
  const won = fight({ ...bossRun, tempLives: 4 }, 0, 'p1', 'boss');
  assert.equal(won.scene.kind, 'reward'); assert.equal((won.scene as any).reward.lives, E.BOSS_LIFE_REWARD); assert.equal(won.lives, 6, '首領獎勵：永久生命 +1');
  assert.equal(won.tempLives, 4, '領獎前臨時生命仍在');
  const nextAct = E.leaveReward(won, pool);
  assert.equal(nextAct.act, 2); assert.equal(nextAct.tempLives, 1, '換章：臨時生命清空，只剩餘燼燈芯本章的 1 點'); assert.equal(nextAct.lives, 6, '永久生命不清');
  const plain = E.leaveReward(fight({ ...setup(13, { boss: true }), tempLives: 3 }, 0, 'p1', 'boss2'), pool);
  assert.equal(plain.tempLives, 0, '沒有來源的臨時生命換章後清空');
  const guardian = E.leaveReward(fight({ ...setup(13, { boss: true, equipId: 'starlight_guardian' }), tempLives: 5 }, 0, 'p1', 'boss3'), pool);
  assert.equal(guardian.tempLives, 1, '套裝特權：每章開始臨時生命 +1');
}

// ───────── 四、生命歸 0 ＝ 失敗結算；首領戰敗／放棄只扣生命
{
  const run = setup(14, { extra: 2 });
  const dead = fight({ ...run, lives: 2, tempLives: 0 }, 2, 'p2', 'zero');
  assert.equal(dead.scene.kind, 'end'); assert.equal((dead.scene as any).result, 'wiped'); assert.equal((dead.scene as any).cause, 'lives'); assert.equal(dead.lives, 0);
  assert.ok(E.DEFEAT_TEXT.lives.includes('生命')); assert.ok(dead.chronicle[0].includes('生命耗盡'));
  // 臨時生命算入總量：永久 1＋臨時 1 倒下 2 隻 → 歸 0；倒下 1 隻 → 還活著
  assert.equal(fight({ ...run, lives: 1, tempLives: 1 }, 2, 'p2', 'tl').scene.kind, 'end');
  const surv = fight({ ...run, lives: 1, tempLives: 1 }, 1, 'p2', 'tl2'); assert.equal(surv.scene.kind, 'map'); assert.deepEqual([surv.lives, surv.tempLives], [1, 0]);
  // 勝利也一樣：贏了但生命歸 0 仍是失敗
  assert.equal(fight({ ...run, lives: 2, tempLives: 0 }, 2, 'p1', 'win0').scene.kind, 'end');
  // 首領戰敗：只扣生命，回到迎戰前；放棄同理；生命不夠才失敗
  const boss = setup(14, { boss: true, extra: 2 });
  const lost = fight(boss, 3, 'p2', 'bl'); assert.equal(lost.scene.kind, 'prelude'); assert.equal(lost.lives, 2); assert.equal((lost.scene as any).encounter.kind, 'boss');
  const left = fight(boss, 0, 'exit', 'bx'); assert.equal(left.scene.kind, 'prelude'); assert.equal(left.lives, 5);
  assert.equal(fight({ ...boss, lives: 3 }, 3, 'p2', 'bz').scene.kind, 'end');
  // 全隊倒下但生命夠：以生命換回隊伍，全員 30% 復甦
  const wipe = fight(setup(14), 3, 'p2', 'wipe'); assert.equal(wipe.scene.kind, 'map'); assert.ok(wipe.team.every(alive)); assert.equal(wipe.lives, 2);
  // 種子可重現：同局同操作結果完全相同
  const j = (r: E.RunV2) => JSON.stringify({ l: r.lives, t: r.tempLives, s: r.scene.kind, n: r.nonce, e: r.eclipse, c: r.chronicle.slice(0, 3), loss: r.lastLifeLoss });
  assert.equal(j(fight(setup(14, { extra: 2 }), 2, 'p1', 'r')), j(fight(setup(14, { extra: 2 }), 2, 'p1', 'r')));
}

// ───────── 五、保命遺物與逆命者：改為「本場不扣生命」
{
  assert.ok(['substitute_doll', 'undying_core', 'reverse_hourglass'].every(id => isRescueRelic(id) && /本場不扣生命|生命將歸零/.test(RELIC_BY_ID[id].desc)), '描述改為生命制');
  const lethal = (r: E.RunV2, fall: number) => ({ ...r, lives: fall, tempLives: 0 });
  // 替身人偶：致命時本場不扣生命（輸或贏都一樣）；贏的話照常領獎勵
  const doll = setup(15, { extra: 1, relics: ['substitute_doll', 'atk_bead'] });
  const lose = fight(lethal(doll, 3), 3, 'p2', 'd1'); assert.equal(lose.scene.kind, 'map'); assert.equal(lose.lives, 3, '沒扣生命'); assert.ok(!lose.relics.includes('substitute_doll'));
  const win = fight(lethal(doll, 3), 3, 'p1', 'd2'); assert.equal(win.scene.kind, 'reward', '贏了照領獎勵'); assert.equal(win.lives, 3); assert.equal(win.lastLifeLoss?.saved, 'substitute_doll');
  assert.ok(win.team.every(e => e.currentHp / e.maxHp >= .79), '全隊 80% 體力');
  // 不致命時保命遺物不動
  const calm = fight(doll, 2, 'p2', 'd3'); assert.ok(calm.relics.includes('substitute_doll')); assert.equal(calm.lives, 3);
  // 不滅星核：贏的話不重戰；輸的話重戰；全隊 100%
  const core = setup(16, { extra: 1, relics: ['undying_core'] });
  assert.equal(fight(lethal(core, 3), 3, 'p1', 'c1').scene.kind, 'reward'); assert.equal(fight(lethal(core, 3), 3, 'p2', 'c2').scene.kind, 'prelude');
  assert.ok(fight(lethal(core, 3), 3, 'p2', 'c3').team.every(e => e.currentHp === e.maxHp));
  // 逆時沙漏：回到戰前（含生命），蝕度 +10，可改隊重戰
  const glass = setup(17, { extra: 1, relics: ['reverse_hourglass'] });
  const glL = lethal(glass, 3), gl = fight(glL, 3, 'p2', 'g1'); assert.equal(gl.scene.kind, 'prelude'); assert.equal(gl.eclipse, glass.eclipse + 10); assert.equal(gl.lives, glL.lives, '生命回到戰前');
  // 逆命者：每局一次，致命時本場不扣生命，全隊 30%
  const fate = setup(18, { extra: 1, equipId: 'fate_defier' });
  assert.equal(E.rescueSources(fate)[0], 'perk:fate_defier');
  const f1 = fight(lethal(fate, 3), 3, 'p2', 'f1'); assert.equal(f1.scene.kind, 'map'); assert.equal(f1.lives, 3); assert.equal(f1.lifelineUsed, true); assert.ok(f1.team.every(e => e.currentHp / e.maxHp >= .29));
  assert.equal(fight(lethal({ ...fate, lifelineUsed: true }, 3), 3, 'p2', 'f2').scene.kind, 'end', '第二次沒有了');
  // 沒有保命：致命就是失敗
  assert.equal(fight(lethal(setup(19, { extra: 1 }), 3), 3, 'p2', 'n1').scene.kind, 'end');
}

// ───────── 六、生命來源：遺物、事件、首領、商店
{
  const base = setup(20, { extra: 1 });
  const lotus = E.gainRelic(base, 'life_lotus'); assert.equal(lotus.lives, base.lives + 1);
  const heart = E.gainRelic(base, 'lantern_heart'); assert.equal(heart.lives, base.lives + 1, '提燈者之心：永久生命 +1');
  const wick = E.gainRelic(base, 'ember_wick'); assert.equal(wick.tempLives, 1); assert.equal(wick.lives, base.lives);
  for (const id of ['life_lotus', 'ember_wick', 'lantern_heart']) assert.ok(/生命/.test(RELIC_BY_ID[id].desc), `${id} 描述寫明生命`);
  // 事件：守夜人的燭台、縫命婆婆
  const ev = (id: string, idx: number, patch: Partial<E.RunV2> = {}) => E.chooseEvent({ ...base, ...patch, scene: { kind: 'event', eventId: id } } as E.RunV2, idx, pool);
  assert.ok(EVENTS.some(e => e.id === 'night_watch') && EVENTS.some(e => e.id === 'stitch_crone'));
  const c1 = ev('night_watch', 0, { beans: 100 }); assert.equal(c1.tempLives, 2); assert.equal(c1.beans, 0);
  const c2 = ev('night_watch', 1, { shards: 2 }); assert.equal(c2.lives, base.lives + 1); assert.equal(c2.shards, 0);
  assert.equal(ev('night_watch', 0, { beans: 99 }).tempLives, 0, '豆不夠不可選');
  assert.equal(ev('stitch_crone', 0).lives, base.lives + 1); assert.equal(ev('stitch_crone', 1).tempLives, 1);
  // 商店：臨時 80、永久 240（每買一次 +50%），章節係數同其他商品
  let shop: E.RunV2 | null = null;
  for (let step = 0, r = setup(21, { extra: 0 }); step < 400 && !shop; step++) {
    if (r.scene.kind === 'shop') { shop = r; break; }
    if (r.scene.kind === 'map') { const m = E.movesFrom(r); if (!m.length) break; r = E.moveTo(r, (m.find(n => n.kind === 'shop') ?? m[0]).id, pool); }
    else if (r.scene.kind === 'prelude') { const b = E.startBattle(r, pool, `s${step}`)!; r = E.settleBattleV2(b.run, `s${step}`, 'p1', b.p1, pool); }
    else if (r.scene.kind === 'reward') r = E.leaveReward(r, pool); else if (r.scene.kind === 'event') r = r.scene.outcome ? E.backToMap(r) : E.chooseEvent(r, r.scene.eventId === 'night_watch' ? 2 : 0, pool); else r = E.backToMap(r);
  }
  assert.ok(shop, '找到商店'); const sc = (shop as E.RunV2).scene as any;
  const iT = sc.stock.findIndex((s: any) => s.kind === 'life' && s.ref === 'temp'), iP = sc.stock.findIndex((s: any) => s.kind === 'life' && s.ref === 'perm');
  assert.ok(iT >= 0 && iP >= 0, '商店有臨時與永久生命'); assert.ok(sc.stock[iP].price > sc.stock[iT].price * 2);
  const rich = { ...(shop as E.RunV2), beans: 9999 };
  const t = E.shopBuy(rich, iT, pool); assert.equal(t.tempLives, rich.tempLives + 1); assert.equal(t.beans, rich.beans - sc.stock[iT].price); assert.ok((t.scene as any).stock[iT].sold);
  const p = E.shopBuy(rich, iP, pool); assert.equal(p.lives, rich.lives + 1); assert.equal(p.lifeBought, 1);
  assert.equal(E.shopBuy(p, iP, pool), p, '已售不可再買');
  assert.equal(E.shopBuy({ ...rich, beans: 1 }, iP, pool).lives, rich.lives, '豆不夠不可買');
}

// ───────── 七、舊存檔遷移：沒有生命欄位 → 依 N 等級給預設生命
{
  const fresh = setup(22, { nLevel: 6 });
  const old: any = { ...fresh }; delete old.lives; delete old.tempLives; delete old.lifeBought; delete old.lastLifeLoss;
  const st = store(); st.setItem(E.RUN_KEY_V2, JSON.stringify(old));
  const loaded = E.loadRunV2(st)!;
  assert.equal(loaded.lives, startLivesFor(6)); assert.equal(loaded.tempLives, 0); assert.equal(loaded.lifeBought, 0);
  const oldPerk: any = { ...setup(22, { equipId: 'inferno_mecha' }) }; delete oldPerk.lives; delete oldPerk.tempLives;
  st.setItem(E.RUN_KEY_V2, JSON.stringify(oldPerk)); assert.equal(E.loadRunV2(st)!.lives, 6, '舊存檔：預設生命含套裝特權');
  // 已有生命的存檔不被覆蓋；舊的敗因仍可顯示
  st.setItem(E.RUN_KEY_V2, JSON.stringify({ ...fresh, lives: 2, tempLives: 3 })); const kept = E.loadRunV2(st)!; assert.deepEqual([kept.lives, kept.tempLives], [2, 3]);
  for (const c of ['wipe', 'boss', 'exit', 'lives'] as const) assert.ok(E.DEFEAT_TEXT[c]);
}

// ───────── 八、遺物翻倍（2026-10-24）：全部數值 ×2；倍率型 ×2；機率類上限 100%
{
  // 翻倍前的數值（面板加成、百分比加成、倍增、局內修正），逐項對照
  const OLD: Record<string, any> = {
    atk_bead: { panel: { atk: 50 } }, spatk_bead: { panel: { spatk: 50 } }, def_bead: { panel: { def: 50 } }, spdef_bead: { panel: { spdef: 50 } }, speed_bead: { panel: { speed: 25 } }, hp_bead: { panel: { hp: 100 } },
    mul_prism: { mul: 1.15 }, mul_cluster: { mul: 1.5 }, twin_core: { mul: 2 }, black_sun_heart: { mulAtk: 3, mulDef: 0.5 },
    strong_atk_bead: { panel: { atk: 150 } }, strong_spatk_bead: { panel: { spatk: 150 } }, strong_def_bead: { panel: { def: 150 } }, strong_spdef_bead: { panel: { spdef: 150 } }, strong_speed_bead: { panel: { speed: 75 } },
    dean_blade: { panel: { atk: 150 } }, ray_wing: { panel: { speed: 100 } }, gravity_boots: { panel: { speed: 40 } }, ancient_armor_plate: { panel: { def: 150, spdef: 150 } }, quantum_chip: { panel: { spatk: 200, speed: 30 } },
    puni_robe: { panel: { hp: 80, atk: 80, def: 80, spatk: 80, spdef: 80, speed: 80 } }, holy_spirit_soul: { panel: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 } }, gaia_fist: { panel: { atk: 250, def: -50 } },
    throne_shard: { pct: .08 },
    black_cat_bell: { run: { shopMult: .85 } }, gold_tooth: { run: { beansMult: .3 } }, potion_belt: { run: { potions: 2 } }, apothecary_lamp: { run: { potions: 1 } },
    dead_compass: { run: { eclipsePerMove: -2 } }, old_key: { run: { eliteRelicChoice: 1 } }, lantern_heart: { run: { lineupBonus: 1, restHealMult: 1.5 } },
    curse_greed: { run: { shopMult: 1.25 } }, curse_insomnia: { run: { restHealMult: .5 } }, curse_mirror: { run: { eclipsePerMove: 3 } }, black_sun: { run: { eclipsePerMove: 2 } }, pale_contract: { run: { beansMult: -.3 } },
  };
  const approx = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}：${a} ≠ ${b}`);
  for (const [id, o] of Object.entries(OLD)) {
    const r = RELIC_BY_ID[id]; assert.ok(r, id);
    if (o.panel) for (const [k, v] of Object.entries(o.panel as Record<string, number>)) assert.equal((r.panel as any)[k], v * 2, `${id}.${k} 翻倍`);
    if (o.mul) for (const k of ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed']) approx((r.panelMul as any)[k], o.mul * 2, `${id} 倍率 ×2`);
    if (o.mulAtk) { approx(r.panelMul!.atk!, o.mulAtk * 2, `${id} 攻擊倍率`); approx(r.panelMul!.spatk!, o.mulAtk * 2, `${id} 特攻倍率`); approx(r.panelMul!.def!, o.mulDef / 2, `${id} 防禦倍率（減半再減半）`); }
    if (o.pct) for (const k of ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed']) approx((r.panelPct as any)[k], o.pct * 2, `${id} 百分比`);
    if (o.run) for (const [k, v] of Object.entries(o.run as Record<string, number>)) {
      const nv = (r.run as any)[k];
      if (k === 'shopMult' && v < 1) approx(nv, 1 - (1 - v) * 2, `${id} 折扣翻倍`);
      else if (k === 'shopMult') approx(nv, 1 + (v - 1) * 2, `${id} 加價翻倍`);
      else if (k === 'restHealMult' && v < 1) approx(nv, v / 2, `${id} 修復減半再減半`);
      else if (k === 'restHealMult') approx(nv, 1 + (v - 1) * 2, `${id} 修復加成翻倍`);
      else approx(nv, v * 2, `${id}.${k}`);
    }
  }
  // 描述與數值同步：單一能力的面板型遺物，描述必須含「+新值」
  const NAME: Record<string, string> = { hp: '體力', atk: '攻擊', def: '防禦', spatk: '特攻', spdef: '特防', speed: '速度' };
  for (const r of RELICS) if (r.panel && Object.keys(r.panel).length === 1) { const [k, v] = Object.entries(r.panel)[0]; assert.ok(r.desc.includes(`${NAME[k]} ${v > 0 ? '+' : '−'}${Math.abs(v)}`), `${r.id} 描述同步：${r.desc}`); }
  assert.ok(RELIC_BY_ID.mul_prism.desc.includes('×2.3') && RELIC_BY_ID.mul_cluster.desc.includes('×3') && RELIC_BY_ID.twin_core.desc.includes('×4') && RELIC_BY_ID.black_sun_heart.desc.includes('×6') && RELIC_BY_ID.black_sun_heart.desc.includes('×0.25'));
  assert.ok(RELIC_BY_ID.gold_tooth.desc.includes('+60%') && RELIC_BY_ID.black_cat_bell.desc.includes('−30%') && RELIC_BY_ID.dead_compass.desc.includes('−4') && RELIC_BY_ID.curse_mirror.desc.includes('+6'));
  // 戰鬥效果：傷害、減傷、治療、固定值
  const comp = (incoming: boolean, cat = 'skill_attack') => ({ isIncoming: incoming, damageCategory: cat, increasePercent: 0, decreasePercent: 0 });
  const ctx: any = { actor: 'p1', self: { currentHp: 100, maxHp: 1000 }, target: { battleStatus: 'burn' }, applyHeal: () => {}, addLog: () => {} };
  const out = (id: string, extra: Record<string, any> = {}) => { const c: any = comp(false); runRelicEffects([id], { ...ctx, ...extra }, EffectTiming.BEFORE_DAMAGE, { damageComp: c }); return c.increasePercent; };
  const inn = (id: string, cat = 'skill_attack') => { const c: any = comp(true, cat); runRelicEffects([id], ctx, EffectTiming.BEFORE_DAMAGE, { damageComp: c }); return c.decreasePercent; };
  approx(out('rusted_gear'), .16, '鏽蝕齒輪'); approx(out('justin_arm'), .3, '賈斯汀之臂'); approx(out('silver_wing'), .4, '銀翼獵手'); approx(out('black_sun'), .6, '黑太陽'); approx(out('curse_dud'), -.2, '啞火詛咒');
  approx(out('third_eye'), .6, '第三隻眼'); approx(out('blood_watch'), .7, '血契懷錶'); approx(out('eclipse_crown:40'), .4, '星蝕之冠：蝕度 40 → +40%');
  approx(inn('ash_charm'), .16, '灰燼護符'); approx(inn('dmg_reduction_bead'), .2, '減傷能量珠'); approx(inn('pale_contract'), .4, '蒼白契約'); approx(inn('faceless_mask'), .6, '無面者面具'); approx(inn('silver_stitch', 'fixed'), .75, '銀線縫合（減傷上限 75%）');
  assert.ok(inn('silver_stitch') === 0, '銀線縫合不減技能攻擊');
  const heals: number[] = []; const hctx: any = { ...ctx, self: { currentHp: 100, maxHp: 1000 }, applyHeal: (_s: string, n: number) => heals.push(n) };
  runRelicEffects(['moth_wing'], hctx, EffectTiming.ROUND_END); runRelicEffects(['abyss_cradle'], hctx, EffectTiming.ROUND_END); runRelicEffects(['tear_vial'], hctx, EffectTiming.ROUND_END);
  runRelicEffects(['dry_chalice'], hctx, EffectTiming.BATTLE_PHASE_END, { killedOpponent: true }); runRelicEffects(['six_wing'], hctx, EffectTiming.BATTLE_PHASE_END, { killedOpponent: true });
  assert.deepEqual(heals, [80, 160, 300, 200, 400], '燈蛾 8%、深淵搖籃 16%、淚滴瓶 30%、聖杯 20%、六翼 40%');
  const losses: number[] = []; const lctx: any = { ...ctx, adjustHp: (_s: string, n: number) => losses.push(n) };
  runRelicEffects(['curse_bone'], lctx, EffectTiming.ROUND_END); runRelicEffects(['faceless_mask'], lctx, EffectTiming.ROUND_END);
  assert.deepEqual(losses, [-60, -60], '蝕骨詛咒、無面者面具每回合失去 6%');
  // 機率類上限 100%：蛛網紡錘 20% → 40%（回合開始、疲憊 2 回合），不會超過 100%
  const statuses: any[] = []; const sctx: any = { ...ctx, targetSide: 'p2', applyStatusWithImmunityCheck: (_s: string, st: string, turns: number) => { statuses.push([st, turns]); return { success: true }; } };
  let hit = 0; for (let i = 0; i < 400; i++) runRelicEffects(['web_spindle'], sctx, EffectTiming.ROUND_START);
  hit = statuses.length; assert.ok(hit > 400 * .3 && hit < 400 * .5, `蛛網紡錘約 40%：${hit}/400`); assert.ok(statuses.every(([s, t]) => s === '疲憊' && t === 2));
  // 面板：能量珠、倍增、固定值
  const s = { hp: 1000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 };
  const { applyRelicPanel } = await import('../src/modes/interstellar/v2/relics');
  assert.equal(applyRelicPanel(s, ['atk_bead']).atk, 200); assert.equal(applyRelicPanel(s, ['hp_bead']).hp, 1200); assert.ok(Math.abs(applyRelicPanel(s, ['throne_shard']).atk - 116) <= 1);
  // 虛空護盾 1000、藥師提燈新章藥劑 +4、提燈者之心出戰上限 +2
  const shield = E.startBattle({ ...setup(23), relics: ['void_shield_gen'] }, pool, 'v')!; assert.equal(shield.p1[0].shield, 1000);
  const lamp = E.leaveReward(fight({ ...setup(23, { boss: true }), relics: ['apothecary_lamp'], potions: 0 }, 0, 'p1', 'lamp'), pool); assert.equal(lamp.potions, 3 + 4);
  assert.equal(E.lineupSlots({ ...setup(23), relics: ['lantern_heart'] }), 3 + 2);
  // 商店折扣下限 ×0.5（開放折扣疊加）：現有遺物＋套裝為 0.7×0.9，不被夾；疊到下限以下才夾在 ×0.5
  const cheap = { ...setup(23, { equipId: 'venom_armor' }), relics: ['black_cat_bell'] } as E.RunV2;
  assert.equal(E.SHOP_DISCOUNT_FLOOR, .5); approx(E.mods(cheap).shopMult, .63, '鈴鐺×套裝 = 0.63（高於下限，不夾）'); approx(E.mods({ ...setup(23), relics: ['black_cat_bell'] } as E.RunV2).shopMult, .7, '單件鈴鐺 ×0.7');
  approx(E.mods({ ...cheap, relics: ['black_cat_bell', 'black_cat_bell'] } as E.RunV2).shopMult, E.SHOP_DISCOUNT_FLOOR, '疊到下限以下時夾在 ×0.5');
}

// ───────── 九、章末首領「神話」異常：既有 BOSS_ONLY 狀態，任一方首次出手時激活
{
  // 既有定義（不重做）：免疫能力下降與異常、PP 無限、必中；BOSS 專用、無回合數
  const def = (StatusRegistry as any)['神話'];
  assert.ok(def.categories.includes('BOSS_ONLY')); assert.deepEqual(def.mechanics[0].params, { immuneStatDebuff: true, immuneStatus: true, infinitePP: true, sureHit: true });
  // 遭遇：只有章末首領帶神話；一般遭遇與夢魘沒有
  const boss = E.startBattle(setup(24, { boss: true }), pool, 'm1')!;
  assert.ok(boss.enemyRelics.includes(E.BOSS_MYTH_RELIC), '章末首領：敵方遺物清單含 boss_myth'); assert.ok(!boss.relics.includes(E.BOSS_MYTH_RELIC), '我方沒有');
  assert.ok(!E.startBattle(setup(24), pool, 'm2')!.enemyRelics.includes(E.BOSS_MYTH_RELIC), '一般遭遇沒有神話');
  const elite = setup(24); const eliteRun = { ...elite, scene: { kind: 'prelude', encounter: { ...(elite.scene as any).encounter, kind: 'elite' } } } as E.RunV2;
  assert.ok(!E.startBattle(eliteRun, pool, 'm3')!.enemyRelics.includes(E.BOSS_MYTH_RELIC), '夢魘沒有神話');
  // 處理器：己方首次出手（BEFORE_ACTION）或對手首次出手（OPPONENT_ACTION）才激活；登場、回合開始不會；已有或倒下不重複
  const applied: any[] = []; const self: any = { name: '首領', currentHp: 100, maxHp: 100, battleStatuses: {} };
  const mk = (over: any = {}): any => ({ actor: 'p2', self: { ...self, ...over }, applyStatusWithImmunityCheck: (side: string, st: string, turns: number) => { applied.push([side, st, turns]); return { success: true }; }, addLog: () => {} });
  for (const ev of [EffectTiming.ON_ENTRANCE, EffectTiming.ROUND_START, EffectTiming.ROUND_END, EffectTiming.BATTLE_START]) runRelicEffects(['boss_myth'], mk(), ev);
  assert.equal(applied.length, 0, '登場／回合開始不激活');
  runRelicEffects(['boss_myth'], mk(), EffectTiming.BEFORE_ACTION); assert.deepEqual(applied, [['p2', '神話', 999]], '首領自己先出手');
  runRelicEffects(['boss_myth'], mk(), EffectTiming.OPPONENT_ACTION); assert.equal(applied.length, 2, '對手先出手');
  runRelicEffects(['boss_myth'], mk({ battleStatuses: { 神話: 999 } }), EffectTiming.BEFORE_ACTION); assert.equal(applied.length, 2, '已激活不重複');
  runRelicEffects(['boss_myth'], mk({ currentHp: 0 }), EffectTiming.BEFORE_ACTION); assert.equal(applied.length, 2, '倒下者不激活');
}

// ───────── 十、真實戰鬥（headless 引擎）：首次出手前沒有神話，任一方先出手後都有
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
try {
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { getStatuses } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const skill = (name: string) => ({ name, category: '物理', type: '普通', power: 40, pp: 5, maxPp: 5, isSureHit: false, description: '' });
  const elf = (id: string, speed: number, hp = 1_000_000): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, calculatedStats: { hp, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, statStages: {}, skills: [skill('打')] });
  const play = async (playerSpeed: number, bossSpeed: number, enemyRelics: string[]) => {
    delete (globalThis as any).__BATTLE_SEED__;
    const engine = createBattleEngine({ initialP1Team: [elf('P', playerSpeed)], initialP2Team: [elf('B', bossSpeed)], p1StarterId: 'P', p2StarterId: 'B', battleMode: 'PVE', preparedTeams: true, isFast: () => true, randomSeed: 7,
      interstellarOptions: { relics: [], enemyRelics, onPotionUse: () => true, maxPotionUsage: 3 } });
    engine.mount(); engine.start(); await engine.idle();
    const before = { ...getStatuses(engine.getState().p2) };
    engine.onSkillSelect('p1', engine.getState().p1.skills[0]); engine.onSkillSelect('p2', engine.getState().p2.skills[0]); await engine.idle();
    const st = engine.getState(); const after = { ...getStatuses(st.p2) }; const ppAfter = st.p2.skills[0].pp, playerStatuses = { ...getStatuses(st.p1) }; engine.unmount();
    return { before, after, ppAfter, playerStatuses };
  };
  for (const [label, ps, bs] of [['玩家先手', 200, 100], ['首領先手', 100, 200]] as const) {
    const r = await play(ps, bs, ['boss_myth']);
    assert.equal(r.before['神話'], undefined, `${label}：開戰、登場時還沒有神話`);
    assert.ok(r.after['神話'] > 0, `${label}：任一方首次出手後激活`); assert.equal(r.ppAfter, 5, `${label}：神話 PP 無限`);
    assert.equal(r.playerStatuses['神話'], undefined, '只掛在首領身上');
  }
  const none = await play(200, 100, []); assert.equal(none.after['神話'], undefined, '沒有 boss_myth 就沒有神話'); assert.ok(none.ppAfter < 5, '一般精靈會耗 PP');
} finally { await server.close(); }

console.log('星蝕回廊：生命制（N 表、倒下數扣除、臨時優先與換章清空、歸 0 失敗、保命新規則、來源、舊存檔遷移）、遺物翻倍、首領神話通過');
