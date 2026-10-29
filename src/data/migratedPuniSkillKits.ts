// 300 譜尼 / 5000 聖靈譜尼 靈光之怒 Kit：「對手任意種能力等級越高此招威力越大（等級6:18）」。
// 內置公式解讀：每 1 級能力提升 +3 威力（6 級 → +18）。基礎威力 80 來自技能資料。
// power_mod 新欄位 perStageLevel/perLevelAmount（線性逐級威力加成；modify_power 節點）。
// 舊 handler（sum×40 固定傷害）與原文「威力」語意不符——Kit 改為正式威力修正。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { sequence } from './reviewedSequenceSkillKits';

const raw = '🎯 對手任意種能力等級越高此招威力越大（內置公式等級6:18，往下以此類推）';

const entry = (elfIds: string[]): ReviewedSequenceSkill => ({
  elfIds, name: '靈光之怒', description: raw, kit: [
    { codeId: 'effect_sequence', node: 'modify_power', source: 'skill', role: 'innate', order: 0,
      customText: raw,
      params: { clause: { raw, trig: 'outgoing_power', parsed: true, body: [
        { acts: [{ op: 'power_mod', p: { perStageLevel: { side: 'opp', kind: 'up' }, perLevelAmount: 3 }, label: '每級+3威力' }] },
      ] } } },
  ],
});

export const MIGRATED_PUNI_SKILL_KITS: ReviewedSequenceSkill[] = [entry(['300']), entry(['5000'])];
