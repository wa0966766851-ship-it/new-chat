import { StatusRegistry } from '../effects/statusRegistry';
import { canonicalStatusName } from '../effects/statusIdentity';
import type { Elf } from "../types";
import type { BattleState } from "../components/BattleManager";
import { addTimer, clearTurnEffects, type Timer, type AddContext } from "./timers";
import { bindMarkToElf, markAppliesToElf, setMark, type Mark } from "./marks";

type Side = "p1" | "p2";
export type ElfScopeSnapshot = { registry: Record<string, unknown>; timers: Timer[] };
export const battleIdentity = (elf: Pick<Elf, "id" | "battleId">) => elf.battleId || elf.id;

/** 側清單可收納場下印記；精靈物件只能存自身與陣營印記。 */
export function setBattleSideMarks(state: BattleState, side: Side, marks: Mark[]): BattleState {
  const teamKey = `${side}Team` as const;
  const team = state[teamKey].map(elf => ({ ...elf, marks: marks.filter(mark => markAppliesToElf(mark, elf)) }));
  return { ...state, [teamKey]: team, [side]: team[state[`${side}ActiveIndex`]], [`${side}Marks`]: marks };
}

/** 精靈更新中的marks是持有者視圖，不能拿來覆蓋含場下持有者的完整側清單。 */
export function replaceBattleElfMarks(state: BattleState, side: Side, holder: Elf, marks: Mark[]): BattleState {
  const next=(state[`${side}Marks`]||[]).filter(mark=>!markAppliesToElf(mark,holder));
  for(const mark of marks)if(markAppliesToElf(mark,holder)){
    const bound=bindMarkToElf(mark,holder),index=next.findIndex(m=>m.id===bound.id&&m.ownerBattleId===bound.ownerBattleId);
    if(index<0)next.push(bound);else next[index]=bound;
  }
  return setBattleSideMarks(state,side,next);
}

/** 明文的陣營、指定下一隻、及追蹤上場者資料；其他 RegistryState 預設個體。 */
export function isTeamRegistryKey(key: string): boolean {
  const plain = key.replace(/^p[12]_/, "");
  return plain.startsWith("nextElf") || plain.startsWith("team") || plain.startsWith("nextKill") ||
    plain.startsWith("wuxuBladeReviveTracking") ||
    ["previousActiveElfId", "incomingElfFear", "chanStacks", "canjieShengmangLayers"].includes(plain);
}

export function readScopedRegistry(state: BattleState, side: Side, elf: Elf, key: string): any {
  if (isTeamRegistryKey(key) || battleIdentity(elf) === battleIdentity(state[side])) {
    return state[`${side}RegistryState`][key];
  }
  return state[`${side}ElfState`]?.[battleIdentity(elf)]?.registry[key];
}

export function writeScopedRegistry(state: BattleState, side: Side, elf: Elf, patch: Record<string, unknown>): BattleState {
  const flat = { ...state[`${side}RegistryState`] };
  const bank = { ...state[`${side}ElfState`] };
  const id = battleIdentity(elf);
  const snapshot = bank[id] || { registry: {}, timers: [] };
  const registry = { ...snapshot.registry };
  for (const [key, value] of Object.entries(patch)) {
    if (isTeamRegistryKey(key) || id === battleIdentity(state[side])) flat[key] = value;
    else registry[key] = value;
  }
  bank[id] = { ...snapshot, registry };
  return { ...state, [`${side}RegistryState`]: flat, [`${side}ElfState`]: bank };
}

