// 5041 岳峙淵渟.卡修斯 魂印「山」+ 5 技能 Kit（DSH 2026-10-31）。
//
// 魂印核心（依原文）：
//   自身位於出戰背包內時：
//     有護盾時受攻擊傷害扣減減半
//     超額非真傷 > 當前護盾 → 本次免傷 + 階段結束消耗 50% 護盾回 25% 體力
//     超額真傷 > 當前護盾且致死 → 100% 重生 1 次
//   山神守護狀態時：異常不轉控制/弱化，改為 1 回合不受 PP 限制 + 對手附加失效
//   回合開始（在場累計 ≤1 回合）：召喚額外精靈「炫彩山神」(id: shancaishen)
//   護盾消失時：炫彩山神死亡並清除在場回合數
//   選攻擊技能：忽略對手防禦 40%；雙方任一方有護盾 → 對手先制-2 且 100% 石化
//   選屬性技能：使用後無效對手下次攻擊；雙方任一方有護盾 → 不消耗 PP 且吸取雙方護盾 70% 體力
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';
import texts from './cassiusShanText.json';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const e = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry =>
  ({ codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
     params: { clause: { raw, trig, parsed: true, body } } });

const hasShield = (side: 'self' | 'opp') => c('shield', { side });

// ── 魂印 Kit ────────────────────────────────────────────────────────────────
export const CASSIUS_SHAN_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5041'],
  name: '山',
  description: texts.soul,
  kit: [
    // 回合開始：在場累計 ≤1 回合 → 召喚炫彩山神
    e('round_start', 'round_start', '回合開始時若自身本次在場累計回合數不高於1回合，召喚額外精靈炫彩山神加入己方', [
      { cond: [c('field_rounds', { op: '不高於', amount: 1 })], acts: [
        a('summon_extra_elf', { id: 'shancaishen', name: '炫彩山神', type: '普通', side: 'self', statFromTeamRatio: 1, statSource: 'team' }),
        a('shield', { ratio: 0.5 }),
        a('status', { side: 'self', status: '山神守護', turns: 3, chance: 100 }),
      ] },
    ], 0),
    // 選攻擊技能：忽略對手防禦 40%；雙方任一方有護盾 → 對手先制-2 且 100% 石化
    e('on_skill_use', 'self_attack', '自身選擇使用攻擊技能時忽略對手防禦值40%；雙方任一方存在護盾時額外令對手先制-2且100%石化', [
      { acts: [ a('ignore_def_turns', { ratio: 0.4, turns: 1, stat: '雙防' }) ] },
      { cond: [c('field_shield', {})], acts: [
        a('next_skill_prio', { side: 'opp', v: -2 }),
        a('status', { side: 'opp', status: '石化', turns: 3, chance: 100 }),
      ] },
    ], 1),
    // 選屬性技能：使用後無效對手下次攻擊；雙方任一方有護盾 → 不消耗 PP 且吸取雙方護盾 70% 體力
    e('on_skill_use', 'self_skill', '自身選擇使用屬性技能時使用技能後無效對手下次攻擊技能；雙方任一方存在護盾時自身使用技能不消耗PP值且技能使用時額外吸取雙方護盾值70%的體力', [
      { acts: [ a('invalid_next', { kind: '攻擊', uses: 1 }) ] },
      { cond: [c('field_shield', {})], acts: [
        a('drain_shield_ratio', { ratio: 0.7 }),
      ] },
    ], 2),
  ],
};

