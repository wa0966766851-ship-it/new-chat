import {NADOLE_SOURCE} from './nadoleSource';
import {authoredEntry as e,operation as a,actions as act,condition as c} from './authoredKitTools';
const raw=(prefix:string)=>{const s=NADOLE_SOURCE.split(/\r?\n/).find(s=>s.replace(/^>+/,'').startsWith(prefix));if(!s)throw Error(prefix);return s;};
const heal=[act(a('heal',{side:'self',ratio:1/3})),act(a('dmg_equal',{type:'百分比'}))];
export const NADOLE_SOUL_KIT=[
 e(raw('交換雙方'),'round_start',[
  act(a('exchange_types',{record:true})),
  {chain:'success',acts:[a('typed_skill_constraint',{turns:1,forceStab:true,nonMatchingInvalid:true,zeroAfterUse:true}),a('dmg_mod_turns',{dir:'out',kind:'攻擊',boost:1,turns:1})]},
 ],0,'soulmark'),
 e(raw('造成攻擊傷害提升10%'),'outgoing_attack',[act(a('history_attack_boost',{perType:.1}))],1,'soulmark'),
 e(raw('使用攻擊技能後額外'),'self_after_use',[act(a('history_percent_repeat',{ratio:.1}))],2,'soulmark',true,[c('skill_kind',{kind:'攻擊'})]),
 e(raw('令其翻倍'),'incoming_nontrue',[act(a('category_damage_reaction',{category:'fixed',multiplier:2,leaveHp:1,body:[act(a('status',{side:'opp',status:'石化',chance:100})),...heal]}))],3,'soulmark'),
 e(raw('令其減半'),'incoming_nontrue',[act(a('category_damage_reaction',{category:'percent',multiplier:.5,body:[act(a('maxhp',{side:'self',ratio:.1,direction:'increase'})),...heal]}))],4,'soulmark'),
];

