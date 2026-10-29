// arena_15 命運龍輪 莫伊萊 專屬特性 Kit（DSH 20261018 第十二批 legacyWrapped 拆解）。
// 舊 handler：staged-arena/moiraiRegistry.ts handleMoiraiSoulMark 整份移除（規則3.3）。
// 通用件：random_branch（擲一次骰 N 選 1；arenaShared.ts 新增）；pp_zero_random 擴充 lastAmount（被消除PP）。
//   stat／stage{neg}／shield／dmg_mod_turns／hp_ratio／clear_turn／stat_clear／heal／pp_op／
//   no_heal{own_skill}／turn_key_set{priorityPenaltyTurns}／opp_used_skill／last_amount 皆既有。
// 技能表 MOIRAI_SKILLS 保留（技能仍為 wrapped route；後續批次遷移）。
import type { KitEntry, Node } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const e = (node: Node, trig: string, raw: string, body: any[], order: number, role: KitEntry['role'] = 'innate'): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role, node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });

// 回合開始 2 選 1
const startA = [
  { acts: [a('stat', { side: 'self', stats: ['全屬性'], v: 1 })] },
  { cond: [c('stage', { side: 'self', kind: 'up', neg: true }, '不處於能力提升狀態')], acts: [
    a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '攻擊', boost: 1, turns: 1 }),
    a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '固定', boost: 0.5, turns: 1 }),
    a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '百分比', boost: 0.5, turns: 1 }),
  ] },
];
const startB = [
  { cond: [c('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 }, '體力低於一半')], acts: [
    a('shield', { flat: 400 }), a('shield', { flat: 400, kind: 'barrier' }),
  ], elseActs: [
    a('shield', { flat: 200 }), a('shield', { flat: 200, kind: 'barrier' }),
  ] },
];
// 回合結束 2 選 1
const endA = [
  { acts: [a('stat', { side: 'opp', stats: ['全屬性'], v: -1 })] },
  { cond: [c('stage', { side: 'opp', kind: 'down', neg: true }, '對手不處於能力下降狀態')], acts: [
    a('stat_clear', { side: 'opp', kind: 'up' }),
    a('clear_turn', { side: 'opp' }),
    a('turn_key_set', { key: 'priorityPenaltyTurns', turns: 1, side: 'opp', reason: '命運龍輪', label: '下一回合先制-2' }),
  ] },
];
const endB = [
  { acts: [a('pp_zero_random', { count: 1 })] },
  { cond: [c('last_amount', { op: '不高於', amount: 5 }, '被消除的PP不高於5')], acts: [
    a('heal', { side: 'self', ratio: 1 / 3 }),
    a('pp_op', { side: 'self', mode: 'recover' }),
    a('no_heal', { scope: 'own_skill', turns: 1, next: true }),
  ] },
];
export const MIGRATED_MOIRAI_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['arena_15'],
  name: '命運龍輪',
  description: '回合開始時，隨機觸發以下 2 項效果中的 1 項：\n① 自身全屬性 +1；觸發後若自身不處於能力提升狀態，則該回合攻擊傷害提升 100%，固定傷害與百分比傷害提升 50%。\n② 自身獲得 200 點護盾與 200 點【護罩】；若目前體力低於最大體力一半，效果翻倍。\n\n回合結束時，隨機觸發以下 2 項效果中的 1 項：\n① 令對手全屬性 −1；觸發後若對手不處於能力下降狀態，則消除其能力提升與回合類效果，並令其下一回合先制 −2。\n② 令對手隨機 1 個技能的 PP 歸零；若被消除的 PP 不高於 5，則恢復自身最大體力的 1/3 與全部技能 PP，並令對手下一回合無法透過技能恢復體力。\n\n若對手該回合沒有使用技能，回合結束時觸發上述全部效果。',
  kit: [
    // 回合開始：隨機 2 選 1
    e('round_start', 'round_start', '回合開始時，隨機觸發以下 2 項效果中的 1 項', [
      { acts: [a('random_branch', { branches: [startA, startB] })] },
    ], 0),
    // 回合結束：對手有使用技能→隨機 2 選 1（互斥條件實現 if/else）
    e('round_end', 'round_end', '回合結束時：對手該回合有使用技能則隨機觸發 2 項中的 1 項', [
      { cond: [c('opp_used_skill', {}, '對手該回合有使用技能')], acts: [
        a('random_branch', { branches: [endA, endB] }),
      ] },
    ], 1),
    // 回合結束：對手沒有使用技能→觸發上述全部效果（開始①②＋結束①②，逐語句帶 opp_used_skill{neg}）
    e('round_end', 'round_end', '若對手該回合沒有使用技能，回合結束時觸發上述全部效果', [
      { cond: [c('opp_used_skill', { neg: true }, '對手該回合沒有使用技能')], acts: [
        a('stat', { side: 'self', stats: ['全屬性'], v: 1 }),
      ] },
      { cond: [c('opp_used_skill', { neg: true }), c('stage', { side: 'self', kind: 'up', neg: true }, '不處於能力提升狀態')], acts: [
        a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '攻擊', boost: 1, turns: 1 }),
        a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '固定', boost: 0.5, turns: 1 }),
        a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '百分比', boost: 0.5, turns: 1 }),
      ] },
      // 注意：守衛條件（對手未用技能）與體力分支各自獨立成句——若把體力分支寫成 elseActs，
      // 守衛失敗（對手有用技能）時 elseActs 會被誤執行（守衛與分支共用 else 觸發）。
      { cond: [c('opp_used_skill', { neg: true }), c('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 }, '體力低於一半')], acts: [
        a('shield', { flat: 400 }), a('shield', { flat: 400, kind: 'barrier' }),
      ] },
      { cond: [c('opp_used_skill', { neg: true }), c('hp_ratio', { side: 'self', op: '不低於', ratio: 0.5 }, '體力不低於一半')], acts: [
        a('shield', { flat: 200 }), a('shield', { flat: 200, kind: 'barrier' }),
      ] },
      { cond: [c('opp_used_skill', { neg: true })], acts: [
        a('stat', { side: 'opp', stats: ['全屬性'], v: -1 }),
      ] },
      { cond: [c('opp_used_skill', { neg: true }), c('stage', { side: 'opp', kind: 'down', neg: true }, '對手不處於能力下降狀態')], acts: [
        a('stat_clear', { side: 'opp', kind: 'up' }),
        a('clear_turn', { side: 'opp' }),
        a('turn_key_set', { key: 'priorityPenaltyTurns', turns: 1, side: 'opp', reason: '命運龍輪', label: '下一回合先制-2' }),
      ] },
      { cond: [c('opp_used_skill', { neg: true })], acts: [
        a('pp_zero_random', { count: 1 }),
      ] },
      { cond: [c('opp_used_skill', { neg: true }), c('last_amount', { op: '不高於', amount: 5 }, '被消除的PP不高於5')], acts: [
        a('heal', { side: 'self', ratio: 1 / 3 }),
        a('pp_op', { side: 'self', mode: 'recover' }),
        a('no_heal', { scope: 'own_skill', turns: 1, next: true }),
      ] },
    ], 2),
  ] };
