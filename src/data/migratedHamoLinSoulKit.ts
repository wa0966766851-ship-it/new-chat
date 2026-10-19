// 5035 御天龍神·哈莫 魂印「鱗」真 Kit（DSH 20261018 第十七批 legacyWrapped 拆解）。
// 舊 handler：src/effects/elves/hamo/registry.ts handleHamoSoulMark 已空殼化（規則3.3）。
// 龍鱗以資源印記表達；循環與防護使用通用積木執行端，不按精靈名稱分流。
// 本批新增 Kit 節點 before_stat_change（能力等級變更前攔截），供「藍色龍鱗免疫能力下降」使用。
// 描述原文存於同目錄 hamoLinSoulText.json（由程式從 DEFAULT_ELVES 匯出，逐字含 CRLF，不可手打）。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import linText from './hamoLinSoulText.json';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });
const scale = (colour: string) => c('mark_count', { side: 'self', id: 'hamo_scale_' + colour, op: '不小於', amount: 1 }, '存在' + colour + '龍鱗');
const colouredIds=['藍色','紅色','綠色'].map(colour=>'hamo_scale_'+colour);
const protectScales=()=>colouredIds.map(id=>a('mark_lock_turns',{id,turns:2}));
const success=()=>[c('success',{})];
const lowHealth=(equals:boolean)=>c('player_state',{key:'lowHealthDefenseMode',equals,fallback:false});

