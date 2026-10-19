// 組 3（額外精靈／無序）legacyWrapped 拆解成果：5022 終焉·六花斬（技能）。其餘定義隨各自遷移加入本檔。
// 通用件在 blocks/ops/extraElf.ts（drain_by_pp_state、deferred_action_damage_sum）；原文與舊 wrapped 條目逐字相同。
import type { KitEntry } from '../effects/effectSystem.schema';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const skillAttached = (raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node: 'on_hit', source: 'skill', role: 'attached', order, customText: raw,
  params: { clause: { raw, marker: '🎯', trig: 'after_hit', parsed: true, body } } });

const SIX_PETAL_RAW = "■ 必中\n■ 自身處於異常狀態時先制+3且無視對手正先制效果\n🎯 雙方每有1個技能PP值不為滿則吸取對手1次66點體力（每次吸取體力獨立），若吸取後對手體力未減少則該次改為汲取體力\n🎯 雙方每有1個技能PP值為滿則吸取對手1次66點體力（每次吸取體力獨立），若吸取後對手體力未減少則該次改為汲取體力\n🎯 進行6次額外行動，每次行動依序以邪靈、戰鬥、邪靈.戰鬥、邪靈、戰鬥、邪靈.戰鬥為順序進行攻擊且每次造成66點技能傷害，額外行動期間不會造成傷害直到行動結束時對方所有精靈受到6次行動造成的傷害總和技能傷害，場下精靈死亡時令其消逝並轉化其能力值總和20%給予自身";

/** 5022 終焉·六花斬：
 *  ■ 必中；■ 自身處於異常狀態時先制+3且無視對手正先制效果（條件先制＋條件固有無視正先制）；
 *  🎯 雙方每有1個技能PP「不為滿／為滿」各吸取1次66點（固定傷害，每次獨立，未減少體力改汲取＝真實傷害）；
 *  🎯 6次額外行動（邪靈、戰鬥、邪靈.戰鬥 各兩輪）：期間不造成傷害，行動結束時對方所有精靈受到各次克制後的總和技能傷害；
 *     場下精靈死亡時消逝並轉化其能力值總和20%給予自身（沿用舊 handler 逐項能力值20%，轉化模式可於 Kit 參數調整）。 */
export const MIGRATED_EXTRA_ELF_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5022'], name: '終焉·六花斬', description: SIX_PETAL_RAW, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    { codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'attached', order: 1,
      customText: '■ 自身處於異常狀態時先制+3',
      params: { property: 'conditional_priority', value: 3, conditions: [c('abnormal', { side: 'self' }, '自身處於異常狀態')] } },
    { codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'innate', order: 2,
      customText: '■ 自身處於異常狀態時無視對手正先制效果',
      params: { property: 'ignore_positive_priority', value: true, conditions: [c('abnormal', { side: 'self' }, '自身處於異常狀態')] } },
    skillAttached('🎯 雙方每有1個技能PP值不為滿則吸取對手1次66點體力（每次吸取體力獨立），若吸取後對手體力未減少則該次改為汲取體力',
      [{ acts: [a('drain_by_pp_state', { state: 'notFull', flat: 66 })] }], 3),
    skillAttached('🎯 雙方每有1個技能PP值為滿則吸取對手1次66點體力（每次吸取體力獨立），若吸取後對手體力未減少則該次改為汲取體力',
      [{ acts: [a('drain_by_pp_state', { state: 'full', flat: 66 })] }], 4),
    skillAttached('🎯 進行6次額外行動，每次行動依序以邪靈、戰鬥、邪靈.戰鬥、邪靈、戰鬥、邪靈.戰鬥為順序進行攻擊且每次造成66點技能傷害，額外行動期間不會造成傷害直到行動結束時對方所有精靈受到6次行動造成的傷害總和技能傷害，場下精靈死亡時令其消逝並轉化其能力值總和20%給予自身',
      [{ acts: [a('deferred_action_damage_sum', { flat: 66, types: ['邪靈', '戰鬥', '邪靈.戰鬥', '邪靈', '戰鬥', '邪靈.戰鬥'], convertRatio: 0.2, convertMode: 'per_stat' })] }], 5),
  ] },
];
