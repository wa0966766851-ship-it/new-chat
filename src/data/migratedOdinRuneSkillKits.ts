// 5019 奧丁符文系 ᛟᛞᛁᚾᛋ ᚨᚾᛋᚢᛉ Kit：必中／無視免疫攻擊(成功→下次也無視)／
// 免疫下次攻擊／消回合→臣服(未觸發→鎖切換)／雙方能力調整+吸取20%／場上異常→增傷75%。
// 「執行後任一項未觸發或均觸發則吸取」採全情況吸取裁定（同 5028 王·深海之吻四分支先例）。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';

const raw = '■ 必中\n■ 無視對手免疫攻擊效果，無視成功則自身下次攻擊無視對手免疫攻擊效果\n🎯 免疫下次受到的攻擊\n🎯 消除對手回合類效果，消除成功則100%令對手臣服，未觸發則2回合內對手無法主動切換精靈\n🎯 使自身攻擊、速度、命中+1，對手雙攻、雙防、速度-1，執行後任一項未觸發或均觸發則吸取對手最大體力20%\n🎯 場上存在異常狀態時，當回合造成技能傷害提升75%';

const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });

export const MIGRATED_ODIN_RUNE_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5019'], name: 'ᛟᛞᛁᚾᛋ ᚨᚾᛋᚢᛉ', description: raw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // 無視對手免疫攻擊效果；無視成功 → 下次攻擊也無視
    sequence('無視對手免疫攻擊效果，無視成功則自身下次攻擊無視對手免疫攻擊效果', [
      { acts: [a('ignore', { what: '免疫攻擊' })] },
      { chain: 'success', acts: [a('ignore_next', { what: '攻擊免疫' })] },
    ], 1),
    // 免疫下次受到的攻擊
    sequence('免疫下次受到的攻擊', [
      { acts: [a('immune_attack_count', { count: 1 })] },
    ], 2),
    // 消回合 → 成功→臣服；未觸發 → 2回合鎖切換
    sequence('消除對手回合類效果，消除成功則100%令對手臣服，未觸發則2回合內對手無法主動切換精靈', [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [a('status', { side: 'opp', status: '臣服', chance: 100, turns: 3 })] },
      { chain: 'fail', acts: [a('no_switch', { turns: 2, next: false })] },
    ], 3),
    // 雙方能力調整；執行後（全情況裁定）吸取對手20%
    sequence('使自身攻擊、速度、命中+1，對手雙攻、雙防、速度-1，執行後任一項未觸發或均觸發則吸取對手最大體力20%', [
      { acts: [
        a('stat', { side: 'self', stats: ['攻擊', '速度', '命中'], v: 1, chance: 100 }),
        a('stat', { side: 'opp', stats: ['攻擊', '特攻', '防禦', '特防', '速度'], v: -1, chance: 100 }),
        a('drain', { ratio: 0.2, true: false }),
      ] },
    ], 4),
    // 場上存在異常狀態 → 當回合技能傷害+75%
    sequence('場上存在異常狀態時，當回合造成技能傷害提升75%', [
      { cond: [c('abnormal', { side: 'any' }, '場上存在異常狀態')], acts: [
        a('boost', { mult: 1.75, kind: '技能' }),
      ] },
    ], 5),
  ] },
];
