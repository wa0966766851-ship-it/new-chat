import { BattleEventContext } from "../effects/types";
import { StatusRegistry } from "../effects/statusRegistry";
import { isStatusActive } from "./statusManager";
import { syncLegacy, getStatuses, removeStatusEffect } from "./battleHelpers";

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
        // 透過共用移除入口同步 battleStatuses、effects 與 legacy 欄位；
        // 只改查詢用副本會讓非控制類異常在下一次讀取時復活。
        removeStatusEffect(self, statusName);
      }
    }
    // 星佑是「重生一次」的消耗型附屬異常；若保留狀態，後續每次致死都會
    // 重複觸發，等同永久免死。先清除再同步舊欄位，讓新舊狀態表示一致。
    removeStatusEffect(self, "星佑");
    syncLegacy(self);
    
    ctx.addLog(`⭐ 【星佑】：體力歸零觸發重生！體力恢復至滿血，解除非控制類異常狀態！`, "effect");
    return true;
  }
  return false;
}
