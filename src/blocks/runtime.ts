import {ownerLinkOperations,ownerLinkCondition} from './ops/ownerLinks';
import {resourcePanelOperations} from '../effects/resourcePanelOperations';
import {supportOperations,consumedHealthAmount} from '../effects/mechSupportLifecycle';
import {portableSkillCapabilities} from '../battle/portableSkillMarks';
import { addDamageReduction, multiplyDamageReduction } from '../battle/damageReduction';
import {stageOperationBlocked} from '../effects/stageProtection';
import {hasAllStageDirection} from '../effects/stageQueries';
import {grantAttackTypeView} from '../effects/attackTypeView';
import {grantCountedStatusImmunity} from '../battle/statusImmunityCount';
import { queueActionDamageModifier, queueActionPowerMultiplier, queueActionPowerAdd, queueHpPowerScale } from '../battle/actionDamageModifiers';
import { queueActionDefenseIgnore } from '../battle/actionDefenseModifiers';
import { isAlienElf } from '../battle/advancedDamageModifiers';
import { queueHpDrain } from '../battle/hpDrain';
import {instantKillRequest} from '../battle/instantKillRequest';
import {checkElfDead} from '../battle/elfAlive';
import {resourceSnapshotOperations} from '../effects/resourceSnapshotOperations';
import {readMarkStacks,readMarkRemainingTurns,markChancePercent} from '../effects/markQueries';
import {scaleActionByMarks} from '../effects/actionMarkScale';
import {resourceMarkLocked} from '../effects/resourceMarkLocks';
import {ownsActiveFormation,linksFormation} from '../effects/formationTimerOwnership';
import {closeFormationWindow,runFormationWindows} from '../effects/formationLifecycle';
import {deferAllyEntry} from '../effects/deferredEntryEffects';
import {armConditionalRebirth} from '../effects/conditionalRebirth';
import {setIncomingPanelAttack} from '../battle/panelAttack';
import {floorStagesAtOpponent,loseBodyMaximumAndResource} from '../effects/bodyResourceOperations';
import {grantTypeDamageFloor,applyTypeDamageFloor} from '../effects/typeDamageFloor';
import {checkedPercentDrain} from '../effects/checkedDrain';
import {snapshotNextPowerForNonfullTeam} from '../effects/teamPowerSnapshot';
import {readStageLevels,readStageKinds} from '../effects/stageQueries';
import { bypassesAttackDefense } from '../battle/attackDefense';
import { isSkillDamageType, isNonTrueDamageType } from '../battle/damageSemantics';
import { matchesDamageTypes } from '../effects/damageChoices';
import { makeEffectPresentation } from '../battle/effectPresentation';
// 積木執行器：把 Program（parse.ts 產生）在戰鬥中執行。
import type { Act, Clause, Cond, Program, Stmt, Trigger } from "./model";
import type { BattleEventContext } from "../effects/types";
import { EffectTiming } from "../effects/types";
import { prdPercent } from "../utils/prd";
import { executeTemplateEffect } from "../effects/templateEngine";
import { STAT_KEYS, matchCond } from "./parse";
const matchCondText = (t?: string) => { const c = t ? matchCond(String(t).replace(/^[，,\s]*(?:若)?/, "")) : null; return c && c.c !== "text" ? c : null; };
import { CUSTOM } from "./custom";
import { getTypeMatchup, calculateEffectiveStat } from "../utils/statCalculator";
import { statusChanceBlocked } from '../battle/statusChanceRules';
import { settleDamageAbsorption } from '../battle/damageSemantics';
import { StatusRegistry } from '../effects/statusRegistry';
import { canonicalStatusName } from '../effects/statusIdentity';
import {withRecoveryOrigin,blocksOwnSkillRecovery,blocksTimedRecovery} from '../battle/recoveryOrigin';
import { removeStatusEffect, clearAllStatuses,getMaxPp } from '../utils/battleHelpers';
import { timed as addConstraintTimer, uses as addUseConstraint } from '../effects/newElfOperations';
import { markAppliesToElf } from '../battle/marks';
import { markRecoveryReduction } from '../battle/markRecovery';
import { applyKitPpOperation } from '../effects/ppOperations';
import {abolishSelectedSkill,consumeSelectedPp} from '../effects/selectedSkillOperations';
import {panelDurationOperations} from './ops/panelAndDuration';
import {collectionOperations} from '../effects/collectionOperations';
import { astralOperations } from '../effects/astralOperations';
import { legacyHandlerOperations } from './ops/legacyHandler';
import { skillSlot } from '../battle/skillSlot';
import { STATE_SIGNS } from '../battle/stateSigns';
import { DAMAGE_STAT_BASES } from '../effects/damageBases';
import {damageBaseValue,type DamageTerm} from '../effects/damageSum';
import { groupAEvalCond } from './ops/groupA';
import { closureOperations } from '../effects/sequenceClosureOperations';
import { groupCOperations } from './ops/groupC';
import { applyMarkProgram } from '../effects/markProgram';
import { sequenceIssue } from '../effects/sequenceContract';
import { applyStatusCollection,increasingStatusChance,statusDurationSum,applyOrExtendStatus } from '../effects/statusCollection';
import { timerProgramIdentity } from './timerProgramIdentity';
import { groupBOperations, groupBCounters } from './ops/groupB';
import { itemUseOperations } from './ops/itemUse';
import { powerStatOperations, powerStatEvalCond } from './ops/powerStat';
import { entranceStackOperations, entranceStackEvalCond } from './ops/entranceStack';
import { stageDamageOperations, stageDamageEvalCond } from './ops/stageDamage';
import { keldSoulOperations, keldSoulEvalCond } from './ops/keldSoul';
import { statusSovereigntyOperations } from './ops/statusSovereignty';
import { priorityBonusOperations } from './ops/priorityBonus';
import { fifthPpDiff, arenaDrainAmount } from './ops/arenaShared';
import { arenaSharedOperations } from './ops/arenaShared';
import { holyMilesOperations } from './ops/holyMiles';
import { dragonHealingOperations } from './ops/dragonHealing';
import { shieldMarkOperations } from './ops/shieldMark';
import {markCapability} from '../battle/markCapabilities';
import { canOperations, canEvalCond } from './ops/can';
import { brinkkOperations } from './ops/brinkk';
import { odinOperations } from './ops/odinRune';
import { mechOperations } from './ops/mech';
import { ppAbsorbOperations } from './ops/ppAbsorb';
import { fearSeedOperations } from './ops/fearSeed';
import { rosterStatsOperations } from './ops/rosterStats';
import { group1Operations } from './ops/group1';
import { finalExtraTraitOperations } from './ops/finalExtraTraits';
import { finalMarsLanDragonOperations } from './ops/finalMarsLanDragon';
import {typedCycleOperations} from './ops/typedDamageCycle';
import {resourceDefenseOperations} from './ops/resourceDefenses';
import {missingHpScalingOperations} from './ops/missingHpScaling';
import {removedEffectOperations} from './ops/removedEffects';
import { finalOdbOperations, finalOdbEvalCond } from './ops/finalOdinDeluBeliente';
import { extraElfOperations } from './ops/extraElf';
import { bossTraitOperations } from './ops/bossTraits';
import { thunderGodOperations, thunderGodEvalCond } from './ops/thunderGod';
import { group5Operations } from './ops/group5';

type S = "p1" | "p2";
export interface RunState {
  selectedElf?:{side:S;id:string};
  lastStatLevels?:Record<string,number>;
  markStacks?:number;
  holderMark?:{id:string;ownerBattleId?:string};
  sourceKind?: 'skill' | 'soul' | 'trait'; // 明確積木容器保留來源，魂印／特質計時不可誤列為可消除技能效果。
  last: boolean | null; // 上一個動作是否成功（消除成功／觸發）
  lastAmount: number; // 上一個動作的數值（等量）
  lastStmt?: Stmt;
  prevOp?: string;
  survived?: boolean;
  lastDealt?: number;
  lastDamageImmune?:boolean;
  lastRequestedDamage?:number; // 傷害結算前名目量：免疫後的「等量真傷」仍取同一次快照。
  maxHpBeforeChange?: Partial<Record<S, number>>;
  conditionSnapshots?: Map<string, boolean | undefined>;
  event?: { trig: Trigger; data?: any };
  /** 本次事件中已執行句子的成敗（「任一項未觸發」） */
  history?: boolean[];
  historyTrig?: Trigger;
  /** 下一句以「附加後對手體力未減少」為條件：延後到實際扣血結算（OPPONENT_DAMAGE.hpReduced） */
  deferNoDmg?: Stmt;
  deferred?: Set<Stmt>;
  deferredDamageSerial?:number;
}

const DYNAMIC_CONDS = new Set(["success", "triggered", "fail", "kill", "nokill", "crit", "dmg_cmp", "last_amount", "last_no_dmg", "invalid", "weak", "event_crit","selected_pp","last_damage_immune","mark_count","mark_chance","death_node","last_hp_lost","last_typed_damage_weak"]);
const condKey = (c: Cond) => `${c.c}:${JSON.stringify(c.p || {})}`;
export function snapshotConditions(ctx: BattleEventContext, clauses: Clause[], st: RunState) {
  st.conditionSnapshots ||= new Map();
  for (const clause of clauses) {
    for (const c of [...(clause.cond || []), ...clause.body.flatMap(s => [...(s.cond || []),...[...s.acts,...(s.elseActs || [])].flatMap(a=>a.p?.x2If ? [a.p.x2If] : [])])]) {
      if (!DYNAMIC_CONDS.has(c.c) && !st.conditionSnapshots.has(condKey(c))) st.conditionSnapshots.set(condKey(c), evalCond(ctx, c, st));
    }
  }
}
const evalEventCond = (ctx: BattleEventContext, c: Cond, st: RunState) => {
  const key = condKey(c);
  return (st.conditionSnapshots?.has(key) ? st.conditionSnapshots.get(key) : evalCond(ctx, c, st)) === true;
};

export const DEFAULT_STATUS_TURNS = 3; // 異常未特別定義回合數時預設 3 回合
const STATUS_DURATION: Record<string, number> = { 中毒: 3, 燒傷: 3, 寄生: 3, 凍傷: 3, 衰弱: 3, 流血: 3 };
const sideOf = (ctx: BattleEventContext, w: string): S => (w === "self" ? ctx.actor : ctx.targetSide);
const elfOf = (ctx: BattleEventContext, side: S): any => (side === "p1" ? ctx.activeP1 : ctx.activeP2);
const idOf = (e: any) => String(e?.battleId || e?.id || "");
/** 同一回合內讀取場上最新精靈（ctx.activeP1/P2 是建立 ctx 當下的快照） */
export function liveElf(ctx: BattleEventContext, side: S): any {
  const base = (side === ctx.actor ? ctx.self : side === ctx.targetSide ? ctx.target : undefined) || elfOf(ctx, side);
  if (!base) return base;
  return (ctx.getFullTeam?.(side) || []).find((e: any) => idOf(e) === idOf(base)) || base;
}
const chance = (ctx: BattleEventContext, tag: string, pct: number) => pct >= 100 || prdPercent(`${ctx.actor}:${ctx.self?.battleId||ctx.self?.id}:${ctx.skill?.name ?? "soul"}:blk:${tag}`, pct);

const hasAbn = (ctx: BattleEventContext, elf: any, cls?: string) => Object.entries(ctx.getStatuses ? ctx.getStatuses(elf) : {}).some(([name, v]) =>
  (v as number) > 0 && (!cls || statusInClass(name, cls)));
const hasStage = (elf: any, up: boolean) => Object.values(elf?.statStages || {}).some((v: any) => typeof v === "number" && (up ? v > 0 : v < 0));

function resetStages(ctx: BattleEventContext, side: S, pick: (v: number) => boolean,operation:'clear'|'steal'='clear'): boolean {
  const elf = liveElf(ctx, side);
  const before: Record<string, number> = { ...(elf?.statStages || {}) };
  const stages: Record<string, number> = { ...before };
  let changed = false;
  for (const k in stages) if (typeof stages[k] === "number" && pick(stages[k])&&!stageOperationBlocked(ctx,side,stages[k],operation)) { stages[k] = 0; changed = true; }
  if (changed) ctx.updateElf(side, { statStages: stages as any });
  // 寫入可能被「提升不可消除」攔截。成功分支必須看寫入後；比較對象是寫入前的複本（updateElf 可能原地修改）。
  return changed && (!ctx.getFullTeam || Object.keys(stages).some(k=>Number(liveElf(ctx,side)?.statStages?.[k] || 0)!==Number(before[k] || 0)));
}

function cmp(a: number, op: string, b: number): boolean {
  if (/不高於|不大於/.test(op)) return a <= b;
  if (/不低於|不小於/.test(op)) return a >= b;
  if (/高於|大於/.test(op)) return a > b;
  if (/低於|小於/.test(op)) return a < b;
  return false;
}

// ───────── 條件 ─────────
export function evalCond(ctx: BattleEventContext, c: Cond, st: RunState): boolean | undefined {
  const linkCondition=ownerLinkCondition(ctx,c);if(linkCondition!==undefined)return linkCondition;
  const companionCondition = canEvalCond(ctx, c);
  if (companionCondition !== undefined) return companionCondition;
  const finalCondition = finalOdbEvalCond(ctx,c,st);
  if (finalCondition !== undefined) return finalCondition;
  const p = c.p || {};
  const self: any = liveElf(ctx, ctx.actor), opp: any = liveElf(ctx, ctx.targetSide);
  const pick = (w: string) => (w === "self" ? self : opp);
  switch (c.c) {
    // 「N%機率」：偽隨機分布（與其他機率事件同一入口），每份技能各自計數；100% 不消耗亂數。
    case "chance": return chance(ctx, `cond:${p.pct}`, p.pct);
    case "first": return ctx.goesFirst === true || ctx.moveIndex === 0;
    case "last": return !(ctx.goesFirst === true || ctx.moveIndex === 0);
    case "success": case "triggered": return st.last === true;
    case "fail": return st.last === false;
    case "kill": return (opp?.currentHp ?? 1) <= 0;
    case "nokill": return (opp?.currentHp ?? 1) > 0;
    case "has_status": {
      const sides = p.side === "both" ? [self, opp] : [pick(p.side)];
      const present=sides.some(e => Object.entries(ctx.getStatuses(e)||{}).some(([name,turns])=>canonicalStatusName(name)===canonicalStatusName(p.status)&&turns>0));
      return p.neg?!present:present;
    }
    case "abnormal": {
      // 「處於（特定分類的）異常狀態」：cls=控制類/弱化類/非附屬類（5007 癡愚之觸「不處於控制類」）。
      const r = p.side === "any" ? hasAbn(ctx, self, p.cls) || hasAbn(ctx, opp, p.cls) : hasAbn(ctx, pick(p.side), p.cls);
      return p.neg ? !r : r;
    }
    case 'action_priority': {const value=(p.side==='self'?ctx.getPlayerState:ctx.getOpponentState)('actionPriorityThisTurn');return Number.isFinite(value)&&cmp(value,p.op,p.amount);}
    case "stage": { const r = hasStage(pick(p.side), p.kind === "up"); return p.neg ? !r : r; }
    case 'stage_value': {const value=pick(p.side)?.statStages?.[p.stat]??0;return Number.isFinite(value)&&cmp(value,p.op,p.amount);}
    case 'stage_all': {const r=hasAllStageDirection(pick(p.side),p.kind);return p.neg?!r:r;}
    case "hp_ratio": { const e = pick(p.side); return cmp(e.currentHp, p.op, e.maxHp * p.ratio); }
    case 'hp_value':return cmp(pick(p.side).currentHp,p.op,p.amount);
    case 'alive':return !checkElfDead(pick(p.side));
    case "hp_cmp": { const a = pick(p.side), b = p.side === "self" ? opp : self; return cmp(a.currentHp, p.op, b.currentHp); }
    case "field_shield": return [self,opp].some(e => p.absent ? !(Number(e?.shield)>0) : Number(e?.shield)>0);
    case "shield": { const e = pick(p.side); const r = ((e?.shield || 0) + (e?.barrier || 0)) > 0; return p.neg ? !r : r; }
    case "hp_full": { const e = pick(p.side); return !!e && e.currentHp >= e.maxHp; }
    case "no_skill_dmg": return ctx.getPlayerState(p.kind === "攻擊" ? "blkAttackDmgTakenRound" : "blkSkillDmgTakenRound") !== (ctx.roundNumber ?? 0);
    // 當回合未受到指定類（固定／百分比）傷害（殞星衝擊；recordBattleFacts 寫入）。
    case "no_damage_kind": return ctx.getPlayerState(p.kind === "百分比" ? "blkPercentDmgTakenRound" : "blkFixedDmgTakenRound") !== (ctx.roundNumber ?? 0);
    // 對手在場期間 PP 曾變化（newElfLifecycle:61 寫入；殞星衝擊/念力傾瀉變思遷憶）。
        // arena_12 條件（DSH 20261018）：先出手／未行動／對手切換／同屬性。
    case "first_move": {const side=ctx.getPlayerState?.('blkFirstMoverThisRound');return (side==='p1'||side==='p2')&&((side===ctx.actor)!==!!p.neg);}
    case "unacted": return (ctx.getPlayerState?.('actionPreventedRound') === (ctx.roundNumber ?? 0))
      || (ctx.getPlayerState?.('blkActedThisRound') !== undefined && ctx.getPlayerState?.('blkActedThisRound') !== ctx.actor);
    case "opp_switched": return ctx.getPlayerState?.('blkSwitchedThisRound') === ctx.targetSide;
    case "same_type": {
      const side = p.side === 'opp' ? ctx.targetSide : ctx.actor;
      const elf = liveElf(ctx, side);
      const sk = side === ctx.actor ? ctx.skill : (ctx as any).opponentSkill;
      if (!elf || !sk) return false;
      const et = String(elf.type || ''), st = String(sk.type || '');
      if (!et || !st) return false;
      const parts = et.split(/[·.、／/]/).map((x: string) => x.trim()).filter(Boolean);
      return parts.some((x: string) => st.includes(x)) || et === st;
    }
    case "opp_pp_changed": return ctx.getOpponentState('fieldPpChanged') === true;
    case "invalid": return st.event?.trig === "on_invalid" || st.event?.trig === "self_invalid";
    case "weak": {
      const reg = ctx.getPlayerState("blkLastTypeMult");
      const m = typeof reg === "number" ? reg : getTypeMatchup(ctx.skill?.type || "", opp?.type || "");
      return m > 0 && m < 1;
    }
    case "text": { const re = matchCondText(p.text); return re ? evalCond(ctx, re, st) : false; }
    case "pp_full": { const sk = ctx.skill; const r = !!sk && (sk.pp ?? 0) >= getMaxPp(sk,self); return p.neg ? !r : r; }
    case 'selected_charge':{
      const elf=pick(p.side),selected=p.side==='self'?ctx.skill:ctx.opponentSkill;
      const slot=skillSlot(elf,selected);if(slot<0)return false;
      const value=elf.skills[slot]?.charge;
      return Number.isFinite(value)&&cmp(value,p.op,p.amount);
    }
    case 'selected_pp':{
      const elf=pick(p.side),selected=p.side==='self'?ctx.skill:ctx.opponentSkill;
      const slot=skillSlot(elf,selected);if(slot<0)return false;
      const value=elf.skills[slot]?.currentPp??elf.skills[slot]?.pp;
      return Number.isFinite(value)&&cmp(value,p.op,p.amount);
    }
    case 'skill_pp_any':return (pick(p.side)?.skills||[]).some((s:any)=>Number.isFinite(s.pp)&&cmp(s.pp,p.op,p.amount));
    // 「技能PP值均為滿」（5021 神懺福音之章龍魂：對方PP均滿時效果翻倍）：所有技能 pp≥maxPp（無 maxPp 資料者不算滿）。
    case 'skill_pp_all':{const list=(pick(p.side)?.skills||[]);return list.length>0&&list.every((s:any)=>s.maxPp!==undefined&&(s.pp??0)>=s.maxPp);}
    // 「攻擊與特攻差值高於N」（5035 破曉：|atk-spatk|>200 → 附加200固定傷害）。
    case 'atk_gap':{const e=pick(p.side||'self');const d=Math.abs((e?.calculatedStats?.atk??0)-(e?.calculatedStats?.spatk??0));return cmp(d,p.op,p.amount);}
    case 'skill_kind': { const category = st.event?.data?.skill?.category || ctx.skill?.category; return p.kind === '攻擊' ? !!category && category !== '屬性' : category === p.kind; }
    case 'skill_fifth': return (ctx.skill?.isFifthSkill===true)!==!!p.neg;
    case 'skill_invalid': return st.event?.data?.invalid === true;
    // 本次行動失敗原因（引擎 failAction／notifyActionResult 的 failKind：invalid／miss／evade／immune）。
    case 'fail_kind': { const failResult = st.event?.data?.effectEventData || st.event?.data; const failedAs = failResult?.failKind === p.kind; return p.neg ? !failedAs : failedAs; }
    // 「當自身處於龍魂時」（5021 次元龍系技能的龍魂覺醒分支）：讀 dimensionalDragonSoul 覺醒鍵。
    case "player_state": {
      if(p.thisRound&&ctx.getPlayerState(p.key+':round')!==ctx.roundNumber)return false;
      const raw = (ctx as any).getPlayerState?.(p.key);
      const v = raw === undefined ? p.fallback : raw;
      return v === p.equals;
    }
    case "field_rounds": {
      const turns = Number((ctx as any).getPlayerState?.(`${ctx.actor}_turnsInBattle`) || 1);
      const n = Number(p.amount);
      switch (p.op) {
        case '低於': return turns < n;
        case '不高於': return turns <= n;
        case '高於': return turns > n;
        case '不小於': return turns >= n;
        case '等於': return turns === n;
        default: return false;
      }
    }
    case "skill_slot": {
      const sk = (ctx as any).skill;
      if (!sk) return false;
      const elf = liveElf(ctx, ctx.actor);
      const idx = (elf?.skills || []).findIndex((s: any) => s.name === sk.name);
      return idx === Number(p.index);
    }
    case "dragon_soul": return ctx.getPlayerState?.("dimensionalDragonSoul") === true;
    case 'event_crit':return (st.event?.data?.effectEventData || st.event?.data)?.isCrit === true;
    case 'event_hit': {
      const result=st.event?.data?.effectEventData || st.event?.data;
      return result?.hit===true&&(!p.requireAdditional||result.additionalEffectsEnabled===true);
    }
    case 'mark_count':return cmp(readMarkStacks(ctx,p as any),p.op,p.amount);
    case 'mark_chance':return chance(ctx,`mark:${p.side}:${p.id}:${p.pct}`,markChancePercent(ctx,p as any));
    case 'death_node':return (st.event?.data?.effectEventData||st.event?.data)?.node===p.node;
    case 'alien': return isAlienElf(pick(p.side));
    case 'defeated_alien': return isAlienElf((ctx as any).effectEventData?.defeatedElf || st.event?.data?.defeatedElf);
    case "dmg_cmp": {
      const data=st.event?.data?.effectEventData || st.event?.data;
      return cmp(data?.damageDealt ?? data?.dealt ?? data?.totalDamage ?? ctx.getPlayerState("blkLastHitDamage") ?? 0,p.op,p.v);
    }
    case "last_amount":return cmp(st.lastAmount,p.op,p.amount);
    case "speed_cmp": {
      const speedOf = (e: any) => calculateEffectiveStat(Number(e?.calculatedStats?.speed) || 0, Number(e?.statStages?.speed) || 0);
      const a = pick(p.side), b = p.side === "self" ? opp : self;
      return cmp(speedOf(a), p.op, speedOf(b));
    }
    case "last_hp_lost":return st.lastDealt!==undefined&&cmp(st.lastDealt,p.op,p.amount);
    case "last_damage_immune":return st.lastDamageImmune===true;
    case "event_status": return (p.statuses || []).includes(canonicalStatusName((ctx as any).effectEventData?.status || st.event?.data?.status || ''));
    case "type_is": {const present=String(pick(p.side)?.type||'').split(/[.·・]/).includes(p.type);return p.neg?!present:present;}
    case "enemy": { const m = getTypeMatchup(opp?.type || "", self?.type || ""); return typeof p?.above === "number" ? m > p.above : m >= 2; }
    case "self_enemy": return getTypeMatchup(self?.type || "", opp?.type || "") >= 2;
    case "crit": {
      const result = st.event?.data?.effectEventData || st.event?.data;
      return typeof result?.isCrit === 'boolean' ? result.isCrit
        : st.event?.trig === 'after_hit' && !!ctx.getPlayerState("blkLastCrit");
    }
    case "last_no_dmg": return st.lastDealt === 0;
    // 依正式出手通知判斷，不能將「選過技能」或缺少選招快照當作使用結果。
    case "opp_used_skill": { const r = ctx.getPlayerState('opponentSkillUsedRound') === (ctx.roundNumber ?? 0); return p.neg ? !r : r; }
    case 'resource_crossed': {
      const data=(ctx as any).effectEventData||st.event?.data?.effectEventData||st.event?.data;
      return data?.id===p.id&&Number.isFinite(data.before)&&Number.isFinite(data.after)
        &&data.before<p.threshold&&data.after>=p.threshold;
    }
    case 'mark_locked':return resourceMarkLocked(ctx,sideOf(ctx,p.side),p.id);
    // 5032 變思遷憶/星核脈衝：「處於回合類效果」＝該側存在 turn_effect/round_counter 類計時器（含 pending）。
    case "has_turn_effect": { const r = !!ctx.hasTurnEffectOn?.(p.side === "self" ? ctx.actor : ctx.targetSide); return p.neg ? !r : r; }
    case 'either_turn_effect':return !!ctx.hasTurnEffectOn?.(ctx.actor)||!!ctx.hasTurnEffectOn?.(ctx.targetSide);
    // 5032 空間躍遷反擊：本次行動技能傷害被擋下（引擎 blockSkillDamage 生效時寫入）。
    case "damage_blocked": return ctx.getPlayerState('blockedSkillDamageThisAction') === true;
    // 「無視成功時→…」：讀引擎寫入的無視成功旗標（本次行動結束重置）；與免疫／傷害限制的無視鍵對稱。
    case "ignore_success": return p.what === '攻擊免疫' ? ctx.getPlayerState('attackImmunityIgnoredThisAction') === true
      : p.what === '傷害限制' ? ctx.getPlayerState('ignoreDamageLimitSucceededThisAction') === true : false;
    // 白名單 payload 布林鍵的計時器存在查詢（如 spaceShift）。
    case "timer_active": { const ts = (ctx.actor === 'p1' ? ctx.p1Timers : ctx.p2Timers) || []; return ts.some((t: any) => t.payload?.[p.key] === true && (t.remaining ?? 0) > 0 && !t.pendingActivation); }
    case "stab": {
      // 「若屬性相同」＝本系：技能屬性（每一部分）都包含在自身目前的屬性中
      const own = String(self?.type || "").split(/[.·・]/).filter(Boolean);
      const sk = String(ctx.skill?.type || "").split(/[.·・]/).filter(Boolean);
      return sk.length > 0 && sk.every(t => own.includes(t));
    }
    case "has_mark": {
      // 星火之灼／星芳之纏／星海之浸：以戰鬥狀態鍵（剩餘回合）記錄，沒有 Mark 實體；同樣視為「處於該印記」。
      const sign = STATE_SIGNS.find(s => s.name === p.name);
      const signHit = sign && Number((p.side === "self" ? ctx.getPlayerState : ctx.getOpponentState)(sign.key)) > 0;
      if (signHit) return p.neg ? false : true;
      const hit = (ctx.getMarks(p.side === "self" ? ctx.actor : ctx.targetSide) || []).some((m: any) => markAppliesToElf(m,pick(p.side)) && (m.name === p.name || m.id === p.name || m.id === `blk_${p.name}`) && (m.count || 0) > 0);
      return p.neg ? !hit : hit;
    }
    default: return entranceStackEvalCond(ctx, c) ?? keldSoulEvalCond(ctx, c) ?? stageDamageEvalCond(ctx, c) ?? powerStatEvalCond(ctx, c) ?? groupAEvalCond(ctx, c) ?? thunderGodEvalCond(ctx, c, liveElf);
  }
}

