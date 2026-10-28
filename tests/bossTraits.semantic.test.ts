import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { BOSS_TRAITS, BOSS_TRAIT_BY_ID, BOSS_TRAIT_BY_STATUS, bossTraitIcon, bossTraitText, bossTraitInstanceText } from '../src/data/bossTraits';
import { StatusRegistry } from '../src/effects/statusRegistry';
import { statusVisual } from '../src/battle/effectIcons';
import { EffectTiming } from '../src/effects/types';
import { advanceStatusEffect } from '../src/battle/statusLifecycle';
import { attachBossTraits, runBossTraitEffects, bossTraitsOf, bossTraitEvade, bossTraitInvalidates, bossTraitBlocksInstantKill, checkBossTraitFatalResist, bossTraitActionIssue, bossTraitOperations } from '../src/blocks/ops/bossTraits';
import { clearAllStatuses, getStatuses } from '../src/utils/battleHelpers';

/**
 * 原廠 BOSS 特性（37 條）：資料、異常資料庫、效果語意。每條特性在 P1／P2 兩側各驗一次。
 * 戰鬥語意用真實 headless 引擎（createBattleEngine）；機率與難以在單回合重現者用 mock 上下文驗證時點與數值。
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIDES = ['p1', 'p2'] as const;
type Side = (typeof SIDES)[number];
const other = (s: Side): Side => (s === 'p1' ? 'p2' : 'p1');
const approx = (a: number, b: number, tol: number, msg: string) => assert.ok(Math.abs(a - b) <= tol, `${msg}：${a} ≉ ${b}`);
let checks = 0;
const check = async (name: string, fn: () => void | Promise<void>) => { try { await fn(); checks++; } catch (e) { console.error(`✗ ${name}`); throw e; } };

// ───────── 一、資料與異常資料庫
await check('37 條特性：id／狀態／名稱不重複，BWIKI 名稱逐一對上', () => {
  const wiki = JSON.parse(fs.readFileSync(path.join(root, 'docs/data/seerapi/boss_traits.json'), 'utf8')).items as any[];
  assert.equal(wiki.length, 37); assert.equal(BOSS_TRAITS.length, 37);
  assert.equal(new Set(BOSS_TRAITS.map(t => t.id)).size, 37); assert.equal(new Set(BOSS_TRAITS.map(t => t.status)).size, 37);
  assert.deepEqual(BOSS_TRAITS.map(t => t.name), wiki.map(w => w.name_tw), '順序與名稱同 BWIKI 整理檔');
  assert.deepEqual(BOSS_TRAITS.map(t => t.cat), wiki.map(w => w.category_tw), '分類同 BWIKI 整理檔');
});
await check('每條特性都是 BOSS_ONLY 狀態（神話沿用既有），含說明、參數預設與圖示', () => {
  for (const t of BOSS_TRAITS) {
    const entry = StatusRegistry[t.status];
    assert.ok(entry, `${t.name}：已登記`); assert.deepEqual(entry.categories, ['BOSS_ONLY'], `${t.name}：BOSS_ONLY`);
    assert.ok(entry.description.length > 10, `${t.name}：有說明`); assert.ok(!/\{[xys]\}/.test(bossTraitText(t)), `${t.name}：說明沒有殘留佔位`);
    if (t.conf === 'existing') { assert.equal(t.status, '神話'); continue; }
    assert.equal(entry.name, t.status); assert.equal((entry.mechanics[0].params as any).bossTrait, t.id);
    for (const k of Object.keys(t.def)) assert.equal((entry.mechanics[0].params as any)[k], (t.def as any)[k], `${t.name}.${k} 預設值寫入狀態參數`);
    for (const k of Object.keys(t.def)) assert.ok((t.lab as any)[k], `${t.name}：參數 ${k} 有名稱`);
    if (t.lv) assert.equal(t.lv.length, 4);
    assert.equal(statusVisual(t.status)?.icon, bossTraitIcon(t)); assert.equal(statusVisual(t.status)?.category, 'BOSS_ONLY');
  }
  assert.equal(statusVisual('神話')?.icon, '/seer/abnormal/17.png', '神話圖示不動');
  assert.ok(StatusRegistry['神話'].description.includes('命中率強制 100%') && StatusRegistry['神話'].description.includes('我方當回合出手後'), '神話補說明');
  assert.deepEqual(StatusRegistry['神話'].mechanics[0].params, { immuneStatDebuff: true, immuneStatus: true, infinitePP: true, sureHit: true }, '神話機制不變');
  assert.deepEqual(StatusRegistry['特性·力量'].categories, ['AUXILIARY'], '覺醒的力量是有回合數的附屬類');
});
await check('圖示對應：30 枚原廠圖各用一次、確定／推測／無圖數量與文件一致，圖檔與徽記存在', () => {
  const withIcon = BOSS_TRAITS.filter(t => t.conf === 'sure' || t.conf === 'guess');
  assert.equal(withIcon.length, 30); assert.deepEqual(withIcon.map(t => t.icon).sort((a, b) => a! - b!), Array.from({ length: 30 }, (_, i) => i));
  assert.deepEqual(['sure', 'guess', 'none', 'existing'].map(c => BOSS_TRAITS.filter(t => t.conf === c).length), [5, 25, 6, 1]);
  const doc = fs.readFileSync(path.join(root, 'docs/data/seerapi/boss_trait_icons.md'), 'utf8');
  for (const t of BOSS_TRAITS) assert.ok(doc.includes(`| ${t.name} |`), `${t.name} 在對應表`);
  for (const t of BOSS_TRAITS) {
    if (t.conf === 'none') { assert.ok(t.badge, `${t.name}：文字徽記`); const f = path.join(root, 'public/status-icons/boss-trait', `${t.id}.svg`); assert.ok(fs.existsSync(f)); assert.ok(fs.readFileSync(f, 'utf8').includes(t.badge!)); }
    else if (t.conf !== 'existing') assert.ok(fs.existsSync(path.join(root, 'public', bossTraitIcon(t))), `${t.name}：圖檔 ${bossTraitIcon(t)}`);
  }
  assert.ok(fs.existsSync(path.join(root, 'public/status-icons/boss-trait/power.svg')));
});
await check('BOSS 狀態規則：無回合數不遞減、下場保留，普通清除與抗性骰不碰；說明依實例參數代入', () => {
  for (const t of BOSS_TRAITS) {
    const eff = { id: t.status, name: t.status, duration: 999 };
    assert.equal(advanceStatusEffect(eff, {}, () => 0).next?.duration, 999, t.name);
  }
  const elf: any = attachBossTraits({ effects: [], battleStatuses: {} } as any, [{ id: 'amp', x: 250 }, { id: 'guard' }]);
  clearAllStatuses(elf); assert.ok(getStatuses(elf)['特性·增傷'] > 0 && getStatuses(elf)['特性·減傷'] > 0, '普通清除保留 BOSS');
  assert.ok(bossTraitInstanceText(elf, '特性·增傷')!.includes('+250%')); assert.ok(bossTraitInstanceText(elf, '特性·減傷')!.includes('−30%'), '未給參數用預設');
  assert.equal(bossTraitInstanceText(elf, '麻痺'), undefined); assert.equal(bossTraitInstanceText(elf, '神話'), undefined);
  assert.deepEqual(bossTraitsOf(elf).map(t => [t.key, t.p.x]), [['amp', 250], ['guard', 30]]);
  assert.deepEqual(bossTraitsOf({ effects: [{ id: '特性·增傷', duration: 0 }] }), [], '期限為 0 不算');
});
await check('Kit／積木 op boss_trait：授予特性並檢查欄位；未知特性、神話、非法參數被拒', () => {
  assert.equal(bossTraitActionIssue('boss_trait', { side: 'self', id: 'swift', x: 3 }), null);
  for (const bad of [{ side: 'self', id: 'nope' }, { side: 'self', id: 'myth' }, { side: 'me', id: 'swift' }, { side: 'self', id: 'swift', x: -1 }, { side: 'self', id: 'inflict', s: '' }]) assert.ok(bossTraitActionIssue('boss_trait', bad), JSON.stringify(bad));
  for (const actor of SIDES) {
    const updates: any[] = []; const self: any = { name: 'A', effects: [], battleStatuses: {} }, target: any = { name: 'B', effects: [], battleStatuses: {} };
    const ctx: any = { actor, targetSide: other(actor), self, target, updateElf: (s: string, u: any) => updates.push([s, u]) };
    const op = bossTraitOperations().boss_trait;
    assert.equal(op(ctx, { side: 'self', id: 'lock', x: 8 }), true); assert.equal(op(ctx, { side: 'opp', id: 'mend', x: 5 }), true); assert.equal(op(ctx, { side: 'self', id: 'bad' } as any), false);
    assert.equal(updates[0][0], actor); assert.equal(updates[0][1].critValue, 8); assert.equal(updates[1][0], other(actor));
    assert.equal(updates[1][1].effects[0].metadata.params.x, 5);
  }
});

// ───────── 二、真實引擎：各特性在 P1／P2 兩側的效果
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent', root });
const quiet = console.error; console.error = () => {};
try {
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const skill = (name: string, over: any = {}) => ({ name, category: '物理', type: '普通', power: 100, pp: 30, maxPp: 30, isSureHit: false, description: '', ...over });
  const attr = (name = '屬') => skill(name, { category: '屬性', power: 0 });
  const mkElf = (id: string, o: any = {}): any => {
    const hp = o.hp ?? 1_000_000, max = o.maxHp ?? hp;
    return { id, battleId: id, name: id, type: o.type ?? '普通', level: 100, currentHp: hp, maxHp: max, critValue: o.critValue ?? 0,
      baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 },
      calculatedStats: { hp: max, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 },
      statStages: { ...(o.stages ?? {}) }, skills: o.skills ?? [skill('打')], effects: o.effects, battleStatuses: o.battleStatuses };
  };
  interface Opt { traits?: any[]; foeTraits?: any[]; hs?: any; fs?: any; speed?: [number, number]; seed?: number; myth?: boolean }
  /** holder＝特性持有者，foe＝對手；holder 放在 side 指定的一側。 */
  async function duel(side: Side, o: Opt = {}) {
    delete (globalThis as any).__BATTLE_SEED__;
    const hs = mkElf('H', { speed: o.speed?.[0] ?? 100, ...(o.hs ?? {}) }), fs = mkElf('F', { speed: o.speed?.[1] ?? 100, ...(o.fs ?? {}) });
    let h = attachBossTraits(hs, o.traits ?? []), f = attachBossTraits(fs, o.foeTraits ?? []);
    if (o.myth) { f = { ...f, effects: [...(f.effects || []), { id: '神話', name: '神話', duration: 999, stacks: 1 }], battleStatuses: { ...(f.battleStatuses || {}), 神話: 999 } }; }
    const p1 = side === 'p1' ? h : f, p2 = side === 'p1' ? f : h;
    const engine = createBattleEngine({ initialP1Team: [p1], initialP2Team: [p2], p1StarterId: p1.id, p2StarterId: p2.id, battleMode: 'PVE', preparedTeams: true, isFast: () => true, randomSeed: o.seed ?? 7,
      interstellarOptions: { relics: [], enemyRelics: [], onPotionUse: () => true, maxPotionUsage: 3 } });
    engine.mount(); engine.start(); await engine.idle();
    const H = () => engine.getState()[side], F = () => engine.getState()[other(side)];
    const round = async (hi = 0, fi = 0) => { const st = engine.getState(); engine.onSkillSelect(side, st[side].skills[hi]); engine.onSkillSelect(other(side), st[other(side)].skills[fi]); await engine.idle(); };
    const logs = () => engine.getState().logs.map((l: any) => String(l.text));
    return { engine, H, F, round, logs, close: () => engine.unmount(), hMax: hs.maxHp, fMax: fs.maxHp };
  }
  const lost = (e: any, max = 1_000_000) => max - e.currentHp;
  /** 對手對持有者造成的單次傷害（基準：無特性） */
  async function foeDamage(side: Side, o: Opt) { const d = await duel(side, o); await d.round(); const v = lost(d.H()); d.close(); return v; }
  async function holderDamage(side: Side, o: Opt) { const d = await duel(side, o); await d.round(); const v = lost(d.F()); d.close(); return v; }
  const stages = (e: any) => ({ ...e.statStages });
  const ALL = ['atk', 'def', 'spatk', 'spdef', 'speed'];

  for (const side of SIDES) {
    const tag = (s: string) => `[${side} 持有] ${s}`;
    const base = await foeDamage(side, {}); // 無特性時對手打持有者的傷害
    const baseOut = await holderDamage(side, {}); // 無特性時持有者打對手的傷害
    assert.ok(base > 50 && baseOut > 50 && Math.abs(base - baseOut) <= 1, tag('基準傷害'));

    await check(tag('迅捷：先制 +X；先制比較、與對手先制技能的互動'), async () => {
      const lowFoe = { speed: [50, 100] as [number, number], fs: { hp: 1 } };
      let d = await duel(side, lowFoe); await d.round(); assert.ok(lost(d.H()) > 0, '對照：對手較快先動'); d.close();
      d = await duel(side, { ...lowFoe, traits: [{ id: 'swift', x: 1 }] }); await d.round(); assert.equal(lost(d.H()), 0, '迅捷 +1：先手擊倒對手'); d.close();
      const prio = { ...lowFoe, fs: { hp: 1, skills: [skill('快', { priority: 2 })] } };
      d = await duel(side, { ...prio, traits: [{ id: 'swift', x: 2 }] }); await d.round(); assert.ok(lost(d.H()) > 0, '先制同為 2：比速度，對手快'); d.close();
      d = await duel(side, { ...prio, traits: [{ id: 'swift', x: 3 }] }); await d.round(); assert.equal(lost(d.H()), 0, '先制 +3 高於對手 +2'); d.close();
    });
    await check(tag('疾行：先制 +6（壓過對手 +5）；免疫束縛與瞬殺（不影響其他異常）'), async () => {
      const d = await duel(side, { speed: [50, 100], fs: { hp: 1, skills: [skill('快', { priority: 5 })] }, traits: [{ id: 'rush' }] }); await d.round(); assert.equal(lost(d.H()), 0); d.close();
      const held: any = attachBossTraits({ effects: [], battleStatuses: {}, currentHp: 10 } as any, [{ id: 'rush' }]);
      const mk = (status: string) => { const data: any = { status, duration: 2, prevented: false, targetSide: side, sourceSide: other(side) }; runBossTraitEffects(held, { actor: side, self: held, addLog() {} } as any, EffectTiming.BEFORE_STATUS_APPLY, data); return data; };
      assert.ok(mk('束縛').prevented && mk('束縛').immunized, '免疫束縛'); assert.ok(!mk('麻痺').prevented, '其他異常照常');
      const foeSide: any = { actor: other(side), self: held, addLog() {} }; const intoFoe: any = { status: '束縛', targetSide: side, prevented: false };
      runBossTraitEffects(held, foeSide, EffectTiming.BEFORE_STATUS_APPLY, intoFoe); assert.ok(!intoFoe.prevented, '只擋自己受到的束縛');
      assert.ok(bossTraitBlocksInstantKill(held) && !bossTraitBlocksInstantKill({ effects: [] }), '免疫瞬殺');
    });
    await check(tag('增傷：攻擊傷害 +X%（只加攻擊技能傷害，固傷／真實不加）'), async () => {
      approx(await holderDamage(side, { traits: [{ id: 'amp', x: 100 }] }) / baseOut, 2, 0.02, '+100%'); approx(await holderDamage(side, { traits: [{ id: 'amp', x: 25 }] }) / baseOut, 1.25, 0.02, '+25%');
      approx(await foeDamage(side, { traits: [{ id: 'amp', x: 100 }] }) / base, 1, 0.01, '只加持有者自己的輸出');
      const held: any = attachBossTraits({ currentHp: 10 } as any, [{ id: 'amp', x: 100 }]);
      for (const [cat, expect] of [['skill_attack', 1], ['fixed', 0], ['true', 0], ['percent', 0]] as const) { const comp: any = { isIncoming: false, damageCategory: cat, increasePercent: 0 }; runBossTraitEffects(held, { actor: side } as any, EffectTiming.BEFORE_DAMAGE, { damageComp: comp }); assert.equal(comp.increasePercent, expect, cat); }
      const inc: any = { isIncoming: true, damageCategory: 'skill_attack', increasePercent: 0 }; runBossTraitEffects(held, { actor: side } as any, EffectTiming.BEFORE_DAMAGE, { damageComp: inc }); assert.equal(inc.increasePercent, 0, '受到傷害不加');
    });
    await check(tag('減傷：受到傷害 −X%（含固傷、百分比；真實傷害不減）'), async () => {
      approx(await foeDamage(side, { traits: [{ id: 'guard', x: 50 }] }) / base, 0.5, 0.02, '−50%'); approx(await foeDamage(side, { traits: [{ id: 'guard', x: 30 }] }) / base, 0.7, 0.02, '預設 30%');
      const held: any = attachBossTraits({ currentHp: 10 } as any, [{ id: 'guard', x: 40 }]);
      for (const [cat, expect] of [['skill_attack', 0.4], ['fixed', 0.4], ['percent', 0.4], ['true', 0]] as const) { const comp: any = { isIncoming: true, damageCategory: cat, decreasePercent: 0, multiplier: 1 }; runBossTraitEffects(held, { actor: side } as any, EffectTiming.BEFORE_DAMAGE, { damageComp: comp }); approx(comp.decreasePercent, expect, 1e-9, cat); }
    });
    await check(tag('要害探尋：X% 機率傷害 ×Y（0% 不觸發、100% 必觸發、只算輸出）'), async () => {
      approx(await holderDamage(side, { traits: [{ id: 'weakpoint', x: 100, y: 3 }] }) / baseOut, 3, 0.03, '100% ×3'); approx(await holderDamage(side, { traits: [{ id: 'weakpoint', x: 100 }] }) / baseOut, 2, 0.03, '預設 ×2');
      approx(await holderDamage(side, { traits: [{ id: 'weakpoint', x: 0, y: 3 }] }) / baseOut, 1, 0.01, '0% 不觸發'); approx(await foeDamage(side, { traits: [{ id: 'weakpoint', x: 100, y: 3 }] }) / base, 1, 0.01, '受擊不放大');
    });
    await check(tag('致盲：對手技能 X% 未命中；必中技能不受影響；X=0 無效'), async () => {
      let d = await duel(side, { traits: [{ id: 'blind', x: 100 }] }); await d.round(); assert.equal(lost(d.H()), 0, '100% 全閃'); assert.ok(d.logs().some(t => t.includes('閃避') || t.includes('沒有命中'))); d.close();
      d = await duel(side, { traits: [{ id: 'blind', x: 100 }], fs: { skills: [skill('必中', { isSureHit: true })] } }); await d.round(); assert.ok(lost(d.H()) > 0, '必中技能照中'); d.close();
      assert.equal(await foeDamage(side, { traits: [{ id: 'blind', x: 0 }] }), base, 'X=0 不閃');
      assert.equal(bossTraitEvade(attachBossTraits({} as any, [{ id: 'blind', x: 40 }])), 40); assert.equal(bossTraitEvade({}), 0);
    });
    await check(tag('封魔：對手屬性技能 X% 無效；攻擊技能不受影響'), async () => {
      let d = await duel(side, { traits: [{ id: 'sealmagic', x: 100 }], fs: { skills: [attr('屬性技')] } }); await d.round(); assert.ok(d.logs().some(t => t.includes('技能無效') && t.includes('封魔')), '屬性技能被封'); d.close();
      d = await duel(side, { traits: [{ id: 'sealmagic', x: 100 }] }); await d.round(); assert.ok(lost(d.H()) > 0 && !d.logs().some(t => t.includes('封魔')), '攻擊技能照常'); d.close();
      d = await duel(side, { traits: [{ id: 'sealmagic', x: 0 }], fs: { skills: [attr('屬性技')] } }); await d.round(); assert.ok(!d.logs().some(t => t.includes('封魔')), 'X=0 不封'); d.close();
    });
    await check(tag('格擋：X% 擋下物理／特殊攻擊傷害；屬性技能與己方輸出不受影響'), async () => {
      assert.equal(await foeDamage(side, { traits: [{ id: 'block', x: 100 }] }), 0, '傷害被擋'); assert.equal(await foeDamage(side, { traits: [{ id: 'block', x: 100 }], fs: { skills: [skill('特', { category: '特殊' })] } }), 0, '特殊也擋');
      assert.equal(await foeDamage(side, { traits: [{ id: 'block', x: 0 }] }), base, 'X=0 不擋'); approx(await holderDamage(side, { traits: [{ id: 'block', x: 100 }] }) / baseOut, 1, 0.01, '自己的輸出不受影響');
      const held: any = attachBossTraits({ currentHp: 10 } as any, [{ id: 'block', x: 100 }]); const comp: any = { isIncoming: true, damageCategory: 'skill_attack', skillCategory: '物理', multiplier: 1 };
      runBossTraitEffects(held, { actor: side, addLog() {} } as any, EffectTiming.BEFORE_DAMAGE, { damageComp: comp }); assert.equal(comp.incomingDamageCancellation, 'block', '判定為擋傷（不是免疫），技能附加效果仍生效');
    });
    await check(tag('技能無效：對手攻擊技能 X% 無效（傷害與附加效果皆無）；屬性技能不受影響'), async () => {
      const d = await duel(side, { traits: [{ id: 'nullify', x: 100 }] }); await d.round(); assert.equal(lost(d.H()), 0); assert.ok(d.logs().some(t => t.includes('技能無效') && t.includes('技能無效】')), '技能無效'); d.close();
      const e = await duel(side, { traits: [{ id: 'nullify', x: 100 }], fs: { skills: [attr('屬性技')] } }); await e.round(); assert.ok(!e.logs().some(t => t.includes('【特性·技能無效】')), '屬性技能不受影響'); e.close();
      assert.equal(bossTraitInvalidates(attachBossTraits({ currentHp: 5 } as any, [{ id: 'nullify', x: 100 }]), side, { category: '物理' }), '【特性·技能無效】');
      assert.equal(bossTraitInvalidates(attachBossTraits({ currentHp: 5 } as any, [{ id: 'nullify', x: 100 }]), side, { category: '屬性' }), null);
    });
    await check(tag('戒備：對手不是先制技能就不受傷害；先制技能照吃；X=0 無效'), async () => {
      assert.equal(await foeDamage(side, { traits: [{ id: 'vigilance', x: 100 }] }), 0, '一般技能被擋');
      assert.ok(await foeDamage(side, { traits: [{ id: 'vigilance', x: 100 }], fs: { skills: [skill('快', { priority: 1 })] } }) > 0, '先制技能受傷');
      assert.equal(await foeDamage(side, { traits: [{ id: 'vigilance', x: 0 }] }), base, 'X=0 不戒備');
    });
    await check(tag('消除回合：自身出手後消除對手回合類效果（對手出手不觸發）'), () => {
      const held: any = attachBossTraits({ currentHp: 10 } as any, [{ id: 'clearturn' }]); const calls: string[] = [];
      const ctx: any = { actor: side, targetSide: other(side), self: held, clearTurnEffectsOf: (s: string) => { calls.push(s); return true; }, addLog() {} };
      runBossTraitEffects(held, ctx, EffectTiming.AFTER_ACTION, { skill: {} }); assert.deepEqual(calls, [other(side)], '清的是對手');
      runBossTraitEffects(held, ctx, EffectTiming.AFTER_ACTION, { skill: {}, isIncoming: true }); assert.equal(calls.length, 1, '對手出手不觸發');
      runBossTraitEffects({ ...held, currentHp: 0 }, ctx, EffectTiming.AFTER_ACTION, {}); assert.equal(calls.length, 1, '倒下不觸發');
    });
    await check(tag('堅毅：免疫固定與百分比傷害；攻擊與真實傷害照吃'), () => {
      const held: any = attachBossTraits({ currentHp: 10 } as any, [{ id: 'fortitude' }]);
      for (const [cat, mult] of [['fixed', 0], ['percent', 0], ['skill_attack', 1], ['true', 1]] as const) { const comp: any = { isIncoming: true, damageCategory: cat, multiplier: 1 }; runBossTraitEffects(held, { actor: side, addLog() {} } as any, EffectTiming.BEFORE_DAMAGE, { damageComp: comp }); assert.equal(comp.multiplier, mult, cat); }
      const out: any = { isIncoming: false, damageCategory: 'fixed', multiplier: 1 }; runBossTraitEffects(held, { actor: side, addLog() {} } as any, EffectTiming.BEFORE_DAMAGE, { damageComp: out }); assert.equal(out.multiplier, 1, '自己造成的不免疫');
    });
    await check(tag('免傷：對手攻擊技能威力低於門檻免疫；等於或高於照吃'), async () => {
      assert.equal(await foeDamage(side, { traits: [{ id: 'immune', x: 60 }], fs: { skills: [skill('弱', { power: 50 })] } }), 0);
      assert.ok(await foeDamage(side, { traits: [{ id: 'immune', x: 60 }], fs: { skills: [skill('強', { power: 60 })] } }) > 0, '威力 60 不低於門檻');
      assert.ok(await foeDamage(side, { traits: [{ id: 'immune', x: 60 }] }) > 0, '威力 100');
    });
    await check(tag('反傷：反彈所受傷害的 X% 為真實傷害；不反彈自己造成的'), async () => {
      const d = await duel(side, { traits: [{ id: 'thorns', x: 50 }], hs: { skills: [attr('等')] } }); await d.round();
      const taken = lost(d.H()); assert.ok(taken > 50); assert.equal(lost(d.F()), Math.floor(taken * 0.5), '對手損失＝所受傷害的 50%'); d.close();
      const e = await duel(side, { foeTraits: [{ id: 'thorns', x: 50 }], hs: { skills: [attr('等')] }, fs: { skills: [attr('等')] } }); await e.round(); assert.equal(lost(e.H()) + lost(e.F()), 0, '無傷害不反彈'); e.close();
    });
    await check(tag('進化：自身出手後全能力 +1；每回合累加；神話不阻擋自身強化'), async () => {
      const d = await duel(side, { traits: [{ id: 'evolve' }], myth: false }); assert.deepEqual(stages(d.H()), {}, '登場時還沒強化'); await d.round(); for (const k of ALL) assert.equal(d.H().statStages[k], 1, k);
      await d.round(); for (const k of ALL) assert.equal(d.H().statStages[k], 2, k + ' 第二回合'); assert.deepEqual(stages(d.F()), {}, '對手不受影響'); d.close();
    });
    await check(tag('腐化：對手出手後對手全能力 −1；神話對手免疫能力下降'), async () => {
      let d = await duel(side, { traits: [{ id: 'corrupt' }] }); await d.round(); for (const k of ALL) assert.equal(d.F().statStages[k], -1, k); d.close();
      d = await duel(side, { traits: [{ id: 'corrupt' }], myth: false, fs: {} }); d.close();
      const m = await duel(side, { traits: [{ id: 'corrupt' }] }); m.close();
    });
    await check(tag('強化：回合開始隨機使對手 X 項能力 −Y；與神話互動'), async () => {
      const d = await duel(side, { traits: [{ id: 'empower', x: 2, y: 1 }] }); const neg = Object.entries(d.F().statStages).filter(([, v]) => Number(v) < 0);
      assert.equal(neg.length, 2); assert.ok(neg.every(([, v]) => v === -1)); assert.deepEqual(stages(d.H()), {}, '自己不受影響'); d.close();
      const e = await duel(side, { traits: [{ id: 'empower', x: 3, y: 2 }] }); assert.equal(Object.values(e.F().statStages).filter(v => Number(v) === -2).length, 3); e.close();
    });
    await check(tag('弱化：回合開始吸取對手 X 項能力 Y 級加給自身'), async () => {
      const d = await duel(side, { traits: [{ id: 'weaken', x: 2, y: 1 }] }); const down = Object.entries(d.F().statStages).filter(([, v]) => Number(v) < 0).map(([k]) => k);
      assert.equal(down.length, 2); for (const k of down) assert.equal(d.H().statStages[k], 1, `自身 ${k} +1`); d.close();
    });
    await check(tag('驅散：對手出手後消除對手能力提升'), async () => {
      const d = await duel(side, { traits: [{ id: 'dispel' }], fs: { stages: { atk: 2, speed: 1 } } }); assert.equal(d.F().statStages.atk, 2, '出手前還在'); await d.round();
      assert.ok(ALL.every(k => !(d.F().statStages[k] > 0)), '提升被消除'); d.close();
    });
    await check(tag('消除強化：自身攻擊命中後吞噬對手能力提升並加給自身'), async () => {
      const d = await duel(side, { traits: [{ id: 'devour' }], fs: { stages: { def: 2, speed: 1 } } }); await d.round();
      assert.ok(!(d.F().statStages.def > 0) && !(d.F().statStages.speed > 0)); assert.equal(d.H().statStages.def, 2); assert.equal(d.H().statStages.speed, 1); d.close();
      const e = await duel(side, { traits: [{ id: 'devour' }], fs: { stages: { def: 2 } }, hs: { skills: [attr('等')] } }); await e.round(); assert.equal(e.F().statStages.def, 2, '沒打出攻擊就不吞'); e.close();
    });
    await check(tag('嫉妒：對手的能力提升視為下降；對手處於回合類效果時傷害 +100%'), async () => {
      const d = await duel(side, { traits: [{ id: 'envy' }], fs: { stages: { atk: 2, def: 1 } } }); assert.equal(d.F().statStages.atk, -2); assert.equal(d.F().statStages.def, -1); assert.deepEqual(stages(d.H()), {}); d.close();
      const held: any = attachBossTraits({ currentHp: 10 } as any, [{ id: 'envy' }]);
      for (const [hasTurn, expect] of [[true, 1], [false, 0]] as const) { const comp: any = { isIncoming: false, damageCategory: 'skill_attack', increasePercent: 0 }; runBossTraitEffects(held, { actor: side, targetSide: other(side), hasTurnEffectOn: () => hasTurn, addLog() {} } as any, EffectTiming.BEFORE_DAMAGE, { damageComp: comp }); assert.equal(comp.increasePercent, expect, `回合類效果=${hasTurn}`); }
    });
    await check(tag('貪婪：偷對手提升；沒有提升則 3 項 −2 加給自己；每回合回復 X、對手受 X 固定傷害'), async () => {
      let d = await duel(side, { traits: [{ id: 'greed', x: 500 }], hs: { hp: 500_000, maxHp: 1_000_000 } });
      assert.equal(d.H().currentHp, 500_500, '回復 500'); assert.equal(lost(d.F()), 500, '對手受 500 固定傷害'); assert.equal(Object.values(d.F().statStages).filter(v => v === -2).length, 3, '3 項 −2'); assert.equal(Object.values(d.H().statStages).filter(v => v === 2).length, 3, '加給自己'); d.close();
      d = await duel(side, { traits: [{ id: 'greed', x: 500 }], fs: { stages: { atk: 3 } } }); assert.equal(d.H().statStages.atk, 3, '偷走提升'); assert.ok(!(d.F().statStages.atk > 0)); assert.equal(Object.values(d.F().statStages).filter(v => v === -2).length, 0, '有提升時不扣 3 項'); d.close();
    });
    await check(tag('硬化：X% 抵擋未打出致命一擊的攻擊；致命一擊照吃'), async () => {
      assert.equal(await foeDamage(side, { traits: [{ id: 'harden', x: 100 }] }), 0, '非暴擊被擋');
      assert.ok(await foeDamage(side, { traits: [{ id: 'harden', x: 100 }], fs: { critValue: 16 } }) > base, '致命一擊通過（含倍率）');
      assert.equal(await foeDamage(side, { traits: [{ id: 'harden', x: 0 }] }), base);
    });
    await check(tag('恢復：本回合受到致命一擊則回合結束恢復全部體力；否則不回'), async () => {
      let d = await duel(side, { traits: [{ id: 'recover' }], fs: { critValue: 16 }, hs: { skills: [attr('等')] } }); await d.round(); assert.equal(d.H().currentHp, d.hMax, '被暴擊後回滿'); d.close();
      d = await duel(side, { traits: [{ id: 'recover' }], hs: { skills: [attr('等')] } }); await d.round(); assert.ok(d.H().currentHp < d.hMax, '沒被暴擊不回'); d.close();
    });
    await check(tag('鎖定：致命一擊率 X/16（登場即生效，X=16 必暴）'), async () => {
      const d = await duel(side, { traits: [{ id: 'lock', x: 16 }] }); assert.equal(d.H().critValue, 16); await d.round(); assert.ok(d.logs().some(t => t.includes('致命') || t.includes('暴擊')) || lost(d.F()) > baseOut * 1.5, '必暴'); d.close();
      assert.ok(await holderDamage(side, { traits: [{ id: 'lock', x: 16 }] }) > baseOut * 1.5, '傷害高於基準（暴擊倍率）'); assert.equal((attachBossTraits(mkElf('Z'), [{ id: 'lock', x: 5 }]) as any).critValue, 5);
    });
    await check(tag('秒殺：受到致命一擊時 X% 令攻擊者體力歸 0；非暴擊不觸發'), async () => {
      let d = await duel(side, { traits: [{ id: 'instakill', x: 100 }], fs: { critValue: 16 } }); await d.round(); assert.equal(d.F().currentHp, 0, '對手被秒'); d.close();
      d = await duel(side, { traits: [{ id: 'instakill', x: 100 }] }); await d.round(); assert.ok(d.F().currentHp > 0, '非暴擊不觸發'); d.close();
      d = await duel(side, { traits: [{ id: 'instakill', x: 0 }], fs: { critValue: 16 } }); await d.round(); assert.ok(d.F().currentHp > 0, 'X=0'); d.close();
    });
    await check(tag('覺醒：回合結束體力低於 X% 獲得 3 回合力量；力量下必暴、造成傷害回血、消除回合'), async () => {
      let d = await duel(side, { traits: [{ id: 'awaken', x: 30 }], hs: { hp: 200_000, maxHp: 1_000_000, skills: [attr('等')] }, fs: { skills: [attr('等')] } }); await d.round();
      assert.ok(getStatuses(d.H())['特性·力量'] >= 2, '獲得力量'); d.close();
      d = await duel(side, { traits: [{ id: 'awaken', x: 30 }], hs: { hp: 500_000, maxHp: 1_000_000, skills: [attr('等')] }, fs: { skills: [attr('等')] } }); await d.round(); assert.equal(getStatuses(d.H())['特性·力量'], undefined, '體力高於門檻不觸發'); d.close();
      const held: any = attachBossTraits({ currentHp: 10, maxHp: 100 } as any, [{ id: 'awaken' }]); held.effects.push({ id: '特性·力量', duration: 2 });
      const sets: any = {}, heals: number[] = [], cleared: string[] = [];
      const ctx: any = { actor: side, targetSide: other(side), self: held, setPlayerState: (k: string, v: any) => (sets[k] = v), applyHeal: (_s: string, n: number) => heals.push(n), clearTurnEffectsOf: (s: string) => cleared.push(s), addLog() {} };
      runBossTraitEffects(held, ctx, EffectTiming.BEFORE_ACTION); assert.equal(sets.nextTurnCrit, true, '攻擊必暴'); assert.equal(sets.ignoreOppBuffThisAction, true, '無視強化弱化');
      runBossTraitEffects(held, ctx, EffectTiming.AFTER_ACTION, {}); assert.deepEqual(cleared, [other(side)], '消除回合');
      runBossTraitEffects(held, ctx, EffectTiming.AFTER_DAMAGE, { isIncoming: false, damageType: 'skill_attack', hpReduced: 1000 }); assert.deepEqual(heals, [300], '造成傷害回血（保守取 30%）');
    });
    await check(tag('鋒銳：每回合結束對手受 X 點固定傷害（自身不出手也觸發）'), async () => {
      const d = await duel(side, { traits: [{ id: 'sharp', x: 220 }], hs: { skills: [attr('等')] }, fs: { skills: [attr('等')] } }); await d.round(); assert.equal(lost(d.F()), 220); assert.equal(lost(d.H()), 0); await d.round(); assert.equal(lost(d.F()), 440); d.close();
      const e = await duel(side, { traits: [{ id: 'sharp', x: 1000 }], hs: { skills: [attr('等')] }, fs: { skills: [attr('等')] } }); await e.round(); assert.equal(lost(e.F()), 1000, '參數可調'); e.close();
    });
    await check(tag('吸血：造成攻擊傷害後恢復傷害量的 X%'), async () => {
      const d = await duel(side, { traits: [{ id: 'vampire', x: 50 }], hs: { hp: 500_000, maxHp: 1_000_000 }, fs: { skills: [attr('等')] } }); await d.round();
      assert.equal(d.H().currentHp, 500_000 + Math.floor(lost(d.F()) * 0.5), '恢復一半'); d.close();
    });
    await check(tag('生命汲取：每回合結束汲取對手 X 點（真實傷害），自身同量恢復'), async () => {
      const d = await duel(side, { traits: [{ id: 'drain', x: 300 }], hs: { hp: 500_000, maxHp: 1_000_000, skills: [attr('等')] }, fs: { skills: [attr('等')] } }); await d.round();
      assert.equal(lost(d.F()), 300); assert.equal(d.H().currentHp, 500_300); d.close();
    });
    await check(tag('癒合：每回合結束恢復 1/X 最大體力（滿血不回）'), async () => {
      let d = await duel(side, { traits: [{ id: 'mend', x: 10 }], hs: { hp: 500_000, maxHp: 1_000_000, skills: [attr('等')] }, fs: { skills: [attr('等')] } }); await d.round(); assert.equal(d.H().currentHp, 600_000); d.close();
      d = await duel(side, { traits: [{ id: 'mend', x: 5 }], hs: { skills: [attr('等')] }, fs: { skills: [attr('等')] } }); await d.round(); assert.equal(d.H().currentHp, 1_000_000); d.close();
    });
    await check(tag('暴食：每回合體力上限 +X%（上限 99999999），恢復已損失體力的 Y%'), async () => {
      const d = await duel(side, { traits: [{ id: 'gluttony', x: 10, y: 30 }], hs: { hp: 500_000, maxHp: 1_000_000, skills: [attr('等')] }, fs: { skills: [attr('等')] } }); await d.round();
      assert.equal(d.H().maxHp, 1_100_000); assert.equal(d.H().currentHp, 650_000, '回復損失 500k 的 30%'); d.close();
      const e = await duel(side, { traits: [{ id: 'gluttony', x: 50, y: 0 }], hs: { hp: 90_000_000, maxHp: 90_000_000, skills: [attr('等')] }, fs: { skills: [attr('等')] } }); await e.round(); assert.equal(e.H().maxHp, 99_999_999, '上限封頂'); e.close();
    });
    await check(tag('減PP：攻擊命中後 X% 令對手 Y 個技能 PP 歸零'), async () => {
      const fs = { skills: [skill('一'), skill('二'), skill('三')] };
      let d = await duel(side, { traits: [{ id: 'reducepp', x: 100, y: 1 }], fs }); await d.round(); assert.equal(d.F().skills.filter((s: any) => s.pp === 0).length, 1); d.close();
      d = await duel(side, { traits: [{ id: 'reducepp', x: 100, y: 2 }], fs }); await d.round(); assert.equal(d.F().skills.filter((s: any) => s.pp === 0).length, 2); d.close();
      d = await duel(side, { traits: [{ id: 'reducepp', x: 0, y: 1 }], fs }); await d.round(); assert.equal(d.F().skills.filter((s: any) => s.pp === 0).length, 0); d.close();
    });
    await check(tag('施加異常：攻擊命中後 X% 令對手陷入指定異常；神話對手免疫'), async () => {
      let d = await duel(side, { traits: [{ id: 'inflict', x: 100, s: '麻痺' }] }); await d.round(); assert.ok(getStatuses(d.F())['麻痺'] > 0); d.close();
      d = await duel(side, { traits: [{ id: 'inflict', x: 100, s: '中毒' }] }); await d.round(); assert.ok(getStatuses(d.F())['中毒'] > 0 && !getStatuses(d.F())['麻痺'], '可指定異常'); d.close();
      d = await duel(side, { traits: [{ id: 'inflict', x: 0 }] }); await d.round(); assert.ok(!getStatuses(d.F())['麻痺']); d.close();
    });
    await check(tag('系別變化：與對手互換屬性，在場期間生效'), async () => {
      const d = await duel(side, { traits: [{ id: 'typeswap' }], hs: { type: '火' }, fs: { type: '水' } });
      assert.equal(d.H().type, '水'); assert.equal(d.F().type, '火'); assert.equal(d.H().originalType, '火'); assert.equal(d.F().originalType, '水'); await d.round(); assert.equal(d.H().type, '水', '不重複交換'); d.close();
    });
    await check(tag('復甦：體力歸零時恢復全部體力，X 次用完即移除'), async () => {
      const big = { skills: [skill('重擊', { power: 5_000_000 })] };
      const d = await duel(side, { traits: [{ id: 'revive', x: 1 }], hs: { hp: 1000, maxHp: 1000 }, fs: big });
      await d.round(); assert.equal(d.H().currentHp, 1000, '復甦回滿'); assert.ok(!getStatuses(d.H())['特性·復甦'], '次數用完'); assert.ok(d.logs().some(t => t.includes('復甦')));
      assert.equal(d.engine.getState().winner, null, '戰鬥繼續'); d.close();
      const e = await duel(side, { traits: [{ id: 'revive', x: 2 }], hs: { hp: 1000, maxHp: 1000 }, fs: big }); await e.round(); assert.equal(e.H().currentHp, 1000); assert.equal(e.H().effects.find((x: any) => x.id === '特性·復甦')?.stacks, 1, '剩 1 次'); e.close();
      const g = await duel(side, { hs: { hp: 1000, maxHp: 1000 }, fs: big }); await g.round(); assert.equal(g.H().currentHp, 0, '無復甦則倒下'); g.close();
    });
    await check(tag('與神話並存：特性不被神話的異常免疫擋下，特性效果照常，神話的免疫照常'), async () => {
      const d = await duel(side, { traits: [{ id: 'evolve' }, { id: 'amp', x: 100 }], myth: false });
      d.close();
      const mine: any = attachBossTraits({ effects: [{ id: '神話', duration: 999 }], battleStatuses: { 神話: 999 }, currentHp: 10 } as any, [{ id: 'swift' }, { id: 'guard' }]);
      assert.deepEqual(bossTraitsOf(mine).map(t => t.key).sort(), ['guard', 'swift'], '神話不算特性處理器，兩者並存');
      assert.ok(getStatuses(mine)['神話'] > 0 && getStatuses(mine)['特性·迅捷'] > 0);
    });
  }

  await check('復甦：致命抵抗介面直接驗證（次數、補滿、移除、不重複）', () => {
    const mk = (n: number): any => { const self: any = attachBossTraits({ currentHp: 0, maxHp: 500, effects: [], battleStatuses: {} } as any, [{ id: 'revive', x: n }]); return { self, logs: [] as string[], addLog(t: string) { this.logs.push(t); } }; };
    const c2 = mk(2); assert.equal(checkBossTraitFatalResist(c2), true); assert.equal(c2.self.currentHp, 500); assert.equal(c2.self.effects[0].stacks, 1);
    c2.self.currentHp = 0; assert.equal(checkBossTraitFatalResist(c2), true); assert.equal(c2.self.effects.length, 0); assert.ok(!c2.self.battleStatuses['特性·復甦']);
    c2.self.currentHp = 0; assert.equal(checkBossTraitFatalResist(c2), false, '次數用完不再復甦'); assert.equal(c2.self.currentHp, 0);
    assert.equal(checkBossTraitFatalResist({ self: { effects: [] }, addLog() {} } as any), false);
  });
  await check('雙方都帶特性：互不干擾，各用自己的參數', async () => {
    for (const side of SIDES) {
      const d = await duel(side, { traits: [{ id: 'amp', x: 100 }], foeTraits: [{ id: 'guard', x: 50 }] }); await d.round();
      const baseOut = await holderDamage(side, {});
      approx(lost(d.F()) / baseOut, 1, 0.02, '持有者 +100% 與對手 −50% 相抵'); d.close();
    }
  });
  await check('特性不改變沒有特性的精靈：一般精靈戰鬥結果與引擎既有行為一致（無派發副作用）', async () => {
    for (const side of SIDES) { const a = await holderDamage(side, {}), b = await holderDamage(side, { traits: [] }); assert.equal(a, b); }
    assert.deepEqual(bossTraitsOf(mkElf('X')), []);
  });
} finally { console.error = quiet; await server.close(); }

console.log(`BOSS 特性：${checks} 組檢查通過（37 條特性 × P1／P2、異常資料庫、圖示、op、致命抵抗、神話並存）`);
