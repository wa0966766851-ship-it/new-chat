// 5041 岳峙淵渟.卡修斯 魂印「山」+ 5 技能 Kit（DSH 2026-10-31）。
//
// 魂印核心（依原文）：
//   自身位於出戰背包內時：
//     有護盾時受攻擊傷害扣減減半
//     超額非真傷 > 當前護盾 → 本次免傷 + 階段結束消耗 50% 護盾回 25% 體力
//     超額真傷 > 當前護盾且致死 → 100% 重生（11/01 裁定：每次滿足條件都觸發，無總次數限制）
//   山神守護狀態時：異常不轉控制/弱化，改為 1 回合不受 PP 限制 + 對手附加失效
//   回合開始（在場累計 ≤1 回合）：召喚額外精靈「炫彩山神」(id: shancaishen)
//   護盾消失時：炫彩山神死亡並清除在場回合數（由 kill_owned_extra 執行）
//   選攻擊技能：忽略對手防禦 40%；雙方任一方有護盾 → 對手先制-2 且 100% 石化
//   選屬性技能：使用後無效對手下次攻擊；雙方任一方有護盾 → 不消耗 PP 且吸取雙方護盾 70% 體力
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';
import texts from './cassiusShanText.json';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const e = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number, extra: Record<string, any> = {}): KitEntry =>
  ({ codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
     params: { clause: { raw, trig, parsed: true, body, ...extra } } });

// 技能 Kit 條目：來源須為 'skill'（執行端只區分「技能／非技能」，套用預設時亦會歸為 skill）。
const sk = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry =>
  ({ ...e(node, trig, raw, body, order), source: 'skill', role: 'attached' });