// ───────── 傷害分類 ─────────
/** kind：攻擊＝攻擊技能公式傷害；技能＝技能傷害（攻擊＋X系技能傷害）；非真實；空＝全部 */
export function compMatchesKind(comp: any, kind?: string): boolean {
  const scopes: Record<string, string> = { 攻擊: 'attack', 技能: 'skill', 非真實: 'non_true', 固定: 'fixed', 百分比: 'percent', 真實: 'true' };
  return kind ? !!scopes[kind] && matchesDamageTypes([scopes[kind]], comp.damageCategory) : true;
}

// ───────── 動作 ─────────
type OpFn = (ctx: BattleEventContext, p: any, st: RunState) => boolean | void;

function applyStatus(ctx: BattleEventContext, side: S, status: string, turns?: number): boolean {
  const r = ctx.applyStatusWithImmunityCheck(side, status, turns ?? STATUS_DURATION[status] ?? DEFAULT_STATUS_TURNS);
  if (r.success) ctx.addLog(`💫 【${elfOf(ctx, side)?.name}】陷入了【${status}】！`, "status");
  return !!r.success;
}

const RT_TYPE: Record<string, string> = { 真實: "true", 固定: "fixed", 百分比: "percent", 技能: "skill_attribute" };
/** 造成傷害：回傳實際結算量（引擎回傳的最終傷害；0 就是 0，不以名目值代替）。
 *  st.lastDealt＝扣除護盾／護罩吸收後的預估扣血量（「對手體力未減少」）。 */
function dealDamage(ctx: BattleEventContext, side: S, amt: number, type: string, elem?: string, st?: RunState): number {
  const before = liveElf(ctx, side);
  if (st?.deferNoDmg) registerNoDmgFollowUp(ctx, side, type, st);
  if(st){st.lastDamageImmune=false;st.lastRequestedDamage=Math.max(0,Math.floor(amt));}
  const r = dealDamage0(ctx, side, amt, type, elem,st);
  if (st) st.lastDealt = Math.min(Math.max(0, before?.currentHp ?? r), settleDamageAbsorption(r, RT_TYPE[type] as any || "percent", before?.shield || 0, before?.barrier || 0).amount);
  return r;
}
function dealDamage0(ctx: BattleEventContext, side: S, amt: number, type: string, elem?: string,st?:RunState): number {
  amt = Math.max(0, Math.floor(amt));
  if (amt <= 0) return 0;
  const num = (v: any) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  const recipient=liveElf(ctx,side),active=elfOf(ctx,side);
  if(recipient && active && idOf(recipient)!==idOf(active))return num(ctx.applyDamageToElf?.(side,idOf(recipient),amt,(RT_TYPE[type] || 'percent') as any,{elem,label:`${type}傷害`,onCalculated:r=>{if(st)st.lastDamageImmune=r.incomingImmune;}}));
  if (type === "真實") return num(ctx.applyTrueDamage(side, amt, "真實傷害"));
  if (type === "固定") return num(ctx.applyFixedDamage(side, amt, "固定傷害"));
  if (type === "技能") return num(ctx.applySkillTypeDamage(side, amt, `${elem || ""}系技能傷害`, { elem, node: "attack_damage" }));
  return num(ctx.applyPinkDamage(side, amt, "百分比傷害", undefined, undefined, "percent",{onCalculated:r=>{if(st)st.lastDamageImmune=r.incomingImmune;}}));
}

/** 實際恢復量（預估）：禁療為 0；不超過已損失體力；扣除印記的恢復減少 */
export function actualHeal(ctx: BattleEventContext, side: S, amt: number): number {
  const e = liveElf(ctx, side);
  if (!e || amt <= 0) return 0;
  const own = side === ctx.actor ? ctx.getPlayerState : ctx.getOpponentState;
  const other = side === ctx.actor ? ctx.getOpponentState : ctx.getPlayerState;
  if ((own(`noHealTurns`) || 0) > 0 || (own(`${side}_noHealTurns`) || 0) > 0 || (other(`${side}_noHealTurns`) || 0) > 0 || (other("oppSealHealTurns") || 0) > 0) return 0;
  if(blocksOwnSkillRecovery((ctx as any).recoveryOrigin,side,idOf(e),Number(own('skillHealBlockTurns'))||0))return 0;
  if(blocksTimedRecovery(side==='p1'?ctx.p1Timers:ctx.p2Timers,side,idOf(e),(ctx as any).recoveryOrigin))return 0;
  const mult = Math.max(0, 1 - markRecoveryReduction(ctx.getMarks?.(side) || [], e));
  return Math.max(0, Math.min(Math.floor(amt * mult), (e.maxHp || 0) - (e.currentHp || 0)));
}
function heal(ctx: BattleEventContext, side: S, amt: number): number {
  const real = actualHeal(ctx, side, Math.floor(amt));
  const recipient=liveElf(ctx,side),active=elfOf(ctx,side);
  if(recipient && active && idOf(recipient)!==idOf(active)) {
    if(!ctx.applyHealToElf)return 0;
    ctx.applyHealToElf(side,idOf(recipient),Math.floor(amt));
  } else ctx.applyHeal(side, Math.floor(amt));
  return real;
}

/** 「附加後若對手體力未減少則…」：以實際扣血結算（OPPONENT_DAMAGE 的 hpReduced）判定 */
function registerNoDmgFollowUp(ctx: BattleEventContext, side: S, type: string, st: RunState) {
  const stmt = st.deferNoDmg!; st.deferNoDmg = undefined; (st.deferred ||= new Set()).add(stmt);
  const list = [...(ctx.getPlayerState("blkNoDmgPending") || [])].filter((x: any) => x.round === (ctx.roundNumber ?? 0));
  list.push({ round: ctx.roundNumber ?? 0, side, type: RT_TYPE[type] || "percent", body: [{ ...stmt, cond: (stmt.cond || []).filter(c => c.c !== "last_no_dmg") }] });
  ctx.setPlayerState("blkNoDmgPending", list);
}
/** 我方造成的傷害結算後（OPPONENT_DAMAGE）：檢查待決的「體力未減少」追加 */
export function settleNoDmgFollowUps(ctx: BattleEventContext, data: any) {
  const list: any[] = ctx.getPlayerState("blkNoDmgPending") || [];
  if (!list.length || !data) return;
  const dt = String(data.damageType || data.rawDamageType || "");
  const idx = list.findIndex(x => x.side === data.targetSide && (dt === x.type || (x.type === "skill_attribute" && /skill/.test(dt)) || (x.type === "true" && /true|absorb/.test(dt))));
  if (idx < 0) return;
  const [hit] = list.splice(idx, 1);
  ctx.setPlayerState("blkNoDmgPending", list);
  if ((data.hpReduced ?? 1) > 0) return;
  runStmts(ctx, hit.body, { last: null, lastAmount: 0 });
}

/** 回合類效果的登錄狀態鍵：以 turn_effect 計時器鏡像，「消除回合類效果」時一併歸零並算消除成功 */
function mirrorTurn(ctx: BattleEventContext, side: S, name: string, turns: number, keys: string[]) {
  if (!(turns > 0) || turns >= 99) return;
  const presentation = makeEffectPresentation({ mirrorRegistryKeys: keys }, ctx.skill?.name, name);
  presentation.description = name;
  ctx.addTimerTo(side, {
    id: `blk_${side}_${ctx.skill?.name || ctx.self?.name || "src"}_${name}_mirror`, name, kind: "turn_effect", source: "skill" as any,
    remaining: turns, tickAt: "round_end", stackRule: "refresh", displayChar: name[0], description: name,
    presentation,
    payload: { mirrorRegistryKeys: keys, block: { mirror: true, owner: side, src: ctx.skill?.name || ctx.self?.name } },
  } as any, false);
}
const isSkillCtx = (st: RunState) => st.sourceKind ? st.sourceKind==='skill' : !st.event || st.event.trig === "use" || st.event.trig === "after_hit" || st.event.trig === "on_invalid";
/** 技能附加且以回合計數 → 回合類效果；魂印附加的不可被消除 */
function setTurnKey(ctx: BattleEventContext, side: S, st: RunState, name: string, kv: Record<string, any>, turnsKey: string) {
  const set = side === ctx.actor ? ctx.setPlayerState : ctx.setOpponentState;
  for (const [k, v] of Object.entries(kv)) set(k, v);
  if (isSkillCtx(st)) mirrorTurn(ctx, side, name, Number(kv[turnsKey]) || 0, Object.keys(kv).filter(k => typeof kv[k] === "number" || typeof kv[k] === "boolean"));
}

// ───────── 異常免疫（分類） ─────────
const CLS_CAT: Record<string, string> = { 控制類: "CONTROL", 弱化類: "WEAKENING" };
export function statusInClass(status: string, cls: string): boolean {
  if (!cls) return true;
  const e = StatusRegistry[canonicalStatusName(status)] || StatusRegistry[status];
  const cats: string[] = (e?.categories || []) as any;
  if (cls === "非附屬類") return !cats.some(c => c === "AUXILIARY" || c === "BOSS_ONLY" || c === "NO_EFFECT");
  return cats.includes(CLS_CAT[cls]);
}
/** 引擎附加異常前查詢：積木「N回合內免疫(並反彈)X類異常」→ "reflect" | "immune" | null */
export function blockStatusGuard(timers: any[] | undefined, elf: any, status: string): "reflect" | "immune" | null {
  if(portableSkillCapabilities(elf).statusImmune)return 'immune';
  let res: "reflect" | "immune" | null = null;
  for (const t of timers || []) {
    const g = t.payload?.block?.statusGuard;
    if (!g || (t.remaining ?? 0) <= 0 || t.pendingActivation) continue;
    if (t.ownerBattleId && elf && t.ownerBattleId !== (elf.battleId || elf.id)) continue;
    if (g.exclude?.some((name:string)=>canonicalStatusName(name)===canonicalStatusName(status))) continue;
    if (!statusInClass(status, g.cls)) continue;
    if (g.reflect) return "reflect";
    res = "immune";
  }
  return res;
}

