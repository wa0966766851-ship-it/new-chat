// 5035 龍神·御天陣 技能 Kit（DSH 20261018 第十七批 legacyWrapped 拆解）。
// 舊 handler：src/effects/elves/hamo/registry.ts HAMO_SKILLS['龍神·御天陣'] 已空殼化；
// 其屬性層效果（無視傷害限制／攻擊免疫／最低克制倍率）原由 HAMO_SKILL_TRANSFORMS 承擔，
// 本批以通用 ignore{what} 條款表達；威力+150%（後出手翻倍）原由 HAMO_DAMAGE_TRANSFORMS 承擔，
// 以 modify_power 查詢與通用 power_mod 表達，讀取實際優先序決定的先後手。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'skill', role: 'attached', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });

export const MIGRATED_HAMO_YUTIANZHEN_SKILL_KIT: ReviewedSequenceSkill[] = [{
  elfIds: ['5035'],
  name: '龍神·御天陣',
  description: "■ 先制-1\r\n■ 必中\r\n■ 無視傷害限制效果\r\n■ 無視免疫受到的攻擊效果\r\n■ 無視對手百分比技能傷害減少效果\r\n■ 攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）\r\n🎯 消除對手回合類效果，消除成功則吸取對手最大體力⅓\r\n🎯 吸取並反轉對手能力提升狀態\r\n🎯 令對手下次釋放的技能無效，無效成功則對方當前在場精靈下2回合同類型技能附加效果失效\r\n🎯 附加自身最大體力50%的百分比傷害並恢復自身體力，自身體力低於最大體力1/2時效果翻倍\r\n🎯 技能威力提升150%，後出手效果翻倍",
  kit: [
    prop('先制-1', 'base_priority', -1, 0),
    prop('必中', 'sure_hit', true, 1),
    // 無視傷害限制／攻擊免疫／百分比減傷
    seq('■ 無視傷害限制效果', [{ acts: [a('ignore', { what: '傷害限制' })] }], 2),
    seq('■ 無視免疫受到的攻擊效果', [{ acts: [a('ignore', { what: '攻擊免疫' })] }], 3),
    seq('■ 無視對手百分比技能傷害減少效果', [{ acts: [a('ignore', { what: '抵擋傷害' })] }], 4),
    // 攻擊時不會出現微弱（克制關係微弱時變普通）——引擎既有 minimumTypeMultiplierThisAction
    seq('■ 攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）', [
      { acts: [a('turn_key_set', { key: 'minimumTypeMultiplierThisAction', turns: 1, side: 'self', reason: '龍神·御天陣', label: '微弱變普通' })] },
    ], 5),
    // 消除對手回合類效果，成功則吸取⅓
    seq('🎯 消除對手回合類效果，消除成功則吸取對手最大體力⅓', [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [a('drain', { ratio: 1 / 3 })] },
    ], 6),
    // 吸取並反轉對手能力提升
    seq('🎯 吸取並反轉對手能力提升狀態', [
      { acts: [a('stat_steal', { mode: '吸取', reverse: true })] },
    ], 7),
    // 令對手下次釋放的技能無效；無效成功則下2回合同類型技能附加效果失效
    // 「下次技能無效」＋「無效成功則下2回合同類型技能附加效果失效」——後者由引擎 newElfLifecycle 的
    // invalidFollowup 讀取端處理（主攻擊仍可使用，只讓附加效果失效）。
    seq('🎯 令對手下次釋放的技能無效，無效成功則對方當前在場精靈下2回合同類型技能附加效果失效', [
      { acts: [a('invalid_next', { kind: 'all', uses: 1, followupRounds: 2, followupSameCategory: true, timerId: 'next_skill_invalid' })] },
    ], 8),
    // 附加自身最大體力50%百分比傷害並恢復自身體力；低於1/2時翻倍
    seq('🎯 附加自身最大體力50%的百分比傷害並恢復自身體力，自身體力低於最大體力1/2時效果翻倍', [
      { cond: [c('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 }, '自身體力低於1/2')], acts: [
        a('dmg', { base: '最大體力', of: 'self', ratio: 1, type: '百分比' }),
        a('heal', { side: 'self', ratio: 1, missingRatio: 1 }),
      ] },
      { cond: [c('hp_ratio', { side: 'self', op: '不低於', ratio: 0.5 }, '自身體力不低於1/2')], acts: [
        a('dmg', { base: '最大體力', of: 'self', ratio: 0.5, type: '百分比' }),
        a('heal', { side: 'self', ratio: 0.5 }),
      ] },
    ], 9),
    // 技能威力提升150%，後出手效果翻倍
    entry('modify_power', 'outgoing_power', '🎯 技能威力提升150%，後出手效果翻倍', [
      { cond: [c('first_move', { neg: true }, '後出手')], acts: [
        a('power_mod', { boost: 3 }),
      ] },
      { cond: [c('first_move', {}, '先出手')], acts: [
        a('power_mod', { boost: 1.5 }),
      ] },
    ], 10),
  ],
}];
