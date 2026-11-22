// arena_14 無極聖武 魂印「無極聖武」真 Kit（DSH 20261018 第二十一批 legacyWrapped 拆解）。
// 舊 handler：staged-arena/wujiRegistry.ts 的印記操作（giveWujiMark／wujiMarkRounds／removeWujiMark）
// 保留為引擎讀取端；本 Kit 把效果條款寫成可編輯積木，四印記以 resource_mark_* 表達。
// 「通用特性不含／含有 ≤50% 機率附加異常」由 count_team_trait{traitText:'lowChanceStatus'} 統計（本批擴充）。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import wujiText from './wujiSoulText.json';
import { LIANGJIE_PROGRAM, WEIYUE_PROGRAM } from './wujiMarkPrograms';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const e = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });
const markAdd = (id: string, name: string, ch: string, desc: string, maxCount = 99) => a('resource_mark_add', {
  id, name, displayChar: ch, unit: '層', side: 'self', scope: 'elf', persistsOffField: true,
  amount: 1, maxCount, description: desc });
const hasMark = (id: string, side: 'self' | 'opp' = 'self') => c('mark_count', { side, id, op: '不小於', amount: 1 }, '持有' + id);
const markLayers = (id: string, side: 'self' | 'opp' = 'self') => c('mark_count', { side, id, op: '不小於', amount: 1 }, '持有' + id);

/** 武誅：登場與攻擊後附加共用同一張圖紙（等同英雄之耀層數的回合）。 */
const WUZHU_PROGRAM = {
  id:'arena.wuzhu',name:'武誅',displayChar:'誅',description:'對手為無極聖武時所有技能先制-2；體力高於1/2時受到攻擊傷害提升50%，低於1/2時造成攻擊傷害減少50%',
  side:'opp',scope:'elf',persistsOffField:true,mode:'add',unit:'回合',count:1,maxCount:99,countFromMark:{side:'self',id:'arena.heroGlory'},turnsFromCount:true,
  priorityBonus:-2,vsOpponentName:'無極聖武',rules:[
    {raw:'體力高於一半受到攻擊傷害提升50%',trig:'incoming_attack',parsed:true,body:[{cond:[c('hp_ratio',{side:'self',op:'高於',ratio:.5})],acts:[a('dmg_mod',{dir:'in_boost',kind:'攻擊',boost:.5})]}]},
    {raw:'體力低於一半造成攻擊傷害減少50%',trig:'outgoing_attack',parsed:true,body:[{cond:[c('hp_ratio',{side:'self',op:'低於',ratio:.5})],acts:[a('dmg_mod',{dir:'out_reduce',kind:'攻擊',reduce:.5})]}]},
  ],
};

