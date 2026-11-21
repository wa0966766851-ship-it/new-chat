import type {BattleItem} from '../types';
import type {KitEntry} from '../effects/effectSystem.schema';
/** 晻藹夜靈.布萊克／虯螭淵玄.索蘭特 的特殊道具（2026-11-21）。只建立資料，不在共用道具目錄初始化時載入積木執行器。 */
export const SYMBIOSIS_ITEM_ID='symbiosis_cycle';
export const PURE_SHADOW_ITEM_ID='pure_shadow';
export const PURE_SHADOW_ACTIVE_ID='pure_shadow_active';
/** 純粹暗影使用後的激活旗標（陣營層級）。 */
export const PURE_SHADOW_ACTIVE_KEY='teamPureShadowActive';
const a=(op:string,p:any)=>({op,p,label:op});
const c=(id:string,p:any={})=>({c:id,p,label:id});
const held=(text:string,node:string,trig:string,body:any[],order:number):KitEntry=>({codeId:'effect_sequence',node:node as any,source:'soulmark',role:'innate',order,customText:text,params:{clause:{raw:text,trig,parsed:true,body}}});
const use=(text:string,body:any[]):KitEntry=>({codeId:'effect_sequence',node:'on_skill_use',source:'skill',order:0,customText:text,params:{clause:{raw:text,trig:'use',parsed:true,body}}});
const early=c('field_rounds',{op:'不高於',amount:4});
const blakeDark=[c('name_has',{side:'self',names:['布萊克']}),c('type_is',{side:'self',type:'暗影'})];

export const SYMBIOSIS_CYCLE:BattleItem={
 id:SYMBIOSIS_ITEM_ID,name:'共生循環',type:'special',grantOnly:true,holdLimit:1,unusable:true,
 description:'無法被選擇使用的特殊藥劑。戰鬥開始時記錄召喚者與夥伴的能力值；一方被擊敗後，另一方登場首回合回合結束時未被擊敗，即將其召回己方背包末位、恢復所有能力值並重生（每組1次）。',
};
export const PURE_SHADOW:BattleItem={
 id:PURE_SHADOW_ITEM_ID,name:'純粹暗影',type:'special',grantOnly:true,holdLimit:1,
 description:'持有時：己方在場精靈本次在場回合數≤4，所有技能額外吸取對手雙攻值總和80%的體力、使用技能先制+2。使用後變為激活狀態：己方在場布萊克所有技能額外吸取對手雙攻值100%、威力提升150%、造成技能傷害額外附加自身雙攻值總和150%的暗影系技能傷害、先制+2；進入狂暴時轉化為平靜。激活後布萊克下場即消失。',
 heldKit:[
  held('持有時：己方在場精靈本次在場回合數≤4，所有技能額外吸取對手在場精靈雙攻值總和80%的體力','after_action','self_after_skill',[{cond:[early],acts:[a('drain',{base:'stat:攻擊和特攻',of:'opp',ratio:.8})]}],0),
  held('持有時：己方在場精靈本次在場回合數≤4，使用技能額外先制+2且無視對手同等級先制','modify_priority','modify_priority',[{cond:[early],acts:[a('prio_bonus',{v:2}),a('priority_offset_round',{amount:2})]}],1),
 ],
 useKit:{
  normal:[use('使用後變為激活狀態：己方所有布萊克若存在混沌系則將其混沌屬性從當前屬性與所有技能屬性中剝離',[{acts:[
   a('strip_type_team_named',{names:['布萊克'],type:'混沌'}),a('grant_item',{side:'self',itemId:PURE_SHADOW_ACTIVE_ID,count:1}),a('flag_set',{key:PURE_SHADOW_ACTIVE_KEY,value:true}),
  ]}])],
  backlash:[use('藥劑反噬：仍變為激活狀態',[{acts:[
   a('strip_type_team_named',{names:['布萊克'],type:'混沌'}),a('grant_item',{side:'self',itemId:PURE_SHADOW_ACTIVE_ID,count:1}),a('flag_set',{key:PURE_SHADOW_ACTIVE_KEY,value:true}),
  ]}])],
 },
};
/** 純粹暗影（激活）：不可使用；持有期間作用於己方在場且為暗影系的布萊克（任意型態）。布萊克下場後消失。 */
export const PURE_SHADOW_ACTIVE:BattleItem={
 id:PURE_SHADOW_ACTIVE_ID,name:'純粹暗影（激活）',type:'special',grantOnly:true,holdLimit:1,unusable:true,
 description:'己方在場布萊克若為暗影系：所有技能額外吸取對手雙攻值100%、威力提升150%、造成技能傷害額外附加自身雙攻值總和150%的暗影系技能傷害；使用技能先制+2且無視對手同等級先制；進入狂暴時轉化為平靜並獲得專屬特性中處於狂暴的效果。布萊克下場後消失。',
 heldKit:[
  held('激活：在場布萊克若為暗影系所有技能額外吸取對手雙攻值100%，造成的技能傷害額外附加自身雙攻值總和150%的暗影系技能傷害','after_action','self_after_skill',[{cond:blakeDark,acts:[
   a('drain',{base:'stat:攻擊和特攻',of:'opp',ratio:1}),a('dmg',{base:'stat:攻擊和特攻',of:'self',ratio:1.5,type:'固定',elem:'暗影'}),
  ]}],0),
  held('激活：在場布萊克若為暗影系所有技能威力提升150%','modify_power','outgoing_power',[{cond:blakeDark,acts:[a('power_mod',{boost:1.5})]}],1),
  held('激活：在場布萊克若為暗影系本次在場使用技能額外先制+2且無視對手同等級先制','modify_priority','modify_priority',[{cond:blakeDark,acts:[a('prio_bonus',{v:2}),a('priority_offset_round',{amount:2})]}],2),
  held('激活：在場布萊克每次進入狂暴異常則將其轉化為平靜，並獲得專屬特性中處於狂暴的效果（取消所有非附屬類異常的附加效果）','before_status_apply','before_status',[
   {cond:[c('name_has',{side:'self',names:['布萊克']}),c('event_status',{statuses:['狂暴']})],acts:[a('status_replace',{status:'平靜',durationMode:'keep'}),a('status_rules',{whileStatus:'平靜',cancelExceptCategory:'AUXILIARY'})]},
  ],3),
  held('激活狀態下布萊克下場後消失','on_switch_out','switch_out',[{cond:[c('name_has',{side:'self',names:['布萊克']})],acts:[a('item_discard',{side:'self',itemId:PURE_SHADOW_ACTIVE_ID}),a('flag_set',{key:PURE_SHADOW_ACTIVE_KEY,value:false})]}],4),
 ],
};
