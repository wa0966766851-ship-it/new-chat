// 5007 克塔亞特／濁 魂印「濁」真 Kit（DSH 20261018 第二十四批 legacyWrapped 拆解）。
// 舊 handler：brinkk/registry.ts 的克塔亞特額外精靈生命週期讀取端保留；本 Kit 以通用 op 表達效果條款。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import brinkkText from './brinkkSoulText.json';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const e = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });

export const MIGRATED_5007_BRINKK_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5007'],
  name: '濁',
  description: brinkkText.soul,
  kit: [
    // 戰鬥開始：克塔亞特作為額外精靈加入敵方（能力值複製己方全隊總和一半）
    e('battle_start', 'battle_start', '戰鬥開始時：克塔亞特作為額外精靈加入敵方', [
      { acts: [a('summon_extra_elf', { name: '克塔亞特', type: '水', statFromTeamRatio: 0.5, side: 'opp' })] },
    ], 0),
    // 自身在場：對手每次受真傷→增加自身等量體力；非真實傷害提升4%（最多32層）
    e('on_damaged', 'damaged_true', '自身在場期間：對手每次受到真實傷害時直接增加自身等量體力；令自身本場戰鬥造成非真實傷害提升4%（最多疊加32次）', [
      { acts: [
        a('heal', { side: 'self', ratio: 1 }),
        a('true_damage_stack', { key: 'brinkkOnFieldStacks', stackStep: 0.04, maxStacks: 32, dir: 'out', kind: '非真實' }),
      ] },
    ], 1),
    // 自身場下：對手每次受真傷→消耗自身當前體力⅛；受到非真實傷害降低4%（最多16層，可降為0時不執行）
    e('on_damaged', 'damaged_true', '自身位於場下期間：對手每次受到真實傷害時消耗自身當前體力⅛；以令自身本場戰鬥受到非真實傷害降低4%（最多疊加16次，執行時若判斷體力可降為0時不執行）', [
      { acts: [
        a('off_field_hp_drain', { ratio: 0.125, key: 'brinkkOffFieldStacks', maxStacks: 16 }),
        a('true_damage_stack', { key: 'brinkkOffFieldStacks', stackStep: 0.04, maxStacks: 16, dir: 'in_reduce', kind: '非真實' }),
      ] },
    ], 2),
    // 回合開始：場上存在本次在場≤2或>8回合的精靈→體力上限+20%並恢復全部體力與PP
    e('round_start', 'round_start', '回合開始時：若場上存在本次在場期間不大於2回合或在場超過8回合以上的精靈，則自身體力上限提升20%並恢復自身全部體力與PP值', [
      { acts: [
        a('maxhp', { side: 'self', ratio: 0.2, direction: 'increase' }),
        a('heal', { side: 'self', ratio: 1 }),
        a('pp_op', { side: 'self', mode: 'recover', amount: 99 }),
      ] },
    ], 3),
    // 克塔亞特：己方（＝克塔亞特所在的敵方）精靈每次出戰令其漸凍1回合；未觸發則3回合內非真實傷害減半 n 次
    e('on_entered', 'entrance', '克塔亞特：己方精靈每次出戰時令其漸凍1回合，未觸發則3回合內造成非真實傷害減半n次（n=本次在場期間所受到真實傷害次數）', [
      { acts: [a('status', { side: 'opp', status: '漸凍', turns: 1, chance: 100 })] },
      { chain: 'fail', acts: [a('dmg_mod_turns', { side: 'self', dir: 'out_reduce', kind: '非真實', reduce: 0.5, turns: 3 })] },
    ], 4),
    // 克塔亞特：任意戰鬥階段節點結算時額外汲取己方在場精靈當前體力¼
    e('battle_phase_end', 'phase_end', '克塔亞特：己方精靈任意戰鬥階段節點結算時自身額外汲取己方在場精靈當前體力¼', [
      { acts: [a('extra_elf_heal_owner', { ratio: 0.25, side: 'opp' })] },
    ], 5),
    // 自身死亡時消逝，並令己方所有精靈失去自身當前體力上限⅛
    e('self_fatal', 'fatal', '克塔亞特：自身死亡時消逝，並令己方所有精靈失去自身當前體力上限⅛的體力上限', [
      { acts: [a('vanish_on_death_maxhp_share', { ratio: 0.125, side: 'opp' })] },
    ], 6),
  ],
};