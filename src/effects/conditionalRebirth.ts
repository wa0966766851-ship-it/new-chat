import {EffectTiming, type BattleEventContext} from './types';
import {checkElfDead} from '../battle/elfAlive';

const key='teamConditionalRebirth';
const id=(e:any)=>String(e?.battleId||e?.id||'');
type Contract={source:string;afterRounds:number;ratio:number;stage:'armed'|'next_entry'|'tracking';holder?:string;rounds:number;lastRound?:number};

/** 個體的下次死亡契約：資料保存在陣營，接力者下場即失效，不以名稱認人。 */
export function armConditionalRebirth(ctx:BattleEventContext,p:any):boolean{
 const source=id(ctx.self);if(!source||checkElfDead(ctx.self)||ctx.self.isVanished)return false;
 const pending:Contract[]=ctx.getPlayerState(key)||[];
 if(pending.length>=100&&!pending.some(x=>x.source===source))return false;
 ctx.setPlayerState(key,[...pending.filter(x=>x.source!==source),{source,afterRounds:p.afterRounds,ratio:p.ratio,stage:'armed',rounds:0}]);
 return true;
}

/** 正式生命週期入口；復活是生命轉移，不走一般禁療，亦不復原消逝者。 */
export function runConditionalRebirth(ctx:BattleEventContext,event:string):void{
 if(![EffectTiming.AFTER_DEFEATED,EffectTiming.ON_ENTRANCE,EffectTiming.ON_SWITCH_OUT,EffectTiming.ROUND_END].includes(event as EffectTiming))return;
 const active=ctx.actor==='p1'?ctx.activeP1:ctx.activeP2;
 if(!active||id(ctx.self)!==id(active))return;
 const pending:Contract[]=ctx.getPlayerState(key)||[];if(!pending.length)return;
 const next:Contract[]=[],revive:any[]=[];
 for(const original of pending){
  const c={...original},source=ctx.getFullTeam(ctx.actor).find(e=>id(e)===c.source);
  if(!source||source.isVanished)continue;
  if(c.stage==='armed'){
   if(event===EffectTiming.AFTER_DEFEATED&&id(ctx.self)===c.source&&checkElfDead(ctx.self))c.stage='next_entry';
  }else{
   // 其他復活途徑已讓原持有者存活，不保留第二次死亡的免費契約。
   if(!checkElfDead(source))continue;
   if(c.stage==='next_entry'&&event===EffectTiming.ON_ENTRANCE&&!ctx.self.isExtra&&!ctx.self.isVanished&&!checkElfDead(ctx.self)&&id(ctx.self)!==c.source){c.stage='tracking';c.holder=id(ctx.self);c.rounds=0;}
   if(c.stage==='tracking'){
    if((event===EffectTiming.ON_SWITCH_OUT||event===EffectTiming.AFTER_DEFEATED)&&id(ctx.self)===c.holder)continue;
    if(event===EffectTiming.ON_ENTRANCE&&id(ctx.self)!==c.holder)continue;
    if(event===EffectTiming.ROUND_END){
     if(id(ctx.self)!==c.holder||checkElfDead(ctx.self)||ctx.self.isVanished)continue;
     if(c.lastRound!==ctx.roundNumber){c.lastRound=ctx.roundNumber;c.rounds++;}
     if(c.rounds>c.afterRounds){revive.push({source,hp:Math.max(1,Math.floor(source.maxHp*c.ratio))});continue;}
    }
   }
  }
  next.push(c);
 }
 // 先消耗契約，避免重入重生；僅更新原個體，絕不替換目前出戰者。
 ctx.setPlayerState(key,next);
 for(const {source,hp} of revive){ctx.updateElf(ctx.actor,{battleId:source.battleId||source.id,currentHp:hp});ctx.addLog(`✨ 【${source.name}】的接力重生契約完成，恢復 ${hp} 點體力！`,'effect');}
}
