// arena_16 龍之治癒：可編輯魂印條款。
// 喚醒、PP豁免、正式技能重播與赤龍儲存已接共用讀取端。
// 逐龍面板、臨時上限、增減傷與PP已接通；追加條件及龍魂印記全文仍須個別驗收。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import dhText from './dragonHealingSoulText.json';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const e = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });
const dragonMark = (id: string, name: string, ch: string) => a('resource_mark_add', {
  id, name, displayChar: ch, unit: '層', side: 'self', scope: 'elf', persistsOffField: true,
  amount: 1, maxCount: 1, description: name + '已喚醒' });
const hasDragon = (id: string, n = 1) => c('mark_count', { side: 'self', id, op: '不小於', amount: n }, '已喚醒 ' + n + ' 條以上');

const DRAGONS=['dragonGold','dragonMystic','dragonRed','dragonAzure'];
const panel=()=>a('resource_panel_scale',{key:'dragonAwakeningPanel',ids:DRAGONS,statRatio:0.25,maxHpRatio:0.25});
export const MIGRATED_ARENA16_DRAGON_HEALING_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['arena_16'],
  name: '龍之治癒',
  description: dhText.soul,
  kit: [
    // 登場：四龍沉睡（清空喚醒印記與真龍）
    e('on_entered', 'entrance', '登場時，金龍、玄龍、赤龍與蒼龍均為沉睡狀態', [
      { acts: [
        a('resource_mark_remove', { id: 'dragonGold', side: 'self', scope: 'elf' }),
        a('resource_mark_remove', { id: 'dragonMystic', side: 'self', scope: 'elf' }),
        a('resource_mark_remove', { id: 'dragonRed', side: 'self', scope: 'elf' }),
        a('resource_mark_remove', { id: 'dragonAzure', side: 'self', scope: 'elf' }),
        a('resource_mark_remove', { id: 'trueDragon', side: 'self', scope: 'elf' }),
      ] },
    ], 0),
    // 首次使用第1~4技能在正式使用前依序喚醒對應龍（技能位序：1金／2玄／3赤／4蒼）
    e('before_skill', 'before_skill', '首次使用技能欄第 1～4 個技能時，依序喚醒對應龍', [
      { cond: [c('skill_slot', { index: 0 }, '使用第1技能')], acts: [dragonMark('dragonGold', '金龍', '金')] },
      { cond: [c('skill_slot', { index: 1 }, '使用第2技能')], acts: [dragonMark('dragonMystic', '玄龍', '玄')] },
      { cond: [c('skill_slot', { index: 2 }, '使用第3技能')], acts: [dragonMark('dragonRed', '赤龍', '赤')] },
      { cond: [c('skill_slot', { index: 3 }, '使用第4技能')], acts: [dragonMark('dragonAzure', '蒼龍', '蒼')] },
    ], 1),
    e('battle_start','battle_start','保存基礎能力點數及最大體力，逐龍提升25%而非能力等級',[
      {acts:[panel()]},
    ],2),
    e('on_resource_changed','resource_changed','四龍甦醒數量變動時同步能力點數與臨時體力上限',[
      {acts:[panel()]},
    ],9),
    e('before_damage','incoming','每甦醒一龍，受到的非真實傷害降低15%',[
      {acts:[a('resource_damage_scale',{ids:DRAGONS,attackBoost:0.5,nonTrueReduce:0.15})]},
    ],10),
    e('before_damage','outgoing','每甦醒一龍，攻擊技能傷害增加50%',[
      {acts:[a('resource_damage_scale',{ids:DRAGONS,attackBoost:0.5,nonTrueReduce:0.15})]},
    ],11),
    e('round_end','round_end','每甦醒一龍，回合末恢復最大體力10%並隨機吸取1點PP',[
      {acts:[a('resource_round_recovery',{ids:DRAGONS,healRatio:0.1,ppPerResource:1})]},
    ],3),
    e('on_switch_out','switch_out','下場時四龍重新沉睡並撤回能力點數及臨時上限',[
      {acts:[...DRAGONS.map(id=>a('resource_mark_remove',{id,side:'self',scope:'elf'})),a('resource_mark_remove',{id:'trueDragon',side:'self',scope:'elf'}),a('stored_damage_reset',{key:'arena.red'})]},
    ],12),
    // 四龍全醒後使用第五技能 → 喚醒真龍・治癒
    e('before_skill', 'before_skill', '四龍全部喚醒後，使用第五技能喚醒【真龍・治癒】', [
      { cond: [c('skill_slot', { index: 4 }, '使用第五技能'), hasDragon('dragonGold'), hasDragon('dragonMystic'), hasDragon('dragonRed'), hasDragon('dragonAzure')], acts: [
        a('resource_mark_add', { id: 'trueDragon', name: '真龍・治癒', displayChar: '真', unit: '層', side: 'self', scope: 'elf', persistsOffField: true, amount: 1, maxCount: 1, description: '真龍已喚醒' }),
        a('pp_unlimited_until_switch', {}),
      ] },
    ], 4),
    // 真龍・治癒：使用技能時額外使用 4 次
    e('on_skill_use', 'self_skill', '真龍・治癒令所有技能無視 PP 限制，使用技能時額外使用 4 次', [
      { cond: [c('mark_count', { side: 'self', id: 'trueDragon', op: '不小於', amount: 1 }, '真龍已喚醒')], acts: [
        a('extra_use_times', { times: 4 }),
      ] },
    ], 5),
    // 赤龍：喚醒後抵擋受到的攻擊傷害並累計（上限為自身最大體力）
    e('before_damage', 'incoming', '【赤龍】：喚醒後抵擋受到的攻擊傷害並累計（上限為自身最大體力）', [
      { cond: [hasDragon('dragonRed')], acts: [a('attack_absorb_store', { capRatio: 1, key:'arena.red' })] },
    ], 6),
    // 四龍追加效果（真龍喚醒後每次使用技能無條件觸發）
    e('after_action', 'self_after_skill', '四龍追加效果（真龍・治癒喚醒後每次使用技能無條件觸發）：金龍消除對手回合類效果；玄龍下3回合造成的固定傷害與百分比傷害提升50%；蒼龍吸取對手最大體力50%', [
      { cond: [c('mark_count', { side: 'self', id: 'trueDragon', op: '不小於', amount: 1 }, '真龍已喚醒')], acts: [
        a('clear_turn', { side: 'opp' }),
        a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '固定', boost: 0.5, turns: 3 }),
        a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '百分比', boost: 0.5, turns: 3 }),
        a('drain', { ratio: 0.5 }),
      ] },
    ], 7),
    e('after_action','self_after_skill','【赤龍】：使用攻擊技能時釋放已累計的固定傷害；真龍喚醒後屬性技能也釋放',[
      {cond:[hasDragon('dragonRed'),c('skill_kind',{kind:'攻擊'})],acts:[a('stored_damage_release',{key:'arena.red',type:'固定'})]},
      {cond:[hasDragon('dragonRed'),hasDragon('trueDragon'),c('skill_kind',{kind:'屬性'})],acts:[a('stored_damage_release',{key:'arena.red',type:'固定'})]},
    ],8),
    e('after_action','self_after_status','真龍喚醒後使用屬性技能，每條甦醒之龍各造成150點龍系直接傷害',
      DRAGONS.map(id=>({cond:[hasDragon('trueDragon'),hasDragon(id)],acts:[a('dmg',{flat:150,type:'技能',elem:'龍'})]})),13),
    e('after_action','self_after_skill','龍魂印記：每層令每條甦醒之龍各造成150點龍系直接傷害；龍魂之源每龍增加50點，真龍改用最高克制倍率',[
      {acts:[a('resource_scaled_hits',{ids:DRAGONS,mark:'arena.dragonSoulMark',base:150,bonusMark:'dragonSoulSource',bonusPerResource:50,multiplierMark:'trueDragon',maxMultiplier:4,elem:'龍'})]},
    ],14),
    // 2026-10-28 三龍追加效果：由 DAMAGE_IMMUNIZED（真正 100% 免傷）事件觸發。
    // 金龍：成功免疫異常時消除對手回合類效果（掛在異常免疫事件，見下）。
    // 玄龍：成功免疫固定／百分比傷害後，下 3 回合自身造成的固定與百分比傷害 +50%。
    // 蒼龍：成功免疫能力下降時吸取對手最大體力 1/2（同技能多項下降只觸發一次，op 內去重）。
    e('on_damage_immunized','damage_immune','【玄龍】成功免疫固定或百分比傷害後，下 3 回合自身造成的固定傷害與百分比傷害提升 50%',[
      {cond:[hasDragon('dragonMystic')],acts:[a('immune_success_bonus',{kind:'mystic'})]},
    ],15),
    e('on_status_immunized','status_immune','【金龍】成功免疫異常狀態時，消除對手回合類效果',[
      {cond:[hasDragon('dragonGold')],acts:[a('immune_success_bonus',{kind:'gold'})]},
    ],16),
    e('before_stat_change','before_stat_change','【蒼龍】成功免疫能力下降時，吸取對手最大體力 1/2（同一技能多項下降只觸發一次）',[
      {cond:[hasDragon('dragonAzure')],acts:[a('stat_drop_guard',{}),a('immune_success_bonus',{kind:'azure'})]},
    ],17),
  ],
};
