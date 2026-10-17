import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const c=(name:string,p:any)=>({c:name,p,label:name});
/** 同一組異常逐項走正式免疫管道；組內至少一項成功才吸取，期限在施加後計算。 */
export const MIGRATED_FAREWELL_SKILL_KITS:ReviewedSequenceSkill[]=[{
 elfIds:['5008'],name:'訣別',description:'■ 必中\n🎯 雙倍吸取對手能力提升狀態，吸取成功則對手下2回合正先制效果失效\n🎯 附加給對手等同於自身能力提升狀態的能力下降狀態，若該效果未滿足條件或未觸發則令對手隨機2項技能PP值歸零\n🎯 技能威力提升35%，對手任意1項技能PP值小於2點則提升效果加倍\n🎯 敵我雙方同時進入混亂、流血狀態，觸發成功則雙方每有1回合異常狀態則吸取對手150點固定體力',kit:[
  property('■ 必中','sure_hit',true,0),
  sequence('雙倍吸取對手能力提升狀態，吸取成功則對手下2回合正先制效果失效',[
   {acts:[a('stat_steal',{mode:'吸取',double:true})]},
   {chain:'success',acts:[a('no_pos_prio_turns',{turns:2,next:true})]},
  ],1),
  sequence('附加給對手等同於自身能力提升狀態的能力下降狀態，未滿足條件或未觸發則隨機2項技能PP歸零',[
   {acts:[a('stat_mirror',{side:'opp',kind:'down',fromKind:'up'})]},
   {chain:'fail',acts:[a('pp_zero_random',{count:2})]},
  ],2),
  sequence('技能威力提升35%，對手任一技能PP小於2點時提升效果加倍',[
   {acts:[a('boost',{mult:1.35,power:true,x2If:c('skill_pp_any',{side:'opp',op:'低於',amount:2})})]},
  ],3),
  sequence('雙方進入混亂、流血狀態，觸發成功時每1回合異常狀態吸取對手150點固定體力',[
   {acts:[a('status_seq',{side:'both',list:['混亂','流血'],turns:3,chance:100})]},
   {chain:'success',acts:[a('drain',{flat:150,perStatusTurns:'both'})]},
  ],4),
 ],
}];