const selfHalf = c('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 }, '自身體力低於½');
const selfShield = c('shield', { side: 'self' }, '自身擁有護盾');
const fieldShield = c('field_shield', {}, '雙方任一方存在護盾');
const kindIs = (kind: '攻擊' | '屬性') => c('skill_kind', { kind }, kind + '技能');
const noHpLoss = c('last_no_dmg', {}, '吸取後對手體力未減少');
const GUARD = '山神守護';
// 「控制類異常、弱化類異常」一律用狀態分類（StatusRegistry.categories），不寫死異常名單。
const CONTROL_WEAK = ['CONTROL', 'WEAKENING'];
// 「吸取對手最大體力 N%，自身體力低於½時翻倍，吸取後體力未減少則 300 真傷＋後續」共用主體
const drainThenFollowups = (drain: any, follow: any[]) => [
  { acts: [drain] },
  { cond: [noHpLoss], acts: follow },
];

// ── 魂印 Kit ────────────────────────────────────────────────────────────────
export const CASSIUS_SHAN_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5041'],
  name: '山',
  description: texts.soul,
  kit: [
    // ── 自身位於出戰背包內時（battle_start 對所有存活背包持有者派發；規則由通用讀取端 teamPassiveRules 結算）──
    e('battle_start', 'battle_start', '自身與己方其他精靈擁有護盾時若因受到攻擊傷害而扣減時減少量減半', [
      { acts: [a('team_rules', { shieldDeductionRatio: 0.5 })] },
    ], 0),
    e('battle_start', 'battle_start', '若在場精靈受到任一種超額非真實傷害大於該精靈當前護盾值：對手無法造成本次傷害', [
      { acts: [a('team_rules', { excessIntercept: true })] },
    ], 1),
    e('battle_phase_end', 'team_phase_end', '戰鬥階段結束時消耗當前護盾值50%以恢復在場精靈等同於消耗量25%的體力', [
      { acts: [a('team_intercept_settle', { shieldRatio: 0.5, healRatio: 0.25 })] },
    ], 2, { observer: { includeDead: false } }),
    e('battle_start', 'battle_start', '若在場精靈受到超額真實傷害大於該精靈當前護盾值且為致死真實傷害：100%重生1次', [
      { acts: [a('team_rules', { excessTrueRebirth: true })] },
    ], 3),
    // ── 自身處於山神守護狀態時 ──
    e('battle_start', 'battle_start', '自身所處的所有異常狀態無法被轉化為控制類異常、弱化類異常', [
      { acts: [a('status_rules', { whileStatus: GUARD, conversionTargetBan: CONTROL_WEAK })] },
    ], 4),
    e('battle_start', 'battle_start', '取消控制類異常與弱化類異常原有效果；改為自身1回合內選擇使用技能不受PP值限制', [
      { acts: [a('status_rules', { whileStatus: GUARD, cancelEffects: CONTROL_WEAK, replacePpFree: true, replaceInvalidateOppTurns: 1 })] },
    ], 5),
    e('after_action', 'self_after_skill', '技能使用後令對手1回合內技能附加效果失效', [
      { acts: [a('replacement_invalidate_opp', {})] },
    ], 6),
    // ── 回合開始：在場累計回合數 ≤1 → 召喚炫彩山神 ──
    e('round_start', 'round_start', '回合開始時若自身本次在場累計回合數不高於1回合，召喚額外精靈炫彩山神加入己方', [
      { cond: [c('field_rounds', { op: '不高於', amount: 1 })], acts: [
        // 炫彩山神的「被加入時」三效果與死亡／登場行為由額外精靈自己的 Kit 執行（migratedShancaishenKit.ts）。
        a('summon_extra_elf', { id: 'x_shancaishen', name: '炫彩山神', type: '普通', side: 'self', statFromTeamRatio: 1, statSource: 'highest_of_name', statName: '岳峙淵渟.卡修斯', statMode: 'each' }),
      ] },
    ], 0),
    // ── 自身護盾每次消失時：炫彩山神死亡並清除自身本次在場累計回合數 ──
    e('on_entered', 'entrance', '自身護盾每次消失時：炫彩山神死亡以清除自身本次在場累計回合數', [
      { acts: [a('shield_lost_watch', { scope: 'self', once: false, body: [
        // 護盾消失時才執行；ownerShield:'gone' 為防誤殺（護盾又被補上則不動作）
        { acts: [a('kill_owned_extra', { id: 'x_shancaishen', ownerShield: 'gone', resetOwnerRounds: true })] },
      ] })] },
    ], 7),
    // ── 選擇攻擊技能：忽略對手防禦40%；雙方任一方有護盾 → 對手先制-2且100%石化 ──
    e('on_skill_use', 'self_attack', '自身選擇使用攻擊技能時忽略對手防禦值40%', [
      { acts: [a('ignore_def_turns', { ratio: 0.4, turns: 1, stat: '雙防' })] },
    ], 8),
    e('on_skill_selected', 'skill_selected', '雙方任一方存在護盾時額外令對手先制-2且100%石化', [
      { cond: [kindIs('攻擊'), fieldShield], acts: [
        a('prio_turns', { side: 'opp', v: -2, turns: 1, current: true }),
        a('status', { side: 'opp', status: '石化', turns: 3, chance: 100 }),
      ] },
    ], 9),
    // ── 選擇屬性技能：使用後無效對手下次攻擊；雙方任一方有護盾 → 不消耗PP且吸取雙方護盾70%體力 ──
    e('on_skill_use', 'self_status', '自身選擇使用屬性技能時使用技能後無效對手下次攻擊技能', [
      { acts: [a('invalid_next', { kind: '攻擊', uses: 1 })] },
    ], 10),
    e('battle_start', 'battle_start', '雙方任一方存在護盾時則自身使用技能不消耗PP值', [
      { acts: [a('skill_rules', { ppFreeKind: '屬性', ppFreeWhenFieldShield: true })] },
    ], 11),
    e('on_skill_use', 'self_status', '雙方任一方存在護盾時技能使用時額外吸取雙方護盾值70%的體力', [
      { cond: [fieldShield], acts: [a('drain_shield_ratio', { ratio: 0.7 })] },
    ], 12),
  ],
};

