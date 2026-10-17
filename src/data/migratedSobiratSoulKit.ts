// 黯魂印（悲歌.索比拉特 5001）積木遷移：受擊害怕/PP吸取/scarBonus/擊敗附加黯痕/悲歌護盾。
// 黯痕的引擎讀取端（減半/翻倍/傷害cap）由 DarkScarTurns registry 鍵驅動（contextBuilders 多處），
// 通用掃描每回合自動遞減；mark_program 提供可見印記與規則描述。
import type { KitEntry, Node } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const entry = (node: Node, trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } },
});
const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });

/** 黯痕印記程式（掛對手；3回合規則由引擎 DarkScarTurns 鍵結算，此處為可見層數與到期） */
const darkScarMark = (turns: number) => a('mark_program', {
  id: 'dark_scar', name: '黯痕', displayChar: '黯', unit: '回合', side: 'opp', mode: 'set',
  count: turns, maxCount: 99, scope: 'elf', persistsOffField: false, turns,
  description: '持有者技能傷害無法超過1點；造成的百分比與固定傷害減半；無視傷害限制時改為本次技能傷害減半；期間無法附加雙方任一方異常狀態；受到攻擊技能傷害翻倍。',
  rules: [],
});

export const MIGRATED_SOBIRAT_SOUL_KIT = {
  kind: 'soul' as const, elfIds: ['5001'], name: '黯',
  description: '自身每次受到技能傷害時：\n> 令對手進入害怕狀態\n> 未觸發則當回合結束時吸取對手所有技能1點PP值\n回合結束若自身未受到技能傷害：\n> 下次被擊敗時黯痕回合數+1\n自身被擊敗時：\n> 消除對手回合類效果\n> 消除對手能力提升狀態\n> 為對方當前在場精靈附加黯痕印記\n黯痕：\n> 持有者每次技能傷害無法超過1點\n> 持有者造成的百分比傷害減半\n> 持有者造成的固定傷害減半\n> 對方無視傷害限制時改為本次技能傷害減半\n> 持續3回合\n> 期間持有者無法附加雙方任一方異常狀態\n> 持有者受到攻擊技能傷害翻倍\n\n【命運之輪 C 級專屬攔截：悲歌護盾】\n自身陣亡時：\n> 己方下一隻出場精靈附加等同於自身最大體力80%的精靈護罩\n> 己方下一隻出場精靈2回合內免疫所有異常狀態',
  kit: [
    // 受擊 → 100% 害怕；未觸發（附加失敗）→ 本回合結束吸取對手 1 PP
    entry('on_damaged', 'damaged_skill', '自身每次受到技能傷害時令對手進入害怕狀態，未觸發則當回合結束時吸取對手所有技能1點PP值', [
      { acts: [a('status', { side: 'opp', status: '害怕', chance: 100, turns: 1 })] },
      { chain: 'fail', acts: [a('timed', { turns: 1, from: 'now', trig: 'round_end', once: true, label: '幽冥迴響',
        body: [{ acts: [a('pp_drain', { v: 1, steal: false })] }] })] },
    ], 0),
    // 回合結束未受技能傷害 → 待觸發黯痕+1
    entry('round_end', 'round_end', '回合結束若自身未受到技能傷害，下次被擊敗時黯痕回合數+1', [
      { cond: [c('no_skill_dmg', { kind: '技能' }, '本回合未受到技能傷害')], acts: [
        a('pending_counter', { key: 'sobiratScarBonus', amount: 1, label: '下次被擊敗時黯痕回合數+1' }),
      ] },
    ], 1),
    // 被擊敗 → 消除對手回合類＋能力提升＋附加黯痕（3+scarBonus 回合）＋悲歌護盾（命運之輪 C 級攔截）
    entry('cthyaat_death', 'defeated', '自身被擊敗時消除對手回合類效果與能力提升狀態，為對方在場精靈附加黯痕印記（黯痕回合數＝3＋待觸發累計）', [
      { acts: [
        a('clear_turn', { side: 'opp' }),
        a('stat_clear', { side: 'opp', kind: 'up' }),
        a('counter_into_turns', { counterKey: 'sobiratScarBonus', turnKey: 'DarkScarTurns', base: 3, side: 'opp', reason: '【黯痕】', label: '黯痕' }),
        a('status', { side: 'opp', status: '黯痕', chance: 100, turns: 3 }),
      ] },
    ], 2),
    // 註：命運之輪 C 級攔截「悲歌護盾」由 destiny 系統（destinyGacha dirge_shield）統一管理，
    // 魂印本體不含此效果；舊 handler 中的重複實作（固定400護罩）隨 Kit 化退役。
  ],
};
