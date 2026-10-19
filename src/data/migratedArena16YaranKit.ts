// arena_16 雅髯獅嘯 技能 Kit（DSH 20261018 第十七批 legacyWrapped 拆解）。
// 舊 handler：staged-arena/dragonHealingRegistry.ts DRAGON_HEALING_SKILLS['雅髯獅嘯'] 由技能表移除。
// 時點：🎯＝使用時；> 為上一條補充；■ 自身滿體力時威力＝技能屬性（modify_power 條件）；
//       ■ 技能無效時＝on_invalid 條款（Miss／閃避／攻擊免疫皆觸發）。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'skill', role: 'attached', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });

export const MIGRATED_ARENA16_YARAN_SKILL_KIT: ReviewedSequenceSkill[] = [{
  elfIds: ['arena_16'],
  name: '雅髯獅嘯',
  description: '🎯 吸取對手的能力提升\n> 吸取成功時為自身附加 3 回合【狂暴】，吸取失敗時技能威力提升 100%\n■ 自身滿體力時技能威力提升 50%，先出手時提升效果改為 100%\n🎯 解除自身所有異常狀態，成功時令對手下 2 回合所有技能的附加效果失效\n🎯 解除對手所有異常狀態，每成功解除 1 個便附加 200 點固定傷害；結算時自身體力大於對手則固定傷害翻倍\n■ 技能無效時，消除對手回合類效果，令對手【疲憊】3 回合並使其下 3 回合屬性技能命中效果失效，恢復自身全部體力',
  kit: [
    // 吸取對手能力提升；成功→自身狂暴3回合；失敗→技能威力+100%
    seq('🎯 吸取對手的能力提升', [
      { acts: [a('stat_steal', { mode: '吸取' })] },
      { chain: 'success', acts: [a('status', { side: 'self', status: '狂暴', chance: 100, turns: 3 })] },
      { chain: 'fail', acts: [a('boost', {mult:2,power:true})] },
    ], 0),
    // 自身滿體力時威力+50%，先出手時改為+100%
    entry('modify_power', 'outgoing_power', '■ 自身滿體力時技能威力提升 50%，先出手時提升效果改為 100%', [
      { cond: [c('hp_ratio', { side: 'self', op: '不低於', ratio: 1 }, '自身滿體力'), c('first_move', {}, '先出手')], acts: [
        a('power_mod',{boost:1}),
      ] },
      { cond: [c('hp_ratio', { side: 'self', op: '不低於', ratio: 1 }, '自身滿體力'), c('first_move', { neg: true }, '非先出手')], acts: [
        a('power_mod',{boost:0.5}),
      ] },
    ], 1),
    // 解除自身所有異常；成功→對手下2回合附加效果失效
    seq('🎯 解除自身所有異常狀態，成功時令對手下 2 回合所有技能的附加效果失效', [
      { acts: [a('cure_status', { side: 'self', cls: '' })] },
      { chain: 'success', acts: [a('add_invalid_turns',{kind:'all',turns:2,next:true})] },
    ], 2),
    // 解除對手所有異常，每解除1個附加200固定傷害；自身體力大於對手則翻倍
    seq('🎯 解除對手所有異常狀態，每成功解除 1 個便附加 200 點固定傷害；結算時自身體力大於對手則固定傷害翻倍', [
      { acts: [a('cure_status', { side: 'opp', cls: '' })] },
      {live:true,cond:[c('hp_cmp',{side:'self',op:'高於'},'結算時體力較高')],acts:[a('dmg_from_last',{ratio:400,type:'固定'})],elseActs:[a('dmg_from_last',{ratio:200,type:'固定'})]},
    ], 3),
    // 技能無效時：消除對手回合類效果＋疲憊3回合＋下3回合屬性技能命中效果失效＋恢復自身全部體力
    {...entry('on_invalid','self_invalid','■ 技能無效時，消除對手回合類效果，令對手【疲憊】3 回合並使其下 3 回合屬性技能命中效果失效，恢復自身全部體力', [
      { cond:[c('skill_invalid',{})],acts: [
        a('clear_turn', { side: 'opp' }),
        a('status', { side: 'opp', status: '疲憊', chance: 100, turns: 3 }),
        a('add_invalid_turns',{kind:'屬性',turns:3,next:true}),
        a('heal', { side: 'self', ratio: 1 }),
      ] },
    ], 4),role:'innate'},
  ],
}];
