// BOSS 類異常的共用規則（2026-11-15）：
// 一、BOSS 類異常＝附屬類異常的子集合＋關閉回合數，由單一旗標（noDuration）控制。
// 二、瞬殺免疫只有一個判定入口，結算與 AI 共用；疾行不涉及任何異常。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { StatusRegistry } from '../src/effects/statusRegistry';
import { isDurationlessStatus, isBossClassInstance, canonicalStatusName } from '../src/effects/statusIdentity';
import { advanceStatusEffect } from '../src/battle/statusLifecycle';
import { BOSS_TRAITS, attachBossTraits, holdsBossTrait } from '../src/data/bossTraits';
import { instantKillImmune, mentionsInstantKill } from '../src/battle/instantKillImmunity';
import { bossTraitBlocksInstantKill, bossTraitActionIssue, bossTraitInvalidates } from '../src/blocks/ops/bossTraits';
import { BOSS_TRAIT_BY_ID, bossTraitIcon, bossEffectIconPath } from '../src/data/bossTraits';
import { placeholderEffectIcon, UNKNOWN_EFFECT_ICON } from '../src/battle/effectIcons';
import { timedAuxDescription } from '../src/components/BossStatusSection';
import { scoreActions, AI_DEFAULT } from '../src/battle/ai/legacyScoring';

// 一、分類與旗標
const boss = Object.values(StatusRegistry).filter(e => e.categories.includes('BOSS_ONLY'));
assert.ok(boss.length >= 42);
for (const e of boss) {
  assert.ok(e.categories.includes('AUXILIARY'), `${e.name}：BOSS 類必為附屬類的子集合`);
  assert.equal(e.noDuration, true, `${e.name}：關閉回合數`);
  assert.ok(isDurationlessStatus(e.name));
  const r = advanceStatusEffect({ id: e.name, name: e.name, duration: 999 } as any, {}, () => 0);
  assert.equal(r.next?.duration, 999, `${e.name}：回合結算不扣`); assert.equal(r.ended, false);
}
// BOSS 類與「關閉回合數」是兩件事（2026-11-15 使用者規則）：
// 實例開啟回合數 → 照一般附屬類倒數、不再算 BOSS 類；其他異常關閉回合數 → 不會因此變成 BOSS 類。
{
  const timed = attachBossTraits({ id: 'T', currentHp: 1, effects: [], battleStatuses: {} } as any, [{ id: 'swift', turns: 3 }]);
  const eff = timed.effects!.find((e: any) => e.id === '特性·迅捷');
  assert.equal(eff.duration, 3); assert.equal(eff.timed, true); assert.equal(timed.battleStatuses!['特性·迅捷'], 3);
  assert.equal(advanceStatusEffect(eff, {}, () => 0).next?.duration, 2, '開啟回合數的 BOSS 特性照常倒數');
  assert.ok(!isDurationlessStatus('特性·迅捷', eff) && isDurationlessStatus('特性·迅捷'));
  assert.ok(!isBossClassInstance('特性·迅捷', { timed: true }) && !isBossClassInstance('特性·迅捷', { turns: 3 }), '開啟回合數就不再算 BOSS 類');
  assert.ok(isBossClassInstance('特性·迅捷', { turns: 999 }) && isBossClassInstance('神話'));
  assert.ok(!isBossClassInstance('麻痺') && !isBossClassInstance('麻痺', { turns: 999 }), '一般異常即使不倒數也不算 BOSS 類');
  assert.equal(bossTraitActionIssue('boss_trait', { side: 'self', id: 'swift', turns: 3 }), null);
  assert.ok(bossTraitActionIssue('boss_trait', { side: 'self', id: 'swift', turns: 0 }) && bossTraitActionIssue('boss_trait', { side: 'self', id: 'swift', v: 'Z' }));
}
assert.ok(!isDurationlessStatus('特性·力量') && !isDurationlessStatus('麻痺'), '有回合數的附屬類與一般異常照常扣回合');
assert.equal(advanceStatusEffect({ id: '特性·力量', name: '特性·力量', duration: 3 } as any, {}, () => 0).next?.duration, 2);
assert.equal(canonicalStatusName('特性·系別變化'), '特性·屬性反轉', '舊狀態名對應到新名');
assert.ok(isDurationlessStatus('特性·系別變化'));
// 判斷「不扣回合／不顯示回合數」的地方都讀旗標，不再各自判斷分類
for (const f of ['src/battle/statusLifecycle.ts', 'src/components/StatusBadgePanel.tsx', 'src/components/BattleScreen.ui.tsx']) {
  const src = fs.readFileSync(f, 'utf8');
  assert.ok(src.includes('noDuration'), `${f} 讀 noDuration`);
  assert.ok(!src.split('\n').some(l => !l.includes('catKey') && /includes\('BOSS_ONLY'\)\s*(\?|&&)[^\n]*(remainingTurns|duration|回合)/.test(l)), `${f} 不再以 BOSS_ONLY 決定回合數顯示`);
}