const GROUP_B_COUNTERS = groupBCounters(liveElf);
export const OPS: Record<string, OpFn> = {
  ...groupBOperations({ liveElf, addTimer: addBlockTimer, ops: () => OPS, counters: GROUP_B_COUNTERS }),
  incoming_panel_attack:setIncomingPanelAttack,
  rebirth_after_ally_turns:armConditionalRebirth,
  dmg_sum:(ctx,p,st)=>{
    const amount=p.terms.reduce((sum:number,t:DamageTerm)=>sum+damageBaseValue(t.of==='self'?ctx.self:ctx.target,t.base)*t.ratio,0);
    if(!(amount>0)||!Number.isFinite(amount))return false;
    st.lastAmount=dealDamage(ctx,ctx.targetSide,amount,p.type,undefined,st);return true;
  },
  attack_type_view_uses:(ctx,p)=>grantAttackTypeView(ctx,p),
  damage_reduction_steps:(ctx,p,st)=>{st.lastAmount=Math.floor(Math.max(0,ctx.mainSkillReduction?.reduced||0)/p.unit);return st.lastAmount>0;},
  match_max_hp:(ctx,p,st)=>{const side=sideOf(ctx,p.side),e=liveElf(ctx,side),source=liveElf(ctx,sideOf(ctx,p.source)),n=Math.max(0,source.maxHp-e.maxHp);st.lastAmount=n;if(!n)return false;const stats={...e.calculatedStats,hp:source.maxHp};if(p.reduceStats)for(const k of ['atk','def','spatk','spdef','speed'])stats[k]=Math.max(1,stats[k]-n);ctx.updateElf(side,{maxHp:source.maxHp,calculatedStats:stats});return true;},
  peel_types:(ctx,p,st)=>{const side=sideOf(ctx,p.side),elf=liveElf(ctx,side);const n=elf.typePeeled?0:String(elf.type||'').split(/[.·・]/).filter((t:string)=>t&&t!=='普通'&&t!=='無屬性').length;(st as any).peeledTypes=n;st.lastAmount=n;if(!n)return false;ctx.updateElf(side,{type:'普通',typePeeled:true,originalType:elf.originalType||elf.type,typeChangedUntilSwitch:true} as any);return true;},
  change_type:(ctx,p)=>{
    const side=sideOf(ctx,p.side),elf=liveElf(ctx,side);
    ctx.updateElf(side,{type:p.type,originalType:elf.originalType||elf.type,typeChangedUntilSwitch:true} as any);
    return true;
  },
  next_ally_entry:deferAllyEntry,
  ...resourceSnapshotOperations({liveElf}),
  ...collectionOperations({liveElf,run:(ctx,body,st)=>{snapshotConditions(ctx,[{raw:'集合子流程',trig:st.event?.trig||'use',parsed:true,body}],st);runStmts(ctx,body,st);}}),
  ...astralOperations({liveElf,run:(ctx,body,st)=>{snapshotConditions(ctx,[{raw:'星核子流程',trig:st.event?.trig||'use',parsed:true,body}],st);runStmts(ctx,body,st);},evalCond}),
  stat_apply_last:(ctx,p,st)=>{
    const changes=Object.fromEntries(Object.entries(st.lastStatLevels||{}).map(([key,value])=>[key,value*(p.direction==='opposite'?-1:1)]));
    return Object.keys(changes).length>0&&ctx.applyStatChange(sideOf(ctx,p.side),changes)?.success===true;
  },
  next_entry_priority:(ctx,p)=>{ctx.setOpponentState('nextElfPriorityConstraint',{turns:p.turns,sourceRound:ctx.roundNumber});return true;},
  heal_then:(ctx,p,st)=>{
    const side=sideOf(ctx,p.side),recipient=liveElf(ctx,side);if(!recipient)return false;
    let settled=false;
    const next=(amount:number)=>{
      if(settled)return;settled=true;
      const frame:RunState={sourceKind:st.sourceKind,last:amount>0,lastAmount:amount,event:st.event};
      snapshotConditions(ctx,[{raw:'恢復結算後連鎖',trig:st.event?.trig||'use',parsed:true,body:p.body}],frame);
      runStmts(ctx,p.body,frame);
    };
    // 恢復失敗仍繼續「然後」；死亡者不送入不回報結算的恢復佇列。
    if(checkElfDead(recipient)){next(0);return false;}
    const options={onSettled:(r:import('../battle/settlementReceipt').SettlementReceipt)=>{if(r.operation==='heal'&&r.targetBattleId===idOf(recipient))next(r.hpGained);}};
    if(ctx.applyHealToElf)ctx.applyHealToElf(side,idOf(recipient),Math.floor(recipient.maxHp*p.ratio),options);
    else ctx.applyHeal(side,Math.floor(recipient.maxHp*p.ratio),options);
    return true;
  },
  abolish_selected:(ctx,p)=>abolishSelectedSkill(ctx,sideOf(ctx,p.side)),
  consume_selected_pp:(ctx,p,st)=>{st.lastAmount=consumeSelectedPp(ctx,sideOf(ctx,p.side));return st.lastAmount>0;},
  // 印記層數鎖：遞減動作依目前持有者讀取；包含啟動當回合。
  mark_lock_turns:(ctx,p,st)=>{
    if(!(p.turns>0)||typeof p.id!=='string'||!p.id)return false;
    addBlockTimer(ctx,ctx.actor,`印記鎖`,p.turns,'turns',{markLock:{id:p.id}},false,isSkillCtx(st)?'turn_effect':'round_counter',true,'elf',`markLock:${st.sourceKind||'skill'}:${isSkillCtx(st)?ctx.skill?.name||'skill':'passive'}:${ctx.self.battleId||ctx.self.id}:${p.id}`);
    ctx.addLog(`🔒 ${p.turns} 回合內【${p.id}】層數不再減少！`,'effect');
    return true;
  },
  // 關閉陣形計時器並觸發關閉懲罰：體力調整為1、所有技能PP歸0、1回合無法主動切換（通用，不認特定陣形名）。
  close_formation:(ctx,p,st)=>{
    const formationId=typeof p.formationId==='string'&&p.formationId?p.formationId:'dixin_formation';
    if(closeFormationWindow(ctx,formationId,(body,sourceKind)=>runStmts(ctx,body,{last:null,lastAmount:0,sourceKind,event:{trig:st.event?.trig||'round_end',data:st.event?.data}})))return true;
    const sideTimers=(s:S)=>s==='p1'?ctx.p1Timers:ctx.p2Timers;
    const owner=idOf(ctx.self);
    if(!(sideTimers(ctx.actor)||[]).some(t=>ownsActiveFormation(t,formationId,owner)))return false;
    // 移除指定陣形計時器：consumeTimer 為「次數型扣一次」語義，回合型計時器須扣到歸零才會消失。
    for(const s of [ctx.actor,ctx.targetSide] as S[]){
      for(const t of [...(sideTimers(s)||[])]){
        if((s===ctx.actor&&ownsActiveFormation(t,formationId,owner))||linksFormation(t,formationId,ctx.actor,owner)){
          let guard = (t.remaining || 1) + 2;
          while (guard-- > 0 && (sideTimers(s) || []).some((x:any)=>x.id===t.id&&(x.remaining??0)>0)) ctx.consumeTimer?.(s, t.id);
        }
      }
    }
    // 同步清除陣形狀態鍵（dixin_formation → dixinFormationRounds／dixinFormationAtNine），避免後續 CHECK 重建。
    const stem = formationId.replace(/_formation$/, '');
    if (stem) {
      // 只清回合數，保留 AtNine 旗標：runDixinFormation 的重建檢查讀 AtNine，保留即不會在後續事件重建。
      ctx.setPlayerState(`${stem}FormationRounds`, 0);
    }
    ctx.adjustHp?.(ctx.actor,1-(ctx.self.currentHp||0));
    ctx.updateElf(ctx.actor,{skills:ctx.self.skills.map(sk=>({...sk,pp:0,currentPp:0}))});
    addBlockTimer(ctx,ctx.actor,'陣形關閉·鎖切換',p?.lockTurns??1,'turns',{lockSwitch:true},false,isSkillCtx(st)?'turn_effect':'round_counter');
    ctx.addLog(`👑 陣形關閉懲罰：體力調整為1、PP歸0，${(p?.lockTurns??1)}回合內無法主動切換精靈！`,'effect');
    return true;
  },
  // 每場戰鬥一次的技能主體成功：用後失去必中、命中歸0；之後選擇該技能時令對方當回合先制-v。
  once_used_degrade:(ctx,p,st)=>{
    const key=`blockOnce:${(ctx as any).illusionEffectKey||''}:${p.key}`;
    if(ctx.getPlayerState(key))return false;
    ctx.setPlayerState(key,true);
    ctx.setPlayerState(`${p.key}:degraded`,true);
    ctx.addLog(`📜 【${ctx.skill?.name||'技能'}】本場戰鬥輝煌效果已經用過，此後失去必中且命中率歸0，但選擇該技能時令對方當回合先制${p.v>0?'-':''}${p.v}！`,'effect');
    return true;
  },
  resource_mark_add:(ctx,p,st)=>{
    const amount=p.amount===undefined?Math.floor(st.lastAmount*p.ratio):p.amount;if(!(amount>0)||!Number.isSafeInteger(amount))return false;
    const side=sideOf(ctx,p.side),owner=p.scope==='elf'?idOf(liveElf(ctx,side)):undefined;
    const previous=ctx.getMarks(side).find(m=>m.id===p.id&&m.ownerBattleId===owner);
    const before=previous?.count||0,count=Math.min(p.maxCount??Infinity,before+amount);if(!Number.isSafeInteger(count)||count===before)return false;
    ctx.setMark({...previous,id:p.id,name:p.name,displayChar:p.displayChar,unit:p.unit,description:p.description,count,scope:p.scope,ownerBattleId:owner,persistsOffField:p.persistsOffField,clearable:false,
      ...(p.maxCount===undefined?{}:{maxCount:p.maxCount}),
      ...(p.snapshotKey?{effects:{...previous?.effects,[p.snapshotKey]:[...(previous?.effects?.[p.snapshotKey]||[]),...Array(count-before).fill(liveElf(ctx,side).maxHp)]}}:{}),
      ...(p.incomingDamageReduction?{effects:{...previous?.effects,incomingDamageReduction:{...p.incomingDamageReduction}}}:{})},side);
    const after=ctx.getMarks(side).find(m=>m.id===p.id&&m.ownerBattleId===owner)?.count||0;
    if(after===before)return false;
    /**
     * 2026-10-30：詩章（snapshotKey）**不改體力上限**。
     *
     * 官方描述：「紀錄持有者精靈的體力上限，當持有精靈死亡時，詩章將轉移給
     * 存活狀態的治癒.龍魂再臨 次元龍以增加其等量體力上限」。
     *
     * 也就是：持有期間只是「記錄」，體力上限的提高發生在**死亡轉交時**
     * （由 src/effects/rules/snapshotResources.ts 的 faint 規則處理）。
     *
     * 先前這裡直接 updateElf 加 maxHp，造成持有者每取得一篇就漲一次上限，已移除。
     */
    ctx.emitElfEvent?.(side,liveElf(ctx,side),EffectTiming.RESOURCE_CHANGED,{side,targetBattleId:idOf(liveElf(ctx,side)),id:p.id,before,after});return true;
  },
  type_damage_floor_turns:(ctx,p)=>grantTypeDamageFloor(ctx,p),
  damage_floor:(ctx,p,st)=>{
    const comp=st.event?.data?.damageComp||(ctx as any).damageComp;
    if(!comp||comp.isIncoming||comp.damageCategory!=='skill_attack')return false;
    const side=sideOf(ctx,p.side),base=p.base==='全隊體力上限'?ctx.getFullTeam(side).filter(e=>!e.isVanished).reduce((n,e)=>n+e.maxHp,0):liveElf(ctx,side).maxHp;
    comp.floor=Math.max(comp.floor||0,Math.floor(base*p.ratio));return true;
  },
  damage_to_heal_turns:(ctx,p,st)=>{
    addBlockTimer(ctx,ctx.actor,'傷害轉體力',p.turns,'turns',{convertDamageToHeal:true,kind:p.kind,sourceKind:st.sourceKind},!!p.next,isSkillCtx(st)?'turn_effect':'round_counter',!p.next);
    return true;
  },
  instant_kill:(ctx,p,st)=>{
    if(!chance(ctx,`instant_kill:${ctx.skill?.name}`,p.chance))return false;
    return ctx.applyInstantKill?.(ctx.targetSide,'秒殺',{onSettled:r=>{st.lastAmount=r.hpLost;st.lastDealt=r.hpLost;}})===true;
  },
  prevent_instant_kill:(ctx,p)=>{
    const request=instantKillRequest(ctx);if(!request)return false;
    const owns=p.dir==='out'?request.sourceSide===ctx.actor&&(p.scope==='team'||request.sourceBattleId===idOf(ctx.self))
      :request.targetSide===ctx.actor&&(p.scope==='team'||request.targets.some(t=>t.side===ctx.actor&&t.id===idOf(ctx.self)));
    if(!owns)return false;request.blocked=true;ctx.addLog?.(p.dir==='out'?'🛡️ 令己方秒殺失效！':'🛡️ 令對方秒殺失效！','effect');return true;
  },
  instant_kill_same_hp_targets:(ctx)=>{
    const request=instantKillRequest(ctx);if(!request||request.sourceSide!==ctx.actor||request.sourceBattleId!==idOf(ctx.self))return false;
    const original=request.targets.find(t=>t.id===request.targetBattleId&&t.side===request.targetSide);if(!original)return false;
    for(const e of ctx.getFullTeam(request.targetSide)||[])if(!e.isVanished&&!e.isExtra&&!checkElfDead(e)&&e.currentHp===original.hpSnapshot)
      request.targets.push({side:request.targetSide,id:idOf(e),hpSnapshot:e.currentHp});
    return true;
  },
  pp_op:(ctx,p,st)=>{
    const side=sideOf(ctx,p.side);
    // kind 過濾（2026-10-15 星核脈衝）：'屬性'＝只作用屬性技能槽；'攻擊'＝只作用非屬性槽；未填＝全部。
    const only=p.kind?(s:any)=>p.kind==='屬性'?s.category==='屬性':s.category!=='屬性':undefined;
    if(p.captureRestored){
      const report={restored:0};st.lastAmount=0;
      const changed=applyKitPpOperation(ctx,side,p.mode,p.amount||0,only,report);
      st.lastAmount=report.restored;return changed;
    }
    if(!p.stopIfEmpty)return applyKitPpOperation(ctx,side,p.mode,p.amount || 0,only);
    // 「若因此對手PP值歸0則對手當回合無法行動」：以該回合對手已選的技能槽判定。
    const slot=skillSlot(liveElf(ctx,side),ctx.opponentSkill),report={emptied:[] as number[]};
    const changed=applyKitPpOperation(ctx,side,p.mode,p.amount || 0,only,report);
    if(slot>=0&&report.emptied.includes(slot))(side===ctx.actor?ctx.setPlayerState:ctx.setOpponentState)('actionPreventedRound',ctx.roundNumber);
    return changed;
  },
  noop: () => true,
  note: () => true,
  status: (ctx, p, st) => {
    const sides: S[] = p.side === "both" ? [ctx.targetSide, ctx.actor] : [sideOf(ctx, p.side)];
    let ok = false;
    // chanceHpRatio：以自身體力當前百分比作為機率（「有等同於自身體力當前百分比機率…」）；100% 不消耗亂數。
    const pct = Math.max(markCapability(liveElf(ctx,ctx.actor),'statusChanceFloor'),p.chanceHpRatio === true
      ? Math.max(0, Math.min(100, ((liveElf(ctx, ctx.actor)?.currentHp ?? 0) / (liveElf(ctx, ctx.actor)?.maxHp || 1)) * 100))
      : increasingStatusChance(ctx, p));
    if (statusChanceBlocked(ctx, pct) || !chance(ctx, `st:${p.status}`, pct)) return false;
    for (const s of sides) ok = applyStatus(ctx, s, p.status, p.turns) || ok;
    return ok;
  },
  status_collection:(ctx,p)=>applyStatusCollection(ctx,p),
  status_or_extend:(ctx,p)=>{
    const sides:S[]=p.side==='both'?[ctx.actor,ctx.targetSide]:[sideOf(ctx,p.side)];let any=false;
    for(const side of sides)any=applyOrExtendStatus(ctx,side,liveElf(ctx,side),p.status,p.turns,p.extend)||any;return any;
  },
  status_chance_turns: (ctx, p, st) => OPS.status(ctx, p, st),
  status_seq: (ctx, p, st) => {
    if (p.chance != null && (statusChanceBlocked(ctx, p.chance) || !chance(ctx, `seq:${p.list}`, p.chance))) return false;
    const sides:S[]=p.side==='both'?[ctx.actor,ctx.targetSide]:[p.side==='self'?ctx.actor:ctx.targetSide];
    // 「隨機附加其中 N 種」：count 指定抽取數（'fifth_pp_diff'＝第五技能PP差；競技場通用讀取端）。
    const pool = p.countFrom ? [...p.list] : null;
    if (pool) {
      const n = p.countFrom === 'peeledTypes' ? Number((st as any).peeledTypes)||0 : p.countFrom === 'fifth_pp_diff' ? fifthPpDiff(ctx) : Math.min(Number(p.countFrom) || 0, pool.length);
      let any = false,failed=0;
      for (const side of sides) {
        const local = [...pool];
        for (let i = 0; i < Math.min(n, local.length); i++) {
          const idx = Math.floor((ctx.rng?.() ?? Math.random()) * local.length);
          const ok=applyStatus(ctx, side, local.splice(idx, 1)[0], p.turns);if(!ok)failed++;any=ok||any;
        }
      }
      if(p.countFrom==='peeledTypes')st.lastAmount=failed;
      return any;
    }
    let any=false,failed=0;for(const side of sides)for(const name of p.list){const ok=applyStatus(ctx,side,name,p.turns);if(!ok)failed++;any=ok||any;}if(p.countFailures)st.lastAmount=failed;return any;
  },
  status_random: (ctx, p) => {
    // 候選池一律取自正式 StatusRegistry 分類，不用手寫清單（避免漏掉新異常或分類錯誤）。
    // 「非附屬類」＝排除附屬類與 BOSS 專用／無效果類；這是分類語意，不是「只取某幾種」。
    const cls: Record<string, string> = { 控制類: "CONTROL", 弱化類: "WEAKENING", 限制類: "RESTRICTIVE", 衍化類: "EVOLUTIONARY", 附屬類: "AUXILIARY" };
    const want = cls[String(p.cls ?? "")];
    const pool = Object.keys(StatusRegistry).filter(name => {
      const cats = StatusRegistry[name]?.categories || [];
      if (!cats.length) return false;
      // 別名（如「麻痹」）與同分類重複名稱不重複計入；只保留正式登錄名稱。
      if (StatusRegistry[name]?.name !== name) return false;
      if (cats.includes("NO_EFFECT" as any)) return false;
      if (p.cls === "非附屬類") return !cats.includes("AUXILIARY" as any) && !cats.includes("BOSS_ONLY" as any);
      return want ? cats.includes(want as any) : !cats.includes("BOSS_ONLY" as any);
    });
    if (!pool.length) return false;
    const r = ctx.rng || Math.random; const picked = new Set<string>();
    // 無放回抽樣：以洗牌取代「重抽直到湊滿」，固定亂數也不會無限迴圈。
    const bag = [...pool];
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    for (const s of bag) { if (picked.size >= Math.min(p.count, pool.length)) break; picked.add(s); }
    let any = false; picked.forEach(s => { any = applyStatus(ctx, ctx.targetSide, s) || any; }); return any;
  },
  cure_status: (ctx, p, st) => {
    st.lastAmount=0;
    const sides: S[] = p.side === "both" ? [ctx.actor, ctx.targetSide] : [sideOf(ctx, p.side)];
    let any = false;
    for (const s of sides) {
      const e=liveElf(ctx,s),before=ctx.getStatuses(e) || {};
      if(!hasAbn(ctx,e))continue;
      const updated={...e,effects:[...(e.effects || [])],battleStatuses:{...before}};
      if(p.cls){
        const category:Record<string,string>={控制類:'CONTROL',弱化類:'WEAKENING',限制類:'RESTRICTIVE',衍化類:'EVOLUTIONARY',附屬類:'AUXILIARY'};
        for(const id of Object.keys(before)){
          const cats=StatusRegistry[canonicalStatusName(id)]?.categories||[];
          if(cats.includes('BOSS_ONLY'))continue;
          if(p.cls==='非附屬類'?!cats.includes('AUXILIARY'):cats.includes(category[p.cls] as any))removeStatusEffect(updated,id);
        }
      }else clearAllStatuses(updated);
      if(JSON.stringify(before)!==JSON.stringify(ctx.getStatuses(updated) || {})) {
        st.lastAmount+=Object.keys(before).filter(id=>!(id in (ctx.getStatuses(updated)||{}))).length;
        ctx.updateElf(s,{effects:updated.effects,battleStatuses:updated.battleStatuses,battleStatus:updated.battleStatus,battleStatusDuration:updated.battleStatusDuration} as any);any=true;
      }
    }
    if (any) ctx.addLog(`🌿 解除了異常狀態！`, "status");
    return any;
  },
  convert_status: (ctx, p) => {
    const side = sideOf(ctx, p.side); const e = liveElf(ctx, side);
    const before = ctx.getStatuses(e) || {};
    // 常駐主權（status_conversion_ban）：持有者列入保護的異常不可被轉化為其他異常狀態（5015 夜）。
    const conversionBanned=((side===ctx.actor?ctx.getPlayerState:ctx.getOpponentState)('blkStatusConversionBan')||[]).map((n:string)=>canonicalStatusName(n));
    if(p.from!==undefined){
      const matched=Object.keys(before).filter(id=>canonicalStatusName(id)===canonicalStatusName(p.from)&&!conversionBanned.includes(canonicalStatusName(id))&&!StatusRegistry[canonicalStatusName(id)]?.categories.includes('BOSS_ONLY'));
      if(!matched.length||!applyStatus(ctx,side,p.status,p.turns))return false;
      // 附加失敗時保留來源；成功後只移除指定異常，避免清掉無關異常與新附加的目標。
      const current=liveElf(ctx,side),updated={...current,effects:[...(current.effects||[])],battleStatuses:{...(ctx.getStatuses(current)||{})}};
      for(const id of matched)removeStatusEffect(updated,id);
      ctx.updateElf(side,{effects:updated.effects,battleStatuses:updated.battleStatuses,battleStatus:updated.battleStatus,battleStatusDuration:updated.battleStatusDuration} as any);return true;
    }
    const convertible = Object.keys(before).filter(id => {
      const entry = StatusRegistry[canonicalStatusName(id)];
      return entry && !entry.categories.includes('BOSS_ONLY') && !conversionBanned.includes(canonicalStatusName(id));
    });
    if (!convertible.length) return false;
    // 只移除真正被轉化的異常，不把計時效果／其他增益及BOSS特性一起清空。
    const updated = { ...e, effects: [...(e.effects || [])], battleStatuses: { ...before } };
    for (const id of convertible) removeStatusEffect(updated, id);
    ctx.updateElf(side, { effects: updated.effects, battleStatuses: updated.battleStatuses,
      battleStatus: updated.battleStatus, battleStatusDuration: updated.battleStatusDuration } as any);
    return applyStatus(ctx, side, p.status, p.turns);
  },
  immune_status_count: (ctx, p) => grantCountedStatusImmunity(ctx, p),
  immune_status_turns: (ctx, p, st) => {
    if (p.cls || p.exclude?.length) {
      // 分類免疫（控制類／弱化類／非附屬類）：引擎附加異常前以 blockStatusGuard 依分類判定
      addBlockTimer(ctx, ctx.actor, `免疫${p.reflect ? "並反彈" : ""}${p.exclude?.length?`除${p.exclude.join('、')}外`:''}${p.cls || '所有'}異常`, p.turns, "turns", { statusGuard: { cls: p.cls || '', reflect: !!p.reflect, ...(p.exclude?.length?{exclude:[...p.exclude]}:{}) } }, false, isSkillCtx(st) ? "turn_effect" : "round_counter");
    } else {
      const key = p.reflect ? "reflectStatusTurns" : "immuneStatusTurns";
      setTurnKey(ctx, ctx.actor, st, `免疫${p.reflect ? "並反彈" : ""}異常`, { [key]: Math.max(p.turns, ctx.getPlayerState(key) || 0) }, key);
    }
    ctx.addLog(`🛡️ ${p.turns} 回合內免疫${p.reflect ? "並反彈" : ""}${p.exclude?.length?`除${p.exclude.join('、')}外`:''}${p.cls || ""}異常狀態！`, "effect"); return true;
  },
  immune_status_perm: (ctx) => { ctx.setPlayerState("immuneStatusTurns", 999); return true; },
  immune_statdown_turns: (ctx, p, st) => { setTurnKey(ctx, ctx.actor, st, "免疫能力下降", { immuneStatDownTurns: p.turns }, "immuneStatDownTurns"); return true; },

  stat_clear: (ctx, p, st) => {
    const sides: S[] = p.side === "both" ? [ctx.actor, ctx.targetSide] : [sideOf(ctx, p.side)];
    let any = false;
    if(p.captureLevels)st.lastAmount=0;
    for (const s of sides) {
      const before={...(liveElf(ctx,s)?.statStages||{})};
      any = resetStages(ctx, s, v => (p.kind === "up" ? v > 0 : p.kind === "down" ? v < 0 : v !== 0)) || any;
      if(p.captureLevels){
        const after=liveElf(ctx,s)?.statStages||{};
        for(const [key,value] of Object.entries(before))if(typeof value==='number'&&value!==0&&Number(after[key]||0)===0&&(p.kind==='up'?value>0:p.kind==='down'?value<0:true))st.lastAmount+=Math.abs(value);
      }
    }
    if (any) ctx.addLog(`🧹 消除了能力${p.kind === "up" ? "提升" : p.kind === "down" ? "下降" : "變化"}狀態！`, "status");
    return any;
  },
  stat_steal: (ctx, p) => {
    // 對手處於「能力提升無法被消除或吸取」：吸取整體失敗（不先替自身加上）
    if (p.mode === "吸取" && ((Number(ctx.getOpponentState("statBoostUnclearableTurns")) || 0) > 0||stageOperationBlocked(ctx,ctx.targetSide,1,'steal'))) return false;
    const limit=p.v===undefined?Infinity:p.v*(p.perMark?readMarkStacks(ctx,p.perMark):1);
    if(!(limit>0))return false;
    const opp: any = liveElf(ctx, ctx.targetSide); const gains: Record<string, number> = {},taken:Record<string,number>={}; let any = false;
    for (const k in (opp.statStages || {})) { const v = opp.statStages[k]; if (typeof v === "number" && v > 0) { taken[k]=Math.min(v,limit);gains[k] = taken[k] * (p.double ? 2 : 1); any = true; } }
    if (!any) return false;
    ctx.applyStatChange(ctx.actor, gains);
    if (p.mode === "吸取") {
      // 「吸取並反轉」：對手的 +N 變成 -N（不是清零）；與僅「吸取」的清除語意不同。
      if (p.reverse) {
        const stages: Record<string, number> = { ...(opp.statStages || {}) };
        let changed = false;
        for (const k in stages) if (typeof stages[k] === "number" && stages[k] > 0) { stages[k] = -stages[k]; changed = true; }
        if (changed) ctx.updateElf(ctx.targetSide, { statStages: stages as any });
      } else if(p.v!==undefined){
        const stages={...(opp.statStages||{})};for(const [key,value] of Object.entries(taken))stages[key]-=value;
        ctx.updateElf(ctx.targetSide,{statStages:stages});
      } else resetStages(ctx, ctx.targetSide, v => v > 0,'steal');
    }
    return true;
  },
  stat_reverse: (ctx, p,st) => {
    st.lastStatLevels={};
    const side = sideOf(ctx, p.side); const e = liveElf(ctx, side);
    const stages: Record<string, number> = { ...(e?.statStages || {}) }; let any = false;
    const boosted: Record<string, number> = {};
    for (const k in stages) { const v = stages[k]; if (typeof v === "number" && (p.kind === 'all'?v!==0:p.kind === "down" ? v < 0 : v > 0)&&!stageOperationBlocked(ctx,side,v,'reverse')) { boosted[k] = v; stages[k] = -v; any = true; } }
    const before={...(e?.statStages||{})};
    if (any) ctx.updateElf(side, { statStages: stages as any });
    const after=liveElf(ctx,side)?.statStages||{};
    for(const key of Object.keys(before))if(before[key]!==0&&stages[key]===-before[key]&&after[key]===stages[key])st.lastStatLevels[key]=after[key];
    // 通用（arenaShared 語意）：transfer＝反轉成功後自身附加相同能力提升（原值）；
    // failClear＝反轉失敗（無可反轉項）時消除對手能力提升（萬蒼書帝錄）。
    if (any && p.transfer) {
      const selfElf = liveElf(ctx, ctx.actor);
      const selfStages: Record<string, number> = { ...(selfElf?.statStages || {}) };
      for (const [k, v] of Object.entries(boosted)) selfStages[k] = Math.min(6, (selfStages[k] || 0) + v);
      ctx.updateElf(ctx.actor, { statStages: selfStages as any });
      ctx.addLog?.('🔁 反轉成功：自身附加相同能力提升！', 'effect');
    }
    if (!any && p.failClear) {
      const oppStages: Record<string, number> = { ...(liveElf(ctx, side)?.statStages || {}) };
      let cleared = false;
      for (const k in oppStages) if (oppStages[k] > 0) { oppStages[k] = 0; cleared = true; }
      if (cleared) { ctx.updateElf(side, { statStages: oppStages as any }); ctx.addLog?.('🚫 反轉失敗：消除對手能力提升！', 'effect'); }
    }
    return any&&Object.keys(stages).some(k=>Number(liveElf(ctx,side)?.statStages?.[k] || 0)!==Number(before[k] || 0));
  },
  stat: (ctx, p) => {
    if (!chance(ctx, `stat:${p.stats}`, p.chance ?? 100)) return false;
    let changed=false;
    const apply = (side: "self" | "opp" | "both" | "auto", stats: string[], v: number) => {
      const who = side === "auto" ? (v > 0 ? "self" : "opp") : side;
      const sides: S[] = who === "both" ? [ctx.actor, ctx.targetSide] : [sideOf(ctx, who)];
      const ch: Record<string, number> = {};
      for (const s of stats) for (const k of STAT_KEYS[s] || []) ch[k] = v;
      for (const s of sides) {
        const before={...liveElf(ctx,s)?.statStages},result=ctx.applyStatChange(s, ch);
        changed=changed || (result ? result.success : Object.keys(ch).some(k=>(liveElf(ctx,s)?.statStages?.[k] || 0)!==(before[k] || 0)));
      }
    };
    let value=p.v;
    if(p.hpGapUnit){
      const recipient=liveElf(ctx,sideOf(ctx,p.side)),other=liveElf(ctx,p.side==='self'?ctx.targetSide:ctx.actor);
      value=Math.min(6,value+Math.floor(Math.max(0,recipient.currentHp-other.currentHp)/p.hpGapUnit));
    }
    apply(p.side, p.stats, value);
    if (p.stats2) apply(p.side2, p.stats2, p.v2);
    return changed;
  },

  heal: (ctx, p, st) => { const side = sideOf(ctx, p.side); const e = liveElf(ctx, side); const amt = Math.floor(e.maxHp * p.ratio)+Math.floor(Math.max(0,e.maxHp-e.currentHp)*(p.missingRatio??0)); const real = heal(ctx, side, amt); st.lastAmount = real; (st as any).lastHealOverflow = Math.max(0, amt - real); ctx.addLog(`💚 恢復了 ${real} 點體力！`, "heal"); return real > 0; },
  /**
   * 「（恢復後）每溢出N點：下回合受到的攻擊傷害減少X%且獲得M點護盾」：讀前一個恢復動作的溢出量（請求量−實際恢復量）。
   * 減傷為下回合的回合計數（附加當回合不生效），上限100%。
   */
  heal_overflow: (ctx, p, st) => {
    const over = Number((st as any).lastHealOverflow) || 0;
    const n = Math.floor(over / p.unit);
    if (n <= 0) return false;
    if (p.reduce) addBlockTimer(ctx, ctx.actor, `溢出減傷${Math.round(Math.min(1, n * p.reduce) * 100)}%`, 1, "turns", { dmgIn: -Math.min(1, n * p.reduce), kind: p.kind || "攻擊" }, true, isSkillCtx(st) ? "turn_effect" : "round_counter");
    if (p.shield) ctx.applyShield(ctx.actor, n * p.shield);
    ctx.addLog(`🔷 恢復溢出 ${over} 點：下回合受到的${p.kind || "攻擊"}傷害減少 ${Math.round(Math.min(1, n * (p.reduce || 0)) * 100)}%、獲得 ${n * (p.shield || 0)} 點護盾！`, "effect");
    return true;
  },
  /** 「本場戰鬥自身造成的X傷害提升a%，最高b%」：每次累加，跟著精靈保留（個體鍵），由引擎攻擊流程讀取 battleDamageBoost */
  battle_boost: (ctx, p) => {
    const cur = Number(ctx.getPlayerState("battleDamageBoost")) || 0;
    const next = Math.min(p.cap ?? Infinity, Math.round((cur + p.inc) * 1e6) / 1e6);
    if (next <= cur) return false;
    ctx.setPlayerState("battleDamageBoost", next);
    ctx.addLog(`📈 本場戰鬥造成的攻擊傷害提升 ${Math.round(next * 100)}%！`, "effect");
    return true;
  },
  heal_flat: (ctx, p, st) => { st.lastAmount = heal(ctx, ctx.actor, p.amount); return st.lastAmount > 0; },
  heal_collection:(ctx,p,st)=>{
    if(!ctx.applyHealToElf)return false;
    const side=sideOf(ctx,p.side),active=elfOf(ctx,side);
    const targets=(ctx.getFullTeam(side)||[]).filter(e=>!e.isVanished&&e.currentHp>0&&e.currentHp<e.maxHp&&(p.scope==='team'||idOf(e)!==idOf(active)));
    // 多目標恢復各走正式結算；集合不是一個可借用於「等量」的單目標數值。
    st.lastAmount=0;
    for(const target of targets)ctx.applyHealToElf(side,idOf(target),p.amount);
    return targets.length>0;
  },
  heal_equal: (ctx, _p, st) => {
    // 「傷害提升X%並恢復等量體力」：等量＝本次攻擊傷害（只含攻擊傷害）
    if (st.prevOp === "boost") {
      ctx.setPlayerState("vampireRatio", 1);
      ctx.setPlayerState("vampireDamageTypesThisAction", ["attack"]);
      return true;
    }
    if (!st.lastAmount) return false; const real = heal(ctx, ctx.actor, st.lastAmount); st.lastAmount = real; return real > 0;
  },
  dmg_from_last: (ctx, p, st) => { const amount=p.basis==='requested_damage'?st.lastRequestedDamage:st.lastAmount;if (!amount) return false; st.lastAmount = dealDamage(ctx, ctx.targetSide, amount * p.ratio, p.type, p.elem, st); return true; },
  vampire: (ctx, p, st) => {
    // 傷害結算後（afterHit 句）：等量＝實際攻擊傷害×比例
    if (st.event?.trig === "after_hit") { st.lastAmount = Math.floor((ctx.getPlayerState("blkLastHitDamage") || 0) * p.ratio); return st.lastAmount > 0; }
    ctx.setPlayerState("vampireRatio", p.ratio); ctx.setPlayerState("vampireDamageTypesThisAction", [p.kind === "攻擊" ? "attack" : "skill"]); return true; },
  stat_value: (ctx, p) => {
    const side=sideOf(ctx,p.side),e=liveElf(ctx,side);
    if(!e.calculatedStats||p.stats.some((key:string)=>!Number.isFinite(e.calculatedStats[key])))return false;
    const stats={...e.calculatedStats};
    for(const key of p.stats)stats[key]=Math.max(p.floor,(key==='hp'?e.maxHp:stats[key])+(p.direction==='decrease'?-p.amount:p.amount));
    ctx.updateElf(side,{calculatedStats:stats,...(p.stats.includes('hp')?{maxHp:stats.hp,currentHp:Math.min(e.currentHp,stats.hp)}:{})});return true;
  },
  maxhp: (ctx, p, st) => {
    const side = sideOf(ctx, p.side); const e = liveElf(ctx, side);
    st.maxHpBeforeChange ||= {};
    st.maxHpBeforeChange[side] ??= e.maxHp;
      const ratio=p.perStageKinds?Math.round((p.ratio+readStageKinds(ctx,p.perStageKinds)*p.perStageKinds.amount)*1e12)/1e12:p.ratio;
      const newMax = Math.max(1, Math.floor(e.maxHp * (1 + (p.direction === 'decrease' ? -ratio : ratio))+(p.perStageKinds?1e-9:0)));
      ctx.updateElf(side, { maxHp: newMax, currentHp: Math.min(e.currentHp, newMax),
        ...(e.calculatedStats ? {calculatedStats:{...e.calculatedStats,hp:newMax}} : {}) } as any);
    ctx.addLog(`❤️ 【${e.name}】體力上限變為 ${newMax}！`, "effect");
    return true;
  },
  dmg: (ctx, p, st) => {
    if(p.doublePer) {const n=PER_COUNTERS[p.doublePer]?.(ctx)??0; const factor=2**n; p={...p,...(p.flat!=null?{flat:p.flat*factor}:{ratio:p.ratio*factor})};}
    const send = (amount:number) => p.appendToAttack
      ? ctx.applySkillTypeDamage(ctx.targetSide, amount, '附加技能傷害', {elem:p.elem,appendToAttack:true})
      : dealDamage(ctx, ctx.targetSide, amount, p.type, p.elem, st);
    if (p.flat != null) {
      const amount=p.flat*(p.perStage?readStageLevels(ctx,p.perStage):1)*(p.perMark?readMarkStacks(ctx,p.perMark):1);
      if (p.both) { dealDamage(ctx, ctx.actor, amount, p.type); }
      st.lastAmount = send(amount); return true;
    }
    const base = liveElf(ctx, sideOf(ctx, p.of));
    if (p.base === "護盾值") { const sv = base?.shield || 0; if (sv <= 0) return false; st.lastAmount = send(sv * p.ratio); return true; }
    let v = damageBaseValue(base,p.base);
    if (String(p.base).startsWith("stat:")) {
      const cs = base.calculatedStats || {};
      v = (DAMAGE_STAT_BASES[p.base] || []).reduce((a, k) => a + (cs[k] || 0), 0);
    }
    const bonus=p.stepUnit===undefined?0:Math.floor(Math.max(0,v)/p.stepUnit)*p.stepBonus;
    st.lastAmount = send(v * p.ratio+bonus);
    return true;
  },
  dmg_equal: (ctx, p, st) => { if (!st.lastAmount) return false; st.lastAmount = dealDamage(ctx, ctx.targetSide, st.lastAmount, p.type, undefined, st); return true; },
  dmg_after_action:(ctx,p,st)=>{
    if(!Number.isInteger(ctx.actionId))return false;
    const base=liveElf(ctx,sideOf(ctx,p.of));
    const value=p.base==='當前體力'?base.currentHp:p.base==='已損失體力'?base.maxHp-base.currentHp:p.base==='護盾值'?base.shield||0:String(p.base).startsWith('stat:')?(DAMAGE_STAT_BASES[p.base]||[]).reduce((sum,key)=>sum+(base.calculatedStats?.[key]||0),0):base.maxHp;
    const flat=Math.max(0,Math.floor(value*p.ratio));if(!flat)return false;
    const serial=st.deferredDamageSerial=(st.deferredDamageSerial||0)+1;
    addBlockTimer(ctx,ctx.actor,'本次行動後快照傷害',1,'uses',{
      trig:'self_after_skill',boundActionId:ctx.actionId,targetBattleId:idOf(ctx.target),consumeOnFire:true,
      body:[{acts:[{op:'dmg',p:{flat,type:p.type},label:'本次行動後快照傷害'}]}],
    },false,undefined,false,'elf',`blk_deferred:${ctx.actor}:${idOf(ctx.self)}:${ctx.actionId}:${ctx.skill?.name}:${(ctx as any).illusionEffectKey||''}:${serial}`);return true;
  },
  next_power_nonfull:(ctx,p)=>snapshotNextPowerForNonfullTeam(ctx,p),
  heal_main_settled:(ctx,p,st)=>{const amount=Math.floor(((ctx as any).effectEventData?.settledDamage||0)*p.ratio);st.lastAmount=heal(ctx,ctx.actor,amount);return st.lastAmount>0;},
  checked_percent_drain:(ctx,p,st)=>{st.lastAmount=checkedPercentDrain(ctx,p);st.lastDealt=st.lastAmount;return st.lastAmount>0;},
  drain: (ctx, p, st) => {
    const t: any = liveElf(ctx, ctx.targetSide);
    const durationSides:S[]=p.perStatusTurns==='both'?[ctx.actor,ctx.targetSide]:p.perStatusTurns?[sideOf(ctx,p.perStatusTurns)]:[];
    const amt = p.basis==='attack_damage'?Math.floor(Math.max(0,ctx.mainSkillHpReduced||0)*p.ratio):p.basis==='event_damage'?Math.floor(Math.max(0,Number((ctx as any).damageDealt ?? (ctx as any).settledDamage ?? st.event?.data?.settledDamage ?? (ctx as any).damage) || 0)*(p.ratio ?? 1)):p.flat != null ? p.flat*(p.perMark?readMarkStacks(ctx,p.perMark):p.perStatusTurns?statusDurationSum(ctx,durationSides.map(side=>liveElf(ctx,side))):1) : p.cur ? Math.floor(t.currentHp * p.ratioCur) : p.ofSelf ? Math.floor(liveElf(ctx, ctx.actor).maxHp * p.ratio) : Math.floor(t.maxHp * p.ratio);
    // 競技場通用（arenaShared）：每級能力下降吸取（點數＝固定型）／第五技能PP差翻倍。
    const perStageAmt = p.perStageDown ? arenaDrainAmount(ctx, p, 0) : 0;
    const kind = p.true ? "true" : (p.flat != null || p.perStageDown) ? "fixed" : "percent";
    const amt2 = p.perStageDown ? perStageAmt : ((p.perStageDown || p.ppDiffDouble) ? arenaDrainAmount(ctx, p, amt) : amt);
    if (st.deferNoDmg) registerNoDmgFollowUp(ctx, ctx.targetSide, kind === "true" ? "真實" : kind === "fixed" ? "固定" : "百分比", st);
    st.lastDamageImmune = false;
    st.lastRequestedDamage = Math.max(0, Math.floor(amt2));
    st.lastAmount = queueHpDrain(ctx, ctx.targetSide, amt2, kind, undefined, {
      onCalculated: receipt => { st.lastDamageImmune = receipt.incomingImmune; },
    }); st.lastDealt = st.lastAmount;
    return st.lastAmount > 0;
  },
  drain_from_last:(ctx,p,st)=>{
    const amount=st.lastAmount*p.ratio;
    st.lastAmount=0;if(!(amount>0))return false;
    const kind=p.type==='真實'?'true':p.type==='百分比'?'percent':'fixed';
    if(st.deferNoDmg)registerNoDmgFollowUp(ctx,ctx.targetSide,p.type,st);
    st.lastDamageImmune=false;st.lastRequestedDamage=Math.max(0,Math.floor(amount));
    st.lastAmount=queueHpDrain(ctx,ctx.targetSide,amount,kind,undefined,{onCalculated:r=>{st.lastDamageImmune=r.incomingImmune;}});
    st.lastDealt=st.lastAmount;return st.lastAmount>0;
  },
  mercy: (ctx) => { ctx.setPlayerState("mercyThisAction", true); return true; },
  recoil: (ctx,p,st) => {
    const damage=Number(st.event?.data?.damageDealt??(ctx as any).damageDealt??0);
    if(!Number.isFinite(damage)||damage<=0)return false;
    st.lastAmount=Math.floor(damage*p.ratio);
    ctx.adjustHp(ctx.actor,-st.lastAmount);
    return st.lastAmount>0;
  },
  reflect_received_skill:(ctx,p,st)=>{
    const record=ctx.getPlayerState('receivedSkillDamageThisRound');
    if(record?.round!==(ctx.roundNumber??0)||record.ownerBattleId!==idOf(liveElf(ctx,ctx.actor)))return false;
    const amount=Math.floor(Number(record.amount)*p.ratio);
    if(!Number.isFinite(amount)||amount<=0)return false;
    st.lastAmount=ctx.applySkillTypeDamage(ctx.targetSide,amount,'技能受傷反饋',{
      elem:ctx.skill?.type||ctx.self.type,category:'skill_extra_action',node:'skill_effect',
      floor:p.floor?amount:undefined,ignoreBlock:p.ignoreBlock,ignoreLimit:p.ignoreLimit,
    });
    return st.lastAmount>0;
  },
  reflect_received_damage:(ctx,p,st)=>{
    const record=ctx.getPlayerState('receivedDamageThisRound');st.lastAmount=0;
    if(record?.round!==(ctx.roundNumber??0)||record.ownerBattleId!==idOf(liveElf(ctx,ctx.actor)))return false;
    const amount=Math.floor(Number(record.amount)*p.ratio);
    if(!Number.isFinite(amount)||amount<=0)return false;
    st.lastAmount=dealDamage(ctx,ctx.targetSide,amount,p.type,undefined,st);return st.lastAmount>0;
  },
  reflect_event_damage:(ctx,p,st)=>{
    const data=st.event?.data?.effectEventData || st.event?.data;
    if(!data||data.reaction||!data.sourceBattleId||!['p1','p2'].includes(data.sourceSide)||data.sourceSide===ctx.actor||!ctx.applyDamageToElf)return false;
    const source=(ctx.getFullTeam(data.sourceSide)||[]).find(elf=>idOf(elf)===data.sourceBattleId);
    if(!source||source.isVanished||!(data.amount>0))return false;
    const type=data.damageType==='skill'?'skill_attack':data.damageType;
    if(!['skill_attack','skill_attribute','skill_extra_action','fixed','percent','true'].includes(type))return false;
    st.lastAmount=ctx.applyDamageToElf(data.sourceSide,data.sourceBattleId,Math.floor(data.amount*p.ratio),type,{label:'本次傷害反彈',reaction:true,applyTypeMatchup:false});
    return st.lastAmount>0;
  },
  flat_reduction_uses:(ctx,p)=>{addBlockTimer(ctx,ctx.actor,`受到傷害減少${p.flat}點`,p.uses,'uses',{flatIn:p.flat,kind:p.kind});return true;},
  crit_received_turns:(ctx,p)=>{addConstraintTimer(ctx,ctx.targetSide,`block_received_critical`,p.turns,{incomingAttackCritical:true},!!p.next);return true;},
  damage_multiplier_turns:(ctx,p,st)=>{
    addBlockTimer(ctx,p.side==='opp'?ctx.targetSide:ctx.actor,'持續傷害倍率',p.turns,'turns',{
      [p.dir==='in'?'dmgInMult':'dmgOutMult']:p.mult,kind:p.kind,
    },!!p.next,isSkillCtx(st)?'turn_effect':'round_counter',!p.next);return true;
  },
  consume_shield:(ctx,_p,st)=>{
    const elf=liveElf(ctx,ctx.actor);st.lastAmount=Math.max(0,Number(elf.shield) || 0);
    if(st.lastAmount>0)ctx.updateElf(ctx.actor,{shield:0});return st.lastAmount>0;
  },
  pp_zero_from_last:(ctx,p,st)=>{
    const times=Math.floor(st.lastAmount/p.unit);let any=false;
    for(let i=0;i<times;i++){
      const skills=liveElf(ctx,ctx.targetSide)?.skills || [];if(!skills.length)break;
      const slot=Math.min(skills.length-1,Math.floor((ctx.rng || Math.random)()*skills.length)),selected=skills[slot];
      any=applyKitPpOperation(ctx,ctx.targetSide,'zero',0,s=>s===selected)||any;
    }
    return any;
  },
  timed_uses:(ctx,p,st)=>{
    addBlockTimer(ctx,ctx.actor,p.label||'指定事件次數監控',p.uses,'uses',{trig:p.trig,body:structuredClone(p.body),skillKind:p.kind,consumeOnFire:true,sourceKind:st.sourceKind||'skill'});return true;
  },
  ignore_def_action:(ctx,p)=>queueActionDefenseIgnore(ctx,p.stat,p.ratio),
  status_inflict_guard_turns:(ctx,p,st)=>{
    addConstraintTimer(ctx,sideOf(ctx,p.side),'異常附加受限',p.turns,{statusInflictGuard:{kind:p.kind}},!!p.next,isSkillCtx(st)?'skill':'soulmark',false);return true;
  },
  next_entry_pp_zero:(ctx)=>{ctx.setOpponentState('nextElfPpZero',{sourceSide:ctx.actor,sourceBattleId:idOf(ctx.self)});return true;},
  pp_zero_selected:(ctx,p,st)=>{
    const slot=skillSlot(liveElf(ctx,ctx.targetSide),st.event?.data?.skill || ctx.opponentSkill || ctx.skill);
    if(slot<0)return false;
    const selected=liveElf(ctx,ctx.targetSide).skills[slot];
    return applyKitPpOperation(ctx,ctx.targetSide,'zero',0,s=>s===selected);
  },
  incoming_utility_invalid_turns:(ctx,p,st)=>{
    addBlockTimer(ctx,ctx.actor,'對自身使用的屬性技能無效',p.turns,'turns',{incomingUtilityInvalid:true},false,isSkillCtx(st)?'turn_effect':'round_counter',true);
    return true;
  },
  power_per_hp: (ctx,p)=>queueHpPowerScale(ctx,p),
  power_ratio_turns:(ctx,p)=>{
    const side=sideOf(ctx,p.side),owner=liveElf(ctx,side);
    ctx.addTimerTo(side,{id:`power_ratio:${ctx.actor}:${idOf(ctx.self)}:${ctx.skill?.name}:${side}:${idOf(owner)}`,name:`攻擊威力×${p.ratio}`,kind:'turn_effect',source:'skill',remaining:p.turns,tickAt:'round_end',scope:'elf',ownerBattleId:idOf(owner),persistsOffField:p.bound,payload:{block:{powerRatio:p.ratio}}},false);
    return true;
  },
  power_growth_add:(ctx,p)=>{
    if(!ctx.skill||ctx.skill.category==='屬性')return false;
    const key=`powerGrowth:${p.key}`,prev=ctx.getPlayerState(key);
    const action=`${ctx.roundNumber}:${ctx.actionId}`;
    if(prev?.action===action)return false;
    ctx.setPlayerState(key,{action,value:Math.min(p.cap,Math.round(((prev?.value||0)+p.step)*1e8)/1e8)});return true;
  },
  power_growth_apply:(ctx,p,st)=>{
    const comp=(ctx as any).powerComp||st.event?.data?.powerComp;
    if(!comp||!Number.isFinite(comp.power)||ctx.skill?.category==='屬性')return false;
    comp.power*=1+p.baseBoost+(ctx.getPlayerState(`powerGrowth:${p.key}`)?.value||0);return true;
  },
  power_mod:(ctx,p,st)=>{
    const comp=(ctx as any).powerComp||st.event?.data?.powerComp;
    if(!comp||!Number.isFinite(comp.power)||ctx.skill?.category==='屬性')return false;
    // 「對手能力等級越高威力越大（等級6:18）」：每級線性加成 perLevelAmount×等級總和（300 靈光之怒）。
    if(p.perStageLevel){
      const levels=readStageLevels(ctx,p.perStageLevel);
      if(levels<=0)return false;
      comp.power+=p.perLevelAmount*levels;return true;
    }
    const levels=p.perMark?readMarkStacks(ctx,p.perMark):1;
    if(levels<=0)return false;
    if(p.flat!==undefined)comp.power+=p.flat*levels;else comp.power*=1+p.boost*levels;return true;
  },
  damage_scale:(ctx,p,st)=>{
    const comp=(ctx as any).effectEventData?.damageComp || st.event?.data?.damageComp || (ctx as any).damageComp;
    if(!comp||comp.pure||comp.isIncoming||!compMatchesKind(comp,p.kind))return false;
    comp.multiplier*=p.mult;return true;
  },
  vanish_defeated:(ctx,_p,st)=>{
    const defeated=(ctx as any).effectEventData?.defeatedElf || st.event?.data?.defeatedElf;
    if(!defeated||defeated.isVanished)return false;
    ctx.vanishElf(ctx.targetSide,defeated);return true;
  },
  power_add_hp_iv:(ctx,p)=>{
    const base=liveElf(ctx,p.side==='self'?ctx.actor:ctx.targetSide);
    queueActionPowerAdd(ctx,Math.floor(base.maxHp*p.ratio)+(ctx.self.ivs?.[p.iv] ?? 31));return true;
  },
  damage_cap_turns:(ctx,p,st)=>{
    // capRatio：「N回合內受到的技能傷害不超過自身最大體力X%」——動態上限（每次計算依當下最大體力）。
    const payload=p.capRatio!==undefined?{damageCapRatio:p.capRatio,dir:p.dir,kind:p.kind,ownerBattleId:idOf(liveElf(ctx,p.side==='self'?ctx.actor:ctx.targetSide))}:{damageCap:p.cap,dir:p.dir,kind:p.kind};
    addBlockTimer(ctx,p.side==='self'?ctx.actor:ctx.targetSide,`${p.kind}傷害上限${p.cap ?? Math.round((p.capRatio||0)*100)+'%'}`,p.turns,'turns',payload,!!p.next,isSkillCtx(st)?'turn_effect':'round_counter',!p.next);return true;
  },
  recovery_reduce_turns:(ctx,p,st)=>{
    addConstraintTimer(ctx,p.side==='self'?ctx.actor:ctx.targetSide,`kitRecoveryReduction:${ctx.self.battleId||ctx.self.id}:${ctx.skill?.name}`,p.turns,{recoveryReductionPercent:p.ratio,recoveryReductionIncludesPotions:p.includePotions},!!p.next,isSkillCtx(st)?'skill':'soulmark',false);return true;
  },
  boost: (ctx, p, st) => {
    if(p.perMark)p={...p,mult:1+(p.mult-1)*readMarkStacks(ctx,p.perMark)};
    const comp = st.event?.data?.damageComp || (st.event?.data?.base != null ? st.event.data : null);
    if(p.perLastAmount!==undefined)return queueActionDamageModifier(ctx,p.mult+Math.max(0,st.lastAmount)*p.perLastAmount,p.kind||'攻擊');
    if (p.power && comp) return false; // 威力需在公式前處理，不能當傷害倍率。
    if (p.power && p.add != null) { if (p.add > 0) queueActionPowerAdd(ctx, p.add); return p.add > 0; }
    if (p.perInc != null) {
      // 「提升X%，每有1個…則提升Y%」（威力或傷害倍率同構）：mult = 基礎 + 增量×計數（數值全由 Kit 給）。
      const n = PER_COUNTERS[p.per] ? PER_COUNTERS[p.per](ctx) : 0;
      const mult = p.mult + p.perInc * n;
      if (p.power) { queueActionPowerMultiplier(ctx, mult); return true; }
      if (comp) { if (comp.isIncoming || !compMatchesKind(comp, p.kind || "攻擊")) return false; comp.increasePercent += mult - 1; return true; }
      return queueActionDamageModifier(ctx, mult, p.kind || "攻擊");
    }
    if (p.power) { queueActionPowerMultiplier(ctx, p.mult); return true; }
    if (comp) { if (comp.isIncoming || !compMatchesKind(comp, p.kind || "攻擊")) return false; comp.increasePercent += p.mult - 1; return true; }
    if (st.event?.trig === "passive") return false;
    return queueActionDamageModifier(ctx, p.mult, p.kind || "攻擊");
  },
  no_resist: (ctx) => { ctx.setPlayerState("noResistedThisAction", true); return true; },
  crit_bonus_turns: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `致命機率增加${Math.round(p.bonus * 10000) / 100}%`, p.turns, "turns", { critChanceBonus: p.bonus }, !!p.next); return true; },
  crit_now: (ctx) => { ctx.setPlayerState("nextTurnCrit", true); return true; },
  crit_turns: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `必定致命`, p.next ? p.turns : p.turns + (p.now ? 0 : 1), "turns", { crit: true },!!p.next); return true; },
  crit_uses: (ctx, p) => {
    const scope=p.scope || 'elf',id=scope==='team'?`blk_${ctx.actor}_team_guaranteed_critical`:undefined;
    const old=id?(ctx.actor==='p1'?ctx.p1Timers:ctx.p2Timers).find(t=>t.id===id):undefined;
    addBlockTimer(ctx,ctx.actor,'必定致命',Math.max(p.uses,old?.remaining || 0),'uses',{crit:true,attackOnly:true},false,undefined,false,scope,id);
    return true;
  },
  dmg_taken_x2: (ctx, p, st) => { setTurnKey(ctx, ctx.targetSide, st, "受到傷害翻倍", { damageTakenBoostTurns: p.turns + 1 }, "damageTakenBoostTurns"); return true; },
  dmg_cap_turns: (ctx, p, st) => { setTurnKey(ctx, ctx.actor, st, `受傷上限${p.cap}`, { incomingSkillDmgCapTurns: p.turns, incomingSkillDmgCap: p.cap }, "incomingSkillDmgCapTurns"); return true; },
  dmg_mod_turns: (ctx, p,st) => {
    if (p.chance != null && !chance(ctx, 'dmg_mod_turns', p.chance)) return false;
    const owner = p.side === "opp" ? ctx.targetSide : ctx.actor;
    const turns = p.turns;
    const kind=isSkillCtx(st)?'turn_effect':'round_counter';
    if (p.dir === "in") addBlockTimer(ctx, owner, `受傷-${p.reduce * 100}%`, turns, "turns", { dmgIn: -p.reduce, kind: p.kind }, !!p.next,kind,!p.next&&!p.lateCompensation);
    else if (p.dir === "taken") addBlockTimer(ctx, owner, `受傷+${p.boost * 100}%`, turns, "turns", { dmgIn: p.boost, kind: p.kind }, !!p.next,kind,!p.next&&!p.lateCompensation);
    else if(p.dir==='out_reduce')addBlockTimer(ctx,owner,`${p.kind}輸出傷害-${p.reduce*100}%`,turns,'turns',{dmgOutReduce:p.reduce,kind:p.kind},!!p.next,kind,!p.next);
    else addBlockTimer(ctx, owner, `增傷+${p.boost * 100}%`, turns, "turns", { dmgOut: p.boost, kind: p.kind, ...(p.doubleIfAnyStatus ? { doubleIfAnyStatus: true } : {}) }, !!p.next,kind,!p.next);
    return true;
  },
  boost_turns_x2: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `威力翻倍`, p.turns + 1, "turns", { dmgOutMult: 2, kind: "攻擊" }); return true; },
  // 「下N次受到的（物理／技能）攻擊傷害翻倍」（5035 破曉：吸取成功→對手下2次物理傷害×2）：
  // 掛受方 use_counter timer，讀取端 newElfLifecycle BEFORE_DAMAGE 的 incomingPhysicalSkillMultiplier。
  dmg_taken_uses: (ctx, p, st) => {
    if (!(p.uses > 0) || !(p.mult > 1)) return false;
    const payload: Record<string, any> = {};
    if (p.kind === '物理') payload.incomingPhysicalSkillMultiplier = p.mult;
    else if (p.kind === '技能') { payload.blockSkillDamage = undefined; payload.incomingSkillMultiplier = p.mult; }
    else return false;
    addBlockTimer(ctx, ctx.targetSide, `受到${p.kind}傷害×${p.mult}`, p.uses, "uses", { ...payload, sourceKind: st.sourceKind || 'skill' });
    return true;
  },
  dmg_mod_uses: (ctx, p) => {
    if(p.attackOnly===true) addUseConstraint(ctx,ctx.actor,`next_attack_damage_${ctx.skill?.name||'effect'}`,p.uses,
      {nextAttackDamageModifier:{multiplier:1+p.boost,kind:p.kind}});
    else addBlockTimer(ctx, ctx.actor, `增傷+${p.boost * 100}%`, p.uses, "uses", { dmgOut: p.boost, kind: p.kind });
    return true;
  },
  dmg_mod: (ctx, p, st) => {
    const comp = st.event?.data?.damageComp || (st.event?.data?.base != null ? st.event.data : null);
    if (!comp) return false;
    if (!compMatchesKind(comp, p.kind)) return false;
    const stacks=p.perMark?readMarkStacks(ctx,p.perMark):1;
    if(stacks<=0)return false;
    if (p.dir === "in" && comp.isIncoming) addDamageReduction(comp, p.reduce*stacks, p.dir !== "out_reduce");
    else if (p.dir === "in_boost" && comp.isIncoming) comp.increasePercent += p.boost*stacks;
    else if (p.dir === "out" && !comp.isIncoming) comp.increasePercent += p.boost*stacks;
    else if (p.dir === "out_reduce" && !comp.isIncoming) addDamageReduction(comp, p.reduce*stacks, p.dir !== "out_reduce");
    else return false;
    return true;
  },
  prio_turns: (ctx, p, st) => {
    if(p.current===true){addBlockTimer(ctx,sideOf(ctx,p.side||'self'),`${p.turns}回合內先制${p.v}`,p.turns,'turns',{prio:p.v,attackOnly:!!p.attackOnly,prioTurns:true},false,isSkillCtx(st)?'turn_effect':'round_counter',true);return true;}
    if(p.next===true){addBlockTimer(ctx,sideOf(ctx,p.side||'self'),`下${p.turns}回合先制${p.v}`,p.turns,'turns',{prio:p.v,attackOnly:!!p.attackOnly,prioTurns:true},true,isSkillCtx(st)?'turn_effect':'round_counter');return true;}
    // 對手先制變化：獨立計時器，不覆寫對手自身的 priorityBoost*（對手自己的先制提升仍保留）
    if (p.side === "opp") addBlockTimer(ctx, ctx.targetSide, `先制${p.v}`, p.turns, "turns", { prio: p.v, attackOnly: !!p.attackOnly, prioTurns: true }, true, isSkillCtx(st) ? "turn_effect" : "round_counter");
    else setTurnKey(ctx, ctx.actor, st, `先制+${p.v}`, { priorityBoostTurns: p.turns + 1, priorityBoostValue: p.v, priorityBoostAttackOnly: !!p.attackOnly }, "priorityBoostTurns");
    ctx.addLog(`⚡ 下 ${p.turns} 回合${p.side === "opp" ? "對手" : ""}先制 ${p.v > 0 ? "+" : ""}${p.v}！`, "effect");
    return true;
  },
  prio_next: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `先制+${p.v}`, p.uses, "uses", { prio: p.v, attackOnly: !!p.attackOnly,startAfterActionId:ctx.actionId }); return true; },
  first_turns: (ctx, p, st) => { addBlockTimer(ctx, ctx.actor, `必定先手`, p.next?p.turns:p.turns+1, "turns", { first: true,attackOnly:!!p.attackOnly },!!p.next,isSkillCtx(st)?'turn_effect':'round_counter'); return true; },
  immune_attack_count: (ctx, p) => { ctx.setPlayerState("blockAttackCount", (ctx.getPlayerState("blockAttackCount") || 0) + p.count); ctx.addLog(`🛡️ 免疫下 ${p.count} 次受到的攻擊！`, "effect"); return true; },
  immune_attack_turns: (ctx, p, st) => {
    const sides:S[]=p.extendByStatusTurns==='both'?[ctx.actor,ctx.targetSide]:p.extendByStatusTurns?[sideOf(ctx,p.extendByStatusTurns)]:[];
    const turns=p.turns+statusDurationSum(ctx,sides.map(side=>liveElf(ctx,side)));
    setTurnKey(ctx,ctx.actor,st,'免疫攻擊',{immuneAttackTurns:Math.max(turns,ctx.getPlayerState('immuneAttackTurns')||0)},'immuneAttackTurns');ctx.addLog(`🛡️ ${turns} 回合內免疫受到的攻擊！`,'effect');return true;
  },
  block_attack: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `抵擋攻擊`, p.count, "uses", { blockAttack: true }); ctx.addLog(`🛡️ 抵擋下 ${p.count} 次攻擊傷害！`, "effect"); return true; },
  invalid_next: (ctx, p) => {
    // invalidFollowup：技能無效成功後追加「同類型技能附加效果失效」（引擎 newElfLifecycle 既有讀取端）。
    const payload: any = { invalid: p.kind || "all", ...(p.powerAbove===undefined?{}:{powerAbove:p.powerAbove}) };
    if (p.followupRounds) payload.invalidFollowup = { rounds: p.followupRounds, sameCategory: p.followupSameCategory !== false };
    addBlockTimer(ctx, ctx.targetSide, `技能無效`, p.uses, "uses", payload, false, undefined, false, p.scope || 'elf', p.timerId);
    ctx.addLog(`🚫 對手下 ${p.uses} 次${p.kind}技能無效！`, "effect"); return true; },
  invalid_turns: (ctx, p, st) => {
    const turns=p.turns*(p.perMarkTurns?readMarkRemainingTurns(ctx,p.perMarkTurns):1);
    if(!(turns>0))return false;
    p={...p,turns};
    // 「下N回合…技能無效」：附加當回合不啟用，下回合起 N 回合（回合類效果，可被消除）
    if (p.next) {
      // ROUND_END通知在本輪timer扣減之後；此處再設pending會整整晚一回合才啟用。
      const afterTick=st.event?.trig==='round_end';
      addBlockTimer(ctx, ctx.targetSide, `${p.kind || ""}技能無效`, p.turns, "turns", { invalid: p.kind || "all" }, !afterTick, isSkillCtx(st) ? "turn_effect" : "round_counter", afterTick);
      ctx.addLog(`🚫 下 ${p.turns} 回合對手${p.kind}技能無效！`, "effect");
      return true;
    }
    if (p.kind !== "屬性") setTurnKey(ctx, ctx.targetSide, st, "攻擊技能無效", { attackSkillInvalidTurns: Math.max(p.turns, ctx.getOpponentState("attackSkillInvalidTurns") || 0) }, "attackSkillInvalidTurns");
    if (p.kind !== "攻擊") setTurnKey(ctx, ctx.targetSide, st, "屬性技能無效", { utilitySkillInvalidTurns: Math.max(p.turns, ctx.getOpponentState("utilitySkillInvalidTurns") || 0) }, "utilitySkillInvalidTurns");
    ctx.addLog(`🚫 ${p.turns} 回合內對手${p.kind}技能無效！`, "effect");
    return true;
  },
  add_invalid_turns: (ctx, p, st) => {
    // 對手使用事件在其附加效果執行前觸發，封印已影響本次行動，不多補一回合。
    const appliesNow = !p.next && ['opp_skill','opp_attack','opp_status'].includes(st.event?.trig || '');
    addBlockTimer(ctx, ctx.targetSide, `附加失效`, p.turns, "turns", { addInvalid: p.kind || "all" },!!p.next,undefined,appliesNow); return true;
  },
  add_invalid_next: (ctx, p) => { addBlockTimer(ctx, ctx.targetSide, `附加失效`, p.uses, "uses", { addInvalid: p.kind || "all" }); return true; },
  no_switch: (ctx, p, st) => {
    // 回合結束新寫入的期限不會在當次收尾扣減，不能再補一回合。
    const remaining=p.turns+(p.next&&st.event?.trig!=='round_end'?1:0);
    setTurnKey(ctx,ctx.targetSide,st,'無法切換',{noSwitchTurns:Math.max(remaining,ctx.getOpponentState('noSwitchTurns')||0)},'noSwitchTurns');
    ctx.addLog(`⛓️ ${p.next?'下':'當回合起'}${p.turns}回合對手無法主動切換精靈！`,'effect');return true;
  },
  switch_lock:(ctx,p,st)=>{
    addBlockTimer(ctx,sideOf(ctx,p.side),'無法主動切換',p.turns,'turns',{lockSwitch:true},!!p.next,isSkillCtx(st)?'turn_effect':'round_counter',!p.next);
    return true;
  },
  no_heal: (ctx, p, st) => {
    p={...p,turns:p.turns+(p.perStageKinds?readStageKinds(ctx,p.perStageKinds)*p.perStageKinds.amount:0)};
    if(p.perStageKinds){addBlockTimer(ctx,ctx.targetSide,p.scope==='own_skill'?'自身技能回復受限':'禁療',p.turns,'turns',{healGuard:p.scope==='own_skill'?'own_skill':'all'},!!p.next,isSkillCtx(st)?'turn_effect':'round_counter',!p.next);return true;}
    if(p.next){addBlockTimer(ctx,ctx.targetSide,p.scope==='own_skill'?'自身技能回復受限':'禁療',p.turns,'turns',{healGuard:p.scope==='own_skill'?'own_skill':'all'},true,isSkillCtx(st)?'turn_effect':'round_counter');return true;}
    const key=p.scope==='own_skill'?'skillHealBlockTurns':`${ctx.targetSide}_noHealTurns`;
    setTurnKey(ctx,ctx.targetSide,st,p.scope==='own_skill'?'無法透過自身技能回復':'禁療',{[key]:p.turns+(p.next?1:0)},key);
    ctx.setOpponentState(`${ctx.targetSide}_noHealReason`,`【${ctx.skill?.name || '效果'}】${p.scope==='own_skill'?'自身技能回復受限':'禁療'}`);return true;
  },
  clear_turn: (ctx, p) => {
    const sides: S[] = p.side === "both" ? [ctx.actor, ctx.targetSide] : [sideOf(ctx, p.side)];
    let any = false; for (const s of sides) any = ctx.clearTurnEffectsOf(s) || any;
    if (any) ctx.addLog(`🧹 消除了回合類效果！`, "effect");
    return any;
  },
  clear_shield: (ctx, p, st) => {
    const sides: S[] = p.side === "both" ? [ctx.actor, ctx.targetSide] : [sideOf(ctx, p.side)];
    let any = false; let consumed = 0;
    for (const s of sides) {
      const e = liveElf(ctx, s), patch: any = {};
      if (p.kind !== 'barrier' && (e?.shield || 0) > 0) { consumed += e.shield; patch.shield = 0; }
      if ((p.kind === 'both' || p.kind === 'barrier') && (e?.barrier || 0) > 0) { consumed += e.barrier; patch.barrier = 0; }
      if (Object.keys(patch).length) { ctx.updateElf(s, patch); any = true; }
    }
    // 「消耗敵我雙方全部護盾與護罩」後續按消耗量計算（5028 王·洛浦凌波：每消耗1點威力+1／70%百分比）。
    if (consumed > 0 && st) st.lastAmount = consumed;
    return any;
  },
  shield: (ctx, p, st) => {
    const e=liveElf(ctx,ctx.actor),base=p.base==='已損失體力'?e.maxHp-e.currentHp:p.base==='當前體力'?e.currentHp:e.maxHp;
    const stacks=p.perMark?readMarkStacks(ctx,p.perMark):1;
    const amt=Math.max(0,Math.floor((p.flat??base*p.ratio)*(p.perMark?stacks:1)));
    if(p.kind==='barrier')ctx.updateElf(ctx.actor,{barrier:(e.barrier||0)+amt});else ctx.applyShield(ctx.actor,amt);
    st.lastAmount=amt;return amt>0;
  },
  pp_zero: (ctx, p) => {
    // 走 PP 操作入口：受星護等 PP 保護約束，並派發 PP_CHANGED（過去直接改寫技能欄）
    const only = p.kind ? (sk: any) => (p.kind === "屬性" ? sk.category === "屬性" : sk.category !== "屬性") : undefined;
    const changed = applyKitPpOperation(ctx, ctx.targetSide, "zero", 0, only);
    if (changed) ctx.addLog(`⚡ 對手${p.kind || ""}技能 PP 歸零！`, "effect");
    return changed;
  },
  pp_zero_all: (ctx) => {
    for (const s of [ctx.actor, ctx.targetSide] as S[]) { const e = elfOf(ctx, s); ctx.updateElf(s, { skills: (e.skills || []).map((k: any) => ({ ...k, pp: 0 })) }); }
    return true;
  },
  pp_zero_random: (ctx, p, st) => {
    // 通用語義：隨機 N 個「不同」技能（去重）。與盾碎同歸 custom 的「N 次獨立隨機、可重複」不同。
    // 保留 Set 去重，避免訣別之二等「隨機2」變成可能只中1個。
    const pool = [...(liveElf(ctx, ctx.targetSide)?.skills || [])].filter((sk: any) => (sk.pp || 0) > 0);
    const r = ctx.rng || Math.random, selected = new Set<any>();
    // 無放回抽樣：即使隨機源一直返回0，也必須選到N個不同技能槽。
    for (let n = Math.min(p.count, pool.length); n > 0; n--) {
      const index = Math.min(pool.length - 1, Math.floor(r() * pool.length));
      selected.add(pool.splice(index, 1)[0]);
    }
    // 「被消除的PP」（歸零前各技能PP合計）寫入 lastAmount——供「被消除的PP不高於N」條件讀取（DSH 20261018）。
    const totalZeroed = [...selected].reduce((sum: number, sk: any) => sum + (sk.pp || 0), 0);
    const changed = applyKitPpOperation(ctx, ctx.targetSide, 'zero', 0, sk => selected.has(sk));
    if (st) st.lastAmount = totalZeroed;
    return changed;
  },
  // PP 一律走 applyKitPpOperation：恢復限制、星護與 PP_CHANGED 事件同一管道，不直接寫 skills。
  pp_drain: (ctx, p) => applyKitPpOperation(ctx, ctx.targetSide, p.steal ? "drain" : "reduce", p.v),
  pp_restore: (ctx, p) => applyKitPpOperation(ctx, ctx.actor, p.mode === "recover" ? "recover" : "add", p.v || 0),
  ignore: (ctx, p) => {
    // 攻擊免疫／免疫：無視攻擊免疫（attackImmunity 讀 ignoreAttackImmunityThisAction，本次行動結束時重置）
    const key: Record<string, string> = { 傷害限制: "blkIgnoreLimit", 抵擋傷害: "blkIgnoreBlock", 護盾: "blkIgnoreShield", 正先制: "blkIgnorePrio", 能力提升: "ignoreOppBuffThisAction", 自身能力下降: "selfDropIgnoredThisAction", 對手提升視為下降: "oppBoostAsDropThisAction", 攻擊免疫: "ignoreAttackImmunityThisAction", 免疫攻擊: "ignoreAttackImmunityThisAction", 免疫: "ignoreAttackImmunityThisAction" };
    if (!key[p.what]) return false;
    ctx.setPlayerState(key[p.what], true);
    return true;
  },
  ignore_def_turns: (ctx, p, st) => {
    if(p.next){addBlockTimer(ctx,ctx.actor,'下回合起忽略雙防',p.turns,'turns',{ignoreDefenseRatio:p.ratio},true,isSkillCtx(st)?'turn_effect':'round_counter');return true;}
    // 引擎讀取 ignoreDef25Turns（固定忽略雙防25%）；其他比例寫入 ignoreDefPercentTurns/Value（引擎已讀取，2026-10-11）
    const turns = p.turns + 1;
    if (Math.abs(p.ratio - 0.25) < 1e-9) setTurnKey(ctx, ctx.actor, st, "忽略雙防25%", { ignoreDef25Turns: turns }, "ignoreDef25Turns");
    else setTurnKey(ctx, ctx.actor, st, `忽略雙防${Math.round(p.ratio * 100)}%`, { ignoreDefPercentTurns: turns, ignoreDefPercentValue: p.ratio }, "ignoreDefPercentTurns");
    ctx.addLog(`🗡️ 下 ${p.turns} 回合攻擊忽略對手${p.stat} ${Math.round(p.ratio * 100)}%！`, "effect");
    return true;
  },
  per_statdown_bonus: (ctx, p, st) => {
    const opp: any = ctx.target;
    const k = Object.values(opp?.statStages || {}).filter((v: any) => typeof v === "number" && v < 0).length;
    if (!k) return false;
    const baseline = st.maxHpBeforeChange?.[ctx.targetSide] ?? opp.maxHp;
    const newMax = Math.max(1, Math.floor(opp.maxHp - baseline * p.ratio * k));
    ctx.updateElf(ctx.targetSide, { maxHp: newMax, currentHp: Math.min(opp.currentHp, newMax) } as any);
    const key = `${ctx.targetSide}_noHealTurns`;
    ctx.setOpponentState(key, (ctx.getOpponentState(key) || 0) + p.turns * k);
    ctx.addLog(`⛓️ 對手處於 ${k} 種能力下降：體力上限再減少 ${Math.round(p.ratio * k * 100)}%，禁療回合 +${p.turns * k}！`, "effect");
    return true;
  },
  attack_inflict_turns: (ctx, p, st) => { ctx.setPlayerState("attackInflictStatus", p.status); setTurnKey(ctx, ctx.actor, st, `攻擊必定${p.status}`, { attackInflictStatusTurns: p.turns + 1 }, "attackInflictStatusTurns"); return true; },
  survive: (ctx, _p, st) => {
    // 致命傷害時：抵抗本次致命傷害並保留1點體力；非致死情境不動體力
    if (st.event?.trig === "fatal") { surviveAt1(ctx); st.survived = true; return true; }
    return false;
  },
  bench_entrance_status: (ctx, p) => {
    // ctx 為登場方
    if (statusChanceBlocked(ctx, p.chance) || !chance(ctx, `bench:${p.status}`, p.chance)) return false;
    const r = ctx.applyStatusWithImmunityCheck(ctx.actor, p.status, STATUS_DURATION[p.status] ?? DEFAULT_STATUS_TURNS);
    if (r.success) ctx.addLog(`💫 【${ctx.self?.name}】登場時陷入了【${p.status}】！`, "status");
    return r.success;
  },
  // 事件監看：一次觸發後移除；來源明確保留，次數計時不能被誤認為魂印。
  watch: (ctx, p, st) => {
    if(p.actionOnly&&ctx.actionId===undefined)return false;
    addBlockTimer(ctx, ctx.actor, p.text || "事件監看", 1, "uses", { trig: p.trig, body: p.body, once: true,sourceKind:st.sourceKind,
      ...(p.actionOnly?{boundActionId:ctx.actionId,targetBattleId:idOf(ctx.target),actionOnly:true}:{}) },false,st.sourceKind==='skill'?undefined:'round_counter',false,'elf',p.key?`watch:${idOf(ctx.self)}:${p.key}`:undefined);return true;
  },
  next_entry_status:(ctx,p)=>{ctx.setOpponentState('nextElfStatus',{status:p.status,duration:p.turns,sourceSide:ctx.actor,sourceBattleId:idOf(ctx.self)});return true;},
  stop_status_tick:(_ctx,_p,st)=>{const data=st.event?.data?.effectEventData||st.event?.data;if(!data?.status)return false;data.skipTick=true;return true;},
  stat_protect_turns: (ctx, p, st) => { setTurnKey(ctx, ctx.actor, st, "能力提升不可消除", { statBoostUnclearableTurns: Math.max(p.turns, Number(ctx.getPlayerState("statBoostUnclearableTurns")) || 0) }, "statBoostUnclearableTurns"); return true; },
  stage_guard_turns:(ctx,p,st)=>{addBlockTimer(ctx,ctx.actor,p.kind==='up'?'能力提升不可消除或吸取':'能力下降不可解除或反轉',p.turns,'turns',{stageGuard:p.kind},false,isSkillCtx(st)?'turn_effect':'round_counter',true);return true;},
  ignore_next: (ctx, p) => { if (p.what !== "攻擊免疫") return false; ctx.setPlayerState("ignoreAttackImmunityNext", true); ctx.addLog("⚔️ 下次攻擊技能無視攻擊免疫！", "effect"); return true; },
  heal_reduce_turns: (ctx, p, st) => {
    ctx.addTimerTo(ctx.targetSide, { id: `heal_reduce_${ctx.skill?.name || ctx.self?.name}`, name: `恢復效果-${Math.round(p.ratio * 100)}%`, kind: isSkillCtx(st) ? "turn_effect" : "round_counter",
      source: "skill" as any, remaining: p.turns, tickAt: "round_end", stackRule: "refresh", payload: { recoveryReductionPercent: p.ratio } } as any, ctx.moveIndex === 1);
    ctx.addLog(`💔 ${p.turns} 回合內對手體力恢復效果減少 ${Math.round(p.ratio * 100)}%！`, "effect");
    return true;
  },
  at_round_end: (ctx, p) => { addBlockTimer(ctx, ctx.actor, "回合結束", 1, "uses", { trig: "round_end", body: p.body, once: true,...(p.originalTarget?{targetBattleId:idOf(ctx.target)}:{}) }); return true; },
  stat_steal_random: (ctx, p) => {
    const pool = ["atk", "def", "spatk", "spdef", "speed", "accuracy"],r=ctx.rng||Math.random;
    const down:Record<string,number>={};
    // 無放回：固定亂數測試／最後只剩一項時也能終止，不能靠while碰運氣。
    for(let i=0;i<Math.min(p.count,6);i++){const value=r(),index=Number.isFinite(value)?Math.max(0,Math.min(pool.length-1,Math.floor(value*pool.length))):0;down[pool.splice(index,1)[0]]=-p.v;}
    const applied=ctx.applyStatChange(ctx.targetSide,down)?.applied||{},up:Record<string,number>={};
    for(const [key,value] of Object.entries(applied))if(value<0)up[key]=-value;
    if(!Object.keys(up).length)return false;
    ctx.applyStatChange(ctx.actor,up);return true;
  },
  shield_from_last:(ctx,p,st)=>{if(!(st.lastAmount>0))return false;ctx.applyShield(ctx.actor,Math.floor(st.lastAmount*p.ratio));return true;},
  status_replace:(ctx,p,st)=>{const data=(ctx as any).effectEventData || st.event?.data;if(!data?.status)return false;data.status=canonicalStatusName(p.status);return true;},
  block_damage:(ctx,p,st)=>{
    const comp=st.event?.data?.damageComp||st.event?.data;
    if(!comp?.isIncoming||!compMatchesKind(comp,p.kind)||bypassesAttackDefense(comp,'block'))return false;
    comp.damageBlocks||=new Map();
    const key=`blockCounter:${p.key}`,owner=`${ctx.actor}:${idOf(ctx.self)}:${key}`;
    comp.damageBlocks.set(owner,(amount:number)=>ctx.setPlayerState(key,Math.min(Number.MAX_SAFE_INTEGER,(Number(ctx.getPlayerState(key))||0)+amount)));
    return true;
  },
  block_damage_uses:(ctx,p,st)=>{
    addBlockTimer(ctx,ctx.actor,'次數傷害抵擋',p.uses,'uses',{recordBlockedDamage:p.key,kind:p.kind,onBlock:p.onBlock,sealOpponentAdded:p.sealOpponentAdded,sourceKind:st.sourceKind});return true;
  },
  damage_from_counter:(ctx,p,st)=>{
    const key=`blockCounter:${p.key}`,amount=Number(ctx.getPlayerState(key))||0;
    if(amount<=0)return false;
    st.lastAmount=dealDamage(ctx,ctx.targetSide,amount*p.ratio,p.type,undefined,st);
    if(p.consume)ctx.setPlayerState(key,0);return true;
  },
  heal_from_counter:(ctx,p,st)=>{
    const key=`blockCounter:${p.key}`,amount=Number(ctx.getPlayerState(key))||0;
    if(amount<=0)return false;
    st.lastAmount=heal(ctx,ctx.actor,Math.floor(amount*p.ratio));
    if(p.consume)ctx.setPlayerState(key,0);return st.lastAmount>0;
  },
  pp_cost_mult: (ctx, p) => { ((globalThis as any).__PM ||= []).push({ t: ctx.targetSide, a: ctx.actor }); addBlockTimer(ctx, ctx.targetSide, `PP消耗×${p.mult}`, p.turns, "turns", { ppMult: p.mult, kind: p.kind },false,undefined,true);
    ((globalThis as any).__PM2 ||= []).push((ctx.p2Timers||[]).map((x:any)=>x.id)); return true; },
  dmg_to_heal_turns: (ctx, p) => {
    // 下回合：pendingActivation（本回合不生效，回合結束啟用、下回合結束到期）
    if (p.next) addBlockTimer(ctx, ctx.actor, "下回合傷害轉體力", 1, "turns", { absorbToHeal: true }, true);
    else OPS.absorb_now(ctx, {}, { last: null, lastAmount: 0 });
    return true;
  },
  absorb_now: (ctx) => { addBlockTimer(ctx, ctx.actor, "傷害轉體力", 1, "turns", { absorbToHeal: true }); return true; },
  atk_sum_calc: (ctx) => { ctx.setPlayerState("blkAtkSpatkSum", true); return true; },
  custom: (ctx, p, st) => { const d = CUSTOM[p.key]; return d ? d.run(ctx, st as any) !== false : false; },
  evade: () => true,
  // 選擇槽的即時PP：先制在排序時讀，連擊在每次扣PP前讀，不以技能名快照跨行動沿用。
  pp_priority: (ctx: any, p: any) => {
    const comp = (ctx as any).priorityComp || (ctx as any).effectEventData?.priorityComp;
    if (!comp) return false;
    const slot=skillSlot(ctx.self,ctx.skill),pp=ctx.self.skills[slot]?.pp;
    if(!Number.isFinite(pp)||pp<0)return false;
    comp.bonus += pp * p.perPp;
    return true;
  },
  // before_skill位於正式PP消耗前，免費出招、額外耗PP及追加行動都依本次實值計算。
  pp_combo_hits: (ctx: any, p: any) => {
    const slot=skillSlot(ctx.self,ctx.skill),pp=ctx.self.skills[slot]?.pp;
    if(!Number.isFinite(pp)||pp<0)return false;
    const hits = 1 + pp * p.perPp;
    ctx.setPlayerState('attackHitCountThisAction', Math.max(hits, Number(ctx.getPlayerState('attackHitCountThisAction')) || 0));
    ctx.addLog(`⚔️ 該技能每1點PP連擊+${p.perPp}：使用時 PP ${pp}，連擊 ${hits} 次！`, 'effect');
    return true;
  },
  attack_extra_turns: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `攻擊附加${p.type}傷害`, p.turns + 1, "turns", { trig: "self_after_attack", body: [{ acts: [{ op: "dmg", p: { flat: p.flat, type: p.type }, label: "" }] }] }); return true; },
  // 閃避支援 onExpire（「效果結束後恢復…」5027 星河入眸）：到期時執行子流程。
  evade_turns: (ctx, p, st) => { addBlockTimer(ctx, ctx.actor, `閃避${p.chance}%`, p.turns, "turns", { evade: p.chance, kind: p.kind, ...(p.onExpire ? { expireBody: p.onExpire } : {}), sourceKind: isSkillCtx(st) ? 'skill' : 'soul' },false,undefined,true); return true; },
  survive_turns: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `死亡時保留1體力`, p.turns, "turns", { survive: true },false,undefined,true); return true; },
  no_pos_prio_turns: (ctx, p, st) => { setTurnKey(ctx, ctx.targetSide, st, "正先制失效", { blkNoPosPrioTurns: p.turns + (p.next ? 1 : 0) }, "blkNoPosPrioTurns"); return true; },
  consume_hp_all: (ctx) => { ctx.adjustHp(ctx.actor, -consumedHealthAmount(ctx,ctx.self.currentHp)); return true; },
  // 體力設定（調整至指定值；非傷害非恢復，不受禁療影響）。影之牢籠「消耗全部體力（降為1）」等。
  hp_set: (ctx, p) => {
    const side = sideOf(ctx, p.side || 'self');
    const elf = liveElf(ctx, side);
    // ratio：「體力調整為最大體力X%」——與 value 二擇一（同時給時 value 優先）。
    if (typeof p.value !== 'number' && Number.isFinite(p.ratio)) p = { ...p, value: Math.trunc((elf?.maxHp || 0) * p.ratio) };
    if (!elf || !(typeof p.value === 'number' && p.value >= 0)) return false;
    const delta = Math.trunc(p.value) - elf.currentHp;
    if (!delta) return true;
    return ctx.adjustHp?.(side, delta) !== undefined ? true : true;
  },
  stat_floor_opponent:ctx=>floorStagesAtOpponent(ctx),
  body_maxhp_resource_loss:(ctx,p,st)=>{st.lastAmount=loseBodyMaximumAndResource(ctx,p);return st.lastAmount>0;},
  // 計數器轉回合鍵：讀取並清空待觸發計數器，寫入 base+counter 回合至指定鍵（受影響者 side）。
  // 如「下次被擊敗時黯痕回合數 = 3 + 累計層數」；通用掃描自動遞減。
  counter_into_turns: (ctx, p, st) => {
    if (typeof p.counterKey !== 'string' || !p.counterKey || typeof p.turnKey !== 'string' || !p.turnKey) return false;
    const counter = Math.max(0, Math.floor(Number(ctx.getPlayerState(p.counterKey)) || 0));
    ctx.setPlayerState(p.counterKey, 0);
    const turns = Math.max(1, Math.floor((p.base ?? 0)) + counter);
    const side = sideOf(ctx, p.side || 'opp');
    const kv: Record<string, any> = { [p.turnKey]: turns };
    if (p.reason) kv[`${p.turnKey}Reason`] = p.reason;
    setTurnKey(ctx, side, st, p.label || p.turnKey, kv, p.turnKey);
    ctx.addLog(`🚫 ${p.label || p.turnKey}：${turns} 回合內生效（基礎 ${p.base ?? 0}＋累計 ${counter}）！`, 'effect');
    return true;
  },
  // 陣亡轉贈（通用「下一隻上場」待生效效果；讀取端 effects/rules/nextElfPending 規則）。
  next_elf_pending: (ctx, p) => {
    if (!(p.shield > 0) && !(p.immunityTurns > 0)) return false;
    if (p.shield > 0) ctx.setPlayerState('nextElfShield', Math.floor(p.shield));
    if (p.immunityTurns > 0) ctx.setPlayerState('nextElfImmunityTurns', Math.floor(p.immunityTurns));
    ctx.addLog(`🛡️ 悲歌護盾：下一隻出場精靈將獲得 ${Math.floor(p.shield || 0)} 點護罩與 ${Math.floor(p.immunityTurns || 0)} 回合異常免疫！`, 'effect');
    return true;
  },
  // 通用回合鍵寫入：寫 *Turns registry 鍵（通用掃描每回合-1）＋鏡像計時器（可被「消除回合類」清）。
  // 受影響者由 side 決定；reason 僅供日誌。引擎讀取端如 DarkScarTurns、attackSkillInvalidTurns 等。
  turn_key_set: (ctx, p, st) => {
    if (typeof p.key !== 'string' || !p.key || !(p.turns > 0)) return false;
    const side = sideOf(ctx, p.side || 'opp');
    const kv: Record<string, any> = { [p.key]: p.turns };
    if (p.reason) kv[`${p.key}Reason`] = p.reason;
    setTurnKey(ctx, side, st, p.label || p.key, kv, p.key);
    ctx.addLog(`🚫 ${p.label || p.key}：${p.turns} 回合內生效（${p.side === 'self' ? '自身' : '對手'}）！`, 'effect');
    return true;
  },
  // 待觸發計數器累加（如「下次被擊敗時黯痕+1」；消費端讀取後自行清空）。
  pending_counter: (ctx, p) => {
    if (typeof p.key !== 'string' || !p.key || !(p.amount > 0)) return false;
    const cur = Number(ctx.getPlayerState(p.key)) || 0;
    ctx.setPlayerState(p.key, cur + p.amount);
    ctx.addLog(`🎡【${p.label || p.key}】待觸發層數 +${p.amount}（累計 ${cur + p.amount}）！`, 'effect');
    return true;
  },
  // 計數器花用（與 pending_counter 同一鍵空間）：剩餘點數足夠才扣點執行主體；
  // 「下N次…每次成功則…」句式的通用容器——次數用盡後主體不再執行。
  counter_spend: (ctx, p, st) => {
    if (typeof p.key !== 'string' || !p.key || !(p.amount > 0) || !Array.isArray(p.body)) return false;
    const cur = Number(ctx.getPlayerState(p.key)) || 0;
    if (cur < p.amount) return false;
    ctx.setPlayerState(p.key, cur - p.amount);
    if (p.label) ctx.addLog(`🎡【${p.label}】剩餘 ${cur - p.amount} 次！`, 'effect');
    runStmts(ctx, p.body, st);
    return st.last === true || !!st.survived;
  },
  mark_program:(ctx,p)=>applyMarkProgram(ctx,p,liveElf(ctx,sideOf(ctx,p.side))),
  mark: (ctx, p) => {
    const side = sideOf(ctx, p.side);
    const id = `blk_${p.name}`;
    const cur = (ctx.getMarks(side) || []).find((m: any) => m.id === id && markAppliesToElf(m,liveElf(ctx,side)))?.count || 0;
    ctx.setMark({ id, name: p.name, count: cur + p.count, displayChar: p.name[0] } as any, side);
    return true;
  },
  mark_turns: (ctx, p) => {
    const side = sideOf(ctx, p.side);
    const def = markDefClauses(ctx.self, p.name);
    const eff: Record<string, any> = { blkDef: ctx.self?.name, blkTurns: p.turns };
    for (const c of def) for (const b of c.body) for (const a of b.acts) {
      if (a.op === "heal_reduce") eff.blkHealReduce = a.p.ratio;
      if (a.op === "holder_invalid") eff.blkInvalid = a.p.kind || "all";
      if (a.op === "mark_duration" && !p.turns) eff.blkTurns = a.p.turns;
    }
    ctx.setMark({
      id: `blk_${p.name}`,
      name: p.name,
      count: 1,
      displayChar: p.name[0],
      description: def.map(c => c.raw.replace(/^>\s*/, "")).join("\n"),
      unit: "回合",
      remainingRounds: p.turns,
      clearable: false,
      triggerNode: "round_end",
      polarity: "negative",
      effects: eff,
    } as any, side);
    ctx.addLog(`🔖 為【${elfOf(ctx, side)?.name}】附加 ${p.turns} 回合的【${p.name}】！`, "effect");
    return true;
  },
  dmg_of_event: (ctx, p, st) => {
    const base = Number(st.event?.data?.damage ?? st.event?.data?.amount ?? 0);
    if (base <= 0) return false;
    const damageCtx = p.source === 'opp' ? ctx.contextForElf?.(ctx.targetSide,liveElf(ctx,ctx.targetSide)) : ctx;
    if(!damageCtx)return false;
    st.lastAmount = dealDamage(damageCtx, ctx.actor, base * p.ratio, p.type, undefined, st);
    ctx.addLog(`🔖 【${ctx.self?.name}】受到印記追加的 ${st.lastAmount} 點${p.type}傷害！`, "damage");
    return true;
  },
  heal_reduce: () => true,
  holder_invalid: () => true,
  mark_duration: () => true,
  heal_opp_equal: (ctx, _p, st) => { if (!st.lastAmount) return false; const real = heal(ctx, ctx.targetSide, st.lastAmount); return real > 0; },
  mark_remove_current: (ctx, _p, st) => {
    if(!st.holderMark)return false;
    ctx.clearMark(st.holderMark.id,ctx.actor,st.holderMark.ownerBattleId||null);
    return true;
  },
  pp_restore_opp: (ctx, p) => applyKitPpOperation(ctx, ctx.targetSide, p.mode === "recover" ? "recover" : "add", p.v || 0),
  mark_remove: (ctx, p) => { ctx.clearMark(`blk_${p.name}`, ctx.actor); ctx.addLog(`🔖 【${p.name}】消失了！`, "effect"); return true; },
  // 已損失體力比例恢復（基於 maxHp-currentHp；非恢復類）。
  heal_missing: (ctx, p) => {
    const side = sideOf(ctx, p.side || 'self');
    const elf = liveElf(ctx, side);
    if (!elf || !(p.ratio > 0)) return false;
    const amt = Math.floor(Math.max(0, elf.maxHp - elf.currentHp) * p.ratio);
    if (amt <= 0) return false;
    ctx.applyHeal(side, amt);
    ctx.addLog(`💚 恢復已損失體力的 ${Math.round(p.ratio * 100)}%（${amt} 點）！`, 'heal');
    return true;
  },
  // 開啟陣形計時器：與 close_formation 對稱；設狀態鍵＋回合計數計時器（round_counter、tickAt never，由陣形邏輯自行 tick）。
  open_formation: (ctx, p, st) => {
    const formationId = typeof p.formationId === 'string' && p.formationId ? p.formationId : 'dixin_formation';
    if(p.onClose){
      if(((ctx.actor==='p1'?ctx.p1Timers:ctx.p2Timers)||[]).some(t=>ownsActiveFormation(t,formationId,idOf(ctx.self))))return false;
      ctx.addTimerTo(ctx.actor,{id:formationId,name:p.name||'陣形',kind:isSkillCtx(st)?'turn_effect':'round_counter',source:isSkillCtx(st)?'skill':st.sourceKind==='trait'?'mechanic':'soulmark',remaining:p.turns,
        tickAt:'round_end',scope:'elf',payload:{opponentDamageHpCeiling:p.hpCeiling===true,
          formationWindow:{onClose:p.onClose,reduceLostHpRatio:p.reduceLostHpRatio||0,sourceKind:st.sourceKind||'soul'}}},false);
      ctx.addLog(`👑 【${p.name||formationId}】開啟，持續 ${p.turns} 回合。`,'effect');return true;
    }
    const stem = formationId.replace(/_formation$/, '');
    if (!(p.turns > 0)) return false;
    if (ctx.getPlayerState(`${stem}FormationAtNine`)) return false;  // 已開啟不重複
    ctx.setPlayerState(`${stem}FormationRounds`, p.turns);
    ctx.setPlayerState(`${stem}FormationAtNine`, true);
    ctx.setPlayerState(`${stem}FormationBornRound`, ctx.roundNumber ?? 0);
    ctx.addTimerTo(ctx.actor, { id: formationId, name: p.name || '陣形', kind: 'round_counter', source: 'soulmark',
      remaining: p.turns, tickAt: 'never', scope: 'elf', payload: { opponentDamageHpCeiling: true } }, false);
    ctx.addLog(`👑 【${p.name || formationId}】開啟，持續 ${p.turns} 回合。`, 'effect');
    return true;
  },
  // 資源印記移除：依正式 id（如 bahuang_mark）清空指定持有者的全部層數；不同於 mark_remove 的 blk_ 前綴印記。
  resource_mark_remove: (ctx, p) => {
    if (typeof p.id !== 'string' || !p.id) return false;
    const side = sideOf(ctx, p.side || 'self');
    const owner = p.scope === 'elf' ? idOf(liveElf(ctx, side)) : undefined;
    const existing = ctx.getMarks(side).find(m => m.id === p.id && m.ownerBattleId === owner);
    if (!existing) return false;
    ctx.clearMark(p.id, side, owner || null);
    ctx.emitElfEvent?.(side, liveElf(ctx, side), EffectTiming.RESOURCE_CHANGED, { side, targetBattleId: idOf(liveElf(ctx, side)), id: p.id, before: existing.count || 0, after: 0 });
    ctx.addLog(`🔖 【${existing.name}】的全部層數被消除了！`, 'effect');
    return true;
  },
  // 資源印記遞減：指定層數（低於 0 歸零，不低於 0）；與 resource_mark_add 對稱。
  resource_mark_subtract: (ctx, p) => {
    if (typeof p.id !== 'string' || !p.id || !(p.amount > 0)) return false;
    const side = sideOf(ctx, p.side || 'self');
    if(resourceMarkLocked(ctx,side,p.id))return false;
    const owner = p.scope === 'elf' ? idOf(liveElf(ctx, side)) : undefined;
    const existing = ctx.getMarks(side).find(m => m.id === p.id && m.ownerBattleId === owner);
    const before = existing?.count || 0;
    if (!existing || before <= 0) return false;
    const count = Math.max(0, before - p.amount);
    if (count === before) return false;
    if (count === 0) { ctx.clearMark(p.id, side, owner || null); }
    else ctx.setMark({ ...existing, count }, side);
    ctx.emitElfEvent?.(side, liveElf(ctx, side), EffectTiming.RESOURCE_CHANGED, { side, targetBattleId: idOf(liveElf(ctx, side)), id: p.id, before, after: count });
    ctx.addLog(`🔖 【${existing.name}】減少 ${before - count} 層（剩餘 ${count}）。`, 'effect');
    return true;
  },
  double_prev: (ctx, _p, st) => { if (st.lastStmt) for (const a of st.lastStmt.acts) runAct(ctx, a, st); return true; },
  timed: (ctx, p, st) => {
    // 「N回合內」包含啟動當回合，即使該回合的監控事件已經過去也不補一回合。
    // 起算與事件獨立：self_attack／opp_attack／round_start都不能因後手而變N+1。
    const thisTurnCounts = p.from !== 'next';
    const payload={ trig: p.trig, body: p.body,sourceKind:st.sourceKind,...(p.skillKind?{skillKind:p.skillKind}:{}),...(p.once?{once:true}:{}),...(p.onExpire?{expireBody:p.onExpire}:{}),...(p.onRoundMiss?{roundMissBody:p.onRoundMiss}:{}) };
    const timerId=`blk_${ctx.actor}_${ctx.skill?.name || ctx.self?.name || 'src'}_${p.label||'持續效果'}_${p.trig}${timerProgramIdentity(payload)}`;
    const firedKey=`blockTimerFired:${timerId}`;
    const firedThisAction=ctx.actionId!==undefined&&ctx.getPlayerState(firedKey)===ctx.actionId;
    const extraTurns = p.perMark ? readMarkStacks(ctx, p.perMark) * p.perMark.mult : 0;
    addBlockTimer(ctx, ctx.actor, (p.label || "持續效果"), p.turns + extraTurns, "turns", payload, p.from === 'next', isSkillCtx(st)?'turn_effect':'round_counter', thisTurnCounts,'elf',timerId);
    // 使用通知在新timer建立前已發出：初次命中啟動時明確補本次，不額外延長一回合。
    if(p.initial && !firedThisAction && ctx.skill && (p.trig==='self_skill'||(p.trig==='self_attack'?ctx.skill.category!=='屬性':ctx.skill.category==='屬性'))) {
      if(ctx.actionId!==undefined)ctx.setPlayerState(firedKey,ctx.actionId);
      const frame:RunState={last:null,lastAmount:0,sourceKind:st.sourceKind,event:{trig:p.trig,data:{skill:ctx.skill}}};
      runStmts(ctx,p.body,frame);
      if(p.onRoundMiss && frame.last===true)ctx.setPlayerState(`blockTimerSuccess:${timerId}`,ctx.roundNumber??0);
    }
    return true;
  },
  ...closureOperations({ liveElf, addTimer: addBlockTimer, damage: dealDamage }),
  ...legacyHandlerOperations(),
  ...groupCOperations({ liveElf, ops: () => OPS }),
  ...itemUseOperations(),
  ...powerStatOperations(),
  ...entranceStackOperations(addBlockTimer),
  ...stageDamageOperations({ liveElf, dealDamage }),
  ...keldSoulOperations({ runStmts, dealDamage }),
  ...statusSovereigntyOperations(),
  ...priorityBonusOperations(),
  ...arenaSharedOperations({ runStmts, liveElf }),
  ...holyMilesOperations({ runStmts }),
  ...dragonHealingOperations({ liveElf }),
  ...supportOperations(),
  ...resourcePanelOperations(),
  ...shieldMarkOperations({ liveElf, addBlockTimer, runAct: (ctx,act,st)=>runAct(ctx,act,st) }),
  ...canOperations({ liveElf }),
  ...brinkkOperations({ liveElf }),
  ...odinOperations({ liveElf }),
  ...mechOperations({ liveElf,runAct }),
  ...ppAbsorbOperations(),
  ...fearSeedOperations(),
  ...rosterStatsOperations(),
  ...panelDurationOperations({liveElf,dealDamage,runStmts,addBlockTimer,ops:()=>OPS}),
  ...ownerLinkOperations(),
  ...group1Operations({ runStmts, liveElf, dealDamage }),
  ...finalExtraTraitOperations(),
  ...finalMarsLanDragonOperations({ liveElf, runStmts, dealDamage }),
  ...typedCycleOperations(runStmts),
  ...resourceDefenseOperations(runStmts),
  ...missingHpScalingOperations,
  ...removedEffectOperations,
  ...finalOdbOperations(addBlockTimer,runStmts),
  ...extraElfOperations(),
  ...bossTraitOperations(),
  ...thunderGodOperations({ liveElf }),
  ...group5Operations({ runStmts, liveElf }),
  once:(ctx,p,st)=>{
    const key=`blockOnce:${(ctx as any).illusionEffectKey || ''}:${p.key}`;
    if(ctx.getPlayerState(key))return false;
    ctx.setPlayerState(key,true);
    runStmts(ctx,p.body,st);return st.last===true || !!st.survived;
  },
  once_per_round:(ctx,p,st)=>{
    const key=`blockOnceRound:${(ctx as any).illusionEffectKey || ''}:${p.key}`;
    const round=ctx.roundNumber??0;
    if(ctx.getPlayerState(key)===round)return false;
    ctx.setPlayerState(key,round);
    runStmts(ctx,p.body,st);return st.last===true;
  },
};

