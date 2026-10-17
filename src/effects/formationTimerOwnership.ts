/** 關閉效果只能消耗本次來源持有者已生效的陣形及其衍生限制。 */
export function ownsActiveFormation(timer: any, id: string, ownerBattleId: string): boolean {
  return timer.id === id && timer.remaining > 0 && !timer.pendingActivation
    && (!timer.ownerBattleId || timer.ownerBattleId === ownerBattleId);
}

export function linksFormation(timer: any, id: string, sourceSide: string, ownerBattleId: string): boolean {
  const p = timer.payload;
  return p?.linkedSourceTimerId === id && p.linkedSourceSide === sourceSide
    && p.linkedSourceBattleId === ownerBattleId;
}
