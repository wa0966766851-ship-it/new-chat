import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';
import {MIGRATED_FINAL_C_TRAIT_KITS} from './migratedFinalCKits';
import {MIGRATED_REY_TRAIT_KITS} from './migratedReyKits';
import {OTHERWORLD_REY_TEXT} from './otherworldReyDescriptions';
const entry=(node:KitEntry['node'],trig:string,raw:string,body:any[],order:number):KitEntry=>({codeId:'effect_sequence',source:'mechanic',role:'innate',node,order,customText:raw,params:{clause:{raw,trig,parsed:true,body}}});
export const MIGRATED_TRAIT_KITS=[...MIGRATED_FINAL_C_TRAIT_KITS,...MIGRATED_REY_TRAIT_KITS,{
  kind:'trait' as const,elfIds:['5022','5023','5026'],name:'無序星魂使徒',description:'對異能精靈造成傷害翻倍且擊敗後令其消逝',kit:[
    entry('before_damage','outgoing','對異能精靈造成傷害翻倍',[{cond:[{c:'alien',p:{side:'opp'},label:'對手為異能精靈'}],acts:[a('damage_scale',{kind:'',mult:2})]}],0),
    entry('on_kill','kill','擊敗異能精靈後令其消逝',[{cond:[{c:'defeated_alien',p:{},label:'本次被擊敗者為異能精靈'}],acts:[a('vanish_defeated',{})]}],1),
  ],
},{
  kind:'trait' as const,elfIds:['5029'],name:'電氣纏繞',description:OTHERWORLD_REY_TEXT.gen2,kit:[
    entry('modify_power','outgoing_power','攻擊威力提升70%。',[{acts:[a('power_mod',{boost:.7})]}],0),
    entry('after_action','self_after_skill','使用技能後令對手進入麻痺狀態。',[{acts:[a('status',{side:'opp',status:'麻痺',turns:3,chance:100})]}],1),
    entry('modify_power','incoming_power','對手使用攻擊技能時令對手最終攻擊/特攻值變為面板原始值的70%。',[{acts:[a('incoming_panel_attack',{ratio:.7})]}],2),
  ],
}];