// ── 技能 Kit ────────────────────────────────────────────────────────────────
export const CASSIUS_SHAN_SKILL_KITS = [
  {
    elfIds: ['5041'], name: '萬壑崩摧',
    description: texts.skills['萬壑崩摧'],
    kit: [
      e('on_skill_use', 'self_skill', '5回合內每回合結束時解除自身能力下降並附加給對手', [
        { acts: [ a('timed_status_transfer_down', { turns: 5 }) ] },
      ], 0),
      e('on_skill_use', 'self_skill', '消除雙方護盾護罩並吸取對手消除量的等量體力，若高於400則提升100點體力上限', [
        { acts: [ a('clear_both_shields', { drainRatio: 1, threshold: 400, maxHpBonus: 100 }) ] },
      ], 1),
      e('on_skill_use', 'self_skill', '5回合內使用技能後吸取對手300點體力，低於½翻倍，未減少則附加300真傷且下2回合對手無法恢復體力', [
        { acts: [ a('timed_drain_after_use', { turns: 5, amount: 300, doubleBelowHalf: true, failTrueDamage: 300, noHealTurns: 2 }) ] },
      ], 2),
      e('on_skill_use', 'self_skill', '令對手所有技能PP值-1，若當回合所選技能PP為0則無法行動', [
        { acts: [ a('pp_op', { side: 'opp', mode: 'reduce', amount: 1 }), a('action_prevent_on_empty', { kind: '攻擊' }) ] },
      ], 3),
    ],
  },
  {
    elfIds: ['5041'], name: '群山許諾',
    description: texts.skills['群山許諾'],
    kit: [
      e('on_skill_use', 'self_skill', '自身攻擊、防禦、特防、速度、命中+1', [
        { acts: [ a('stat', { side: 'self', stats: ['攻擊','防禦','特防','速度','命中'], v: 1 }) ] },
      ], 0),
      e('on_skill_use', 'self_skill', '附加3回合山神守護', [
        { acts: [ a('status', { side: 'self', status: '山神守護', turns: 3, chance: 100 }) ] },
      ], 1),
      e('on_skill_use', 'self_skill', '5回合內使用技能吸取對手最大體力⅓，低於½翻倍，未減少則附加300真傷並為對手附加300護罩', [
        { acts: [ a('timed_drain_after_use', { turns: 5, ratioOfTargetMax: 1/3, doubleBelowHalf: true, failTrueDamage: 300, failBarrier: 300 }) ] },
      ], 2),
      e('on_skill_use', 'self_skill', '3回合內對手使用攻擊技能則下2回合屬性技能附加效果失效', [
        { acts: [ a('timed_react_on_attack', { turns: 3, thenInvalidUtilityTurns: 2 }) ] },
      ], 3),
      e('on_skill_use', 'self_skill', '為自身附加400點護盾，護盾消失時附加400真傷且令雙方依序進入束縛、星贖3回合', [
        { acts: [ a('shield', { flat: 400 }), a('timed_shield_break_reaction', { trueDamage: 400, statuses: ['束縛','星贖'], turns: 3 }) ] },
      ], 4),
    ],
  },
  {
    elfIds: ['5041'], name: '歸塵',
    description: texts.skills['歸塵'],
    kit: [
      e('on_skill_use', 'self_attack', '無視對手免疫受到的攻擊效果，無視成功則自身下次攻擊無視對手免疫效果', [
        { acts: [ a('ignore', { what: '攻擊免疫' }), a('ignore_next', { what: '攻擊免疫' }) ] },
      ], 0),
      e('on_skill_use', 'self_attack', '消除對手回合類效果，成功則100%令對手疲憊，未觸發則將自身下次受到攻擊傷害轉化為自身體力', [
        { acts: [ a('clear_turn', { side: 'opp' }) ] },
        { chain: 'success', acts: [ a('status', { side: 'opp', status: '疲憊', turns: 3, chance: 100 }) ] },
        { chain: 'fail', acts: [ a('damage_to_heal_next', {}) ] },
      ], 1),
      e('on_skill_use', 'self_attack', '吸取對手最大體力40%，每次使用提升5%，最高60%', [
        { acts: [ a('escalating_drain', { base: 0.4, step: 0.05, max: 0.6 }) ] },
      ], 2),
      e('on_skill_use', 'self_attack', '3回合內對手使用攻擊技能時100%令對手進入石化', [
        { acts: [ a('timed_react_on_attack', { turns: 3, status: '石化', chance: 100 }) ] },
      ], 3),
    ],
  },
  {
    elfIds: ['5041'], name: '破影',
    description: texts.skills['破影'],
    kit: [
      e('on_skill_use', 'self_attack', '無視對手攻擊傷害限制效果，無視成功則自身下次攻擊無視對手攻擊傷害限制效果', [
        { acts: [ a('ignore', { what: '傷害限制' }) ] },
      ], 0),
      e('on_skill_use', 'self_attack', '3回合內令對手防禦、特防-1，未觸發則下2回合內對手受到技能傷害提升150%', [
        { acts: [ a('stat', { side: 'opp', stats: ['防禦','特防'], v: -1 }) ] },
        { chain: 'fail', acts: [ a('dmg_taken_boost', { side: 'opp', ratio: 1.5, turns: 2 }) ] },
      ], 1),
      e('on_skill_use', 'self_attack', '先出手則對手當回合攻擊技能無效', [
        { cond: [c('first', {})], acts: [ a('invalid_turns', { kind: '攻擊', turns: 1 }) ] },
      ], 2),
      e('on_skill_use', 'self_attack', '4回合內自身使用技能吸取對手最大體力¼', [
        { acts: [ a('timed_drain_after_use', { turns: 4, ratioOfTargetMax: 0.25 }) ] },
      ], 3),
    ],
  },
  {
    elfIds: ['5041'], name: '炫彩.山殞垣頹',
    description: texts.skills['炫彩.山殞垣頹'],
    kit: [
      e('on_skill_use', 'self_attack', '攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）', [
        { acts: [ a('no_weak_damage', {}) ] },
      ], 0),
      e('on_skill_use', 'self_attack', '消除對手能力提升狀態，成功則自身進入山神守護，已處於則恢復自身最大體力⅓', [
        { acts: [ a('stat_clear', { side: 'opp', kind: 'up' }) ] },
        { chain: 'success', acts: [
          a('status_if_absent_else_heal', { status: '山神守護', turns: 3, healRatio: 1/3 }),
        ] },
      ], 1),
      e('on_skill_use', 'self_attack', '己方其他精靈下次登場時免疫下次受到的異常狀態', [
        { acts: [ a('team_next_entry_status_immune', { count: 1 }) ] },
      ], 2),
      e('on_skill_use', 'self_attack', '吸取對手自身最大體力50%並為自身附加等量護盾，之後下次己方精靈護盾消失時令對手下回合無法主動切換精靈', [
        { acts: [ a('drain_then_shield', { ratio: 0.5 }), a('shield_break_no_switch', { turns: 1 }) ] },
      ], 3),
      e('modify_power', 'outgoing_power', '自身擁有護盾時技能威力翻倍', [
        { cond: [c('field_shield', {})], acts: [ a('power_multiplier', { v: 2 }) ] },
      ], 4),
    ],
  },
];

export const CASSIUS_SHAN_ALL_KITS = [CASSIUS_SHAN_SOUL_KIT, ...CASSIUS_SHAN_SKILL_KITS];
