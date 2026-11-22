import {authoredEntry as e,operation as a,actions as act,condition as c} from './authoredKitTools';
/** 趙雲（5052）專屬特性；只用通用積木（含 blocks/ops/linkedTeam），引擎不含本精靈名稱。
 * 2026-11-21 使用者裁定：
 * - 赤膽：雙方每隻精靈（含背包）各1層，逐隻計算、下場保留。己方持有：受到攻擊／固定／百分比傷害或異常時消耗1層並免疫該次；
 *   對方持有：回合結束時若處於回合類效果或能力提升，消耗1層、消除兩者並令其害怕。
 * - 使用技能時①②：對手與自身同一批隨機3項能力-1，自身再把能力下降換成2倍提升；自身已有能力提升時改為-2，且自身提升等級額外視為對手下降。 */
const soul=(text:string,trig:string,body:any[],order:number,cond:any[]=[])=>e(text,trig,body,order,'soulmark',true,cond);
export const ZY_GALL={id:'zyGall',name:'龍膽',displayChar:'膽',unit:'枚',description:'獲得後到下回合結束時自身免疫異常狀態；最多7枚，達到7枚時開啟龍膽世無雙。',maxCount:7};
const gall={...ZY_GALL,side:'self',scope:'elf',persistsOffField:true};
/** 獲得龍膽：獲得後到下回合結束時免疫異常。 */
export const gainGall=(amount=1)=>[act(a('resource_mark_add',{...gall,amount})),{chain:'success',acts:[a('immune_status_turns',{turns:2})]}];
/** 龍膽世無雙：龍膽達到7枚。 */
export const wushuang=(neg=false)=>c('mark_count',{side:'self',id:'zyGall',op:neg?'低於':'不小於',amount:7});
const TALLY='teamChidanSpent';
const stageUp=(side='self',neg=false)=>c('stage',{side,kind:'up',...(neg?{neg:true}:{})});
const CHIDAN_TEXT='赤膽：己方持有時受到攻擊／固定／百分比傷害或異常狀態時消耗1層並免疫該次；回合結束時消除對手回合類效果與能力提升。對方持有時回合結束若處於回合類效果或能力提升，消耗1層並消除兩者、令其害怕。';
const rule=(raw:string,trig:string,body:any[])=>({raw,trig,parsed:true,body});
const chidan=(own:boolean)=>({team:own?'self':'opp',id:own?'chidanOwn':'chidanFoe',name:'赤膽',displayChar:'赤',unit:'層',scope:'elf',mode:'add',count:1,maxCount:99,persistsOffField:true,description:CHIDAN_TEXT,
 rules:own?[
  rule('受到攻擊／固定／百分比傷害時消耗並免疫','incoming',[act(a('damage_immunity_now',{types:['attack','fixed','percent']})),{chain:'success',acts:[a('mark_consume_current',{amount:1,tallySide:'self',tallyKey:TALLY})]}]),
  rule('受到異常狀態時消耗並免疫','before_status',[act(a('status_immunity_now',{})),{chain:'success',acts:[a('mark_consume_current',{amount:1,tallySide:'self',tallyKey:TALLY})]}]),
  rule('回合結束時消除對手回合類效果與能力提升','round_end',[act(a('clear_turn',{side:'opp'}),a('stat_clear',{side:'opp',kind:'up'}))]),
 ]:[
  rule('回合結束時處於回合類效果：消耗並消除、令其害怕','round_end',[
   {cond:[c('has_turn_effect',{side:'self'})],acts:[a('mark_consume_current',{amount:1,tallySide:'opp',tallyKey:TALLY}),a('clear_turn',{side:'self'}),a('stat_clear',{side:'self',kind:'up'}),a('status',{side:'self',status:'害怕',chance:100})]},
   {cond:[c('has_turn_effect',{side:'self',neg:true}),stageUp('self')],acts:[a('mark_consume_current',{amount:1,tallySide:'opp',tallyKey:TALLY}),a('stat_clear',{side:'self',kind:'up'}),a('status',{side:'self',status:'害怕',chance:100})]},
  ]),
 ]});
const grantChidan=[act(a('mark_program_team',chidan(true)),a('mark_program_team',chidan(false)))];

