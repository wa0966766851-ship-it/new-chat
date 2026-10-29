// 5007 混濁海妖.布林克克 癡愚之觸 Kit：先制+3／消回合→成功→20%真傷／命中後中毒(未觸發→感染)／
// 3回合內對手使用技能且不處於控制類→無效下次攻擊(成功→額外一次)。
// 新機制：abnormal 條件擴充 cls 參數（「不處於控制類異常」；statusInClass 引擎分類既有）。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';

const raw = '■ 先制+3\n🎯 消除對手回合類效果，消除成功則附加等同於對手最大體力20%的真實傷害\n🎯 命中後100%令對方中毒，未觸發則100%令對手感染\n🎯 3回合內，若對手使用技能時不處於控制類異常狀態，則無效對手下次攻擊，觸發無效成功則額外無效對手下次攻擊';

const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });

export const MIGRATED_BRINKK_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5007'], name: '癡愚之觸', description: raw, kit: [
    property('■ 先制+3', 'base_priority', 3, 0),
    sequence('消除對手回合類效果，消除成功則附加等同於對手最大體力20%的真實傷害', [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [a('dmg', { base: '最大體力', of: 'opp', ratio: 0.2, type: '真實' })] },
    ], 1),
    sequence('命中後100%令對方中毒，未觸發則100%令對手感染', [
      { acts: [a('status', { side: 'opp', status: '中毒', chance: 100, turns: 3 })] },
      { chain: 'fail', acts: [a('status', { side: 'opp', status: '感染', chance: 100, turns: 3 })] },
    ], 2),
    // 3回合內：對手使用技能且不處於控制類 → 無效其下次攻擊；觸發成功 → 額外無效一次
    sequence('3回合內，若對手使用技能時不處於控制類異常狀態，則無效對手下次攻擊，觸發無效成功則額外無效對手下次攻擊', [
      { acts: [a('timed', { turns: 3, from: 'now', trig: 'opp_skill', body: [
        { cond: [c('abnormal', { side: 'opp', cls: '控制類', neg: true }, '對手不處於控制類')], acts: [
          a('invalid_next', { kind: '攻擊', uses: 1 }),
        ], elseActs: [] },
        { chain: 'success', acts: [a('invalid_next', { kind: '攻擊', uses: 1 })] },
      ] })] },
    ], 3),
  ] },
];