/** 強制存活：本次致命傷害改為保留 1 點體力 */
export function surviveAt1(ctx: BattleEventContext) {
  ctx.updateElf(ctx.actor, { currentHp: 1 } as any);
}

// ───────── 持續效果（回合類，可被消除） ─────────
export function addBlockTimer(ctx: BattleEventContext, side: S, name: string, n: number, mode: "turns" | "uses", payload: Record<string, any>, pendingActivation = false, kind?: "turn_effect" | "round_counter", benefitThisTurn = false, scope: 'elf' | 'team' = 'elf',timerId?:string) {
  const sourceName = kind === 'round_counter' ? ctx.self?.soulMark?.name || ctx.self?.name : ctx.skill?.name;
  const presentation = makeEffectPresentation({ block: payload }, sourceName, name === '持續效果' ? undefined : name);
  ctx.addTimerTo(side, {
    // 同來源同效果重複附加時刷新回合數（不疊加）
    id: timerId || `blk_${side}_${ctx.skill?.name || ctx.self?.name || "src"}_${name}_${payload.trig || ""}${timerProgramIdentity(payload)}`,
    name: presentation.label,
    presentation,
    scope,
    kind: mode === "uses" ? "use_counter" : (kind || "turn_effect"),
    source: kind === 'round_counter' ? 'soulmark' : 'skill',
    remaining: n,
    pendingActivation,
    tickAt: mode === "uses" ? "never" : "round_end",
    payload: { block: { ...payload, ...((ctx as any).effectSource?{effectSource:{...(ctx as any).effectSource}}:{}), owner: side, src: ctx.skill?.name || ctx.self?.name } },
    description: presentation.description || presentation.label,
  } as any, ctx.moveIndex === 1 && !benefitThisTurn);
}

