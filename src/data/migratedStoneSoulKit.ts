import type {KitEntry,Node} from '../effects/effectSystem.schema';
import {action as a} from './reviewedSequenceSkillKits';
const e=(node:Node,trig:string,raw:string,acts:any[],order:number):KitEntry=>({codeId:'effect_sequence',source:'soulmark',role:'innate',node,order,customText:raw,params:{clause:{raw,trig,parsed:true,body:[{acts}]}}});
export const MIGRATED_STONE_SOUL_KIT={kind:'soul' as const,elfIds:['5026'],name:'專屬特性',
 description:'自身使用攻擊技能後：\n> 令對手2回合內屬性技能無效\n> 自身恢復造成傷害100%的體力值\n> 2回合內自身免疫控制類異常狀態\n> 附加對手已損失體力50%的百分比傷害\n> 恢復自身所有技能2點PP值\n對手受到技能傷害時：\n> 若背包內每有一隻精靈體力不為滿，則自身下次攻擊技能威力額外提升25%',
 kit:[
  e('after_action','self_after_attack','令對手2回合內屬性技能無效',[a('invalid_turns',{kind:'屬性',turns:2})],0),
  e('after_action','self_after_attack','自身恢復造成傷害100%的體力值',[a('heal_main_settled',{ratio:1})],1),
  e('after_action','self_after_attack','2回合內自身免疫控制類異常狀態',[a('immune_status_turns',{turns:2,cls:'控制類',reflect:false})],2),
  e('after_action','self_after_attack','附加對手已損失體力50%的百分比傷害',[a('dmg',{base:'已損失體力',of:'opp',ratio:.5,type:'百分比'})],3),
  e('after_action','self_after_attack','恢復自身所有技能2點PP值',[a('pp_op',{side:'self',mode:'add',amount:2})],4),
  e('on_opponent_damaged','opp_damaged_skill','若背包內每有一隻精靈體力不為滿，則自身下次攻擊技能威力額外提升25%',[a('next_power_nonfull',{perElf:.25,scope:'team',aliveOnly:false})],5),
 ]};
