import { BattleEventContext } from "../effects/types";
import { StatusRegistry } from "../effects/statusRegistry";
import { isStatusActive } from "./statusManager";
import { syncLegacy, getStatuses } from "./battleHelpers";

export function checkStatusDrivenFatalResist(ctx: BattleEventContext): boolean {
  const self = ctx.self;
  if (isStatusActive(self, "星佑")) {
    self.currentHp = self.maxHp;
    
    const statuses = getStatuses(self);
    for (const statusName of Object.keys(statuses)) {
      if (statusName === "星佑") {
        continue;
      }
      const registryEntry = StatusRegistry[statusName];
      const isControl = registryEntry?.categories?.includes("CONTROL");
      if (!isControl) {
        delete statuses[statusName];
      }
    }
    syncLegacy(self);
    
    ctx.addLog(`⭐ 【星佑】：體力歸零觸發重生！體力恢復至滿血，解除非控制類異常狀態！`, "effect");
    return true;
  }
  return false;
}
