// 5019 眾神之父·奧丁 技能「ᚱᚨᚷᚾᚨᚱᛟᚲ」真 Kit（DSH 20261018 第十九批 legacyWrapped 拆解）。
// 舊 handler：odinRegistry 的機制資料＋wrapped 條目；符文系統由 finalOdinDeluBeliente.ts 的
// skill_marks_* 通用 op 承擔（剝離／附加／同步／繼承），本 Kit 只組合既有件。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'skill', role: 'attached', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });

const RAW = '■ 必中\n■ 場上每激活2種符文則自身當回合額外先制+1\n🎯 剝離雙方當前的所有符文，並為自身附加ᛏ符文\n🎯 消除雙方能力上升、下降狀態、護盾、護罩、次數類效果與當前在場回合數紀錄\n🎯 下次擊敗對手時，對手下1隻出戰精靈出戰時將下次擁有符文時同步當前激活狀態\n🎯 下次被對手擊敗時，己方下1隻出戰精靈出戰時自身將處於激活狀態的符文附加給技能位序相同的技能';

export const MIGRATED_ODIN_RAGNAROK_SKILL_KIT: ReviewedSequenceSkill[] = [{
  elfIds: ['5019'],
  name: 'ᚱᚨᚷᚾᚨᚱᛟᚲ',
  description: RAW,
  kit: [
    prop('必中', 'sure_hit', true, 0),
    // 場上每激活2種符文則當回合額外先制+1
    entry('modify_priority', 'modify_priority', '■ 場上每激活2種符文則自身當回合額外先制+1', [
      { acts: [a('skill_marks_priority', { perKinds: 2, bonus: 1 })] },
    ], 1),
    // 剝離雙方所有符文，並為自身附加ᛏ符文
    seq('🎯 剝離雙方當前的所有符文，並為自身附加ᛏ符文', [
      { acts: [
        // 剝離雙方符文：拆成自身與對手兩次（合約 side 僅接受 self/opp）。
        // 實際剝離依每個槽保存的來源合約；參數提供舊式槽印記的明確預設。
        a('skill_marks_strip', { side: 'self', restorePp: true, hpRatio: .2, damageRatio: 0, nonlethal: true, zeroHighestMaxPp: false }),
        a('skill_marks_strip', { side: 'opp', restorePp: false, hpRatio: 0, damageRatio: .2, nonlethal: true, zeroHighestMaxPp: true }),
        a('battle_mark_grant', { side: 'self', id: 'tiwaz_rune', name: 'ᛏ 戰神符文', displayChar: 'ᛏ', statRatio: 1.2, duel: true }),
      ] },
    ], 2),
    // 消除雙方能力升降、護盾護罩、次數類效果與在場回合數紀錄
    seq('🎯 消除雙方能力上升、下降狀態、護盾、護罩、次數類效果與當前在場回合數紀錄', [
      { acts: [
        a('combat_record_reset',{side:'self',stages:true,shields:true,clearUses:true,fieldRounds:true}),
        a('combat_record_reset',{side:'opp',stages:true,shields:true,clearUses:true,fieldRounds:true}),
      ] },
    ], 3),
    // 下次擊敗對手時：對手下1隻出戰時同步當前激活狀態
    seq('🎯 下次擊敗對手時，對手下1隻出戰精靈出戰時將下次擁有符文時同步當前激活狀態', [
      { acts: [a('skill_mark_inherit_arm', { when: 'kill', mode: 'activation' })] },
    ], 4),
    // 下次被對手擊敗時：己方下1隻出戰時將激活符文附加給技能位序相同的技能
    seq('🎯 下次被對手擊敗時，己方下1隻出戰精靈出戰時自身將處於激活狀態的符文附加給技能位序相同的技能', [
      { acts: [a('skill_mark_inherit_arm', { when: 'defeated', mode: 'runes' })] },
    ], 5),
  ],
}];
