import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action as a,property,sequence} from './reviewedSequenceSkillKits';
const raw='■ 對手處於能力下降狀態時先制+1且必定命中';
const conditional=(kind:'base_priority'|'sure_hit',value:number|boolean,order:number)=>{
  const entry=property(raw,kind,value,order);entry.params.conditions=[{c:'stage',p:{side:'opp',kind:'down'},label:'對手處於能力下降'}];return entry;
};
export const MIGRATED_CLEARED_REACTION_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5013'],name:'蒼白冥步',
  description:'■ 先制+3\n'+raw+'\n🎯 消除對手回合類效果，消除成功則令對手所有屬性技能PP值歸0\n🎯 3回合內自身100%閃避對手所有攻擊，對手命中後則令對手隨機2個PP值不為0的技能歸0\n🎯 3回合內自身回合類效果被消除則令敵我雙方同時進入凝滯狀態',
  kit:[
    property('■ 先制+3','base_priority',3,0),conditional('base_priority',1,1),conditional('sure_hit',true,2),
    sequence('🎯 消除對手回合類效果，消除成功則令對手所有屬性技能PP值歸0',[
      {acts:[a('clear_turn',{side:'opp'})]},
      {chain:'success',acts:[a('pp_zero',{kind:'屬性'})]},
    ],3),
    sequence('🎯 3回合內自身100%閃避對手所有攻擊，對手命中後則令對手隨機2個PP值不為0的技能歸0',[
      {acts:[a('evade_turns',{turns:3,chance:100,kind:'攻擊'}),a('timed',{turns:3,from:'now',trig:'opp_after_attack',body:[{cond:[{c:'event_hit',p:{},label:'本次攻擊命中'}],acts:[a('pp_zero_random',{count:2})]}]})]},
    ],4),
    sequence('🎯 3回合內自身回合類效果被消除則令敵我雙方同時進入凝滯狀態',[
      {acts:[a('timed',{turns:3,from:'now',trig:'turn_effects_cleared',body:[{acts:[a('status',{side:'both',status:'凝滯',chance:100})]}]})]},
    ],5),
  ],
}];
