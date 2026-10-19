// 5035 御天龍神·哈莫：逐波／燼世／纏根 三技真 Kit
// （DSH 20261018 第十七批 legacyWrapped 拆解；三技同源＝共用「攻特攻總和＋龍鱗最優屬性＋技能無效重結算」結構）。
// 舊 handler：src/effects/elves/hamo/registry.ts HAMO_SKILLS／HAMO_AFTER_HIT／HAMO_ON_INVALID 中
// 這三技的條目已由對應表移除；正式Kit路徑使用可編輯的固有公式查詢，不借舊轉化層。
// 回合末恢復由攜帶監控記錄實際消除快照，固有前置條件啟用，不借舊專屬旗標。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const formula=(text:string,property:string,value:any,conditions:any[],order:number):KitEntry=>({codeId:'skill_property',source:'skill',role:'innate',node:'before_skill',order,customText:text,params:{property,value,conditions}});
const restoration=(node:KitEntry['node'],trig:string,op:string,colourId?:string):KitEntry=>({codeId:'effect_sequence',source:'skill',role:colourId?'innate':'carried',node,order:2,customText:'■ 對應龍鱗存在時，當回合結束恢復被對手消除的強化、回合類效果',params:{clause:{raw:'當回合被對手消除效果的實際快照與回合末恢復',marker:'■',trig,parsed:true,body:[{...(colourId?{cond:[c('mark_count',{side:'self',id:colourId,op:'不小於',amount:1})]}:{}),acts:[a(op,{key:'elementalRemoval'})]}]}}});

const BASE_COMMON = (colourId: string, colourName: string, elemA: string, elemB: string) => [
  prop('先制+3', 'base_priority', 3, 0),
  prop('必中', 'sure_hit', true, 1),
  formula('■ 攻擊、特攻值總和作為特攻','attack_stat_sum',['atk','spatk'],[],2),
  formula('■ 對應龍鱗存在時採最優屬性','preferred_types',[elemA,elemB],[c('mark_count',{side:'self',id:colourId,op:'不小於',amount:1})],2),
  formula('■ 無對應龍鱗時獲得本系加成','force_stab',true,[c('mark_count',{side:'self',id:colourId,op:'低於',amount:1})],2),
  restoration('on_stat_boost_cleared','stat_boost_cleared','removed_effects_capture'),
  restoration('on_turn_effects_cleared','turn_effects_cleared','removed_effects_capture'),
  restoration('before_skill','before_skill','removed_effects_arm',colourId),
  restoration('round_end','round_end','removed_effects_restore'),
];

const INVALID_CLAUSE = (colourId: string, fallbackStatus: string): KitEntry => {
  const entry=seq('> 技能無效時，重新進行傷害結算且技能威力提升100%、消除對手回合類效果、自身存在對應龍鱗附加對手100%' + fallbackStatus, [
    { acts: [
      a('recalculate_skill', { powerMultiplier: 2 }),
      a('clear_turn', { side: 'opp' }),
    ] },
    { cond: [c('mark_count', { side: 'self', id: colourId, op: '不小於', amount: 1 }, '存在對應龍鱗')], acts: [
      a('status', { side: 'opp', status: fallbackStatus, chance: 100, turns: 3 }),
    ] },
  ], 9);
  entry.node='on_invalid';
  entry.params.clause.trig='self_invalid';
  for(const stmt of entry.params.clause.body)stmt.cond=[c('skill_invalid',{},'技能實際無效'),...(stmt.cond||[])];
  return entry;
};

