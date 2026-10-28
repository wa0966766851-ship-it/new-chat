import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
import texts from './finalMarsLanDragonTexts.json';
const c = (name: string, p: any) => ({ c: name, p, label: name });
const up = (v: number) => a('stat', { side: 'self', stats: ['特攻', '防禦', '特防', '速度', '命中'], v });
const timed = (turns: number, trig: string, body: any[], label: string) => a('timed', { turns, from: 'now', trig, body, initial: trig === 'self_skill', label });
const coreRaw = '■ 必中\n🎯 解除自身異常狀態，解除成功則令堅壁機甲解析並記錄此異常狀態\n🎯 5回合內自身使用技能恢復自身體力1/3並附加對手等量百分比傷害，自身體力低於1/2時效果翻倍\n🎯 5回合內自身使用技能吸取對手350點固定體力，對手受到固定傷害後體力未減少則附加300點真實傷害\n🎯 3回合內若對手使用攻擊技能則100%令對手隨機2個技能PP值不為0的技能歸0並將降低的PP值總和轉變為自身技能補充等量充能';
const fifthRaw = '■ 先制+3\n■ 必中\n■ 此技能PP值為滿時無視自身能力下降狀態\n🎯 消除雙方回合類效果，消除成功則令對手燒傷、麻痺、疲憊，任一種異常未觸發則令對手隨機1個技能PP值不為0的技能歸0並將降低的PP值總和轉變為自身充能未滿的技能等量充能\n🎯 消除雙方能力上升、下降狀態、護盾與護罩，消除任意一項則吸取對手等同於對手最大體力70%的百分比傷害\n🎯 3回合內對手體力恢復量下降100%\n🎯 特攻+1、防禦+1、特防+1、速度+1、命中+1，自身技能中存在充能時效果翻倍，若存在技能中充能為0的技能則補充所有技能5點充能\n🎯 5回合內免疫並反彈所有異常狀態';
export const MIGRATED_FINAL_MARS_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5016'], name: '核心重構', description: coreRaw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    sequence('解除自身異常狀態，解除成功則解析並記錄此異常狀態', [{ acts: [a('archive_cure', { key: 'mechArchivedStatuses' })] }], 1),
    sequence('5回合內自身使用技能恢復自身體力1/3並附加對手等量百分比傷害，自身體力低於1/2時效果翻倍', [{ acts: [timed(5, 'self_skill', [
      { acts: [a('heal', { side: 'self', ratio: 1 / 3, x2If: c('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 }) }), a('dmg_equal', { type: '百分比' })] },
    ], '核心重構·恢復與反饋')] }], 2),
    sequence('5回合內自身使用技能吸取對手350點固定體力，對手受到固定傷害後體力未減少則附加300點真實傷害', [{ acts: [timed(5, 'self_skill', [
      { acts: [a('drain', { flat: 350, true: false })] },
      { cond: [c('last_no_dmg', {})], acts: [a('dmg', { flat: 300, type: '真實' })] },
    ], '核心重構·固定吸取')] }], 3),
    sequence('3回合內對手使用攻擊技能，隨機2個PP非0技能歸0並轉為等量充能', [{ acts: [timed(3, 'opp_attack', [
      { acts: [a('pp_zero_to_charge', { count: 2, onlyBelowMax: false })] },
    ], '核心重構·充能掠奪')] }], 4),
  ] },
  { elfIds: ['5016'], name: '王·超限共頻', description: fifthRaw, kit: [
    property('■ 先制+3', 'base_priority', 3, 0), property('■ 必中', 'sure_hit', true, 1),
    { codeId: 'skill_property', node: 'before_damage', source: 'skill', role: 'innate', order: 2,
      customText: '■ 此技能PP值為滿時無視自身能力下降狀態', params: { property: 'stage_view', value: 'self_down_ignore', conditions: [c('pp_full', {})] } },
    sequence('消除雙方回合類效果，成功則燒傷、麻痺、疲憊，任一未觸發則隨機PP歸0轉充能', [
      { acts: [a('clear_turn', { side: 'both' })] },
      { chain: 'success', acts: [a('status_batch_failure', { statuses: ['燒傷', '麻痺', '疲憊'], turns: 3, body: [
        { acts: [a('pp_zero_to_charge', { count: 1, onlyBelowMax: true })] },
      ] })] },
    ], 3),
    sequence('消除雙方能力上升、下降狀態、護盾與護罩，任一成功則吸取對手最大體力70%', [
      { acts: [a('any_effect', { body: [
        { acts: [a('stat_clear', { side: 'both', kind: 'all' })] },
        { acts: [a('clear_shield', { side: 'both', kind: 'both' })] },
      ] })] }, { chain: 'success', acts: [a('drain', { ratio: 0.7, true: false })] },
    ], 4),
    sequence('3回合內對手體力恢復量下降100%', [{ acts: [a('recovery_reduce_turns', { side: 'opp', ratio: 1, turns: 3, includePotions: false, next: false })] }], 5),
    sequence('特攻、防禦、特防、速度、命中+1，存在充能翻倍；任一技能零充能則全部補5', [
      { acts: [up(1)] }, { acts: [a('charge_if', { mode: 'any_positive', body: [{ acts: [up(1)] }] })] },
      { acts: [a('charge_if', { mode: 'any_zero', body: [{ acts: [a('charge_add', { amount: 5, fromLast: false, onlyBelowMax: false })] }] })] },
    ], 6),
    sequence('5回合內免疫並反彈所有異常狀態', [{ acts: [a('immune_status_turns', { turns: 5, reflect: true, cls: '' })] }], 7),
  ] },
];

const soulEntry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({ codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw, params: { clause: { raw, trig, parsed: true, body } } });
const count = (n: number) => c('mark_count', { side: 'self', id: 'poem_chapter', op: '不小於', amount: n });
export const MIGRATED_FINAL_DRAGON_SOUL_KIT = {
  kind: 'soul' as const, elfIds: ['5021'], name: '龍', description: texts.dragon,
  kit: [
    soulEntry('battle_start', 'battle_start', '出戰背包常駐：每回合開始所有存活精靈附加1篇獨立體力快照，死亡時轉交所有存活接收者', [{ acts: [a('snapshot_resource_rule', { id: 'poem_chapter', name: '詩章', displayChar: '詩', snapshotKey: 'poemHpSnapshots', perRound: 1, receiverKey: 'poem_chapter' })] }], 0),
    soulEntry('battle_start', 'battle_start', '1篇起將對手能力提升視為同級下降，自身能力下降視為同級提升', [{ acts: [a('resource_query_rule', { id: 'poem_chapter', min: 1, ignorePpLimit: false, selfDownAsUp: true, oppUpAsDown: true })] }], 1),
    soulEntry('battle_start', 'battle_start', '2篇起使用技能無視PP值限制', [{ acts: [a('resource_query_rule', { id: 'poem_chapter', min: 2, ignorePpLimit: true, selfDownAsUp: false, oppUpAsDown: false })] }], 2),
    soulEntry('modify_priority', 'modify_priority', '1：每有1篇詩章先制+1', [{ cond: [count(1)], acts: [a('resource_priority', { id: 'poem_chapter', perUnit: 1 })] }], 3),
    soulEntry('on_skill_use', 'self_skill', '2：使用技能吸取對手所有技能1點PP', [{ cond: [count(2)], acts: [a('pp_drain', { v: 1, steal: true })] }], 4),
    soulEntry('round_start', 'round_start', '3：回合開始解除異常；大於3篇則免疫所有異常', [
      { cond: [count(3)], acts: [a('cure_status', { side: 'self', cls: '' })] },
      { cond: [count(4)], acts: [a('immune_status_turns', { turns: 1, cls: '', reflect: false })] },
    ], 5),
    soulEntry('on_skill_use', 'self_skill', '4：使用技能吸取最大體力40%，每2篇額外10%，下次技能傷害減少40%', [{ cond: [count(4)], acts: [a('resource_drain', { id: 'poem_chapter', baseRatio: 0.4, bonusPerGroup: 0.1, step: 2 }), a('next_skill_reduction', { ratio: 0.4 })] }], 6),
    soulEntry('before_damage', 'outgoing', '5：每篇攻擊傷害提升20%', [{ cond: [count(5)], acts: [a('resource_damage_modifier', { id: 'poem_chapter', dir: 'out', kind: '攻擊', perUnit: 0.2 })] }], 7),
    soulEntry('before_damage', 'incoming', '5：每篇受到技能傷害減少10%', [{ cond: [count(5)], acts: [a('resource_damage_modifier', { id: 'poem_chapter', dir: 'in', kind: '技能', perUnit: 0.1 })] }], 8),
    soulEntry('before_damage', 'incoming', '消耗4篇技能使用時取得的下次技能傷害減少40%', [{ acts: [a('consume_skill_reduction', {})] }], 16),
    soulEntry('modify_power', 'outgoing_power', '6：雙方每50點護盾與護罩，攻擊威力額外+50', [{ cond: [count(6)], acts: [a('shield_power_steps', { step: 50, powerPerGroup: 50 })] }], 9),
    soulEntry('after_action', 'self_after_attack', '7：攻擊附加雙方體力差值真實傷害', [{ cond: [count(7)], acts: [a('hp_difference_damage', { ratio: 1, type: '真實' })] }], 10),
    soulEntry('on_skill_use', 'self_attack', '8：無視對手攻擊免疫與傷害限制', [{ cond: [count(8)], acts: [a('ignore', { what: '攻擊免疫' }), a('ignore', { what: '傷害限制' })] }], 11),
    soulEntry('before_damage', 'outgoing', '8：無視攻擊免疫成功時技能傷害提升100%', [{ cond: [count(8), c('ignore_success', { what: '攻擊免疫' })], acts: [a('dmg_mod', { dir: 'out', kind: '技能', boost: 1 })] }], 12),
    soulEntry('after_attack_hit', 'attack_hit', '9：按實際攻擊傷害等量附加護盾與護罩', [{ cond: [count(9)], acts: [a('receipt_shields', { ratio: 1, shield: true, barrier: true })] }], 13),
    soulEntry('on_skill_use', 'self_attack', '10：攻擊附加對手最大體力的技能傷害', [{ cond: [count(10)], acts: [a('dmg', { of: 'opp', base: '最大體力', ratio: 1, type: '技能', elem: '次元龍', appendToAttack: true })] }], 14),
    soulEntry('self_fatal', 'fatal', '每場首次死亡強制存活；當回合保留1點、免疫異常，進入龍魂直到戰鬥結束', [{ acts: [a('once', { key: 'poemDragonAwakening', body: [{ acts: [a('cure_status', { side: 'self', cls: '' }), a('survive', {}), a('survive_turns', { turns: 1 }), a('immune_status_turns', { turns: 1, cls: '', reflect: false }), a('flag_set', { key: 'dimensionalDragonSoul', value: true })] }] })] }], 15),
  ],
};