export function addScopedTimer(state: BattleState, side: Side, elf: Elf, timer: Timer, context?: AddContext): BattleState {
  // 明確個體作用域優先；舊未指定作用域的陣營鎖切仍保持相容。
  const scoped: Timer = timer.scope === "team" || (timer.scope !== "elf" && timer.payload?.lockSwitch)
    ? { ...timer, scope: "team" }
    : { ...timer, scope: "elf", ownerBattleId: timer.ownerBattleId || battleIdentity(elf) };
  if (scoped.scope === "team" || scoped.ownerBattleId === battleIdentity(state[side])) {
    return { ...state, [`${side}Timers`]: addTimer(state[`${side}Timers`], scoped, context) };
  }
  const bank = { ...state[`${side}ElfState`] };
  const id = scoped.ownerBattleId!;
  const snapshot = bank[id] || { registry: {}, timers: [] };
  bank[id] = { ...snapshot, timers: addTimer(snapshot.timers, scoped, context) };
  return { ...state, [`${side}ElfState`]: bank };
}

/** 指定持有者的次數型計時器消耗；不把同ID場下計時器留在銀行裡。 */
export function consumeScopedTimer(state:BattleState,side:Side,elf:Elf,id:string):BattleState {
  const owner=battleIdentity(elf);
  const consume=(timers:Timer[])=>timers.flatMap(t=>t.id!==id||(t.scope!=='team'&&t.ownerBattleId&&t.ownerBattleId!==owner)?[t]:t.remaining>1?[{...t,remaining:t.remaining-1}]:[]);
  const key=`${side}Timers` as const,bankKey=`${side}ElfState` as const;
  const bank={...state[bankKey]},snapshot=bank[owner];
  if(snapshot&&owner!==battleIdentity(state[side]))bank[owner]={...snapshot,timers:consume(snapshot.timers)};
  return {...state,[key]:consume(state[key]),[bankKey]:bank};
}

/** 在場者只讀活動清單；其銀行是上次切換快照，不能重新啟用已到期效果。 */
export function scopedTimers(state:BattleState,side:Side,elf:Elf):Timer[] {
  const owner=battleIdentity(elf);
  return [...state[`${side}Timers`].filter(t=>t.scope==='team'||!t.ownerBattleId||t.ownerBattleId===owner),
    ...(owner===battleIdentity(state[side])?[]:state[`${side}ElfState`]?.[owner]?.timers||[])];
}

/** 同一持有者的可消除回合效果（含明確陣營級）才可清除。 */
export function clearScopedTurnEffects(state:BattleState,side:Side,elf:Elf):{state:BattleState;removed:Timer[]} {
  const owner=battleIdentity(elf),key=`${side}Timers` as const,bankKey=`${side}ElfState` as const;
  const applicable=(t:Timer)=>t.scope==='team'||!t.ownerBattleId||t.ownerBattleId===owner;
  const flat=state[key],bank={...state[bankKey]},snapshot=bank[owner];
  const [kept]=clearTurnEffects(flat.filter(applicable));
  const removed=flat.filter(t=>applicable(t)&&!kept.includes(t));
  const nextFlat=flat.filter(t=>!removed.includes(t));
  if(snapshot&&owner!==battleIdentity(state[side])){const [nextOwn]=clearTurnEffects(snapshot.timers);removed.push(...snapshot.timers.filter(t=>!nextOwn.includes(t)));bank[owner]={...snapshot,timers:nextOwn};}
  const zeroKeys:Record<string,unknown>={};
  for(const timer of removed)for(const key of timer.payload?.mirrorRegistryKeys||[])zeroKeys[key]=0;
  return {state:writeScopedRegistry({...state,[key]:nextFlat,[bankKey]:bank},side,elf,zeroKeys),removed};
}

/** 所有切換路徑共用；不修改體力，不把下場保留誤當成傳給下一隻。 */
/** effects 裡代表異常狀態的項目（與 battleStatuses 同步的舊結構）。 */
function isStatusEffect(e: any): boolean {
  return !!e && (!!StatusRegistry[canonicalStatusName(String(e.id ?? e.name ?? ''))] || !!StatusRegistry[canonicalStatusName(String(e.name ?? ''))]);
}

