import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a,property,sequence } from './reviewedSequenceSkillKits';
const description='■ 先制-6\n■ 無視對手抵擋傷害效果\n■ 無視對手傷害限制效果\n🎯 將本次所受的技能傷害2倍以造成技能傷害不小於本次所受的技能傷害2倍形式反饋給對手';
export const MIGRATED_REFLECTION_SKILL_KITS:ReviewedSequenceSkill[]=[
  {elfIds:['300','5000'],name:'能量',description,kit:makeKit()},
  {elfIds:['5010'],name:'克制',description,kit:makeKit()},
  {elfIds:['5024'],name:'無盡入侵',description:'下2回合對手受到的傷害提高150%；5回合內免疫並反彈異常狀態；2回合內反彈對手致命一擊的傷害；2回合內受到的傷害不超過260',kit:[
    sequence('下2回合對手受到的傷害提高150%',[{acts:[a('dmg_mod_turns',{side:'opp',turns:2,next:true,dir:'taken',kind:'攻擊',boost:1.5})]}],0),
    sequence('5回合內免疫並反彈異常狀態',[{acts:[a('immune_status_turns',{turns:5,reflect:true,cls:''})]}],1),
    sequence('2回合內反彈對手致命一擊的傷害',[{acts:[a('timed',{turns:2,from:'now',trig:'damaged_attack',body:[{cond:[{c:'event_crit',p:{},label:'本次受傷為致命一擊'}],acts:[a('reflect_event_damage',{ratio:1})]}]})]}],2),
    sequence('2回合內受到的傷害不超過260',[{acts:[a('damage_cap_turns',{side:'self',dir:'in',kind:'攻擊',cap:260,turns:2})]}],3),
  ]},
];
function makeKit(){return [
  property('■ 先制-6','base_priority',-6,0),
  {...sequence('■ 無視對手抵擋傷害效果',[{acts:[a('ignore',{what:'抵擋傷害'})]}],1),role:'innate' as const},
  {...sequence('■ 無視對手傷害限制效果',[{acts:[a('ignore',{what:'傷害限制'})]}],2),role:'innate' as const},
  sequence('🎯 將本次所受的技能傷害2倍以造成技能傷害不小於本次所受的技能傷害2倍形式反饋給對手',[
    {acts:[a('reflect_received_skill',{ratio:2,floor:true,ignoreBlock:true,ignoreLimit:true})]},
  ],3),
];}
