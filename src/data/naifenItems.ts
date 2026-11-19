import type {BattleItem} from '../types';
import type {KitEntry} from '../effects/effectSystem.schema';
import {NAIFEN_SOURCE} from './naifenSource';
export const NAIFEN_GRASS_ID='naifen_bell_grass';
export const NAIFEN_ELF_ID='5045';
export const NAIFEN_FORM_IDS=['hook','circle','windmill','bow','triangle','moon','star'].map(shape=>`naifen_bell_${shape}`);
const operation=(op:string,p:any)=>({op,p,label:op});
const text=NAIFEN_SOURCE.slice(NAIFEN_SOURCE.indexOf('搖晃的鈴鐺草:\r\n'),NAIFEN_SOURCE.indexOf('【七種形狀'));
const useText=text.slice(text.indexOf('>使用時')).trim();
const entry=(raw:string,trig:string,node:KitEntry['node'],body:any[],source:KitEntry['source']='soulmark'):KitEntry=>({codeId:'effect_sequence',node,source,role:'innate',order:0,customText:raw,params:{clause:{raw,trig,parsed:true,body}}});
const use=()=>[entry(useText,'use','on_skill_use',[{acts:[operation('potion_penalty',{amount:500,pp:2,opponentId:NAIFEN_ELF_ID,mult:1.15,restoreRatio:2})]}],'skill')];
export const NAIFEN_GRASS:BattleItem={id:NAIFEN_GRASS_ID,name:'搖晃的鈴鐺草',description:text.trim(),type:'special',grantOnly:true,holdLimit:7,potionBacklashWhileHeld:true,backlashRestore:{elfId:NAIFEN_ELF_ID,ratio:2},
 heldKit:[entry(text.slice(text.indexOf('>>持有方造成偶數'),text.indexOf('>每次使用藥劑')).trim(),'opp_damage_settled','on_opponent_settlement',[{acts:[operation('damage_parity_next',{evenBoost:2,oddMultiplier:1/3})]}])],
 useKit:{normal:use(),backlash:use()},
};
const shapeNames=['鉤形鈴鐺草','圓形鈴鐺草','風車形鈴鐺草','蝴蝶結形鈴鐺草','三角形鈴鐺草','月形鈴鐺草','星形鈴鐺草'];
const shapeText=(i:number)=>{const start=NAIFEN_SOURCE.indexOf(`${i+1}. ${shapeNames[i]}`),end=i===6?NAIFEN_SOURCE.indexOf('【統稱】'):NAIFEN_SOURCE.indexOf(`${i+2}. ${shapeNames[i+1]}`);return NAIFEN_SOURCE.slice(start,end).trim();};
const modifiers:NonNullable<BattleItem['heldModifiers']>[]=[
 {maxHpIncreaseDisabled:true},
 {recovery:{reduction:.25,abnormalMultiplier:2,opponentTrueRatio:.25}},
 {},
 {incomingIncrease:.3,incomingSpecialSkillIncrease:1.5},
 {reductionDisabled:true,selectedSpecialSkillMultiplier:.5},
 {incomingLimitDisabled:true},
 {deathFloorRatio:.3},
];
const hook=entry(shapeText(0),'battle_node','battle_node',[
 {cond:[{c:'stage',p:{side:'self',kind:'up'},label:'處於能力提升'}],acts:[operation('settlement_flow',{body:[
  {acts:[operation('status',{side:'self',status:'沉睡',turns:3,chance:100})]},
  {chain:'fail',acts:[operation('prio_next',{v:-2,uses:1}),operation('timed_uses',{uses:1,trig:'self_skill',body:[{acts:[operation('status',{side:'self',status:'睡眠',turns:3,chance:100})]}]})]},
 ]})]},
]);
const windmill=entry(shapeText(2),'opp_after_skill','opponent_after_action',[{acts:[operation('opponent_drain',{ratio:1/4})]}]);
/** 每種形態仍保留普通草效果；普通草上限7與七種各1的形態上限分別計。 */
export const NAIFEN_FORMS:BattleItem[]=shapeNames.map((name,i)=>({...NAIFEN_GRASS,id:NAIFEN_FORM_IDS[i],name:`極樂·${name}`,description:[text.trim(),shapeText(i)].join('\n'),holdLimit:1,inventoryGroup:{id:'naifen_bell_forms',limit:7},heldModifiers:modifiers[i],
 heldKit:[...NAIFEN_GRASS.heldKit!,...(i===0?[hook]:i===2?[windmill]:[])],
}));
