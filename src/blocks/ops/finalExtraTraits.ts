/** 常駐進階機制宣告。實際讀取者是 traitsRegistry / TraitsEngine / 傷害與 PP 正式查詢。
 * 每個欄位獨立可編輯，不由精靈或特質名稱選擇封閉處理器。 */
import type {BattleEventContext} from '../../effects/types';
import {StatusRegistry} from '../../effects/statusRegistry';
import {sameStatus,canonicalStatusName} from '../../effects/statusIdentity';
import {clearStatuses} from '../../effects/semanticOperations';
export const ADVANCED_BOOLEAN_KEYS = [
  'isStoneThrower','mythologyWith4Stones','stoneTypeMatchBoost','perfectStoneRate100','firstFatalSurviveAt1Hp',
  'repairOnOtherDeriveStatus','cyberWraithSummon','cyberWraithVanishOnSwitch','wraithExistCurseNoReduce',
  'wraithActionSpell','wraithEndSpellIfNoSkill','wraithSubstituteDeathOnce','wraithSpellDamageDoubleAfterSub',
  'convertStatusToSerenity','doubleSerenityTurnsIfFurious','alwaysAlienElf','enterGainConceal','switchOutInheritConceal',
  'alwaysWeaknessDamage','bestElementAdvantage','ignoreImmuneShieldEffects',
] as const;
export const ADVANCED_NUMBER_RANGES: Record<string, readonly [number,number]> = {
  ignoreDefPercent:[0,1],forceSSSkillStonePower:[0,100000],damageBoost4Stones:[0,100],damageReduce4Stones:[0,1],
  turnEndHeal4Stones:[0,1],stoneUseOfffieldTrueDamagePercent:[0,100],repairHealAmount:[0,100000],repairPpRestore:[0,100],
  cursePpTax:[0,100],wraithSubstituteDeathHpRatio:[0,1],weaknessShieldReductionPercent:[0,100],
};
export const FINAL_EXTRA_TRAIT_ACTION_FIELDS: Record<string, readonly string[]> = {
  advanced_mechanic:['key','value'],
  team_stat_anchor:['stat','divisor','rounding','scope'],
  special_attack_panel_formula:['panel','defense','reductionPerPoint'],
  status_convert_scale:['status','mult','defaultTurns','fromClass'],
  entry_hp_exchange:['key','selfRatio','oppRatio','maxHpMultiple','healPrevious','when'],
  entry_hp_snapshot:['key'],entry_hp_release:['key'],
  missing_hp_damage_boost:['baseBoost','step','stepBoost','doubleBelow'],
  damage_survival_guard:['guardTurns','deathImmuneTurns','fixedPercentCap','preserveOffField'],
};
export function finalExtraTraitActionIssue(op:string,p:any):string|null {
  if(['entry_hp_snapshot','entry_hp_release'].includes(op))return typeof p?.key==='string'&&p.key.length>0?null:'體力快照需獨立鍵';
  if(op==='entry_hp_exchange')return typeof p?.key==='string'&&p.key.length>0&&p.selfRatio>0&&p.selfRatio<=1&&p.oppRatio>0&&p.oppRatio<=1&&p.maxHpMultiple>0&&p.maxHpMultiple<=100&&typeof p.healPrevious==='boolean'&&['entrance','status','opponent_entry'].includes(p.when)?null:'出戰體力交換需明確比例、回饋倍率及觸發來源';
  if(op==='missing_hp_damage_boost')return p?.baseBoost>=0&&p?.step>0&&p.step<=1&&p.stepBoost>=0&&p.doubleBelow>=0&&p.doubleBelow<=1?null:'失血增傷需明確基礎、步長、增幅與翻倍門檻';
  if(op==='damage_survival_guard')return Number.isInteger(p?.guardTurns)&&p.guardTurns>0&&Number.isInteger(p.deathImmuneTurns)&&p.deathImmuneTurns>=p.guardTurns&&Number.isFinite(p.fixedPercentCap)&&p.fixedPercentCap>=0&&typeof p.preserveOffField==='boolean'?null:'非正體力存活需明確護衛、免死期限與固傷上限';
  if(op==='team_stat_anchor')return p?.stat==='spdef'&&p?.scope==='self_and_bench'&&p?.rounding==='ceil'&&Number.isFinite(p?.divisor)&&p.divisor>0&&p.divisor<=1000?null:'特防錨定需自身及場下、無條件進位與正除數';
  if(op==='special_attack_panel_formula')return p?.panel==='spatk'&&p?.defense==='spdef'&&Number.isFinite(p?.reductionPerPoint)&&p.reductionPerPoint>=0&&p.reductionPerPoint<=1?null:'面板公式需特攻、特防與0至1逐點減傷';
  if(op==='status_convert_scale')return typeof p?.status==='string'&&p.status.length>0&&p.fromClass==='non_auxiliary'&&Number.isFinite(p.mult)&&p.mult>0&&p.mult<=100&&Number.isSafeInteger(p.defaultTurns)&&p.defaultTurns>0?null:'狀態轉化倍數需非附屬類、目標狀態與有效期限';
  if(op!=='advanced_mechanic')return null;
  if(!p||typeof p!=='object'||Array.isArray(p))return '常駐機制需物件參數';
  if((ADVANCED_BOOLEAN_KEYS as readonly string[]).includes(p.key))return typeof p.value==='boolean'?null:'此常駐機制需布林值';
  const range=ADVANCED_NUMBER_RANGES[p.key];
  if(!range)return '未知或尚無讀取端的常駐機制';
  return typeof p.value==='number'&&Number.isFinite(p.value)&&p.value>=range[0]&&p.value<=range[1]?null:'常駐機制數值超出範圍';
}
// 宣告不在事件中寫入影子狀態；正式 getter 每次從目前可編輯 Kit 查詢。
export function finalExtraTraitOperations(){return {
  advanced_mechanic:()=>true,team_stat_anchor:()=>true,special_attack_panel_formula:()=>true,
  status_convert_scale:(ctx:BattleEventContext,p:any)=>{
    const statuses=Object.entries(ctx.getStatuses(ctx.self));
    const current=statuses.find(([name])=>sameStatus(name,p.status))?.[1]||0;
    const removable=statuses.filter(([name,n])=>n>0&&!sameStatus(name,p.status)&&
      StatusRegistry[canonicalStatusName(name)]&&!StatusRegistry[canonicalStatusName(name)].categories.includes('AUXILIARY'));
    if(!current&&!removable.length)return false;
    const next=Math.max(1,Math.floor((current||p.defaultTurns)*p.mult));
    if(!ctx.applyStatusWithImmunityCheck(ctx.actor,p.status,next).success)return false;
    clearStatuses(ctx,ctx.actor,ctx.self,name=>removable.some(([old])=>sameStatus(name,old)));
    return true;
  },
  entry_hp_snapshot:(ctx:BattleEventContext,p:any)=>{
    ctx.setPlayerState(p.key,{original:ctx.self.maxHp,temp:0,opponentId:String(ctx.target.battleId||ctx.target.id)});
    ctx.setPlayerState('recoveryMaxHpCap',ctx.self.maxHp);return true;
  },
  entry_hp_release:(ctx:BattleEventContext,p:any)=>{
    const record=ctx.getPlayerState(p.key);if(!record?.temp)return false;
    const live=ctx.getFullTeam(ctx.actor).find(e=>(e.battleId||e.id)===(ctx.self.battleId||ctx.self.id))||ctx.self;
    const maxHp=Math.max(1,live.maxHp-record.temp);
    ctx.updateElf(ctx.actor,{maxHp,currentHp:Math.min(live.currentHp,maxHp),tempMaxHpBoost:0});
    ctx.setPlayerState(p.key,{...record,temp:0});return true;
  },
  entry_hp_exchange:(ctx:BattleEventContext,p:any)=>{
    const selfId=String(ctx.self.battleId||ctx.self.id),active=ctx.actor==='p1'?ctx.activeP1:ctx.activeP2;
    if(String(active.battleId||active.id)!==selfId)return false;
    const record=ctx.getPlayerState(p.key)||{original:ctx.self.maxHp,temp:0};
    if(p.when==='opponent_entry'){
      const data=(ctx as any).effectEventData||{};
      if(data.enteredSide===ctx.actor||!data.enteredId||String(data.enteredId)===record.opponentId)return false;
      record.opponentId=String(data.enteredId);
    }
    // 再觸發時只把舊的臨時額度轉為永久；這次仍建立新的可在下場撤回額度。
    if(p.when!=='entrance')record.temp=0;
    ctx.setPlayerState(p.key,record);
    const amounts=[Math.floor(ctx.self.maxHp*p.selfRatio),Math.floor(ctx.target.maxHp*p.oppRatio)];
    let remaining=2,total=0;
    const settle=(r:any)=>{
      total+=r.hpLost||0;if(--remaining||total<=0)return;
      const live=ctx.getFullTeam(ctx.actor).find(e=>String(e.battleId||e.id)===selfId);if(!live||live.isVanished)return;
      const prior=ctx.getPlayerState(p.key)||record,boost=Math.floor(total*p.maxHpMultiple);
      ctx.setPlayerState(p.key,{...prior,temp:(prior.temp||0)+boost});
      ctx.updateAnyElf(ctx.actor,selfId,{maxHp:live.maxHp+boost,tempMaxHpBoost:(prior.temp||0)+boost});
      if(p.healPrevious){
        const previous=ctx.getPlayerState('previousActiveElfId');
        const mate=ctx.getFullTeam(ctx.actor).find(e=>(String(e.battleId||e.id)===String(previous)||e.id===previous)&&String(e.battleId||e.id)!==selfId);
        if(mate&&mate.currentHp>0)ctx.applyHealToElf?.(ctx.actor,String(mate.battleId||mate.id),total);
      }
    };
    ctx.applyTrueDamage(ctx.actor,amounts[0],'出戰體力交換',undefined,undefined,{onSettled:settle});
    ctx.applyTrueDamage(ctx.targetSide,amounts[1],'出戰體力交換',undefined,undefined,{onSettled:settle});
    return true;
  },
  missing_hp_damage_boost:(ctx:BattleEventContext,p:any)=>{
    const comp=(ctx as any).damageComp;if(!comp||comp.isIncoming||comp.damageCategory==='true')return false;
    const ratio=ctx.self.maxHp>0?Math.max(0,ctx.self.currentHp/ctx.self.maxHp):0;
    const count=Math.floor((Math.max(0,1-ratio)+1e-10)/p.step);
    const increase=(p.baseBoost+count*p.stepBoost)*(ratio<p.doubleBelow?2:1);
    comp.increasePercent+=increase;return true;
  },
  damage_survival_guard:(ctx:BattleEventContext,p:any)=>{ctx.applyDeathImmunity(ctx.actor,p);return true;},
};}
