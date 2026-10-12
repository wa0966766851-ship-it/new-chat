import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';

/**
 * 5026 無序.墜星 的 21 份「石之力-S」技能石定義（使用者決定 2026-10-12：各自表達、各自編輯）。
 * 每份一筆：一個「N%機率」條件 + 一個動作；原先共用的參數化程式（skillStoneEffects 的 detail 分支）不再處理這 21 份。
 * 機率條件使用「使用時」擲一次（PRD）；投石者出招時 toSSStone 把機率改為 100%（威力 240 的 SS 轉化）。
 * 數值、持續回合與原文一字不改：異常 2 回合、先制+1、致命機率 +1/16（下回合）等沿用專案規則（project）。
 */
const chance = (pct: number) => ({ c: 'chance', p: { pct }, label: `${pct}%機率` });
const stone = (name: string, raw: string, pct: number, act: ReturnType<typeof action>, suffix = ''): ReviewedSequenceSkill => ({
  elfIds: ['5026'], name, description: `🎯 ${raw}${suffix}`,
  kit: [sequence(`🎯 ${raw}`, [{ cond: [chance(pct)], acts: [act] }], 0)] });
const BUG_NOTE = '\n---\n【SS級技能石】（裝備於投石者時轉化，PP 1/1，機率100%，※固有：不可替換）';

export const MIGRATED_SKILL_STONE_KITS: ReviewedSequenceSkill[] = [
  stone('電石之力-S', '使用時10%機率令對手麻痺', 10, action('status',{chance:100,side:'opp',status:'麻痺',turns:2})),
  stone('神秘石之力-S', '使用時10%機率令對方疲憊', 10, action('status',{chance:100,side:'opp',status:'疲憊',turns:2})),
  stone('超能石之力-S', '使用時15%機率令對手混亂', 15, action('status',{chance:100,side:'opp',status:'混亂',turns:2})),
  stone('自然石之力-S', '使用時10%機率恢復自己所有技能PP值1點', 10, action('pp_op',{side:'self',mode:'add',amount:1})),
  stone('草石之力-S', '使用時15%機率令對手中毒', 15, action('status',{chance:100,side:'opp',status:'中毒',turns:2})),
  stone('水石之力-S', '使用時15%機率令對手凍傷', 15, action('status',{chance:100,side:'opp',status:'凍傷',turns:2})),
  stone('火石之力-S', '使用時15%機率令對手燒傷', 15, action('status',{chance:100,side:'opp',status:'燒傷',turns:2})),
  stone('飛行石之力-S', '使用時15%機率令對手速度等級-1', 15, action('stat',{chance:100,side:'opp',stats:['速度'],v:-1})),
  stone('機械石之力-S', '使用時15%機率令對手雙防-1', 15, action('stat',{chance:100,side:'opp',stats:['雙防'],v:-1})),
  stone('地面石之力-S', '使用時15%機率令對手命中-1', 15, action('stat',{chance:100,side:'opp',stats:['命中'],v:-1})),
  stone('普通石之力-S', '使用時5%機率威力翻倍', 5, action('boost',{mult:2,power:true,kind:'攻擊'})),
  stone('冰石之力-S', '使用時15%機率令對手凍傷', 15, action('status',{chance:100,side:'opp',status:'凍傷',turns:2})),
  stone('戰鬥石之力-S', '使用時100%機率下回合致命一擊提升', 100, action('crit_bonus_turns',{turns:1,bonus:1/16,next:true})),
  stone('光石之力-S', '使用時10%機率令對手睡眠', 10, action('status',{chance:100,side:'opp',status:'睡眠',turns:2})),
  stone('暗影石之力-S', '使用時10%機率令對手害怕', 10, action('status',{chance:100,side:'opp',status:'害怕',turns:2})),
  stone('龍石之力-S', '使用時5%機率附加200點真實傷害', 5, action('dmg',{flat:200,type:'真實',both:false})),
  // 保留拆解前已鎖定的後手補償：本回合已受擊，回合末略過一次遞減。
  stone('聖靈石之力-S', '使用時10%機率一回合受到傷害減半', 10, action('dmg_mod_turns',{side:'self',dir:'in',kind:'非真實',reduce:0.5,turns:1,lateCompensation:true})),
  stone('次元石之力-S', '使用時10%機率令對手癱瘓', 10, action('status',{chance:100,side:'opp',status:'癱瘓',turns:2})),
  stone('遠古石之力-S', '使用時10%機率令對手流血', 10, action('status',{chance:100,side:'opp',status:'流血',turns:2})),
  // 邪靈：先制要在出手順序判定前決定，所以是「機率先制」技能屬性（附加效果，可被封印；同回合重複查詢沿用同一次擲骰）。
  { elfIds: ['5026'], name: '邪靈石之力-S', description: '🎯 使用時10%機率先制+1', kit: [{ codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'attached', order: 0,
    customText: '🎯 使用時10%機率先制+1', params: { property: 'chance_priority', value: 1, pct: 10, conditions: [] } } as KitEntry] },
  stone('蟲石之力-S', '使用時10%機率降低對手所有技能PP值1點，若因此對手PP值歸0則對手當回合無法行動', 10, action('pp_op',{side:'opp',mode:'reduce',amount:1,stopIfEmpty:true}), BUG_NOTE),
];