export const MIGRATED_ARENA14_WUJI_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['arena_14'],
  name: '無極聖武',
  description: wujiText.soul,
  kit: [
    // 戰鬥開始：依通用特性統計英雄之耀層數
    // （每有1隻不含低機率異常特性→+1層；每有1隻含有→-1層）
    e('battle_start', 'battle_start', '戰鬥開始時，己方每有 1 隻通用特性不含「機率不高於 50% 的異常狀態附加效果」的其他精靈，自身獲得 1 層【英雄之耀】；每有 1 隻通用特性含有該類效果的其他精靈，自身失去 1 層英雄之耀', [
      { acts: [
        a('count_team_trait', { side: 'self', state: 'any', traitText: 'lowChanceStatus', excludeSelf:true, matchedWeight:-1, unmatchedWeight:1, traitSources:['soul','general'] }),
        a('resource_mark_add', { id: 'arena.heroGlory', name: '英雄之耀', displayChar: '耀', unit: '層', side: 'self', scope: 'elf', persistsOffField: true, ratio: 1, maxCount: 99, description: '每層提升自身其他能力值（雙攻差15%）並於登場時為對手附加1回合武誅' }),
        a('stat_points_add_gap',{stats:['hp','def','spdef','speed'],stats2:['atk','spatk'],ratio:.15,markId:'arena.heroGlory'}),
      ] },
    ], 0),
    e('on_entered','entrance','【英雄之耀】：自身登場時為對手附加等同層數回合的武誅',[{acts:[a('mark_program',WUZHU_PROGRAM)]}],6),
    // 任意一方精靈登場：僅令該次登場精靈受 1 回合【砥礪】；成功→3回合【亮節】，失敗→3回合【威怯】
    e('opponent_entered', 'bench', '自身位於出戰背包時，任意一方精靈登場，僅令該次登場的精靈受到 1 回合附屬類異常狀態【砥礪】。砥礪判定成功時賦予該精靈 3 回合【亮節】；判定未成功時為其附加 3 回合【威怯】', [
      { acts: [a('status', { side: 'opp', status: '砥礪', chance: 100, turns: 1 })] },
      // 亮節／威怯 依原文為「印記」非異常；兩者都是 3 回合的回合型印記（技能「每剩1回合威怯」讀剩餘回合）
      { chain: 'success', acts: [
        a('mark_program', LIANGJIE_PROGRAM),
      ] },
      { chain: 'fail', acts: [
        a('mark_program', WEIYUE_PROGRAM),
      ] },
    ], 1),
    // 自身攻擊無視對手能力提升／護盾／攻擊技能免疫
    e('on_skill_use', 'self_attack', '自身攻擊無視對手的能力提升效果、護盾效果與攻擊技能免疫效果', [
      { acts: [
        a('ignore', { what: '能力提升' }),
        a('ignore', { what: '護盾' }),
        a('ignore', { what: '攻擊免疫' }),
      ] },
      // 對手已有武誅：②將對手的能力提升視為同級能力下降；③將自身的能力下降視為對手的同級能力下降。
      // 「視為」只在讀取等級計算時套用（damageCalculator／出手順序／命中判定），不改真實 statStages。
      { cond: [hasMark('arena.wuzhu', 'opp')], acts: [
        a('flag_set', { key: 'oppBoostAsDropThisAction', value: true, thisRound: true }),
        a('flag_set', { key: 'selfDropAsOppDropThisAction', value: true, thisRound: true }),
      ] },
    ], 2),
    // 對手已有武誅：①每有1回合武誅，攻擊傷害+20%；④對手每有100點護盾或護罩，額外+10%（最高100%）。
    e('before_damage', 'outgoing_attack', '對手已有武誅時：①對手每有1回合武誅，造成的攻擊傷害提升20%；④對手每有100點護盾或護罩，本次攻擊傷害額外提升10%，最高提升100%', [
      { cond: [hasMark('arena.wuzhu', 'opp')], acts: [
        a('dmg_mod', { dir: 'out', kind: '攻擊', boost: .2, perMarkTurns: { side: 'opp', id: 'arena.wuzhu' } }),
        a('dmg_mod', { dir: 'out', kind: '攻擊', boost: .1, perShield: { side: 'opp', per: 100 }, maxBoost: 1 }),
      ] },
    ], 7),
    // 使用攻擊技能：對手無武誅→附加等同英雄之耀層數的武誅
    e('after_action', 'self_after_attack', '自身使用攻擊技能時，若對手沒有【武誅】，技能使用後為對手附加等同於英雄之耀層數的武誅', [
      // 兩個分支都以「技能使用前」的武誅判定（pre）：同一次攻擊剛附加的武誅不可當場被消耗。
      { pre: true, cond: [c('mark_count', { side: 'opp', id: 'arena.wuzhu', op: '低於', amount: 1 }, '對手無武誅')], acts: [
        a('mark_program', WUZHU_PROGRAM),
      ] },
      // 若對手已有武誅：①~④已在出手與傷害計算時套用，技能使用後消除武誅
      { pre: true, cond: [hasMark('arena.wuzhu', 'opp')], acts: [
        a('resource_mark_remove', { id: 'arena.wuzhu', side: 'opp', scope: 'elf' }),
      ] },
      // ⑤ 本次攻擊成功無視攻擊技能免疫時，為對手附加3回合威怯
      { pre: true, cond: [hasMark('arena.wuzhu', 'opp'), c('ignore_success', { what: '攻擊免疫' }, '無視攻擊免疫成功')], acts: [
        a('mark_program', WEIYUE_PROGRAM),
      ] },
    ], 3),
    // 【亮節】的效果由印記本身執行（LIANGJIE_PROGRAM）。
    // 【威怯】的減傷由印記本身的持有者規則執行（WEIYUE_PROGRAM），不在本魂印另寫一份。
  ],
};