// ── 技能 Kit ────────────────────────────────────────────────────────────────
export const CASSIUS_SHAN_SKILL_KITS = [
  {
    elfIds: ['5041'], name: '萬壑崩摧',
    description: texts.skills['萬壑崩摧'],
    kit: [
      sk('on_skill_use', 'self_skill', '5回合內每回合結束時解除自身能力下降並附加給對手', [
        { acts: [a('timed', { turns: 5, trig: 'round_end', body: [{ acts: [a('stat_transfer_down', {})] }] })] },
      ], 0),
      sk('on_skill_use', 'self_skill', '消除雙方護盾護罩並吸取對手消除量的等量體力，若高於400則提升100點體力上限', [
        { acts: [a('clear_both_shields', { drainRatio: 1, threshold: 400, maxHpBonus: 100 })] },
      ], 1),
      sk('on_skill_use', 'self_skill', '5回合內使用技能後吸取對手300點體力，低於½翻倍，未減少則附加300真傷且下2回合對手無法恢復體力', [
        { acts: [a('timed', { turns: 5, trig: 'self_after_skill', body: drainThenFollowups(
          a('drain', { flat: 300, x2If: selfHalf }),
          [a('dmg', { flat: 300, type: '真實' }), a('no_heal', { turns: 2, next: true })]) })] },
      ], 2),
      sk('on_skill_use', 'self_skill', '令對手所有技能PP值-1，若當回合所選技能PP為0則無法行動', [
        { acts: [a('pp_op', { side: 'opp', mode: 'reduce', amount: 1 })] },
        { cond: [c('selected_pp', { side: 'opp', op: '不高於', amount: 0 }, '對手所選技能PP為0')], acts: [a('action_prevent_on_empty', { side: 'opp' })] },
      ], 3),
    ],
  },
  {
    elfIds: ['5041'], name: '群山許諾',
    description: texts.skills['群山許諾'],
    kit: [
      sk('on_skill_use', 'self_skill', '自身攻擊、防禦、特防、速度、命中+1', [
        { acts: [a('stat', { side: 'self', stats: ['攻擊','防禦','特防','速度','命中'], v: 1 })] },
      ], 0),
      sk('on_skill_use', 'self_skill', '為自身附加3回合山神守護，自身擁有山神守護時改為山神守護回合結束時將其他異常同時解除', [
        { cond: [c('has_status', { side: 'self', status: GUARD, neg: true })], acts: [a('status', { side: 'self', status: GUARD, turns: 3, chance: 100 })] },
        { cond: [c('has_status', { side: 'self', status: GUARD })], acts: [a('status_end_cleanse', { status: GUARD, turns: 3 })] },
      ], 1),
      sk('on_skill_use', 'self_skill', '5回合內使用技能吸取對手最大體力⅓，低於½翻倍，未減少則附加300真傷並為對手附加300護罩', [
        { acts: [a('timed', { turns: 5, trig: 'self_after_skill', body: drainThenFollowups(
          a('drain', { ratio: 1 / 3, x2If: selfHalf }),
          [a('dmg', { flat: 300, type: '真實' }), a('barrier_add', { side: 'opp', flat: 300 })]) })] },
      ], 2),
      sk('on_skill_use', 'self_skill', '3回合內對手使用攻擊技能則下2回合屬性技能附加效果失效', [
        { acts: [a('timed', { turns: 3, trig: 'opp_attack', from: 'now', skillKind: '攻擊', body: [{ acts: [a('add_invalid_turns', { kind: '屬性', turns: 2, next: true })] }] })] },
      ], 3),
      sk('on_skill_use', 'self_skill', '為自身附加400點護盾，護盾消失時附加400點真傷且100%令雙方依序進入束縛、星贖3回合', [
        { acts: [
          a('shield', { flat: 400 }),
          a('shield_lost_watch', { scope: 'self', once: true, body: [
            { acts: [a('dmg', { flat: 400, type: '真實' })] },
            { acts: [a('status', { side: 'both', status: '束縛', turns: 3, chance: 100 })] },
            { acts: [a('status', { side: 'both', status: '星贖', turns: 3, chance: 100 })] },
          ] }),
        ] },
      ], 4),
    ],
  },
  {
    elfIds: ['5041'], name: '歸塵',
    description: texts.skills['歸塵'],
    kit: [
      sk('on_skill_use', 'self_attack', '無視對手免疫受到的攻擊效果', [
        { acts: [a('ignore', { what: '攻擊免疫' })] },
      ], 0),
      sk('on_skill_use', 'self_attack', '無視成功則自身下次攻擊無視對手免疫效果', [
        { cond: [c('ignore_success', { what: '攻擊免疫' })], acts: [a('ignore_next', { what: '攻擊免疫' })] },
      ], 1),
      sk('on_skill_use', 'self_attack', '消除對手回合類效果，成功則100%令對手疲憊，未觸發則將自身下次受到攻擊傷害轉化為自身體力', [
        { acts: [a('clear_turn', { side: 'opp' })] },
        { chain: 'success', acts: [a('status', { side: 'opp', status: '疲憊', turns: 3, chance: 100 })] },
        { chain: 'fail', acts: [a('convert_damage_to_heal_next', { n: 1, ratio: 1, kind: '攻擊' })] },
      ], 2),
      sk('on_skill_use', 'self_attack', '吸取對手最大體力40%，每次使用提升5%，最高60%', [
        { acts: [a('escalating_drain', { base: 0.4, step: 0.05, max: 0.6 })] },
      ], 3),
      sk('on_skill_use', 'self_attack', '3回合內對手使用攻擊技能時100%令對手進入石化', [
        { acts: [a('timed', { turns: 3, trig: 'opp_attack', from: 'now', skillKind: '攻擊', body: [{ acts: [a('status', { side: 'opp', status: '石化', turns: 3, chance: 100 })] }] })] },
      ], 4),
    ],
  },
  {
    elfIds: ['5041'], name: '破影',
    description: texts.skills['破影'],
    kit: [
      sk('on_skill_use', 'self_attack', '無視對手攻擊傷害限制效果', [
        { acts: [a('ignore', { what: '傷害限制' })] },
      ], 0),
      sk('on_hit', 'after_hit', '無視成功則自身下次攻擊無視對手攻擊傷害限制效果', [
        { cond: [c('ignore_success', { what: '傷害限制' })], acts: [a('ignore_next', { what: '傷害限制' })] },
      ], 1),
      sk('on_skill_use', 'self_attack', '3回合內令對手防禦、特防-1，未觸發則下2回合內對手受到技能傷害提升150%', [
        { acts: [a('stat', { side: 'opp', stats: ['防禦','特防'], v: -1 })] },
        { chain: 'fail', acts: [a('damage_multiplier_turns', { side: 'opp', dir: 'in', kind: '技能', mult: 2.5, turns: 2, next: true })] },
      ], 2),
      sk('on_skill_use', 'self_attack', '先出手則對手當回合攻擊技能無效', [
        { cond: [c('first', {})], acts: [a('invalid_turns', { kind: '攻擊', turns: 1 })] },
      ], 3),
      sk('on_skill_use', 'self_attack', '4回合內自身使用技能吸取對手最大體力¼', [
        { acts: [a('timed', { turns: 4, trig: 'self_after_skill', body: [{ acts: [a('drain', { ratio: 0.25 })] }] })] },
      ], 4),
    ],
  },
  {
    elfIds: ['5041'], name: '炫彩.山殞垣頹',
    description: texts.skills['炫彩.山殞垣頹'],
    kit: [
      // 與【精靈王特權】同句同機制（5012 王·霜祲霞罰等：role innate＋既有 op no_resist）。
      { ...sk('on_skill_use', 'self_attack', '【精靈王特權】攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）', [
        { acts: [a('no_resist', {})] },
      ], 0), role: 'innate' as const },
      sk('on_skill_use', 'self_attack', '消除對手能力提升狀態，成功則自身進入山神守護，已處於則恢復自身最大體力⅓', [
        { acts: [a('stat_clear', { side: 'opp', kind: 'up' })] },
        { chain: 'success', acts: [a('status_if_absent_else_heal', { status: GUARD, turns: 3, healRatio: 1 / 3 })] },
      ], 1),
      sk('on_skill_use', 'use', '己方其他精靈下次登場時免疫下次受到的異常狀態', [
        { acts: [a('next_ally_entry', { resource: 'none', ratio: 1, excludeSource: true, label: '免疫下次異常',
          body: [{ acts: [a('immune_status_count', { count: 1 })] }] })] },
      ], 2),
      sk('on_skill_use', 'self_attack', '吸取對手自身最大體力50%並為自身附加等量護盾', [
        { acts: [a('drain_then_shield', { ratio: 0.5 })] },
      ], 3),
      sk('on_skill_use', 'self_attack', '之後下次己方精靈護盾消失時令對手下回合無法主動切換精靈', [
        { acts: [a('shield_lost_watch', { scope: 'team', once: true, body: [{ acts: [a('no_switch', { turns: 1, next: true })] }] })] },
      ], 4),
      sk('modify_power', 'outgoing_power', '自身擁有護盾時技能威力翻倍', [
        { cond: [selfShield], acts: [a('power_multiplier', { v: 2 })] },
      ], 5),
    ],
  },
];

export const CASSIUS_SHAN_ALL_KITS = [CASSIUS_SHAN_SOUL_KIT, ...CASSIUS_SHAN_SKILL_KITS];