export const ZHAOYUN_SOUL_KIT=[
 soul('戰鬥開始時為所有精靈附加1層赤膽','battle_start',[...grantChidan,act(a('flag_set',{key:'zyChidanStart',value:true,thisRound:true}))],0),
 // 戰鬥開始即登場時只附加一次（同一時點）。
 soul('自身登場時為所有精靈附加1層赤膽','entrance',[{cond:[c('player_state',{key:'zyChidanStart',equals:true,thisRound:true,neg:true})],acts:grantChidan[0].acts}],1),
 soul('每消耗1枚赤膽，自身登場時獲得1枚龍膽','entrance',[act(a('resource_mark_from_tally',{key:TALLY,...ZY_GALL})),{chain:'success',acts:[a('immune_status_turns',{turns:2})]}],2),
 soul('回合開始時自身不處於能力提升則令對手攻擊技能附加效果失效且自身免疫異常狀態','round_start',[
  {cond:[stageUp('self',true)],acts:[a('add_invalid_turns',{kind:'攻擊',turns:1}),a('immune_status_turns',{turns:1})]},
 ],3),
 soul('自身處於能力提升、能力下降或異常狀態則所有技能先制+3','modify_priority',[
  {cond:[stageUp('self')],acts:[a('prio_bonus',{v:3})]},
  {cond:[stageUp('self',true),c('stage',{side:'self',kind:'down'})],acts:[a('prio_bonus',{v:3})]},
  {cond:[stageUp('self',true),c('stage',{side:'self',kind:'down',neg:true}),c('abnormal',{side:'self'})],acts:[a('prio_bonus',{v:3})]},
 ],4),
 soul('使對手隨機3項能力下降並附加到自己身上；自身處於能力提升時提升等級翻倍且將自身能力提升等級額外視為對手能力下降','self_skill',[
  {pre:true,cond:[stageUp('self')],acts:[a('flag_set',{key:'zyBoostedUse',value:true,thisRound:true}),a('stat_random_shared',{count:3,v:-2})],
   elseActs:[a('flag_set',{key:'zyBoostedUse',value:false,thisRound:true}),a('stat_random_shared',{count:3,v:-1})]},
 ],5),
 soul('自身獲得等同自身能力下降2倍的能力提升','self_skill',[act(a('stage_flip_down',{mult:2}))],6),
 // 2026-11-21 使用者裁定：同一項對同一項——自身某項提升 n 級，計算時對手同一項額外視為 -n（傷害雙向、出手順序、自身效果判定）。
 soul('將自身能力提升等級額外視為對手能力下降','battle_start',[act(a('stage_view_rule',{selfUpAsOppDown:true}))],17),
 soul('使用技能時獲得1枚龍膽','self_skill',gainGall(),7),
 soul('每有1枚龍膽，吸取等同（自身能力提升等級＋對手能力下降等級）×77的體力','self_skill',[
  {cond:[c('player_state',{key:'zyBoostedUse',equals:true,thisRound:true})],acts:[a('drain_stage_levels',{unit:77,terms:['self_up','opp_down','self_up'],perMarkId:'zyGall'})],
   elseActs:[a('drain_stage_levels',{unit:77,terms:['self_up','opp_down'],perMarkId:'zyGall'})]},
 ],8),
 soul('自身處於異常則吸取對手最大體力的1/3','self_skill',[{cond:[c('abnormal',{side:'self'})],acts:[a('drain',{ratio:1/3})]}],9),
 // 龍膽世無雙（龍膽達到7枚）
 soul('龍膽世無雙：自身免疫異常狀態','before_status',[{cond:[wushuang()],acts:[a('status_immunity_now',{})]}],10),
 soul('龍膽世無雙：對手正先制效果失效','round_start',[{cond:[wushuang()],acts:[a('no_pos_prio_turns',{turns:1})]}],11),
 soul('龍膽世無雙：無視對手護盾承傷效果與攻擊免疫效果','self_attack',[{cond:[wushuang()],acts:[a('ignore',{what:'護盾'}),a('ignore',{what:'抵擋傷害'}),a('ignore',{what:'攻擊免疫'})]}],12),
 soul('龍膽世無雙：攻擊傷害提升77%；若PP不為滿則攻擊傷害額外提升77%','outgoing_attack',[
  {cond:[wushuang()],acts:[a('dmg_mod',{dir:'out',kind:'攻擊',boost:.77})]},
  {cond:[wushuang(),c('pp_not_full',{side:'self'})],acts:[a('dmg_mod',{dir:'out',kind:'攻擊',boost:.77})]},
 ],13),
 soul('龍膽世無雙：所有技能不受PP值限制','self_skill',[{cond:[wushuang()],acts:[a('pp_unlimited_until_switch',{})]}],14),
 soul('龍膽世無雙：PP不為滿時恢復至滿；使用攻擊技能額外造成777點光次元傷害','self_after_attack',[
  {cond:[wushuang(),c('pp_not_full',{side:'self'})],acts:[a('pp_op',{side:'self',mode:'recover'})]},
  {cond:[wushuang()],acts:[a('dmg',{flat:777,type:'固定',elem:'光.次元'})]},
 ],15),
 soul('自身下場後每經過1回合減少1枚龍膽並恢復自身及場上精靈177體力','team_round_end',[
  {cond:[c('owner_on_field',{neg:true}),c('mark_count',{side:'self',id:'zyGall',op:'不小於',amount:1})],acts:[
   a('resource_mark_subtract',{id:'zyGall',side:'self',scope:'elf',amount:1}),a('heal_holder_and_active',{amount:177}),
  ]},
 ],16),
];
