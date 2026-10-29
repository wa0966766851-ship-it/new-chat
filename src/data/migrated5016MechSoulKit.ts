// 5016 變革·馬爾修斯 魂印「械」真 Kit（DSH 20261019 第二十六批，最後一份 legacyWrapped）。
// 舊 handler：mars/registry.ts 的充能讀取端保留；本 Kit 以通用 op 表達三機甲狀態機與充能效果。
// 充能值＝skill.charge（引擎既有欄位，PP 的替代）；機甲組合以 registry 鍵 mechCombo 記錄。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import mechText from './mechSoulText.json';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const e = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });
const whenFifth=(entry:KitEntry)=>{entry.params.clause.cond=[c('skill_fifth',{})];return entry;};
const switchCombination=()=>({cond:[c('player_state',{key:'mechCombo',equals:'極速'})],acts:[a('mech_combo_switch',{from:'極速',to:'毀滅'})],elseActs:[a('mech_combo_switch',{from:'毀滅',to:'極速'})]});
const observer=(entry:KitEntry)=>{entry.params.clause.observer={includeDead:false};return entry;};

export const MIGRATED_5016_MECH_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5016'],
  name: '械',
  description: mechText.soul,
  kit: [
    // 戰鬥開始：PP 值改為充能值（等量轉換；此後充能值無視 PP 上限，最低 0）。
    // 引擎既有 skill.charge 欄位承擔讀取端（skillResourceView／legalActions 皆讀 charge ?? pp），
    // 精靈資料的 skill.charge 已由資料層提供初值，此處不再以 charge_add 疊加（避免非正數）。
    e('battle_start', 'battle_start', '戰鬥開始時令自身技能中的PP值改為充能值且戰鬥中始終視為PP值為滿且為可選狀態', [
      { acts: [a('pp_unlimited_until_switch', {})] },
    ], 0),
    observer(e('battle_start','team_battle_start','記錄原始技能PP上限與場下體力消耗支援規則',[
      {acts:[a('charge_limits_snapshot',{key:'originalChargeLimits',slots:5}),a('bench_health_consume_guard',{ratio:0.15,cost:1})]},
    ],105)),
    observer(e('round_end','team_round_end','場下對手實際先制較高時恢復末位不足充能，並封鎖對手下回合正先制',[
      {acts:[a('bench_priority_recharge',{key:'originalChargeLimits',slots:5})]},
      {chain:'success',acts:[a('no_pos_prio_turns',{turns:1,next:true})]},
    ],106)),
    observer(e('before_status_apply','team_before_status','極速後出手執行控制異常效果時記錄該異常',[
      {cond:[c('player_state',{key:'mechCombo',equals:'極速'})],acts:[a('archive_outgoing_control',{key:'mechArchivedStatuses'})]},
    ],107)),
    // 登場：啟動堅壁機甲並與極速機甲組合
    e('on_entered', 'entrance', '登場時：啟動堅壁機甲並與極速機甲組合', [
      { acts: [a('mech_combo', { mech: '極速' })] },
    ], 1),
    e('on_skill_selected', 'skill_selected', '每次選擇使用第五技能時吸取對手最大體力⅓；記錄本回合選招', [
      {acts:[a('flag_set',{key:'selectedFifthThisRound',value:false}),a('flag_set',{key:'selectedFifthInvalid',value:false})]},
      {cond:[c('skill_fifth',{})],acts:[a('flag_set',{key:'selectedFifthThisRound',value:true}),a('drain',{ratio:1/3})]},
    ], 2),
    whenFifth(e('after_action','self_after_skill','使用第五技能後切換極速與毀滅組合',[
      switchCombination(),
    ],100)),
    whenFifth(e('on_invalid','self_invalid','第五技能使用失敗收尾切換；實際無效時記錄超頻條件',[
      {cond:[c('skill_invalid',{})],acts:[a('flag_set',{key:'selectedFifthInvalid',value:true})]},
      switchCombination(),
    ],101)),
    // 戰鬥階段結束：未選第五技能或第五技能無效 → 記錄「下回合攻擊時充能超頻」旗標
    // （原文時點是「下回合使用攻擊技能時」才消耗，不是階段結束立刻結算）
    e('battle_phase_end', 'phase_end', '戰鬥階段結束時：若自身本回合未選擇第五技能或第五技能無效，下回合使用攻擊技能時消耗該技能所有充能值、汲取對手等同於15倍消耗值的體力值、當回合攻擊技能造成傷害提升150%', [
      { acts: [a('flag_set', { key: 'marsEndTurnChargeStrike', value: true })] },
      {cond:[c('player_state',{key:'selectedFifthThisRound',equals:true,fallback:false}),c('player_state',{key:'selectedFifthInvalid',equals:false,fallback:false})],acts:[a('flag_set',{key:'marsEndTurnChargeStrike',value:false})]},
    ], 3),
    // 下回合使用攻擊技能時才實際消耗充能＋汲取＋增傷
    // 「下回合」＝下一回合才生效：以 1 回合的回合開始觸發器承載（本回合不消耗）。
    e('before_action', 'before_action', '下回合使用攻擊技能時消耗該技能所有充能值、汲取對手等同於15倍消耗值的體力值、當回合攻擊技能造成傷害提升150%', [
      { cond: [c('player_state', { key: 'marsEndTurnChargeStrike', equals: true, fallback: false }, '充能超頻已就緒')], acts: [
        a('charge_consume_all_to_damage', { perUnit: 15, boostRatio: 1.5 }),
        a('flag_set', { key: 'marsEndTurnChargeStrike', value: false }),
      ] },
    ], 5),
    // 堅壁機甲：馬爾修斯在場時每回合首次受異常→解析並記錄免疫至戰鬥結束
    e('before_status_apply', 'before_status', '堅壁機甲：己方馬爾修斯在場期間令其每回合首次受到異常狀態時解析、開始免疫並記錄該異常狀態直到戰鬥結束時', [
      { acts: [a('archive_status_until_battle_end', {})] },
    ], 4),
    // 堅壁機甲：回合開始附加⅓護盾護罩；存在時首次受非真實傷害減半1次
    e('round_start', 'round_start', '堅壁機甲：回合開始時附加等同於自身最大體力⅓的護盾與護罩且護盾與護罩存在時自身首次受到的非真實傷害減半1次', [
      { acts: [
        a('shield', { ratio: 1 / 3, kind: 'shield' }),
        a('shield', { ratio: 1 / 3, kind: 'barrier' }),
        a('watch',{key:'heldResourceEarlyRecovery',trig:'held_resource_lost',text:'盾罩消失提前回復',body:[{acts:[a('heal_then',{side:'self',ratio:1/3,body:[{acts:[a('dmg_from_last',{ratio:1,type:'百分比'})]}]})]}]}),
      ] },
    ], 6),
    e('before_damage','incoming','護盾與護罩同時存在時，每回合首次受到的非真實傷害減半1次',[
      {acts:[a('damage_reduce_first',{id:'wall_guard',ratio:0.5,types:['non_true'],resources:['shield','barrier']})]},
    ],102),
    // 堅壁機甲：回合結束恢復⅓並附加等量百分比傷害
    e('round_end', 'round_end', '堅壁機甲：回合結束時恢復自身最大體力的⅓並附加對手等量百分比傷害，若護盾護罩消失時則額外提前觸發1次（回合結束時可再次觸發）', [
      { acts: [
        a('heal_then', { side: 'self', ratio: 1 / 3,body:[{acts:[a('dmg_from_last',{ratio:1,type:'百分比'})]}] }),
      ] },
    ], 7),
    // 堅壁機甲：每回合結束「每存在1種異常紀錄」才恢復1點充能（無紀錄則不恢復）
    observer(e('round_end', 'team_round_end', '堅壁機甲：每回合結束時每存在1種異常紀錄則為馬爾修斯恢復1點充能值', [
      {acts:[a('archived_status_charge',{})]},
    ], 8)),
    observer(e('before_status_apply','team_before_status','自身不在場時己方在場精靈免疫所有已解析記錄的異常',[
      {acts:[a('archived_status_guard',{})]},
    ],103)),
    // 極速機甲：馬爾修斯在場時回合開始附加所有技能先制+2
    e('modify_priority', 'modify_priority', '極速機甲：己方馬爾修斯在場期間使用所有技能時先制額外+2', [
      { cond:[c('player_state',{key:'mechCombo',equals:'極速'})],acts: [a('prio_bonus', { v: 2 }),a('priority_tie_role',{role:'challenged'})] },
    ], 9),
    // 極速機甲：先出手時對手全屬性-1（速度提升時翻倍）
    e('before_damage', 'outgoing', '極速機甲：先出手時攻擊傷害結算前使對手全屬性-1，馬爾修斯處於速度能力提升狀態時效果翻倍', [
      { cond: [c('player_state',{key:'mechCombo',equals:'極速'}),c('first_move', {}, '先出手'),c('event_damage_kind',{kind:'攻擊'})], acts: [a('stat', { side: 'opp', stats: ['全屬性'], v: -1,x2If:c('stage_value',{side:'self',stat:'speed',op:'高於',amount:0}) })] },
    ], 10),
    // 極速機甲：後出手則下2回合對手先制失效並令堅壁記錄異常
    e('after_action', 'self_after_skill', '極速機甲：後出手則下2回合對手先制效果失效且執行附加控制類異常效果時令堅壁機甲紀錄該異常', [
      { cond: [c('player_state',{key:'mechCombo',equals:'極速'}),c('first_move', { neg: true }, '後出手')], acts: [
        a('no_pos_prio_turns', { turns: 2,next:true }),
      ] },
    ], 11),
    // 毀滅機甲：馬爾修斯在場時所有攻擊技能威力+100%，每次使用額外+10%（最高170%）
    e('modify_power', 'outgoing_power', '毀滅機甲：馬爾修斯在場期間令其所有攻擊技能威力提升100%，每次使用額外提升10%，最高170%', [
      { cond: [c('player_state', { key: 'mechCombo', equals: '毀滅' }, '與毀滅機甲組合')], acts: [a('power_growth_apply', {key:'destroy_power',baseBoost:1})] },
    ], 12),
    e('before_skill','before_skill','毀滅機甲每次使用攻擊技能，威力增幅額外增加10%，額外最多70%',[
      {cond:[c('player_state',{key:'mechCombo',equals:'毀滅'}),c('skill_kind',{kind:'攻擊'})],acts:[a('power_growth_add',{key:'destroy_power',step:0.1,cap:0.7})]},
    ],104),
    // 毀滅機甲：出手後對手體力低於30%→消耗所有體力與1點充能提升自身能力30%
    e('after_action', 'self_after_skill', '毀滅機甲：每次出手後若對手體力低於30%則消耗對手所有體力與該技能1點充能值以提升自身所有能力值30%', [
      { cond: [c('player_state', { key: 'mechCombo', equals: '毀滅' }, '與毀滅機甲組合'), c('hp_ratio', { side: 'opp', op: '低於', ratio: 0.3 }, '對手體力低於30%'),c('alive',{side:'opp'}),c('selected_charge',{side:'self',op:'不小於',amount:1})], acts: [
        a('consume_opponent_skill_charge', { count: 1 }),
        a('consume_current_health',{side:'opp'}),
        a('stat_points_scale', { side: 'self', ratio: 1.3, stats: ['atk','def','spatk','spdef','speed'] }),
      ] },
    ], 13),
    // 毀滅機甲：出手後對手體力高於30%→消耗1點充能附加30%百分比傷害並恢復等量
    e('after_action', 'self_after_skill', '毀滅機甲：每次出手後若對手體力高於30%則消耗該技能1點充能值以附加對手最大體力30%的百分比傷害並恢復自身等量體力', [
      { cond: [c('player_state', { key: 'mechCombo', equals: '毀滅' }, '與毀滅機甲組合'), c('hp_ratio', { side: 'opp', op: '高於', ratio: 0.3 }, '對手體力高於30%'),c('selected_charge',{side:'self',op:'不小於',amount:1})], acts: [
        a('consume_opponent_skill_charge', { count: 1 }),
        a('drain',{ratio:0.3}),
      ] },
    ], 14),
  ],
};
