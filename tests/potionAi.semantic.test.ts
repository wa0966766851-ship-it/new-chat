// AI 擴充藥劑評分（2026-11-07）：反噬傷害斬殺、控制類異常、干擾、強化、持續恢復；我能直接擊倒對手時不用藥。
import assert from 'node:assert/strict';
import { scoreActions, AI_DEFAULT } from '../src/battle/ai/legacyScoring';
import { BATTLE_ITEMS } from '../src/utils/battleHelpers';
const item = (id: string) => { const i = BATTLE_ITEMS.find(x => x.id === id); assert.ok(i, id); return i!; };
const mk = (id: string, hp: number, extra: any = {}): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: 1000, statStages: {},
  calculatedStats: { hp: 1000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }, skills: [{ name: '打', category: '物理', type: '普通', power: 40, pp: 10, maxPp: 10 }], ...extra });
const deps = (dmgToFoe: number, dmgToSelf: number): any => ({
  estimateDamage: (a: any) => (a.id === 'S' || a.id.startsWith('B') ? dmgToFoe : dmgToSelf), getTypeMatchup: () => 1,
  getStatuses: (e: any) => e.battleStatuses || {}, isSkillUsable: () => true,
  isControlStatus: (n: string) => ['麻痺', '睡眠', '害怕', '石化', '疲憊', '冰封', '焚燼', '感染'].includes(n), isPpExempt: () => false, rng: () => 0.5,
});
const ctx = (self: any, foe: any, items: string[], team: any[] = [self]): any => ({ self, opponent: foe, team, activeIndex: 0, items: items.map(item), canSwitch: false, canUseItem: true, turnNumber: 3 });
const top = (c: any, d: any) => scoreActions(c, d, { ...AI_DEFAULT, randomness: 0, noise: 0 }).sort((a, b) => b.score - a.score)[0];
const itemScore = (c: any, d: any, id: string) => scoreActions(c, d, AI_DEFAULT).find(a => a.action.kind === 'item' && (a.action as any).item.id === id)?.score ?? 0;

// 一、反噬傷害可斬殺 → 首選（技能打不死時）
let r = top(ctx(mk('S', 800), mk('F', 250), ['atk_dmg_300']), deps(100, 50));
assert.equal(r.action.kind, 'item'); assert.equal((r.action as any).item.id, 'atk_dmg_300');
// 二、我能直接擊倒 → 不用藥
assert.equal(itemScore(ctx(mk('S', 800), mk('F', 250), ['atk_dmg_300', 'inflict_paralysis']), deps(400, 50), 'inflict_paralysis'), 0);
// 三、對手可能擊倒我 → 控制類異常有分、弱化類沒有
const danger = deps(100, 900);
assert.ok(itemScore(ctx(mk('S', 800), mk('F', 900), ['inflict_paralysis']), danger, 'inflict_paralysis') > 50, '控制類阻止對手斬殺');
assert.equal(itemScore(ctx(mk('S', 800), mk('F', 900), ['inflict_poison']), danger, 'inflict_poison'), 0, '危急時不附加弱化');
// 四、對手已處於該異常 → 不用
assert.equal(itemScore(ctx(mk('S', 800), mk('F', 900, { battleStatuses: { '麻痺': 2 } }), ['inflict_paralysis']), deps(100, 50), 'inflict_paralysis'), 0);
// 五、干擾：對手體力偏低才封藥
assert.ok(itemScore(ctx(mk('S', 800), mk('F', 400), ['atk_itemlock_2']), deps(100, 50), 'atk_itemlock_2') > 0);
assert.equal(itemScore(ctx(mk('S', 800), mk('F', 950), ['atk_itemlock_2']), deps(100, 50), 'atk_itemlock_2'), 0);
// 六、強化：未持有才用；持有則不用
assert.ok(itemScore(ctx(mk('S', 900), mk('F', 950), ['buff_rage']), deps(100, 50), 'buff_rage') > 0);
assert.equal(itemScore(ctx(mk('S', 900, { battleStatuses: { '狂暴': 2 } }), mk('F', 950), ['buff_rage']), deps(100, 50), 'buff_rage'), 0);
// 七、持續恢復：後援缺血才用後援版；滿血不用
const hurtBench = [mk('S', 950), mk('B1', 300), mk('B2', 300)];
assert.ok(itemScore(ctx(hurtBench[0], mk('F', 950), ['regen_hp_b'], hurtBench), deps(100, 50), 'regen_hp_b') > 0);
const fullBench = [mk('S', 1000), mk('B1', 1000)];
assert.equal(itemScore(ctx(fullBench[0], mk('F', 950), ['regen_hp_b'], fullBench), deps(100, 50), 'regen_hp_b'), 0);
// 八、一般出手仍優先於普通干擾（分數低於出招）
r = top(ctx(mk('S', 900), mk('F', 400), ['atk_itemlock_2', 'buff_rage']), deps(150, 50));
assert.equal(r.action.kind, 'skill', '一般局面以出招為主');
console.log('AI 擴充藥劑評分 8 項通過');
