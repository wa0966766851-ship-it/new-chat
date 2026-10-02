import type { Elf } from "../types";
import type { BattleState } from "../components/BattleManager";
import { addTimer, type Timer, type AddContext } from "./timers";
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
  const scoped: Timer = timer.scope === "team" || timer.payload?.lockSwitch
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

/** 所有切換路徑共用；不修改體力，不把下場保留誤當成傳給下一隻。 */
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
  team[state[indexKey]] = { ...outgoing, marks: marks.filter(mark => markAppliesToElf(mark, outgoing)) };
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
