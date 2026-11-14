import type {BattleEventContext} from '../../effects/types';
import type {RunState} from '../runtime';

export const DAMAGE_ROLL_FIELDS={random_damage:['side','source','min','max','type','elem','perStack']} as const;
export function damageRollIssue(p:any):string|null{
 if(!['self','opp'].includes(p.side)||!['self','opp'].includes(p.source))return '隨機傷害需明確目標與傷害來源';
 if(!Number.isSafeInteger(p.min)||!Number.isSafeInteger(p.max)||p.min<0||p.max<p.min||p.max>1000000)return '隨機傷害需0至一百萬的整數閉區間';
 if(!['技能','固定','百分比','真實'].includes(p.type)||typeof p.perStack!=='boolean')return '隨機傷害需正式傷害類型與逐層旗標';
 return null;
}
type Send=(ctx:BattleEventContext,side:'p1'|'p2',amount:number,type:string,elem:string|undefined,st:RunState)=>number;
/** 逐層逐次擲值與結算，不能合併成總傷害而繞過每次傷害限制。 */
export function randomDamageOperation(send:Send){return (ctx:BattleEventContext,p:any,st:RunState):boolean=>{
 const count=p.perStack?Math.max(0,Math.floor(st.markStacks||0)):1;
 if(!count)return false;
 const source=p.source==='self'?ctx:ctx.contextForElf?.(ctx.targetSide,ctx.target);
 if(!source)return false;
 const side=p.side==='self'?ctx.actor:ctx.targetSide,rng=ctx.rng||Math.random;
 let sum=0;
 for(let i=0;i<count;i++)sum+=send(source,side,p.min+Math.floor(rng()*(p.max-p.min+1)),p.type,p.elem,st);
 st.lastAmount=sum;
 return true;
};}
