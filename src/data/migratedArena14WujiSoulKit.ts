// arena_14 無極聖武 魂印「無極聖武」真 Kit（DSH 20261018 第二十一批 legacyWrapped 拆解）。
// 舊 handler：staged-arena/wujiRegistry.ts 的印記操作（giveWujiMark／wujiMarkRounds／removeWujiMark）
// 保留為引擎讀取端；本 Kit 把效果條款寫成可編輯積木，四印記以 resource_mark_* 表達。
// 「通用特性不含／含有 ≤50% 機率附加異常」由 count_team_trait{traitText:'lowChanceStatus'} 統計（本批擴充）。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import wujiText from './wujiSoulText.json';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const e = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });
const markAdd = (id: string, name: string, ch: string, desc: string, maxCount = 99) => a('resource_mark_add', {
  id, name, displayChar: ch, unit: '層', side: 'self', scope: 'elf', persistsOffField: true,
  amount: 1, maxCount, description: desc });
const markAddOpp = (id: string, name: string, ch: string, desc: string, maxCount = 99) => a('resource_mark_add', {
  id, name, displayChar: ch, unit: '層', side: 'opp', scope: 'elf', persistsOffField: true,
  amount: 1, maxCount, description: desc });
const hasMark = (id: string, side: 'self' | 'opp' = 'self') => c('mark_count', { side, id, op: '不小於', amount: 1 }, '持有' + id);
const markLayers = (id: string, side: 'self' | 'opp' = 'self') => c('mark_count', { side, id, op: '不小於', amount: 1 }, '持有' + id);

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
    e('on_entered','entrance','【英雄之耀】：自身登場時為對手附加等同層數回合的武誅',[{acts:[a('mark_program',{
      id:'arena.wuzhu',name:'武誅',displayChar:'誅',description:'對手為無極聖武時所有技能先制-2；體力高於1/2時受到攻擊傷害提升50%，低於1/2時造成攻擊傷害減少50%',
      side:'opp',scope:'elf',persistsOffField:true,mode:'add',unit:'回合',count:1,maxCount:99,countFromMark:{side:'self',id:'arena.heroGlory'},turnsFromCount:true,
      priorityBonus:-2,vsOpponentName:'無極聖武',rules:[
        {raw:'體力高於一半受到攻擊傷害提升50%',trig:'incoming_attack',parsed:true,body:[{cond:[c('hp_ratio',{side:'self',op:'高於',ratio:.5})],acts:[a('dmg_mod',{dir:'in_boost',kind:'攻擊',boost:.5})]}]},
        {raw:'體力低於一半造成攻擊傷害減少50%',trig:'outgoing_attack',parsed:true,body:[{cond:[c('hp_ratio',{side:'self',op:'低於',ratio:.5})],acts:[a('dmg_mod',{dir:'out_reduce',kind:'攻擊',reduce:.5})]}]},
      ],
    })]}],6),
    // 任意一方精靈登場：僅令該次登場精靈受 1 回合【砥礪】；成功→3回合【亮節】，失敗→3回合【威怯】
    e('opponent_entered', 'bench', '自身位於出戰背包時，任意一方精靈登場，僅令該次登場的精靈受到 1 回合附屬類異常狀態【砥礪】。砥礪判定成功時賦予該精靈 3 回合【亮節】；判定未成功時為其附加 3 回合【威怯】', [
      { acts: [a('status', { side: 'opp', status: '砥礪', chance: 100, turns: 1 })] },
      // 亮節／威怯 依原文為「印記」非異常 → 以 resource_mark_add 表達（3 回合以層數代表）
      { chain: 'success', acts: [
        markAddOpp('liangJie', '亮節', '節', '機率不高於50%的異常附加效果機率降至0；每回合結束為對手PP為0的技能恢復5點PP', 3),
      ] },
      { chain: 'fail', acts: [
        markAddOpp('weiQie', '威怯', '怯', '造成的非真實傷害額外減少60%', 3),
      ] },
    ], 1),
    // 自身攻擊無視對手能力提升／護盾／攻擊技能免疫
    e('on_skill_use', 'self_attack', '自身攻擊無視對手的能力提升效果、護盾效果與攻擊技能免疫效果', [
      { acts: [
        a('ignore', { what: '能力提升' }),
        a('ignore', { what: '護盾' }),
        a('ignore', { what: '攻擊免疫' }),
      ] },
    ], 2),
    // 使用攻擊技能：對手無武誅→附加等同英雄之耀層數的武誅
    e('after_action', 'self_after_skill', '自身使用攻擊技能時，若對手沒有【武誅】，技能使用後為對手附加等同於英雄之耀層數的武誅', [
      { cond: [c('mark_count', { side: 'opp', id: 'wuZhu', op: '低於', amount: 1 }, '對手無武誅')], acts: [
        markAddOpp('wuZhu', '武誅', '誅', '對手為無極聖武時所有技能先制-2；體力高於1/2時受到攻擊傷害+50%，低於1/2時造成攻擊傷害-50%'),
      ] },
      // 若對手已有武誅→觸發①~⑤並在技能使用後消除
      { cond: [hasMark('wuZhu', 'opp')], acts: [
        // ① 每有1回合武誅，當回合造成攻擊傷害+20%
        a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '攻擊', boost: 0.2, turns: 1 }),
        // ② 將對手能力提升視為同級能力下降
        a('stat_reverse', { side: 'opp', kind: 'up' }),
        // ③ 將自身能力下降視為對手的同級能力下降
        a('stat_reverse', { side: 'self', kind: 'down' }),
        // ④ 對手每有100點護盾護罩，本次攻擊傷害+10%（最高100%）
        a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '攻擊', boost: 1, turns: 1 }),
        // ⑤ 無視攻擊技能免疫成功時為對手附加3回合威怯
        markAddOpp('weiQie', '威怯', '怯', '造成的非真實傷害額外減少60%', 3),
        // 消除對手武誅
        a('resource_mark_remove', { id: 'wuZhu', side: 'opp', scope: 'elf' }),
      ] },
    ], 3),
    // 【亮節】每回合結束：為對手 PP 值為 0 的技能恢復 5 點 PP
    e('round_end', 'round_end', '【亮節】：自身機率不高於50%的異常狀態附加效果機率下降至0；每回合結束時，為對手PP值為0的技能恢復5點PP值', [
      { cond: [hasMark('liangJie', 'opp')], acts: [
        a('pp_op', { side: 'opp', mode: 'add', amount: 5 }),
      ] },
    ], 4),
    // 【威怯】自身造成的非真實傷害額外減少60%
    e('before_damage', 'outgoing', '【威怯】：自身造成的非真實傷害額外減少60%', [
      { cond: [hasMark('weiQie', 'opp')], acts: [
        a('dmg_mod_turns', { side: 'opp', dir: 'out_reduce', kind: '非真實', reduce: 0.6, turns: 1 }),
      ] },
    ], 5),
  ],
};
