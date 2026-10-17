import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a,property,sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
const c=(name:string,p:any)=>({c:name,p,label:name});
const innate=(raw:string,acts:any[],order:number):KitEntry=>({...sequence(raw,[{acts}],order),role:'innate'});
export const MIGRATED_QUERY_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5002'],name:'盾碎同歸',description:'■ 必中\n■ 先制+1\n🎯 消耗自身全部護盾值，每消耗100點護盾值令對手隨機1個技能PP歸零\n🎯 消耗護盾值為0時自身全屬性+2且下回合先制+3',kit:[
    property('■ 必中','sure_hit',true,0),property('■ 先制+1','base_priority',1,1),
    sequence('🎯 消耗自身全部護盾值，每消耗100點護盾值令對手隨機1個技能PP歸零',[{acts:[a('consume_shield',{}),a('pp_zero_from_last',{unit:100})]},
      {cond:[c('last_amount',{op:'低於',amount:1})],acts:[a('stat',{side:'self',stats:['全屬性'],v:2}),a('prio_turns',{turns:1,v:3})]},
    ],2),
  ],
},{
  elfIds:['5016'],name:'革新已至',description:'■ 先制+3\n■ 無視對手免疫攻擊效果\n🎯 無效對手下次攻擊技能\n🎯 吸取對手能力提升狀態，吸取成功則下2回合對手受到攻擊時必定為致命一擊\n🎯 吸取對手當前體力1/4，PP值為滿時吸取效果翻倍',kit:[
    property('■ 先制+3','base_priority',3,0),innate('■ 無視對手免疫攻擊效果',[a('ignore',{what:'攻擊免疫'})],1),
    sequence('🎯 無效對手下次攻擊技能',[{acts:[a('invalid_next',{uses:1,kind:'攻擊'})]}],2),
    sequence('🎯 吸取對手能力提升狀態，吸取成功則下2回合對手受到攻擊時必定為致命一擊',[{acts:[a('stat_steal',{mode:'吸取'})]},{chain:'success',acts:[a('crit_received_turns',{turns:2,next:true})]}],3),
    sequence('🎯 吸取對手當前體力1/4，PP值為滿時吸取效果翻倍',[{acts:[a('drain',{cur:true,ratioCur:.25,true:false,x2If:c('pp_full',{})})]}],4),
  ],
},{
  elfIds:['5010'],name:'星光·隨風逐浪',description:'■ 必中\n🎯 全屬性+1，自身當前體力高於最大體力的1/2時強化效果翻倍\n🎯 下2回合自身造成的攻擊傷害翻倍\n🎯 下2回合攻擊忽略對手25%的雙防值\n🎯 下2回合若自身選擇使用技能則無視對手能力提升狀態',kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 全屬性+1，自身當前體力高於最大體力的1/2時強化效果翻倍',[{acts:[a('stat',{side:'self',stats:['全屬性'],v:1,x2If:c('hp_ratio',{side:'self',op:'高於',ratio:.5})})]}],1),
    sequence('🎯 下2回合自身造成的攻擊傷害翻倍',[{acts:[a('damage_multiplier_turns',{side:'self',dir:'out',kind:'攻擊',mult:2,turns:2,next:true})]}],2),
    sequence('🎯 下2回合攻擊忽略對手25%的雙防值',[{acts:[a('ignore_def_turns',{turns:2,ratio:.25,stat:'雙防',next:true})]}],3),
    sequence('🎯 下2回合若自身選擇使用技能則無視對手能力提升狀態',[{acts:[a('timed',{turns:2,from:'next',trig:'self_skill',body:[{acts:[a('ignore',{what:'能力提升'})]}]})]}],4),
  ],
},{
  elfIds:['arena_15'],name:'九轉輪迴天',description:'■ 必中\n■ 自身處於能力下降狀態時先制 +3\n🎯 反轉自身能力下降；反轉成功時令對手 2 回合內屬性技能無效\n🎯 對手每處於 1 種能力下降，隨機附加 1 種非附屬類異常狀態\n■ 自身處於能力提升狀態時必定造成致命一擊',kit:[
    property('■ 必中','sure_hit',true,0),
    {...property('■ 自身處於能力下降狀態時先制 +3','base_priority',3,1),params:{property:'base_priority',value:3,conditions:[c('stage',{side:'self',kind:'down'})]}},
    sequence('🎯 反轉自身能力下降；反轉成功時令對手 2 回合內屬性技能無效',[{acts:[a('stat_reverse',{side:'self',kind:'down'})]},{chain:'success',acts:[a('invalid_turns',{turns:2,kind:'屬性'})]}],2),
    sequence('🎯 對手每處於 1 種能力下降，隨機附加 1 種非附屬類異常狀態',[{acts:[a('status_random',{count:1,cls:'非附屬類',per:'opp_down_kinds'})]}],3),
    {...sequence('■ 自身處於能力提升狀態時必定造成致命一擊',[{live:true,cond:[c('stage',{side:'self',kind:'up'})],acts:[a('crit_now',{})]}],4),role:'innate'},
  ],
}];
