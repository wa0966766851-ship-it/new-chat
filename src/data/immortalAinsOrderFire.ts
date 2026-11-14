import {action as a} from './reviewedSequenceSkillKits';
import {IMMORTAL_AINS_SOURCE} from './immortalAinsSource';

export const ORDER_FIRE_ID='orderFire';
export const ORDER_FIRE_DESCRIPTION=IMMORTAL_AINS_SOURCE.split(/\r?\n/).find(line=>line.startsWith('秩序之火:'))!.slice('秩序之火:'.length);
/** 規則隨印記保存，由持有者事件執行；不靠場上精靈名稱猜測。 */
export const grantOrderFire=()=>a('mark_program',{
 id:ORDER_FIRE_ID,name:'秩序之火',description:ORDER_FIRE_DESCRIPTION,displayChar:'火',unit:'道',
 side:'opp',scope:'elf',mode:'add',count:1,maxCount:3,persistsOffField:true,bindSource:true,
 incomingDamageLimitDisabled:true,incomingEffectChanceGuaranteed:true,
 rules:[
  {raw:'每有1道則自身受到攻擊時對手觸發1次諸邪皆伏效果(隨機附加200~400固定傷害)',trig:'damaged_attack',parsed:true,
   body:[{acts:[a('random_damage',{side:'self',source:'opp',min:200,max:400,type:'固定',perStack:true})]}]},
  {raw:'艾恩斯在場時額外將自身受到的非真實傷害恢復給艾恩斯',trig:'damaged_nontrue',parsed:true,
   body:[{acts:[a('heal_mark_source',{ratio:1,activeOnly:true})]}]},
 ],
});
