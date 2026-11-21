import {authoredEntry as e,operation as a,actions as act,condition as c} from './authoredKitTools';
import {PURE_SHADOW_ACTIVE_KEY,SYMBIOSIS_ITEM_ID} from './shadowPairItems';
/** 晻藹夜靈.布萊克（5053）與虯螭淵玄.索蘭特（5054）共用條目：雙重暗影、共生循環。只用通用積木。 */
export const SHADOW_MARK={id:'doubleShadow',name:'雙重暗影',displayChar:'影',unit:'道',maxCount:2,
 description:'持有者每次死亡時強制存活並保留1點體力，消除雙方回合類效果與能力上升、下降狀態，依序令對手束縛、詛咒、害怕；觸發後當回合結束時減少1道並令自身抵擋下2次受到的攻擊。最多2道，下場後保留。'};
export const BLAKE_NAMES=['布萊克'];
export const SOLANT_NAMES=['索蘭特'];
const soul=(text:string,trig:string,body:any[],order:number,cond:any[]=[])=>e(text,trig,body,order,'soulmark',true,cond);
const hasShadow=c('mark_count',{side:'self',id:SHADOW_MARK.id,op:'不小於',amount:1});
const SURVIVED='shadowSurvived';

/** 共生循環：partners＝夥伴名稱片段。 */
export const symbiosisEntries=(partners:string[],order:number)=>[
 soul('戰鬥開始時若夥伴任意型態存在於背包內且存活，己方道具欄獲得共生循環，雙方計入共生循環並記錄對方能力值','battle_start',[act(a('partner_link',{names:partners,key:'teamSymbiosis',itemId:SYMBIOSIS_ITEM_ID}))],order),
 soul('共生循環：一方被擊敗時，另一方登場首回合回合結束時未被擊敗，將其重新召喚回己方背包末位、恢復所有能力值並重生','round_end',[
  {cond:[c('field_rounds',{op:'等於',amount:1})],acts:[a('partner_revive',{names:partners,key:'teamSymbiosis'})]},
 ],order+1),
];
/** 雙重暗影：持有者的強制存活與回合結束消耗（在場或背包皆適用）。 */
export const doubleShadowEntries=(order:number)=>[
 soul('雙重暗影：持有者每次死亡時強制存活並保留1點體力，消除雙方回合類效果、能力上升與下降狀態，依序令對手束縛、詛咒、害怕','fatal',[
  {cond:[hasShadow],acts:[a('survive',{}),a('flag_set',{key:SURVIVED,value:true,thisRound:true})]},
  {chain:'success',acts:[a('clear_turn',{side:'opp'}),a('clear_turn',{side:'self'}),a('stat_clear',{side:'self',kind:'all'}),a('stat_clear',{side:'opp',kind:'all'}),
   // 對手存在非次數類異常免疫：照原序列各一次；否則改為依序詛咒、害怕，逐項嘗試到對手不存在次數免疫為止（次數類免疫逐次消耗），再附加後續各項。
   a('status_seq_until_success',{list:['束縛','詛咒','害怕'],loopList:['詛咒','害怕'],turns:3})]},
 ],order),
 soul('雙重暗影：每次觸發強制存活後當回合結束時減少1道並令自身抵擋下2次受到的攻擊','team_round_end',[
  {cond:[c('player_state',{key:SURVIVED,equals:true,thisRound:true})],acts:[
   a('flag_set',{key:SURVIVED,value:false}),
   a('resource_mark_subtract',{id:SHADOW_MARK.id,side:'self',scope:'elf',amount:1}),
   a('immune_attack_count',{count:2}),
  ]},
 ],order+1),
];
/** 登場時：背包內存在布萊克且布萊克未持有雙重暗影則重新附加1道。 */
export const reapplyShadow=(order:number)=>soul('索蘭特、布萊克任意型態登場時背包內存在布萊克且布萊克未持有雙重暗影，則重新附加1道雙重暗影','entrance',
 [act(a('resource_mark_team_named',{names:BLAKE_NAMES,amount:1,onlyIfMissing:true,...SHADOW_MARK}))],order);
export {PURE_SHADOW_ACTIVE_KEY};