/** 「效果翻倍」：把數值參數加倍 */
function doubled(op: string, p: any): any {
  const q = { ...p };
  if (op === "boost") q.mult = 1 + (p.mult - 1) * 2;
  if (op === "stat") { q.v = p.v * 2; if (p.v2 != null) q.v2 = p.v2 * 2; }
  for (const k of ["ratio", "ratioCur", "flat", "amount", "reduce", "boost", "count","stepBonus"]) if (typeof p[k] === "number") q[k] = p[k] * 2;
  return q;
}

/**
 * 通用計數（「每有1…」）：數值欄位乘上計數。新增計數只能在這裡登記，並附 P1/P2 測試。
 * - self_up_kinds：自身處於能力提升的能力種類數
 * - sides_priority_zero：本回合出手先制為 0 的一方數（引擎在排序時記錄 actionPriorityThisTurn）
 */
export const PER_COUNTERS: Record<string, (ctx: BattleEventContext) => number> = {
  opp_down_kinds:(ctx)=>Object.values(liveElf(ctx,ctx.targetSide)?.statStages || {}).filter((v:any)=>Number(v)<0).length,
  self_up_kinds: (ctx) => Object.values(liveElf(ctx, ctx.actor)?.statStages || {}).filter((v: any) => Number(v) > 0).length,
  sides_priority_zero: (ctx) => [ctx.actor, ctx.targetSide].filter(s => {
    const v = (s === ctx.actor ? ctx.getPlayerState : ctx.getOpponentState)("actionPriorityThisTurn");
    return v !== undefined && v !== null && Number(v) === 0;
  }).length,
  // 敵我雙方「當前 PP 值低於 1」的技能個數（王·凰歌盡霄：每有1個則威力提升30%）。
  sides_pp_below_one: (ctx) => [ctx.actor, ctx.targetSide].reduce((n, s) =>
    n + (liveElf(ctx, s)?.skills || []).filter((sk: any) => (sk.pp ?? 0) < 1).length, 0),
  // 敵我雙方「無法主動切換精靈」效果個數（5019 ᚺᚢᚷᛁᚾ：每存在1個則技能傷害額外提升50%）。
  // 一個帶 lockSwitch 的有效 timer payload 即一個效果；待啟用與歸零者不算。
  sides_lock_switch_effects: (ctx) => [ctx.actor, ctx.targetSide].reduce((n, s) => {
    const timers = (s === 'p1' ? ctx.p1Timers : ctx.p2Timers) || [];
    return n + timers.filter((t: any) => (t.remaining ?? 0) > 0 && !t.pendingActivation && t.payload?.block?.lockSwitch === true).length;
  }, 0),
  // 對手所有技能「當前 PP 值總和」（5021 告命詩途龍魂：每1點PP附加50點技能傷害）。
  opp_full_pp_skills: (ctx) => (liveElf(ctx, ctx.targetSide)?.skills || []).filter((sk:any)=>sk.maxPp>0&&sk.pp===sk.maxPp).length,
  opp_pp_sum: (ctx) => (liveElf(ctx, ctx.targetSide)?.skills || []).reduce((n: number, sk: any) => n + (sk.pp ?? 0), 0),
  // 敵我雙方「PP 值為滿」的技能個數（龍魂：每存在1個滿技能則翻倍1次）。
  sides_full_pp_skills: (ctx) => [ctx.actor, ctx.targetSide].reduce((n, s) =>
    n + (liveElf(ctx, s)?.skills || []).filter((sk: any) => sk.maxPp > 0 && sk.pp === sk.maxPp).length, 0),
  // 敵我雙方技能「當前 PP 值總和」（5021 神懺福音之章龍魂：雙方每1點PP附加50點技能傷害）。
  sides_pp_sum: (ctx) => [ctx.actor, ctx.targetSide].reduce((n, s) =>
    n + (liveElf(ctx, s)?.skills || []).reduce((m: number, sk: any) => m + (sk.pp ?? 0), 0), 0),
  // 對手「PP 值為 0」的技能個數（arena_16 剛莖棍壓：每有1個則攻擊傷害提升20%）。
  opp_pp_zero_skills: (ctx) => (liveElf(ctx, ctx.targetSide)?.skills || []).filter((sk: any) => (sk.pp ?? 0) === 0).length,
};
Object.assign(PER_COUNTERS, GROUP_B_COUNTERS); // B 組：能力等級相同／不同項數、體力十分位（見 blocks/ops/groupB.ts）
const PER_FIELDS = ["add", "v", "flat", "amount", "ratio","count","mult"];

