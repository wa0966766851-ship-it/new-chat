// 5021 次元龍 技能「遺典.妄世律裁」真 Kit（DSH 20261018 第十八批 legacyWrapped 拆解）。
// 舊 handler：src/effects/elves/dimensional-dragon/registry.ts DIMENSIONAL_SKILLS['遺典.妄世律裁']
// 由技能表移除（規則3.3）。詩章以引擎既有印記 poem_chapter 表達（effects.poemHpSnapshots 記錄體力上限）。
// 「龍魂」＝魂印狀態鍵 dimensionalDragonSoul（引擎既有），以 cond dragon_soul 讀取。
// 描述原文存於同目錄 wangshiSkillText.json（由程式從 DEFAULT_ELVES 匯出，逐字含 CRLF）。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import wsText from './wangshiSkillText.json';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });

export const MIGRATED_DIMENSIONAL_WANGSHI_SKILL_KIT: ReviewedSequenceSkill[] = [{
  elfIds: ['5021'],
  name: '遺典.妄世律裁',
  description: wsText.description,
  kit: [
    prop('必中', 'sure_hit', true, 0),
    // 自身每有1篇詩章攻擊傷害提升20%
    seq('🎯 自身每有1篇詩章攻擊傷害提升20%', [
      { cond: [c('mark_count', { side: 'self', id: 'poem_chapter', op: '不小於', amount: 1 }, '持有詩章')], acts: [
        a('boost', { mult: 1.2, kind: '攻擊', perMark: {side:'self',id:'poem_chapter'} }),
      ] },
    ], 1),
    // 對方每有1種PP值為滿的技能則附加對方當前體力20%的百分比傷害
    seq('🎯 對方每有1種PP值為滿的技能則附加對方當前體力20%的百分比傷害', [
      { acts: [a('dmg', { base: '當前體力', of: 'opp', ratio: 0.2, type: '百分比', per: 'opp_full_pp_skills' })] },
    ], 2),
    // 若詩章大於2，每有1篇附加100點真實傷害
    seq('🎯 若詩章大於2，每有1篇附加100點真實傷害', [
      { cond: [c('mark_count', { side: 'self', id: 'poem_chapter', op: '高於', amount: 2 }, '詩章大於2')], acts: [
        a('dmg', { flat: 100, type: '真實', perMark: {side:'self',id:'poem_chapter'} }),
      ] },
    ], 3),
    // 令對手下2回合先制-1；自身不為滿體力時令對手3回合內屬性技能附加效果失效
    seq('🎯 令對手下2回合先制-1，自身不為滿體力時令對手3回合內屬性技能附加效果失效', [
      { acts: [a('prio_turns', { side: 'opp', v: -1, turns: 2, next: true })] },
      { cond: [c('hp_ratio', { side: 'self', op: '低於', ratio: 1 }, '自身不為滿體力')], acts: [
        a('invalid_turns', { kind: '屬性', turns: 3 }),
      ] },
    ], 4),
    // 龍魂：自身體力大於對手→攻擊傷害100%回復；低於→附加差值70%真實傷害（每滿PP技能翻倍7次）
    seq('■ 龍魂：自身體力大於對手時攻擊傷害的100%回復自身體力值，自身體力低於對手時附加雙方體力差值70%的真實傷害', [
      { cond: [c('dragon_soul', {}), c('hp_cmp', { side: 'self', op: '高於' }, '體力大於對手')], acts: [
        a('vampire', { ratio: 1, kind: '攻擊' }),
      ] },
      { cond: [c('dragon_soul', {}), c('hp_cmp', { side: 'self', op: '低於' }, '體力低於對手')], acts: [
        a('hp_difference_damage', { ratio: 0.7, type: '真實', doublePerFullPp: 7 }),
      ] },
    ], 5),
  ],
}];
