import {MARK_DEFINITIONS,markAppliesToElf,type Mark} from './marks';
/** 持有者印記的能力查詢；不依賴來源精靈仍在場或名稱。 */
export function markCapability(elf:any,key:string,marks:readonly Mark[]=elf?.marks||[]):number {
 let result=0;
 for(const mark of marks){
  if(mark.count<=0||!markAppliesToElf(mark,elf))continue;
  const value=mark.effects?.[key]??MARK_DEFINITIONS[mark.id]?.effects?.[key];
  if(typeof value==='number')result=Math.max(result,value);
  else if(value&&mark.count>=value.at)result=Math.max(result,Number(value.value)||0);
 }
 return result;
}
export function retainShield(elf:any,next:number):number {
 const before=Math.max(0,Number(elf?.shield)||0),ratio=markCapability(elf,'shieldRetention');
 return next<before&&!markCapability(elf,'shieldSideEffectsDisabled')?Math.max(next,Math.ceil(before*ratio)):next;
}
/** 護盾變化規則是 Kit 安裝的參數；每筆實際變化獨立取整，不拿目前盾量代替變化量。 */
export function dispatchShieldChange(ctx:any,changedSide:'p1'|'p2',delta:number){
 const rule=(ctx.self as any)?.shieldChangeMarkRule;
 if(!rule||!delta)return;
 const gain=Math.floor(Math.abs(delta)/rule.perStep);if(!gain)return;
 const side=rule.side==='self'?ctx.actor:ctx.targetSide,elf=side===ctx.actor?ctx.self:ctx.target;
 const ownerBattleId=elf.battleId||elf.id;
 const prev=ctx.getMarks(side).find((m:Mark)=>m.id===rule.markId&&m.ownerBattleId===ownerBattleId);
 ctx.setMark({id:rule.markId,name:rule.markName,displayChar:rule.displayChar,count:Math.min(rule.maxCount,(prev?.count||0)+gain),ownerBattleId,scope:'elf',persistsOffField:true,clearable:false},side);
}
