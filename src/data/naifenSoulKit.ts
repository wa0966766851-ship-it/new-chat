import {NAIFEN_SOURCE} from './naifenSource';
import {NAIFEN_GRASS_ID,NAIFEN_FORM_IDS} from './naifenItems';
import {authoredEntry as e,operation as a,actions as act,condition as c} from './authoredKitTools';
const lines=NAIFEN_SOURCE.split(/\r?\n/);
const raw=(prefix:string)=>{const i=lines.findIndex(s=>s.replace(/^>+/,'').startsWith(prefix));if(i<0)throw Error(prefix);let j=i+1;while(j<lines.length&&lines[j].startsWith('>'))j++;return lines.slice(i,j).join('\n');};
const convert=()=>a('convert_item',{side:'opp',fromId:NAIFEN_GRASS_ID,ids:NAIFEN_FORM_IDS});
const held=(neg=false)=>c('held_item',{side:'opp',itemId:NAIFEN_GRASS_ID,neg});
const drain=(trig:string,order:number)=>e(raw('任一方造成攻擊傷害後'),trig,[act(a('base_damage_drain',{type:'fixed',threshold:300,body:[act(convert())]}))],order,'soulmark');
export const NAIFEN_SOUL_KIT=[
 e(raw('7株搖晃的鈴鐺草'),'battle_start',[act(a('grant_item',{side:'opp',itemId:NAIFEN_GRASS_ID,count:7}))],0,'soulmark'),
 e(raw('釋放極樂之樂鼓舞'),'entrance',[act(convert())],1,'soulmark'),
 e(raw('若敵方道具欄位不存在普通'),'entrance',[{live:true,cond:[held(true)],acts:[a('grant_item',{side:'opp',itemId:NAIFEN_GRASS_ID,count:1})]}],2,'soulmark'),
 e(raw('若敵方道具欄位存在普通'),'entrance',[
  {live:true,cond:[held()],acts:[a('settlement_flow',{body:[
   act(a('clear_turn',{side:'opp'})),
   act(a('status_seq',{side:'opp',list:['沉睡','睡眠'],turns:3,chance:100,countFailures:true})),
   {cond:[c('last_amount',{op:'高於',amount:0})],acts:[a('status',{side:'self',status:'星佑',turns:3,chance:100})]},
  ]})]},
 ],3,'soulmark'),
 e([raw('將自身攻擊、特攻值的總和作為'),raw('將自身攻擊、特攻值的總和加入')].join('\n'),'entrance',[act(a('formula_stats',{stats:['atk','spatk'],stats2:['atk','spatk']}))],4,'soulmark'),
 drain('outgoing_attack',5),drain('incoming_attack',6),
];