export function switchBattleSide(state: BattleState, side: Side, index: number): BattleState {
  const teamKey = `${side}Team` as const;
  const indexKey = `${side}ActiveIndex` as const;
  const incoming = state[teamKey][index];
  if (!incoming || index === state[indexKey]) return state;
  const outgoing = state[side];
  const outId = battleIdentity(outgoing);
  const inId = battleIdentity(incoming);
  const regKey = `${side}RegistryState` as const;
  const bankKey = `${side}ElfState` as const;
  const bank = { ...state[bankKey] };
  const personal: Record<string, unknown> = {};
  const shared: Record<string, unknown> = {};
  const clearKeys = new Set<string>(state[regKey].clearOnSwitch || []);
  for (const [key, value] of Object.entries(state[regKey])) {
    if (key === "clearOnSwitch") continue;
    if (isTeamRegistryKey(key)) shared[key] = value;
    else if (!["vampireRatio", "skillDamageBoost", "modeInterceptorEntranceActive"].includes(key) && !clearKeys.has(key) && !/Turns$|ThisTurn$|ThisAction$/.test(key)) personal[key] = value;
  }
  // 無序的追蹤是針對 incoming，第一次交棒保留；離開被追蹤者才失效。
  if (shared.wuxuBladeReviveTrackingElf !== incoming.name) shared.wuxuBladeReviveTrackingActive = false;
  const boundTimers = state[`${side}Timers`].map(timer => timer.scope === "team"
    ? timer : { ...timer, ownerBattleId: timer.ownerBattleId || outId });
  bank[outId] = {
    registry: personal,
    timers: boundTimers.filter(timer => timer.scope !== "team" && timer.ownerBattleId === outId &&
      (timer.persistsOffField ?? timer.kind !== "turn_effect")),
  };
  const timers = [
    ...boundTimers.filter(timer => timer.scope === "team"),
    ...(bank[inId]?.timers || []),
  ];
  let marks: Mark[] = [];
  for (const mark of [...(outgoing.marks || []), ...(state[`${side}Marks`] || [])]) {
    const bound = bindMarkToElf(mark, outgoing);
    if (bound.scope === "team" || !markAppliesToElf(bound, outgoing) || bound.persistsOffField) {
      marks = setMark(marks, bound);
    }
  }
  // 舊版每隻精靈曾存整側印記；只接受自身/陣營資料，避免舊污染回流。
  for (const mark of incoming.marks || []) {
    const bound = bindMarkToElf(mark, incoming);
    if (markAppliesToElf(bound, incoming) && !marks.some(existing => existing.id === bound.id && existing.ownerBattleId === bound.ownerBattleId)) marks = setMark(marks, bound);
  }
  const active = { ...incoming, marks: marks.filter(mark => markAppliesToElf(mark, incoming)) };
  const team = [...state[teamKey]];
  // 屬性剝離／暫時改變屬性只在場上有效：下場時恢復原屬性。
  const peelRestore = (outgoing.typePeeled || outgoing.typeChangedUntilSwitch) ? { type: outgoing.originalType || outgoing.type, typePeeled: false, typeChangedUntilSwitch: false } : {};
  // 原廠設定：下場時異常狀態與能力等級消失。直接清除，不經「異常結束／解除」流程，所以不會響應窒息等結束效果。
  const offFieldReset = { battleStatus: 'normal', battleStatusDuration: 0, battleStatuses: {},
    effects: (outgoing.effects || []).filter((e: any) => !isStatusEffect(e)),
    statStages: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 } };
  team[state[indexKey]] = { ...outgoing, ...peelRestore, ...offFieldReset, marks: marks.filter(mark => markAppliesToElf(mark, outgoing)) };
  team[index] = active;
  return {
    ...state, [teamKey]: team, [side]: active, [indexKey]: index,
    [bankKey]: bank, [regKey]: { ...(bank[inId]?.registry || {}), ...shared, previousActiveElfId: outgoing.id },
    [`${side}Timers`]: timers, [`${side}Marks`]: marks,
    [`${side}StartHp`]: active.currentHp,
    [`${side}SelectedSkill`]: null,
    [`${side}TurnStats`]: { skillDmg: 0, fixedDmg: 0, percentDmg: 0, trueDmg: 0, hpChange: 0, heal: 0, lastType: null },
  };
}