// 二、瞬殺免疫：單一入口
const rush = attachBossTraits({ id: 'R', currentHp: 100, effects: [], battleStatuses: {} } as any, [{ id: 'rush' }]);
const plain = { id: 'P', currentHp: 100, effects: [], battleStatuses: {} };
assert.ok(instantKillImmune(rush) && !instantKillImmune(plain) && !instantKillImmune(null));
assert.equal(bossTraitBlocksInstantKill(rush), instantKillImmune(rush), '舊名委派到同一入口');
assert.ok(holdsBossTrait({ battleStatuses: { '特性·疾行': 999 } }, 'rush') && !holdsBossTrait({ battleStatuses: { '特性·疾行': 0 } }, 'rush'));
const ik = fs.readFileSync('src/battle/instantKill.ts', 'utf8');
assert.equal((ik.match(/instantKillImmune\(/g) || []).length, 2, '排入與結算兩處都走統一入口');
for (const dir of ['src/effects/elves/zhakesi-fear/registry.ts', 'src/effects/elves/zhakesi-annihilation/registry.ts']) {
  const src = fs.readFileSync(dir, 'utf8');
  assert.ok(src.includes('applyInstantKill'), `${dir} 經正式瞬殺流程`); assert.ok(!/疾行|bossTrait/.test(src), `${dir} 不自行寫死 BOSS 免疫`);
}
assert.ok(mentionsInstantKill('30% 秒殺對手') && mentionsInstantKill('瞬殺') && !mentionsInstantKill('造成傷害'), '秒殺與瞬殺同義');
// AI：對免疫瞬殺的目標，瞬殺技能不加分（與結算同一判定）
const sk = (name: string, over: any = {}) => ({ name, category: '物理', type: '普通', power: 80, pp: 10, maxPp: 10, description: '', ...over });
const kill = sk('必殺', { category: '屬性', power: 0, description: '100% 秒殺對手' }), hit = sk('重擊');
const mk = (id: string, extra: any = {}): any => ({ id, battleId: id, name: id, type: '普通', currentHp: 900, maxHp: 1000, statStages: {}, skills: [kill, hit], ...extra });
const deps: any = { estimateDamage: () => 100, getTypeMatchup: () => 1, getStatuses: (e: any) => e.battleStatuses || {}, isSkillUsable: () => true, isControlStatus: () => false, rng: () => .5 };
const scores = (foe: any) => { const all = scoreActions({ self: mk('S'), opponent: foe, team: [mk('S')], activeIndex: 0, items: [], canSwitch: false, canUseItem: false, turnNumber: 5 } as any, deps, { ...AI_DEFAULT, randomness: 0, noise: 0 });
  const of = (n: string) => all.find(a => a.action.kind === 'skill' && (a.action as any).skill.name === n)!; return { kill: of('必殺'), hit: of('重擊') }; };
const normal = scores(mk('F')), immune = scores({ ...mk('F'), ...attachBossTraits(mk('F'), [{ id: 'rush' }]) });
assert.equal(normal.kill.score - immune.kill.score, 60, '對疾行目標，瞬殺技能扣分');
assert.ok(immune.kill.reason.includes('免疫瞬殺') && immune.hit.score === normal.hit.score, '一般技能不受影響');
assert.ok(immune.hit.score > immune.kill.score, '改選一般技能');

// 三、疾行文字與資料：無束縛、無「免疫／無視異常」
const rushDef = BOSS_TRAITS.find(t => t.id === 'rush')!;
assert.ok(!/束縛|異常/.test(rushDef.desc) && rushDef.desc.includes('無視對手的先制效果') && rushDef.desc.includes('免疫瞬殺'));
// 四、彩色圖：原廠有彩色（iconId 0–28）就用彩色，沒有的維持藍白色；圖鑑與實戰共用 bossTraitIcon
for (let i = 0; i < 29; i++) { assert.equal(bossEffectIconPath(i), `/seerapi/bosseffect-color/${i}.png`); assert.ok(fs.existsSync(`public/seerapi/bosseffect-color/${i}.png`), `彩色圖 ${i}`); }
assert.equal(bossEffectIconPath(29), '/seerapi/bosseffect/29.png', '沒有彩色的編號維持藍白色');
for (const t of BOSS_TRAITS) if (t.icon != null && t.conf !== 'existing') assert.ok(bossTraitIcon(t).startsWith('/seerapi/bosseffect-color/'), `${t.name} 用彩色圖`);
assert.equal(bossTraitIcon(BOSS_TRAIT_BY_ID.myth), '/seer/abnormal/17.png', '神話沿用既有原廠彩色異常圖');

// 五、封魔：A＝原廠（附加效果失效）、B＝擴展（整招無效，走技能無效流程）
const seal = (v?: string) => bossTraitInvalidates(attachBossTraits({ currentHp: 5 } as any, [{ id: 'sealmagic', x: 100, v }]), 'p1', { category: '屬性' });
assert.equal(seal()?.wholeSkill, undefined); assert.equal(seal('A')?.wholeSkill, undefined);
assert.equal(seal('B')?.wholeSkill, true); assert.equal(seal('B')?.reason, '【特性·封魔】');

// 六、同名異常（BOSS 類／附屬類開啟回合數）說明切換
const desc = StatusRegistry['特性·迅捷'].description;
assert.ok(desc.includes('BOSS 類異常；') && desc.includes('無回合數'));
const aux = timedAuxDescription(desc); assert.ok(!aux.includes('BOSS 類異常；') && aux.includes('開啟回合數') && aux.includes('不再算 BOSS 類'));
const enc = fs.readFileSync('src/components/Encyclopedia.tsx', 'utf8');
assert.ok(enc.includes("catKey === 'AUXILIARY' && entry.categories.includes('BOSS_ONLY')"), '附屬類區塊不重複列出 BOSS 類');

// 七、實戰臨時圖示：沒有正式圖示的效果用相近的原廠 buff 圖暫代
assert.ok(placeholderEffectIcon('吸血之力').startsWith('/seer/buff/'), '名稱關鍵字');
assert.ok(placeholderEffectIcon('奇怪印記', '每回合減傷 30%').startsWith('/seer/buff/'), '說明關鍵字');
assert.notEqual(placeholderEffectIcon('奇怪印記', '', 'negative'), placeholderEffectIcon('奇怪印記', '', 'positive'), '依正負面給強化／弱化圖');
assert.notEqual(placeholderEffectIcon('奇怪印記'), UNKNOWN_EFFECT_ICON);
const ui = fs.readFileSync('src/components/BattleScreen.ui.tsx', 'utf8');
assert.ok(!/icon: vis\?\.icon \|\| UNKNOWN_EFFECT_ICON/.test(ui) && ui.includes('placeholderEffectIcon(v.label'), '實戰介面不再留空白圖示');
console.log('BOSS 類異常規則：回合數旗標與 BOSS 類分離、瞬殺免疫統一入口、彩色圖、封魔 A／B、同名切換、臨時圖示通過');
