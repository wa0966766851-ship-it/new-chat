// 瀾：原文為展示來源，條款以可編輯積木執行；不呼叫整段舊 handler。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';
import lanText from './lanSoulText.json';
const c=(id:string,p:any)=>({c:id,p,label:id});
const e=(node:KitEntry['node'],trig:string,raw:string,body:any[],order:number,repeatable=false):KitEntry=>({
 codeId:'effect_sequence',source:'soulmark',role:'innate',node,order,customText:raw,
 params:{clause:{raw,trig,parsed:true,body,...(repeatable?{repeatable:true}:{})}}});
const water='blk_永恆之水',tears='blk_千秋一淚';
const mark=(side:'self'|'opp',id:string,name:string,maxCount:number)=>a('resource_mark_add',{id,name,description:name,displayChar:side==='self'?'水':'淚',unit:'道',side,scope:'elf',persistsOffField:true,amount:1,maxCount});
const addWater=()=>mark('self',water,'永恆之水',8),addTear=()=>mark('opp',tears,'千秋一淚',4);
const anyShield=c('field_shield',{absent:false});
const anyUnshielded=c('field_shield',{absent:true});
export const MIGRATED_5028_LAN_SOUL_KIT={kind:'soul' as const,elfIds:['5028'],name:'瀾',description:lanText.soul,kit:[
 e('battle_start','battle_start','雙方護盾值每次發生變化時：每達到100則附加給1道對手千秋一淚',[{acts:[a('shield_change_mark',{perStep:100,markId:tears,markName:'千秋一淚',displayChar:'淚',maxCount:4,side:'opp'})]}],0),
 e('on_entered','entrance','登場時：為自身附加600點護盾；若登場前場上精靈存在護盾則額外複製雙方護盾總和並附加給自身',[{acts:[a('shield_entry_copy',{flat:600})]}],1),
 e('round_start','round_start','場上精靈中存在擁有護盾者則當回合自身所有技能先制+1',[{cond:[anyShield],acts:[a('prio_turns',{v:1,turns:1,current:true})]}],2),
 e('round_start','round_start','雙方每存在100點護盾則直到下回合結束時每次受到固定傷害、百分比傷害額外減半一次且減半後傷害無法超過雙方當前護盾值總和的1/3（下場後保留）',[{acts:[a('shield_guard_snapshot',{step:100,turns:2,capRatio:1/3})]}],3),
 e('on_skill_use','self_attack','自身使用攻擊技能時：附加給自身1道永恆之水；若場上存在擁有護盾者則額外附加給自身1道永恆之水',[{acts:[addWater()]},{cond:[anyShield],acts:[addWater()]}],4),
 e('after_action','self_after_skill','場上存在不擁有護盾者則自身使用技能不受PP值限制、不消耗技能PP值且當回合技能使用後附加給對手1道千秋一淚',[{cond:[anyUnshielded],acts:[addTear()]}],5),
 e('before_damage','incoming','自身受到技能傷害時：受到技能傷害減半',[{acts:[a('dmg_mod',{dir:'in',kind:'技能',reduce:.5})]}],6),
 e('on_damaged','damaged_skill','每次受到技能傷害後恢復自身最大體力1/3並使自身抵擋下次受到的技能傷害',[{acts:[a('heal',{side:'self',ratio:1/3}),a('block_damage_uses',{uses:1,kind:'技能',key:'receivedSkillDamage'})]}],7),
 e('round_end','round_end','回合結束時若自身未受到技能傷害：吸取對手最大體力1/3；下回合開始時解除自身所處的異常狀態',[{cond:[c('no_skill_dmg',{kind:'技能'})],acts:[a('drain',{ratio:1/3}),a('timed',{turns:1,from:'next',trig:'round_start',once:true,body:[{acts:[a('cure_status',{side:'self'})]}]})]}],8),
 e('before_damage','outgoing','永恆之水：每有1道則造成攻擊傷害提升40%',[{acts:[a('resource_damage_modifier',{id:water,dir:'out',kind:'攻擊',perUnit:.4})]}],9),
 e('self_fatal','fatal','永恆之水：每存在2道時若對方存在1道千秋一淚則死亡時消耗對應的道數令自身重生並解除所有異常狀態',[{acts:[a('mark_pair_rebirth',{selfId:water,selfCost:2,oppId:tears,oppCost:1,ratio:1})]}],10,true),
]};