export const MIGRATED_HAMO_LIN_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5035'],
  name: '鱗',
  description: linText.description,
  kit: [
    // 登場：附加3片無色龍鱗
    entry('on_entered', 'entrance', '登場時：為自身附加3片無色龍鱗', [
      {acts:[a('typed_cycle_reset',{id:'scale_sequence',initialReductions:1}),a('flag_set',{key:'lowHealthDefenseMode',value:false})]},
      {acts:[a('resource_pending_reset',{keys:colouredIds}),...protectScales()]},
      { acts: [a('resource_mark_add', { id: 'hamo_scale_無色', name: '無色龍鱗', displayChar: '鱗', unit: '枚', side: 'self', scope: 'elf', persistsOffField: false, amount: 3, maxCount: 3, description: '無色龍鱗；2回合內免疫龍鱗消失' })] },
    ], 0),
    entry('before_damage','incoming','對手每次造成技能傷害時，需依水、火、草循環；符合則重複減半並依序染色，不符合則無法造成該傷害、己方龍系能力上限提升20%且減半次數+1',[
      {acts:[a('typed_damage_cycle',{id:'scale_sequence',types:['水','火','草'],ratio:0.5,initialReductions:1,
        onMatch:[{acts:[a('resource_dye_first',{fromId:'hamo_scale_無色',choices:[
          {id:'hamo_scale_藍色',name:'藍色龍鱗',displayChar:'藍'},
          {id:'hamo_scale_紅色',name:'紅色龍鱗',displayChar:'紅'},
          {id:'hamo_scale_綠色',name:'綠色龍鱗',displayChar:'綠'},
        ],resetFieldRounds:true})]}],
        onMismatch:[{acts:[a('team_type_stats_mult',{type:'龍',ratio:0.2,aliveOnly:true})]}],
      })]},
    ],0),
    // 常駐：自身造成技能傷害提升150%
    entry('before_damage', 'outgoing', '常駐效果：自身造成技能傷害提升150%', [
      { acts: [a('missing_hp_scaled_boost', {types:['skill'],baseBoost:1.5,step:.1,multiplier:1.1})] },
    ], 1),
    // 回合結束：按當時每損失10%體力逐次乘1.1，透過正式恢復入口結算。
    entry('round_end', 'round_end', '自身回合結束時恢復自身最大體力15%；自身未滿體力時每下降10%上述效果提升10%', [
      { acts: [a('missing_hp_scaled_heal', {baseRatio:.15,step:.1,multiplier:1.1})] },
    ], 2),
    // 自身免疫所有異常；但當前體力同時低於對手且低於自身最大體力½時此效果失效，改為受到技能傷害無法超過250
    entry('round_start', 'round_start', '自身免疫所有異常狀態；回合開始時若自身當前體力同時低於對手且低於自身最大體力½時此效果失效，改為受到技能傷害無法超過250', [
      {acts:[a('flag_set',{key:'lowHealthDefenseMode',value:false})]},
      { cond: [c('hp_cmp', { side: 'self', op: '低於' }, '體力低於對手'), c('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 }, '低於自身最大體力½')], acts: [
        a('flag_set',{key:'lowHealthDefenseMode',value:true}),
      ] },
    ], 3),
    entry('before_status_apply','before_status','自身免疫所有異常狀態；回合開始判定進入低血模式時失效',[
      {cond:[lowHealth(false)],acts:[a('status_guard',{cls:''})]},
    ],3),
    entry('before_damage','incoming','回合開始同時低於對手體力及自身半血時，改為受到技能傷害無法超過250',[
      {cond:[lowHealth(true)],acts:[a('damage_cap_now',{cap:250,types:['skill']})]},
    ],3),
    // 回合開始：無色龍鱗且在場不足2回合→消雙方回合類＋能力提升＋令對手害怕
    entry('round_start','round_start','無色龍鱗：2回合內免疫龍鱗消失；持有無色龍鱗期間每回合重置保護',[
      {cond:[scale('無色')],acts:protectScales()},
    ],3),
    entry('round_start', 'round_start', '無色龍鱗：回合開始時若本次在場回合數不足累計2回合，消除雙方回合類效果、能力提升狀態並100%令對手害怕', [
      { cond: [scale('無色'), c('field_rounds', { op: '低於', amount: 2 }, '在場不足2回合')], acts: [
        a('clear_turn', { side: 'both' }),
        a('stat_clear', { side: 'both', kind: 'up' }),
        a('status', { side: 'opp', status: '害怕', chance: 100, turns: 3 }),
      ] },
    ], 3),
    // 藍色龍鱗：免疫能力下降（before_stat_change 攔截）
    entry('before_stat_change', 'before_stat_change', '藍色龍鱗：持有精靈免疫受到的能力下降狀態；成功觸發則當回合結束後消失', [
      { cond: [scale('藍色')], acts: [
        a('stat_drop_guard',{}),
      ] },
      {cond:success(),acts:[a('resource_consume_pending',{id:'hamo_scale_藍色'})]},
    ], 4),
    // 紅色龍鱗：免疫攻擊/固定/百分比傷害，只有實際免疫成功才排入回合末消耗。
    entry('before_damage', 'incoming', '紅色龍鱗：持有精靈免疫受到的攻擊傷害、固定傷害、百分比傷害；成功觸發則當回合結束後消失', [
      { cond: [scale('紅色')], acts: [
        a('damage_immunity_now',{types:['attack','fixed','percent']}),
      ] },
      {cond:success(),acts:[a('resource_consume_pending',{id:'hamo_scale_紅色'})]},
    ], 5),
    // 綠色龍鱗：原持有者正PP被清除到0；與普通消耗／削PP事件分開。
    entry('pp_cleared', 'pp_cleared', '綠色龍鱗：持有精靈PP值被清除時重置自身體力、PP值為100%；成功觸發則當回合結束後消失', [
      { cond: [scale('綠色')], acts: [
        a('reset_hp_pp_on_clear',{}),
      ] },
      {cond:success(),acts:[a('resource_consume_pending',{id:'hamo_scale_綠色'})]},
    ], 6),
    // 龍鱗消失效果
    entry('round_end', 'round_end', '龍鱗消失時：紅色→對手燒傷並消回合類；藍色→對手凍傷並消護盾護罩；綠色→對手中毒並削減對手體力上限20%', [
      {acts:[a('resource_resolve_pending',{id:'hamo_scale_紅色',body:[{acts:[a('status',{side:'opp',status:'燒傷',chance:100,turns:3}),a('clear_turn',{side:'opp'})]}]})]},
      {acts:[a('resource_resolve_pending',{id:'hamo_scale_藍色',body:[{acts:[a('status',{side:'opp',status:'凍傷',chance:100,turns:3}),a('clear_shield',{side:'opp',kind:'both'})]}]})]},
      {acts:[a('resource_resolve_pending',{id:'hamo_scale_綠色',body:[{acts:[a('status',{side:'opp',status:'中毒',chance:100,turns:3}),a('maxhp',{side:'opp',ratio:.2,direction:'decrease'})]}]})]},
    ], 7),
    // 下場：清空龍鱗
    entry('on_switch_out', 'switch_out', '下場時清空所有龍鱗', [
      { acts: [
        a('resource_mark_remove', { id: 'hamo_scale_無色', side: 'self', scope: 'elf' }),
        a('resource_mark_remove', { id: 'hamo_scale_藍色', side: 'self', scope: 'elf' }),
        a('resource_mark_remove', { id: 'hamo_scale_紅色', side: 'self', scope: 'elf' }),
        a('resource_mark_remove', { id: 'hamo_scale_綠色', side: 'self', scope: 'elf' }),
      ] },
    ], 8),
  ],
};