export function runAct(ctx: BattleEventContext, a: Act, st: RunState, dbl = false): boolean {
  const fn = OPS[a.op];
  if (!fn) return false;
  let p = a.p;
  if(p.scaleByMarks!==undefined){try{p=scaleActionByMarks(ctx,a.op,p);}catch{return false;}}
  if (p.per && p.perInc === undefined) {
    const counter = PER_COUNTERS[p.per];
    if (!counter) return false;
    const n = counter(ctx);
    if (n <= 0) return false;
    p = { ...p }; for (const k of PER_FIELDS) if (typeof p[k] === "number") p[k] = p[k] * n;
  }
  // perInc（每計數增量）由各 op 自行讀 PER_COUNTERS[p.per] 計算，不在此預乘，避免雙重縮放。
  // 每次使用額外附加（最高）
  if (p.rampInc != null) {
    const key = p.rampStreak ? `blkStreak:${ctx.skill?.name}` : `blkUses:${ctx.skill?.name}`;
    const uses = Math.max(0, (ctx.getPlayerState(key) || 1) - 1);
    const field = p.flat != null ? "flat" : p.mult != null ? "mult" : "ratio";
    const inc = field === "flat" ? p.rampInc : p.rampInc / 100;
    let v = (p[field] || 0) + inc * uses;
    if (p.rampCap != null) v = Math.min(v, field === "flat" ? p.rampCap : (field === "mult" ? 1 + p.rampCap / 100 : p.rampCap / 100));
    p = { ...p, [field]: v };
  }
  if(['status','status_seq','bench_entrance_status'].includes(a.op)&&p.chance!=null)p={...p,chance:Math.max(p.chance,markCapability(liveElf(ctx,ctx.actor),'statusChanceFloor'))};
  if (p.chanceX2If && p.chance != null && evalCond(ctx, p.chanceX2If, st) === true) p = { ...p, chance: Math.min(100, p.chance * 2) };
  if (dbl) p = doubled(a.op, p);
  if (p.chance != null && p.chance < 100 && a.op === "boost" && !chance(ctx, `boost:${a.label}`, p.chance)) return false;
  try { const r = fn(ctx, p, st); return r !== false; } catch (e) { console.error("[blocks]", a.op, e); return false; }
}

