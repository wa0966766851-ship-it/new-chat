import type { KitEntry, Node } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const entry=(node:Node,trig:string,raw:string,body:any[],order:number):KitEntry=>({
  codeId:'effect_sequence',source:'soulmark',role:'innate',node,order,customText:raw,
  params:{clause:{raw,trig,parsed:true,body}},
});
const c=(name:string,p:any)=>({c:name,p,label:name});
/** 印記以持有者為self、當前對方為opp；程式與限制自帶，原施放者下場不需回查原文。 */
const reactiveMark=(name:string,element:string)=>({
  id:`blk_${name}`,name,displayChar:name==='星芳之纏'?'纏':'灼',
  description:`持有者受到攻擊後追加等量百分比傷害並回復對方；對方為${element}系時解除並追加等量真實傷害。3回合，重新獲取重置。`,
  side:'opp',mode:'set',count:1,maxCount:1,scope:'elf',persistsOffField:false,unit:'層',turns:3,
  rules:[
    ...(name==='星芳之纏'?[{raw:'持有者造成的非真實傷害額外減少50%',trig:'outgoing',parsed:true,
      body:[{acts:[a('dmg_mod',{dir:'out_reduce',kind:'非真實',reduce:.5})]}]}]:[]),
    {raw:`持有者每次受到攻擊傷害後額外受到傷害值100%的百分比傷害，並恢復對方等量體力與1點所有技能PP；若對手為${element}系則解除並追加等量真實傷害，回復等量體力與全部PP`,
      trig:'damaged_attack',parsed:true,body:[
        {acts:[a('dmg_of_event',{ratio:1,type:'百分比',source:'opp'}),a('heal_opp_equal',{}),a('pp_op',{side:'opp',mode:'add',amount:1})]},
        {cond:[c('type_is',{side:'opp',type:element})],acts:[a('mark_remove_current',{}),
          a('dmg_of_event',{ratio:1,type:'真實',source:'opp'}),a('heal_opp_equal',{}),a('pp_op',{side:'opp',mode:'recover'})]},
      ]},
  ],
  ...(name==='星火之灼'?{recoveryReduction:{ratio:1,perStack:false,includePotions:false}}:{}),
});
const fang=reactiveMark('星芳之纏','火'),burn=reactiveMark('星火之灼','水');

/** 完整定義遷移；2026-10-13 起依使用者指示先接線，未授予逐句驗收。 */
export const MIGRATED_MARK_SOUL_KITS=[{
  kind:'soul' as const,elfIds:['5011'],name:'芳',
  description:'每次登場時：\n> 為對手附加3回合的星芳之纏\n自身每次使用攻擊後：\n> 附加3回合的星芳之纏\n回合開始時：\n> 若自身體力高於對手則當回合受到的非真實傷害減少50%\n> 若自身體力低於對手則回合結束後恢復自身最大體力的35%\n星芳之纏：\n> 持有者造成的非真實傷害額外減少50%\n> 持有者每次受到攻擊傷害後額外受到傷害值100%的百分比傷害\n> 並恢復對方在場精靈等量體力與1點所有技能PP值\n> 若對手為火系則星芳之纏消失並額外附加傷害值100%的真實傷害\n> 並恢復對方在場精靈等量體力與所有技能全部PP值\n> 持續3回合，重複獲取時重置為3回合',
  kit:[
    entry('on_entered','entrance','每次登場時為對手附加3回合的星芳之纏',[{acts:[a('mark_program',fang)]}],0),
    entry('after_action','self_after_attack','自身每次使用攻擊後附加3回合的星芳之纏',[{acts:[a('mark_program',fang)]}],1),
    entry('round_start','round_start','回合開始時若自身體力高於對手則當回合受到的非真實傷害減少50%',[
      {cond:[c('hp_cmp',{side:'self',op:'高於'})],acts:[a('dmg_mod_turns',{turns:1,dir:'in',kind:'非真實',reduce:.5})]},
    ],2),
    entry('round_start','round_start','回合開始時若自身體力低於對手則回合結束後恢復自身最大體力的35%',[
      {cond:[c('hp_cmp',{side:'self',op:'低於'})],acts:[a('timed',{turns:1,from:'now',trig:'round_end',
        body:[{acts:[a('heal',{side:'self',ratio:.35})]}]})]},
    ],3),
  ],
},{
  kind:'soul' as const,elfIds:['5006'],name:'灼',
  description:'每次登場時：\n> 為對手附加3回合的星火之灼\n自身每次使用攻擊後：\n> 附加3回合的星火之灼\n自身使用物理/特殊攻擊技能時：\n> 計算傷害時令攻擊、特攻等於原本二者總和\n自身使用物理攻擊後：\n> 恢復自身最大體力的1/3並造成等量百分比傷害\n自身使用特殊攻擊後：\n> 附加自身最大體力1/3的百分比傷害並於附加後恢復自身等同於附加成功量的體力\n每次觸發時：\n> 恢復自身所有技能1點PP值\n星火之灼：\n> 持有者體力恢復效果減少100%\n> 持有者每次受到攻擊傷害後額外受到傷害值100%的百分比傷害\n> 並恢復對方在場精靈等量體力與1點所有技能PP值\n> 若對手為水系則星火之灼消失並額外附加傷害值100%的真實傷害\n> 並恢復對方在場精靈等量體力與所有技能全部PP值\n> 持續3回合，重複獲取時重置為3回合',
  kit:[
    entry('on_entered','entrance','每次登場時為對手附加3回合的星火之灼',[{acts:[a('mark_program',burn)]}],0),
    entry('after_action','self_after_attack','自身每次使用攻擊後附加3回合的星火之灼',[{acts:[a('mark_program',burn)]}],1),
    entry('on_skill_use','self_attack','自身使用物理/特殊攻擊技能時，計算傷害時令攻擊、特攻等於原本二者總和',[
      {acts:[a('atk_sum_calc',{})]},
    ],2),
    entry('after_action','self_after_physical','自身使用物理攻擊後恢復自身最大體力的1/3並造成等量百分比傷害；恢復自身所有技能1點PP值',[
      {acts:[a('heal',{side:'self',ratio:1/3}),a('dmg_equal',{type:'百分比'}),a('pp_op',{side:'self',mode:'add',amount:1})]},
    ],3),
    entry('after_action','self_after_special','自身使用特殊攻擊後附加自身最大體力1/3的百分比傷害，附加後恢復等同於附加成功量的體力；恢復自身所有技能1點PP值',[
      {acts:[a('dmg',{base:'最大體力',of:'self',ratio:1/3,type:'百分比'}),a('heal_equal',{}),a('pp_op',{side:'self',mode:'add',amount:1})]},
    ],4),
  ],
}];