export const MIGRATED_HAMO_ELEMENTAL_SKILL_KITS: ReviewedSequenceSkill[] = [
  {
    elfIds: ['5035'], name: '逐波',
    description: "■ 先制+3\r\n■ 必中\r\n■ 結算技能傷害時以自身攻擊、特攻值總和作為自身特攻值計算，若自身存在藍色龍鱗，則以水系、龍系中對對手的最優屬性計算傷害且當回合結束時重置自身被對手消除的強化、回合類效果，若自身不擁有藍色龍鱗則獲得水系技能本系加成\r\n🎯 全屬性+1，自身存在藍色龍鱗時強化效果翻倍\r\n🎯 5回合內自身使用技能吸取對手最大體力⅓，自身體力低於最大體力½時效果翻倍\r\n🎯 下2回合自身使用所有技能時先制+3\r\n🎯 命中後100%令對手凍傷，未觸發則對手100%冰封\r\n> 技能無效時，重新進行傷害結算且技能威力提升100%、消除對手回合類效果、自身存在藍色龍鱗附加對手100%冰封",
    kit: [
      ...BASE_COMMON('hamo_scale_藍色', '藍色', '水', '龍'),
      seq('🎯 全屬性+1，自身存在藍色龍鱗時強化效果翻倍', [
        { cond: [c('mark_count', { side: 'self', id: 'hamo_scale_藍色', op: '不小於', amount: 1 }, '存在藍色龍鱗')], acts: [a('stat', { side: 'self', stats: ['全屬性'], v: 2 })] },
        { cond: [c('mark_count', { side: 'self', id: 'hamo_scale_藍色', op: '低於', amount: 1 }, '無藍色龍鱗')], acts: [a('stat', { side: 'self', stats: ['全屬性'], v: 1 })] },
      ], 3),
      seq('🎯 5回合內自身使用技能吸取對手最大體力⅓，自身體力低於最大體力½時效果翻倍', [
        { acts: [a('timed', {turns:5,from:'now',trig:'self_skill',initial:true,label:'逐波使用技能吸取',body:[
          {acts:[a('drain',{ratio:1/3,true:false,x2If:c('hp_ratio',{side:'self',op:'低於',ratio:0.5},'自身體力低於一半')})]},
        ]})] },
      ], 4),
      seq('🎯 下2回合自身使用所有技能時先制+3', [
        { acts: [a('prio_turns', { v: 3, turns: 2, next: true })] },
      ], 5),
      seq('🎯 命中後100%令對手凍傷，未觸發則對手100%冰封', [
        { acts: [a('status', { side: 'opp', status: '凍傷', chance: 100, turns: 3 })] },
        { chain: 'fail', acts: [a('status', { side: 'opp', status: '冰封', chance: 100, turns: 3 })] },
      ], 6),
      INVALID_CLAUSE('hamo_scale_藍色', '冰封'),
    ],
  },
  {
    elfIds: ['5035'], name: '燼世',
    description: "■ 先制+3\r\n■ 必中\r\n■ 結算技能傷害時以自身攻擊、特攻值總和作為自身特攻值計算，若自身存在紅色龍鱗，則以火系、龍系中對對手的最優屬性計算傷害且當回合結束時重置自身被對手消除的強化、回合類效果，若自身不擁有紅色龍鱗則獲得火系技能本系加成\r\n🎯 解除並反饋自身能力下降狀態給對手，任一項觸發失敗則將對手轉化為龍系\r\n🎯 3回合內對手體力恢復量降低100%\r\n🎯 命中後100%令對手燒傷，未觸發則對手100%焚燼\r\n> 技能無效時，重新進行傷害結算且技能威力提升100%、消除對手回合類效果、自身存在紅色龍鱗附加對手100%焚燼",
    kit: [
      ...BASE_COMMON('hamo_scale_紅色', '紅色', '火', '龍'),
      seq('🎯 解除並反饋自身能力下降狀態給對手，任一項觸發失敗則將對手轉化為龍系', [
        { acts: [a('stat_reverse', { side: 'self', kind: 'down' })] },
        { chain: 'fail', acts: [a('change_type', { side: 'opp', type: '龍', untilSwitch: true })] },
      ], 3),
      seq('🎯 3回合內對手體力恢復量降低100%', [
        { acts: [a('no_heal', { turns: 3, scope: 'all' })] },
      ], 4),
      seq('🎯 命中後100%令對手燒傷，未觸發則對手100%焚燼', [
        { acts: [a('status', { side: 'opp', status: '燒傷', chance: 100, turns: 3 })] },
        { chain: 'fail', acts: [a('status', { side: 'opp', status: '焚燼', chance: 100, turns: 3 })] },
      ], 5),
      INVALID_CLAUSE('hamo_scale_紅色', '焚燼'),
    ],
  },
  {
    elfIds: ['5035'], name: '纏根',
    description: "■ 先制+3\r\n■ 必中\r\n■ 結算技能傷害時以自身攻擊、特攻值總和作為自身特攻值計算，若自身存在綠色龍鱗，則以草系、龍系中對對手的最優屬性計算傷害且當回合結束時重置自身被對手消除的強化、回合類效果，若自身不擁有綠色龍鱗則獲得草系技能本系加成\r\n🎯 5回合內自身使用技能時恢復自身最大體力1/1並造成等量百分比傷害\r\n🎯 5回合內對手PP值消耗量提升20倍\r\n🎯 3回合內，每回合吸取對手所有技能1點PP值並恢復自身相同位數技能1點PP值，自身PP值損失量高於PP值上限½時效果翻倍\r\n🎯 命中後100%令對手中毒，未觸發則對手100%感染\r\n> 技能無效時，重新進行傷害結算且技能威力提升100%、消除對手回合類效果、自身存在綠色龍鱗附加對手100%感染",
    kit: [
      ...BASE_COMMON('hamo_scale_綠色', '綠色', '草', '龍'),
      seq('🎯 5回合內自身使用技能時恢復自身最大體力1/1並造成等量百分比傷害', [
        { acts: [a('heal_equal_percent_turns', { turns: 5, ratio: 1 })] },
      ], 3),
      seq('🎯 5回合內對手PP值消耗量提升20倍', [
        // 未限定技能種類；攻擊專用的 attackPpMultiplier 欄位不能代替全部技能。
        { acts: [a('pp_cost_mult', { mult: 20, turns: 5 })] },
      ], 4),
      seq('🎯 3回合內，每回合吸取對手所有技能1點PP值並恢復自身相同位數技能1點PP值，自身PP值損失量高於PP值上限½時效果翻倍', [
        { acts: [a('pp_absorb_turns', { turns: 3, amount: 1, doubleWhenLostHalf: true })] },
      ], 5),
      seq('🎯 命中後100%令對手中毒，未觸發則對手100%感染', [
        { acts: [a('status', { side: 'opp', status: '中毒', chance: 100, turns: 3 })] },
        { chain: 'fail', acts: [a('status', { side: 'opp', status: '感染', chance: 100, turns: 3 })] },
      ], 6),
      INVALID_CLAUSE('hamo_scale_綠色', '感染'),
    ],
  },
];