export function runStmts(ctx: BattleEventContext, body: Stmt[], st: RunState, opts: { afterHitOnly?: boolean } = {}) {
  if(st.sourceKind)ctx=withRecoveryOrigin(ctx,st.sourceKind);
  // 先判定「…時效果翻倍」這類使用前狀態的條件
  const pre = new Map<Stmt, boolean>();
  for (const s of body) if (s.pre && s.cond) pre.set(s, s.cond.every(c => evalCond(ctx, c, st) === true));
  // 同一觸發句內的狀態條件以句子開始時為準。否則「低體力時回血並弱化」會在回血後
  // 重新判斷成 false，錯誤跳過同一句後半效果。依賴前一動作結果的條件仍即時計算。
  if (!st.conditionSnapshots) {
    st.conditionSnapshots = new Map();
    for (const s of body) for (const c of s.cond || []) if (!DYNAMIC_CONDS.has(c.c)) st.conditionSnapshots.set(condKey(c), evalCond(ctx, c, st));
  }
  // 「…時效果翻倍」看使用前的狀態
  const dblMap = new Map<Act, boolean>();
  for (const s of body) for (const a of [...s.acts,...(s.elseActs || [])]) if (a.p?.x2If) dblMap.set(a, evalEventCond(ctx, a.p.x2If, st));
  for (let i = 0; i < body.length; i++) {
    const s = body[i];
    // 傷害結算後才執行的句子（afterHit）：使用時略過；結算後只跑這些句子
    if (opts.afterHitOnly ? !s.afterHit && !s.acts.some(a => a.op === "vampire") : s.afterHit && st.event?.trig !== "after_hit") continue;
    if (s.chain === "success" && st.last !== true) continue;
    if (s.chain === "fail" && st.last !== false) continue;
    if (s.chain === "any_fail" && !(st.history || []).some(x => x === false)) continue;
    if (s.cond && s.cond.length) {
      // 「附加後對手體力未減少」：延後到實際扣血結算時判定（由上一句的傷害登記）
      if (st.deferred?.has(s)) continue;
      const ok = pre.has(s) ? pre.get(s) : s.cond.every(c => s.live ? evalCond(ctx, c, st) === true : evalEventCond(ctx, c, st));
      if (!ok) {
        if (s.elseActs?.length) {
          let any = false;
          for (const a of s.elseActs) { const r=runAct(ctx,a,st,dblMap.get(a)===true); st.prevOp=a.op; if(a.op!=="noop"&&a.op!=="note")any=r||any; }
          st.last=any; (st.history ||= []).push(any); st.lastStmt={...s,acts:s.elseActs};
        }
        continue;
      }
    }
    const next = body[i + 1];
    if (next?.cond?.some(c => c.c === "last_no_dmg") && !next.chain) st.deferNoDmg = next;
    let any: boolean | null = null;
    for (const a of s.acts) {
      if (a.op === "double_prev") { runAct(ctx, a, st); continue; }
      const r = runAct(ctx, a, st, dblMap.get(a) === true);
      st.prevOp = a.op;
      if (a.op !== "noop" && a.op !== "note") any = (any ?? false) || r;
    }
    if (any !== null) { st.last = any; (st.history ||= []).push(any); }
    if (!s.acts.every(a => a.op === "double_prev")) st.lastStmt = s;
    // 未登記（本句沒有造成傷害）時，下一句改為即時判定
    st.deferNoDmg = undefined;
  }
}

/** 每個子句重設數值類狀態（等量／上一數值不可跨子句洩漏）；成敗鏈與「任一項」歷史保留 */
export function runClause(ctx: BattleEventContext, c: Clause, st: RunState, opts: { afterHitOnly?: boolean } = {}): boolean {
  if(st.sourceKind)ctx=withRecoveryOrigin(ctx,st.sourceKind);
  if (c.cond && !c.cond.every(x => evalEventCond(ctx, x, st))) return false;
  st.lastAmount = 0; st.lastDealt = undefined; st.lastDamageImmune=undefined; st.lastRequestedDamage=undefined; st.prevOp = undefined; st.lastStmt = undefined; st.deferNoDmg = undefined; st.deferred = undefined;
  if (st.historyTrig !== c.trig) { st.history = []; st.historyTrig = c.trig; }
  runStmts(ctx, c.body, st, opts);
  return true;
}

/** 記錄本次使用技能（遞增數值「每次使用增加」「連續使用」的計數）。resetOnSwitch：計數隨下場清除（rampReset:'switch'）。 */
export function recordSkillUse(ctx: BattleEventContext, resetOnSwitch = false) {
  const nm = ctx.skill?.name;
  if (!nm) return;
  if (resetOnSwitch) {
    const keep: string[] = ctx.getPlayerState("clearOnSwitch") || [];
    const add = [`blkUses:${nm}`, `blkStreak:${nm}`].filter(k => !keep.includes(k));
    if (add.length) ctx.setPlayerState("clearOnSwitch", [...keep, ...add]);
  }
  // 固有／附加入口可各建立一個frame；同一正式行動仍只能增加一次使用計數。
  if (ctx.actionId !== undefined) {
    const actionKey = `blkUseAction:${nm}`;
    if (ctx.getPlayerState(actionKey) === ctx.actionId) return;
    ctx.setPlayerState(actionKey, ctx.actionId);
  }
  ctx.setPlayerState(`blkUses:${nm}`, (ctx.getPlayerState(`blkUses:${nm}`) || 0) + 1);
  const streak = ctx.getPlayerState("blkLastSkill") === nm ? (ctx.getPlayerState(`blkStreak:${nm}`) || 0) + 1 : 1;
  ctx.setPlayerState(`blkStreak:${nm}`, streak); ctx.setPlayerState("blkLastSkill", nm);
}

/** 技能：使用時 / 傷害結算後 */
export function runSkillProgram(ctx: BattleEventContext, prog: Program, phase: "use" | "after_hit" | "on_invalid", only?: number[]) {
  const st: RunState = { last: null, lastAmount: 0, sourceKind:'skill', event: phase === "use" ? undefined : { trig: phase } };
  snapshotConditions(ctx, prog.clauses.filter((c, i) => (!only || only.includes(i)) && c.trig === phase && c.parsed), st);
  if (phase === "use") ctx.setPlayerState("blkLastHitDamage", 0);
  if (phase === "use") recordSkillUse(ctx);
  prog.clauses.forEach((c, i) => {
    if (only && !only.includes(i)) return;
    if (!c.parsed) return;
    if (c.marker === "■" && ctx.self.isInherentInvalid) return;
    if (c.trig === phase) { runClause(ctx, c, st); return; }
    if (c.trig !== "use") return;
    // 使用時子句中的「傷害結算後」句（等量＝實際傷害）
    if (phase === "after_hit" && c.body.some(b => b.afterHit)) { runClause(ctx, c, st, { afterHitOnly: true }); return; }
    // 使用時子句中「技能無效時…」句：只在技能無效時執行該句
    if (phase === "on_invalid" && c.body.some(b => b.cond?.some(x => x.c === "invalid"))) {
      runClause(ctx, { ...c, body: c.body.filter(b => b.cond?.some(x => x.c === "invalid")) }, st);
    }
  });
}

// ───────── 事件 → 觸發時點 ─────────
export function eventTriggers(ctx: BattleEventContext, ev: string, data: any): Trigger[] {
  switch (ev) {
    case EffectTiming.OPPONENT_ACTION:{
      const skill=data?.skill||ctx.skill;
      return ['opp_before_skill',skill?.category==='屬性'?'opp_before_status':'opp_before_attack'];
    }
    case EffectTiming.OPPONENT_DAMAGE:return ['opp_damage_settled'];
    case EffectTiming.MODIFY_POWER:return Number.isFinite(data?.powerComp?.power)&&(data?.skill||ctx.skill)?.category!=='屬性'?[data?.isIncoming?'incoming_power':'outgoing_power']:[];
    case EffectTiming.RESOURCE_CHANGED:return data?.side===ctx.actor&&data?.targetBattleId===idOf(ctx.self)&&data.after!==data.before?['resource_changed']:[];
    case EffectTiming.BEFORE_INSTANT_KILL:return ['before_instant_kill'];
    case EffectTiming.STAT_BOOST_CLEARED:return data?.sourceSide&&data.sourceSide!==ctx.actor&&Object.values(data.removedStages||{}).some(v=>typeof v==='number'&&v>0)?['stat_boost_cleared']:[];
    case EffectTiming.TURN_EFFECTS_CLEARED:return data?.cleared>0&&data.side===ctx.actor?['turn_effects_cleared']:[];
    case EffectTiming.BEFORE_STATUS_APPLY:return !data?.targetSide||data.targetSide===ctx.actor?['before_status']:[];
    case EffectTiming.BEFORE_STAT_CHANGE:return ['before_stat_change'];
    case EffectTiming.ON_STATUS_ENDED:return ['status_end'];
    case EffectTiming.SELF_STATUS_APPLIED:return ['status_received'];
    case EffectTiming.ON_STATUS_IMMUNIZED:return ['status_immune'];
    case EffectTiming.BEFORE_STATUS_TICK:return ['status_tick'];
    case EffectTiming.ROUND_START: return ["round_start", "team_round_start"];
    case EffectTiming.BEFORE_ACTION: return ["before_action"];
    case EffectTiming.BEFORE_SKILL: return ["before_skill"];
    case EffectTiming.MODIFY_PRIORITY: return ["modify_priority"];
    case EffectTiming.ROUND_END: return ["round_end"];
    case EffectTiming.BATTLE_PHASE_END: return ["phase_end"];
    case EffectTiming.EXTRA_ACTION_START: return ["extra_action_start"];
    case EffectTiming.AFTER_ATTACK_HIT: return ["attack_hit"];
    case EffectTiming.EXTRA_ACTION_END: return ["extra_action_end"];
    case EffectTiming.BATTLE_START:{
      if(ctx.getPlayerState?.('blkBattleStartFired'))return [];
      ctx.setPlayerState('blkBattleStartFired',true);return ['battle_start'];
    }
    case EffectTiming.ON_ENTRANCE:return ['entrance'];
    case EffectTiming.DEATH_NODE_1: return ["defeated"];
    case EffectTiming.ON_KILL: return ["kill"];
    case EffectTiming.NOT_KILLED:return ['not_killed'];
    case EffectTiming.ON_SWITCH_OUT: return ["switch_out"];
    case EffectTiming.HELD_RESOURCE_LOST:return ['held_resource_lost'];
    case EffectTiming.SHIELD_BROKEN: return ["shield_broken" as Trigger];
    case EffectTiming.FATAL_RESIST: return ["fatal"];
    case EffectTiming.ON_DAMAGED: {
      if (data?.targetSide && data.targetSide !== ctx.actor) return isSkillDamageType(data.damageType)?['opp_damaged_skill']:[];
      const t = String(data?.damageType || "");
      const out: Trigger[] = ["damaged"];
      if (/skill|attack/.test(t)) out.push("damaged_skill", ...(data?.typedSkill ? [] : ["damaged_attack"] as Trigger[]), "damaged_nontrue");
      else if (/true/.test(t)) out.push("damaged_true");
      else if (/fixed/.test(t)) out.push("damaged_fixed", "damaged_nontrue");
      else if (/percent|pink/.test(t)) out.push("damaged_percent", "damaged_nontrue");
      return out;
    }
    case EffectTiming.BEFORE_DAMAGE: {
      const comp = data?.damageComp || data;
      if (!comp || typeof comp !== "object" || comp.base == null) return [];
      const skill = isSkillDamageType(comp.damageCategory);
      const atk = comp.damageCategory === "skill_attack" && !comp.isTypedSkill;
      if (comp.isIncoming) return ["passive", "incoming", ...(skill ? ["incoming_skill"] as Trigger[] : []), ...(atk ? ["incoming_attack"] as Trigger[] : []), ...(isNonTrueDamageType(comp.damageCategory) ? ["incoming_nontrue"] as Trigger[] : [])];
      return ["passive", "outgoing", ...(skill ? ["outgoing_skill"] as Trigger[] : []), ...(atk ? ["outgoing_attack"] as Trigger[] : [])];
    }
    default: return [];
  }
}

