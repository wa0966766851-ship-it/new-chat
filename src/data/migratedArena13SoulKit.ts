// arena_13 龍錄天鋒 魂印（出戰次數序列）Kit（DSH 20261017 第九批 legacyWrapped 拆解）。
// 舊 handler：staged-arena/tianfengRegistry handleTianfengSoulMark 整份移除（規則3.3）。
// 通用件：entrance_effect_stage／entrance_stage 條件（entranceStack.ts）＋
//   damage_cap_turns{capRatio}（¼最大體力動態上限）＋crit_block_turns（致命抵擋新讀取端）。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } },
});

const raw = '自身每次登場時，根據本場戰鬥的出戰次數，依序觸發等量的兩回合效果：①受到的技能傷害不超過最大體力 25%；②造成的攻擊傷害提升 100%；③抵擋受到的致命一擊；④令對手體力恢復效果減少 50%；⑤每回合結束吸取對手所有技能 1 點 PP；⑥造成的固定傷害與百分比傷害額外提升 30%。上述效果第 6 次被觸發時不會生效並清除原有效果；第 7 次觸發起恢復正常。\n\n回合開始時，若自身體力高於最大體力 1/2，令對手攻擊、特攻、速度各降低 1 個等級；未觸發時，重新觸發自身目前出戰次數對應的登場效果，並解除自身異常狀態。重新觸發會增加特性觸發次數，但不增加出戰次數。自身體力低於最大體力 1/2 時，所有技能先制 +1、攻擊技能威力提升 100%；若造成的攻擊傷害為 0，吸取對手 100% 最大體力。\n\n自身造成的攻擊傷害高於 300 時，吸取對手最大體力 1/3；若本回合未造成高於 300 的攻擊傷害，戰鬥階段結束時自身特攻、速度各提升 1 個等級。';

export const MIGRATED_ARENA13_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['arena_13'],
  name: '專屬特性',
  description: raw,
  kit: [
    // 登場：段數推進＋六段效果內建（entrance_effect_stage sixStage：第6次清除；第7次循環）
    entry('on_entered', 'entrance', '登場：依出戰次數依序觸發兩回合段數效果（六段內建於通用 op）', [
      { acts: [a('entrance_effect_stage', {})] },
    ], 0),
    // （六段效果已併入登場主條目——同序列寫入後立即讀取）
    // 回合開始：血>½→對手攻特速-1；血≤½→重觸發段效果＋解除自身異常（不增出戰次數）
    entry('round_start', 'round_start', '回合開始：體力高於½令對手攻特速-1；不高於½重新觸發登場效果並解除自身異常', [
      { cond: [c('hp_ratio', { side: 'self', op: '高於', ratio: 0.5 }, '體力高於½')], acts: [
        a('stat', { side: 'opp', stats: ['攻擊', '特攻', '速度'], v: -1 }),
      ], elseActs: [
        a('entrance_effect_stage', {}),
        a('cure_status', { side: 'self', cls: '' }),
      ] },
    ], 7),
    // 血<½ 常駐：先制+1（modify_priority 事中判讀）
    entry('modify_priority', 'modify_priority', '體力低於½時所有技能先制+1', [
      { cond: [c('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 }, '體力低於½')], acts: [
        a('prio_next', { uses: 1, v: 1 }),
      ] },
    ], 8),
    // 血<½：攻擊傷害×2（使用時條件）
    entry('on_skill_use', 'use', '體力低於½時攻擊技能傷害提升100%', [
      { cond: [c('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 }, '體力低於½'), c('skill_kind', { kind: '攻擊' }, '攻擊技能')], acts: [
        a('dmg_mod', { dir: 'out', kind: '攻擊', boost: 1 }),
      ] },
    ], 9),
    // 攻傷為 0 →吸取對手 100% 最大體力（百分比吸取；行動後判讀本次結算量）
    entry('after_action', 'self_after_skill', '造成的攻擊傷害為0時吸取對手100%最大體力', [
      { cond: [c('skill_kind', { kind: '攻擊' }, '攻擊技能'), c('dmg_cmp', { op: '不高於', v: 0 }, '攻擊傷害為0')], acts: [
        a('drain', { ratio: 1, true: false }),
      ] },
    ], 10),
    // 造成攻傷>300→吸取⅓＋記錄本回合已觸發（供 phase_end 判讀）
    entry('on_hit', 'after_hit', '造成的攻擊傷害高於300時吸取對手最大體力⅓', [
      { cond: [c('skill_kind', { kind: '攻擊' }, '攻擊技能'), c('dmg_cmp', { op: '高於', v: 300 }, '攻傷>300')], acts: [
        a('drain', { ratio: 1 / 3, true: false }),
        a('pending_counter', { key: 'tfHitOver300', amount: 1, label: '本回合攻傷>300' }),
      ] },
    ], 11),
    // 本回合未造成>300攻傷→戰鬥階段結束特攻速度各+1（計數器歸零）
    entry('battle_phase_end', 'phase_end', '本回合未造成高於300的攻擊傷害：特攻、速度各提升1個等級', [
      { cond: [c('player_state', { key: 'tfHitOver300', equals: 0, fallback: 0 }, '本回合未攻傷>300')], acts: [
        a('stat', { side: 'self', stats: ['特攻', '速度'], v: 1 }),
      ] },
      { acts: [a('turn_key_set', { key: 'tfHitOver300', turns: 1, side: 'self', reason: '重置攻傷>300標記', label: '重置' })] },
    ], 12),
  ],
};
