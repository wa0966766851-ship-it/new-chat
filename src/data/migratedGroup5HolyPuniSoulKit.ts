// 5000 聖靈譜尼 魂印「神」真 Kit（DSH 20261018 最後衝刺·組 5）。
// 舊 handler：elves/puni/registry.ts handleShenglingPuniSoulMark 整份空殼化（規則3.3）。
//   該 handler 內「技能狀態讀取／回合計數」（puniSkillStateEffects、puniVoidShieldTurns 等）全為 PUNI_SKILLS
//   舊技能 handler 的支援碼；5000 的 27 個技能皆已是 effectMode='kit'，沒有任何 Kit 寫入這些鍵（grep 確認），
//   屬死碼，不隨本魂印保留；300 譜尼（handlePuniBaseSoulMark）另有自己的支援碼，不動。
//   SOUL_MARK_MAPPING 5000／聖靈譜尼 與 tests/fixtures/elfRegistryBeforeMove.json souls 同步移除。
// 七個子效果（皆既有通用件＋組 5 新件）：
//   虛無＝damaged_attack→immune_attack_count（引擎 blockAttackCount 讀取端；與 bypassesAttackDefense 同鍵）。
//   元素＝entrance→clear_turn，chain success→invalid_next{1}。
//   能量＝phase_end→dmg{已損失體力×50%,百分比}。
//   生命＝phase_end→heal 1/4＋pp_add_random{2,1}（新）。
//   輪迴＝round_start→round_checkpoint_snapshot（新）；self_fatal→during_opp_action→once→survive＋round_checkpoint_arm（新）；
//        round_end→round_checkpoint_restore（新；本組自行實作，不共用組1 entry_state 函式）。
//        快照時點：舊 handler 在 BEFORE_TURN_RESOLVE（2.1，早於 ROUND_START），Kit 無該節點，改在 round_start（order 0）。
//   永恆＝modify_priority＋hp_cmp 高於→prio_force_first（新；comp.forcedFirst，與舊 handler 同欄位）。
//   聖潔＝before_status→status_guard；entrance→immune_statdown_turns{99}（引擎 immuneStatDownTurns 既有讀取端）。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } },
});

const raw = "> 虛無： 受到攻擊傷害時，免疫下1次受到的攻擊傷害\n> 元素： 登場時消除對手回合類效果，消除成功則對手下次技能無效\n> 能量： 戰鬥階段結束時附加自身已損失體力50%的百分比傷害\n> 生命： 戰鬥階段結束時恢復自身最大體力的1/4和隨機2個PP值未滿的技能1點PP值\n> 輪迴： 對手出手回合若自身受到致命傷害則殘留1點體力，同時回合結束後自身體力、PP值、能力等級返回當回合選擇操作之後的狀態（每場戰鬥僅觸發1次）\n> 永恆： 回合開始時若自身體力高於對手則當回合自身必定先手\n> 聖潔： 天生免疫所有異常狀態和能力下降狀態";

export const MIGRATED_GROUP5_HOLY_PUNI_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5000'],
  name: '神',
  description: raw,
  kit: [
    entry('on_damaged', 'damaged_attack', '虛無： 受到攻擊傷害時，免疫下1次受到的攻擊傷害', [
      { acts: [a('immune_attack_count', { count: 1 })] },
    ], 0),
    entry('on_entered', 'entrance', '元素： 登場時消除對手回合類效果，消除成功則對手下次技能無效', [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [a('invalid_next', { uses: 1, kind: 'all' })] },
    ], 1),
    entry('battle_phase_end', 'phase_end', '能量： 戰鬥階段結束時附加自身已損失體力50%的百分比傷害', [
      { acts: [a('dmg', { base: '已損失體力', of: 'self', ratio: 0.5, type: '百分比' })] },
    ], 2),
    entry('battle_phase_end', 'phase_end', '生命： 戰鬥階段結束時恢復自身最大體力的1/4和隨機2個PP值未滿的技能1點PP值', [
      { acts: [a('heal', { side: 'self', ratio: 0.25 }), a('pp_add_random', { count: 2, amount: 1 })] },
    ], 3),
    entry('round_start', 'round_start', '輪迴： 回合開始時記錄當回合選擇操作之後的體力、PP值、能力等級', [
      { acts: [a('round_checkpoint_snapshot', {})] },
    ], 4),
    entry('self_fatal', 'fatal', '輪迴： 對手出手回合若自身受到致命傷害則殘留1點體力，同時回合結束後自身體力、PP值、能力等級返回當回合選擇操作之後的狀態（每場戰鬥僅觸發1次）', [
      { acts: [a('during_opp_action', { body: [{ acts: [a('once', { key: 'puniReincarnation', body: [
        { acts: [a('survive', {}), a('round_checkpoint_arm', {})] },
      ] })] }] })] },
    ], 5),
    entry('round_end', 'round_end', '輪迴： 回合結束後自身體力、PP值、能力等級返回當回合選擇操作之後的狀態', [
      { acts: [a('round_checkpoint_restore', {})] },
    ], 6),
    entry('modify_priority', 'modify_priority', '永恆： 回合開始時若自身體力高於對手則當回合自身必定先手', [
      { cond: [c('hp_cmp', { side: 'self', op: '高於' }, '自身體力高於對手')], acts: [a('prio_force_first', {})] },
    ], 7),
    entry('before_status_apply', 'before_status', '聖潔： 天生免疫所有異常狀態', [
      { acts: [a('status_guard', { cls: '' })] },
    ], 8),
    entry('on_entered', 'entrance', '聖潔： 天生免疫所有能力下降狀態', [
      { acts: [a('immune_statdown_turns', { turns: 99 })] },
    ], 9),
  ],
};