/** 側邊持續效果（N回合內，X時Y）與傷害修正 */
export function runSideTimers(baseCtx: BattleEventContext, trigs: Trigger[], data: any) {
  runFormationWindows(baseCtx,trigs,data,(body,sourceKind)=>runStmts(baseCtx,body,{last:null,lastAmount:0,sourceKind,event:{trig:trigs.includes('round_end')?'round_end':trigs[0],data}}));
  const timers: any[] = trigs.includes('turn_effects_cleared')&&Array.isArray(data?.observerTimers)?data.observerTimers:(baseCtx.actor === "p1" ? baseCtx.p1Timers : baseCtx.p2Timers) || [];
  const comp = data?.damageComp || (data && data.base != null ? data : null);
  for (const t of timers) {
    const b = t.payload?.block;
    if (!b || t.pendingActivation || (t.remaining ?? 0) <= 0) continue;
    const ctx:BattleEventContext=b.effectSource?Object.assign(Object.create(baseCtx),{effectSource:b.effectSource}):baseCtx;
    if (t.scope !== "team" && t.ownerBattleId && t.ownerBattleId !== (ctx.self.battleId || ctx.self.id)) continue;
    if(b.statusInstanceGuard){
      if((trigs.includes('status_end')&&canonicalStatusName(data?.status)===b.statusInstanceGuard)||!(ctx.getStatuses(liveElf(ctx,ctx.actor))?.[b.statusInstanceGuard]>0)){
        ctx.consumeTimer?.(ctx.actor,t.id);continue;
      }
      if(comp?.isIncoming&&compMatchesKind(comp,b.kind))OPS.block_damage(ctx,{kind:b.kind,key:`statusGuard:${t.id}`},{last:null,lastAmount:0,event:{trig:'incoming_skill',data}});
    }
    if(b.effectEndWatch){
      const ended=trigs.includes('turn_effects_cleared')?(data?.removed||[]):trigs.includes('round_end')?
        timers.filter(x=>x.kind==='turn_effect'&&x.tickAt==='round_end'&&x.remaining===1&&!x.lateMoverPending&&!x.pendingActivation):[];
      const stamp=`effectEndWatch:${t.id}:${ctx.roundNumber}:${trigs.includes('round_end')?'expiry':ended.map((x:any)=>x.id).join('|')}`;
      if(ended.length&&!ctx.getPlayerState(stamp)){
        ctx.setPlayerState(stamp,true);
        const p=b.effectEndWatch,st:RunState={last:null,lastAmount:0,sourceKind:'skill',event:{trig:trigs[0],data}};
        if(p.mode==='convert')OPS.status_convert_uses(ctx,{count:p.count,status:p.status},st);
        else OPS.immune_status_count(ctx,{count:p.count},st);
      }
    }
    if (b.voluntaryOnly && data?.forced !== false) continue; // 只認主動切換（ON_SWITCH_OUT 帶 forced 旗標）
    if(b.powerRatio&&trigs.includes('outgoing_power')&&Number.isFinite(data?.powerComp?.power))data.powerComp.power*=b.powerRatio;
    if(b.nextPowerRatio&&trigs.includes('outgoing_power')&&Number.isFinite(data?.powerComp?.power)){data.powerComp.power*=b.nextPowerRatio;ctx.consumeTimer?.(ctx.actor,t.id);}
    if(b.typeDamageFloor&&trigs.includes('incoming_skill'))applyTypeDamageFloor(ctx,comp,b.typeDamageFloor);
    if(b.actionOnly&&((ctx.actionId!==undefined&&ctx.actionId!==b.boundActionId)||trigs.includes('round_end'))){ctx.consumeTimer?.(ctx.actor,t.id);continue;}
    let fired=false;
    if(b.trig&&trigs.includes(b.trig)&&['shield_broken','held_resource_lost'].includes(b.trig)&&markCapability(ctx.self,'shieldSideEffectsDisabled')){
      if(b.once)for(let count=0;count<t.remaining;count++)ctx.consumeTimer?.(ctx.actor,t.id);
      continue;
    }
    if (b.trig && trigs.includes(b.trig)) {
      // 指定技能類型的使用次數不被其他類型的技能耗掉。
      if(b.skillKind){const category=data?.skill?.category;
        if(b.skillKind==='攻擊'?category==='屬性'||!category:b.skillKind!==category)continue;
      }
      // 本次行動的快照不能轉送到下一招或已替換的目標。
      if(b.boundActionId!==undefined&&(b.boundActionId!==ctx.actionId||b.targetBattleId!==idOf(liveElf(ctx,ctx.targetSide)))){ctx.consumeTimer?.(ctx.actor,t.id);continue;}
      if(b.boundActionId===undefined&&b.targetBattleId!==undefined&&b.targetBattleId!==idOf(liveElf(ctx,ctx.targetSide))){ctx.consumeTimer?.(ctx.actor,t.id);continue;}
      const st: RunState = { last: null, lastAmount: 0, sourceKind:b.sourceKind || (t.kind==='turn_effect'?'skill':'soul'), event: { trig: b.trig, data } };
      if(ctx.actionId!==undefined&&['self_skill','self_attack','self_status'].includes(b.trig))ctx.setPlayerState(`blockTimerFired:${t.id}`,ctx.actionId);
      if (b.once)for(let count=0;count<t.remaining;count++)ctx.consumeTimer?.(ctx.actor,t.id);
      else if(b.consumeOnFire)ctx.consumeTimer?.(ctx.actor,t.id);
      runStmts(ctx, b.body || [], st);
      if(b.roundMissBody && st.last===true)ctx.setPlayerState(`blockTimerSuccess:${t.id}`,ctx.roundNumber??0);
      fired=true;
    }
    // 同一回合沒有成功執行監控內容（含未能使用技能），於回合末執行一次後備分支。
    if(b.roundMissBody && trigs.includes('round_end') && ctx.getPlayerState(`blockTimerSuccess:${t.id}`)!==(ctx.roundNumber??0) && ctx.getPlayerState(`blockTimerMiss:${t.id}`)!==(ctx.roundNumber??0)){
      ctx.setPlayerState(`blockTimerMiss:${t.id}`,ctx.roundNumber??0);
      runStmts(ctx,b.roundMissBody,{last:null,lastAmount:0,sourceKind:b.sourceKind||'skill',event:{trig:'round_end',data}});
    }
    // 自然到期分支只在真正扣最後一回合前执行；消除、下場與待啟用不是到期。
    if(!fired&&b.expireBody&&trigs.includes('round_end')&&t.remaining===1&&!t.lateMoverPending&&t.tickAt==='round_end'){
      ctx.consumeTimer?.(ctx.actor,t.id);
      runStmts(ctx,b.expireBody,{last:null,lastAmount:0,sourceKind:b.sourceKind||(t.kind==='turn_effect'?'skill':'soul'),event:{trig:'round_end',data}});
    }
    if(comp&&b.damageCap!==undefined&&compMatchesKind(comp,b.kind)){
      if(comp.isIncoming&&b.dir==='in')comp.limit=Math.min(comp.limit??Infinity,b.damageCap);
      if(!comp.isIncoming&&b.dir==='out')comp.outgoingLimit=Math.min(comp.outgoingLimit??Infinity,b.damageCap);
    }
    if(comp&&b.damageCapRatio!==undefined&&compMatchesKind(comp,b.kind)&&(!b.ownerBattleId||b.ownerBattleId===idOf(liveElf(ctx,comp.isIncoming?ctx.actor:ctx.targetSide)))){
      // 動態比例上限：依「上限擁有者」當下最大體力計算（受方上限讀受方 maxHp）。
      const ownerElf=liveElf(ctx,comp.isIncoming?ctx.actor:ctx.targetSide);
      const dynamicCap=Math.floor((ownerElf?.maxHp||0)*b.damageCapRatio);
      if(comp.isIncoming&&b.dir==='in')comp.limit=Math.min(comp.limit??Infinity,dynamicCap);
      if(!comp.isIncoming&&b.dir==='out')comp.outgoingLimit=Math.min(comp.outgoingLimit??Infinity,dynamicCap);
    }
    if(comp?.isIncoming&&comp.base>0&&isNonTrueDamageType(comp.damageCategory)&&b.flatIn>0&&compMatchesKind(comp,b.kind)){
      comp.flatReduction=(comp.flatReduction || 0)+b.flatIn*(comp.reductionPolicy?.attenuation ?? 1);
      if(t.kind==='use_counter')ctx.consumeTimer?.(ctx.actor,t.id);
    }
    if(comp?.isIncoming&&isNonTrueDamageType(comp.damageCategory)&&b.dmgInMult!==undefined&&compMatchesKind(comp,b.kind)){
      if(b.dmgInMult<1)multiplyDamageReduction(comp,b.dmgInMult);else comp.multiplier*=b.dmgInMult;
    }
    if (comp && (b.dmgIn != null || b.dmgOut != null || b.dmgOutMult != null)) {
      if (!compMatchesKind(comp, b.kind)) continue;
      if (comp.isIncoming && b.dmgIn != null) { if (b.dmgIn < 0) addDamageReduction(comp, -b.dmgIn); else comp.increasePercent += b.dmgIn; }
      if (t.kind === 'use_counter' && !b.trig && ((comp.isIncoming && b.dmgIn != null) || (!comp.isIncoming && (b.dmgOut != null || b.dmgOutMult != null)))) ctx.consumeTimer?.(ctx.actor, t.id);
      if (!comp.isIncoming && b.dmgOut != null) comp.increasePercent += b.dmgOut * (b.doubleIfAnyStatus && (hasAbn(ctx, ctx.self) || hasAbn(ctx, ctx.target)) ? 2 : 1);
      if (!comp.isIncoming && b.dmgOutMult != null) {
        // 「減半 n 次」：每次傷害都乘 dmgOutMult 的 n 次方（n 讀當下登錄值）。
        const powN = b.powRegistryKey ? Math.max(0, Number(ctx.getPlayerState(b.powRegistryKey) || 0)) : -1;
        if (powN > 0) {
          if (b.dmgOutMult < 1) multiplyDamageReduction(comp, b.dmgOutMult ** powN, false);
          else comp.multiplier *= b.dmgOutMult ** powN;
        }
        const limit = b.useLimitRegistryKey ? Number(ctx.getPlayerState(b.useLimitRegistryKey) || 0) : Infinity;
        if (powN < 0 && (b.usesConsumed || 0) < limit) {
          if (b.dmgOutMult < 1) multiplyDamageReduction(comp, b.dmgOutMult, false); else comp.multiplier *= b.dmgOutMult;
          if (b.useLimitRegistryKey) ctx.addTimerTo(ctx.actor, { ...t, payload: { ...t.payload, block: { ...b, usesConsumed: (b.usesConsumed || 0) + 1 } } }, false);
        }
      }
    }
    // 「直到上述異常結束前」：該異常提前解除即結束
    if (b.whileStatus && !((ctx.getStatuses(liveElf(ctx, b.whileStatus.side)) || {})[b.whileStatus.status] > 0)) { for (let k = 0; k < (t.remaining ?? 1); k++) ctx.consumeTimer?.(ctx.actor, t.id); continue; }
    if(comp?.isIncoming&&b.recordBlockedDamage&&compMatchesKind(comp,b.kind)&&!comp.reductionPolicy?.skillDefenseDisabled&&!comp.ignoreDamageBlocking&&!bypassesAttackDefense(comp,'block')) {
      comp.damageBlocks ||= new Map();
      comp.damageBlocks.set(`${ctx.actor}:${idOf(ctx.self)}:${t.id}`,amount=>{
        comp.incomingDamageCancellation='block';
        const key=`blockCounter:${b.recordBlockedDamage}`;
        ctx.setPlayerState(key,Math.min(Number.MAX_SAFE_INTEGER,(Number(ctx.getPlayerState(key))||0)+amount));
        ctx.consumeTimer?.(ctx.actor,t.id);
        if(b.onBlock){const trig:Trigger=b.kind==='攻擊'?'incoming_attack':'incoming_skill';
          const st:RunState={last:null,lastAmount:amount,sourceKind:b.sourceKind||'skill',event:{trig,data}};
          const clause:Clause={raw:'抵擋成功反應',trig,parsed:true,body:b.onBlock};snapshotConditions(ctx,[clause],st);runStmts(ctx,b.onBlock,st);}
        ctx.addLog(`🛡️ 抵擋了 ${amount} 點${b.kind}傷害！`,'effect');
      });
    }
    if (comp && comp.isIncoming && b.blockSkillDmg && !comp.reductionPolicy?.skillDefenseDisabled && compMatchesKind(comp, "技能") && !comp.ignoreDamageBlocking && !bypassesAttackDefense(comp, 'block')) {
      const amt = Math.floor(comp.base * (1 + (comp.increasePercent || 0)) * (1 - (comp.decreasePercent || 0)) * (comp.multiplier ?? 1));
      comp.incomingDamageCancellation='block';comp.multiplier = 0;
      ctx.setPlayerState("blkBlockedBySoul", (ctx.getPlayerState("blkBlockedBySoul") || 0) + Math.max(0, amt));
      ctx.addLog(`🛡️ 抵擋了 ${amt} 點技能傷害！`, "effect");
    }
    if (comp && !comp.isIncoming && b.dmgOutReduce && (b.kind?compMatchesKind(comp,b.kind):!b.kinds||b.kinds.includes(comp.damageCategory))) addDamageReduction(comp, b.dmgOutReduce, false);
    if(comp?.isIncoming&&b.convertDamageToHeal&&compMatchesKind(comp,b.kind)&&!bypassesAttackDefense(comp,'conversion')) {
      comp.damageConversions ||= new Map();
      const owner=idOf(ctx.self),recovery=withRecoveryOrigin(ctx,b.sourceKind || (t.kind==='turn_effect'?'skill':'soul'));
      comp.damageConversions.set(`${ctx.actor}:${owner}:${t.id}`,amount=>{
        const healed=Math.floor(amount*(b.convertRatio??1));
        if(recovery.applyHealToElf)recovery.applyHealToElf(ctx.actor,owner,healed);else recovery.applyHeal(ctx.actor,healed);
        ctx.addLog(`💚 受到的${b.kind}傷害轉化為 ${healed} 點體力！`,'heal');
        if(t.kind==='use_counter')ctx.consumeTimer?.(ctx.actor,t.id); // 次數型：每次實際轉化消耗一次
      });
    }
    if (comp && comp.isIncoming && b.absorbToHeal && !comp.reductionPolicy?.skillDefenseDisabled && compMatchesKind(comp, b.kind) && !bypassesAttackDefense(comp, 'conversion')) {
      const amt = Math.floor(comp.base * (1 + (comp.increasePercent || 0)) * (1 - (comp.decreasePercent || 0)) * (comp.multiplier ?? 1));
      if(amt>0)comp.incomingDamageCancellation='conversion';comp.multiplier = 0;
      if (amt > 0) { withRecoveryOrigin(ctx,b.sourceKind || (t.kind==='turn_effect'?'skill':'soul')).applyHeal(ctx.actor, amt); ctx.addLog(`💚 受到的傷害轉化為 ${amt} 點體力！`, "heal");
        if (t.kind === 'use_counter') ctx.consumeTimer?.(ctx.actor, t.id);
      }
    }
    if (comp && comp.isIncoming && b.blockAttack && !comp.reductionPolicy?.skillDefenseDisabled && compMatchesKind(comp, "攻擊") && !comp.ignoreDamageBlocking && !bypassesAttackDefense(comp, 'block')) {
      comp.incomingDamageCancellation='block';comp.multiplier = 0; ctx.consumeTimer?.(ctx.actor, t.id);
      ctx.addLog(`🛡️ 【抵擋】：抵擋了本次攻擊傷害！`, "effect");
    }
  }
}

/** 魂印程式：依事件觸發 */
const PASSIVE_OPS = new Set(["dmg_mod", "boost", "note", "noop", "advanced_mechanic", "team_stat_anchor", "special_attack_panel_formula"]);
export function runSoulProgram(ctx: BattleEventContext, prog: Program, trigs: Trigger[], data: any, only?: number[]): boolean {
  const st: RunState = { last: null, lastAmount: 0, sourceKind:'soul',event: { trig: trigs[0], data } };
  snapshotConditions(ctx, prog.clauses.filter((c, i) => (!only || only.includes(i)) && c.parsed && trigs.includes(c.trig)), st);
  const source = (ctx as any).illusionEffectKey;
  const onceKey = (i: number) => `blkOnce:${source ? `${source}:` : ''}${prog.title}:${i}`;
  prog.clauses.forEach((c, i) => {
    if (only && !only.includes(i)) return;
    if (!c.parsed || !trigs.includes(c.trig)) return;
    // 致命傷害：每場限一次（首次）——子句實際執行時即寫入旗標（不只存活子句）
    if (c.trig === "fatal" && !c.repeatable) { if (ctx.getPlayerState(onceKey(i))) return; }
    if (c.trig === "passive" && !c.body.every(b => b.acts.every(a => PASSIVE_OPS.has(a.op)))) return;
    const ran = runClause(ctx, c, st);
    if (c.trig === "fatal" && !c.repeatable && ran) ctx.setPlayerState(onceKey(i), true);
  });
  return !!st.survived;
}

// ───────── 引擎查詢：技能流程中讀取持續效果 ─────────
export function findBlockTimer(timers: any[] | undefined, pred: (b: any) => boolean): any | undefined {
  return (timers || []).find(t => t.payload?.block && !t.payload.block.mirror && !t.pendingActivation && (t.remaining ?? 0) > 0 && pred(t.payload.block));
}

/** 常駐閃避機率（魂印積木 evade） */
export function passiveEvade(prog: Program | null, skill: any): number {
  if (!prog) return 0;
  for (const c of prog.clauses) for (const b of c.body) for (const a of b.acts) {
    if (a.op !== "evade" || !c.parsed) continue;
    if (a.p.kind === "攻擊" && skill?.category === "屬性") continue;
    return a.p.chance;
  }
  return 0;
}

// ───────── 印記定義（持有者視角） ─────────
let _soulProgramOf: ((elf: any) => Program) | null = null;
export function setSoulProgramProvider(fn: (elf: any) => Program) { _soulProgramOf = fn; }
export function markDefClauses(defElf: any, name: string): Clause[] {
  if (!defElf || !_soulProgramOf) return [];
  return _soulProgramOf(defElf).clauses.filter(c => c.markDef === name && c.marker !== "§");
}

/** 持有者事件：ctx.actor 為持有者方 */
export function runHolderMarks(ctx: BattleEventContext, trigs: Trigger[], data: any, isRoundEnd: boolean) {
  const side = ctx.actor;
  const marks: any[] = (ctx.getMarks(side) || []).filter((m: any) => markAppliesToElf(m,liveElf(ctx,side)) && (
    m.effects?.blkDef || m.effects?.hpAdjustmentMaxHpRatioPerStack || m.effects?.blockProgram),
  );
  // 場下不執行持有者動作，但陣營回合結束仍須扣除其有限期限。
  const all = [...(ctx.getFullTeam?.("p1") || []), ...(ctx.getFullTeam?.("p2") || [])] as any[];
  const htrigs: Trigger[] = [];
  if (trigs.includes("damaged_attack")) htrigs.push("holder_damaged_attack");
  if (trigs.includes("damaged")) htrigs.push("holder_damaged");
  if (trigs.includes("passive")) htrigs.push("holder_passive");
  for (const mk of marks) {
    if(Array.isArray(mk.effects.blockProgram))for(const rule of mk.effects.blockProgram as Clause[]) {
      if(!trigs.includes(rule.trig)||sequenceIssue(rule,undefined,0,true))continue;
      runClause(ctx,rule,{last:null,lastAmount:0,markStacks:mk.count,holderMark:{id:mk.id,ownerBattleId:mk.ownerBattleId},sourceKind:'soul',event:{trig:rule.trig,data}});
      if(!ctx.getMarks(side).some(m=>m.id===mk.id&&(m.ownerBattleId||null)===(mk.ownerBattleId||null)))break;
    }
    const defElf = all.find(e => e?.name === mk.effects.blkDef);
    if (htrigs.length && defElf) {
      for (const c of markDefClauses(defElf, mk.name)) {
        if (!c.parsed || !htrigs.includes(c.trig)) continue;
        if (c.trig === "holder_passive" && !c.body.every(b => b.acts.every(a => a.op === "dmg_mod" || PASSIVE_OPS.has(a.op) || a.op === "heal_reduce" || a.op === "holder_invalid" || a.op === "mark_duration"))) continue;
        runClause(ctx, c, { last: null, lastAmount: 0, event: { trig: c.trig, data } });
      }
    }
    if (isRoundEnd && ctx.getMarks(side).some(m=>m.id===mk.id&&(m.ownerBattleId||null)===(mk.ownerBattleId||null))) {
      const ratio = Number(mk.effects?.hpAdjustmentMaxHpRatioPerStack || 0);
      if (ratio > 0 && mk.count > 0) {
        const amount = Math.floor(ctx.self.maxHp * ratio * mk.count);
        ctx.adjustHp(side, -amount);
        ctx.addLog(`👻 【${mk.name}】發作：${mk.count}${mk.unit || "層"}令【${ctx.self.name}】體力調整 -${amount}！`, "status");
      }
    }
  }
  if (isRoundEnd) for (const mk of (ctx.getAllMarks?.(side) || ctx.getMarks(side) || [])) {
    if (!Number.isFinite(mk.effects?.blkTurns)) continue;
    const left = mk.effects.blkTurns - 1;
    if (left <= 0) { ctx.clearMark(mk.id, side, mk.ownerBattleId || null); ctx.addLog(`🔖 【${mk.name}】結束了。`, "info"); }
    else ctx.setMark({ ...mk, remainingRounds: left, effects: { ...mk.effects, blkTurns: left } }, side);
  }
}

/** 異常附加後（雙方）：status_received（受到者）與 any_status */
export function statusTriggers(ctx: BattleEventContext, data: { side: string; status: string }): Trigger[] {
  return data.side === ctx.actor ? ["status_received", "any_status"] : ["any_status"];
}
