import { BattleEventContext, BattleSkillHandler, EffectTiming } from "../../types";
import { StatusRegistry } from "../../statusRegistry";

export const handlePipiSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { addLog } = ctx;
  if (event === EffectTiming.ON_ENTRANCE) {
    addLog(`🐦 【無】：神寵皮皮登場！大名鼎鼎，返璞歸真！`, "effect");
  }
  return false;
};

function applyStatusCategory(
  ctx: BattleEventContext, 
  categoryFilter?: (cats: string[]) => boolean, 
  targetSides: ("p1" | "p2")[] = ["p1", "p2"]
) {
  const entries = Object.entries(StatusRegistry);
  for (const [statusKey, entry] of entries) {
    if (entry.categories?.includes("BOSS_ONLY") || entry.categories?.includes("NO_EFFECT")) {
      continue;
    }
    if (!categoryFilter || categoryFilter(entry.categories || [])) {
      for (const side of targetSides) {
        ctx.applyStatusWithImmunityCheck(side, statusKey, 3);
      }
    }
  }
}

export const PIPI_SKILLS: Record<string, BattleSkillHandler> = {
  "異常測試": (ctx) => {
    applyStatusCategory(ctx);
    ctx.addLog(`🧪 【皮皮】：對雙方施加了所有異常狀態！`, "effect");
  },
  "測試異常用2": (ctx) => {
    const actorSide = ctx.actor;
    const selfElf = ctx.self;
    if (selfElf && selfElf.effects) {
      for (const eff of selfElf.effects) {
        ctx.applyStatusWithImmunityCheck(actorSide, eff.id, 3);
      }
    }
    applyStatusCategory(ctx, undefined, [actorSide]);
    ctx.addLog(`🧪 【皮皮】：為自身重置並附加了所有異常狀態！`, "effect");
  },
  "測試·控制類": (ctx) => {
    applyStatusCategory(ctx, cats => cats.includes("CONTROL"));
    ctx.addLog(`🧪 【皮皮】：對雙方施加了所有【控制類】異常狀態！`, "effect");
  },
  "測試·弱化類": (ctx) => {
    applyStatusCategory(ctx, cats => cats.includes("WEAKENING"));
    ctx.addLog(`🧪 【皮皮】：對雙方施加了所有【弱化類】異常狀態！`, "effect");
  },
  "測試·限制類": (ctx) => {
    applyStatusCategory(ctx, cats => cats.includes("RESTRICTIVE"));
    ctx.addLog(`🧪 【皮皮】：對雙方施加了所有【限制類】異常狀態！`, "effect");
  },
  "測試·衍化類": (ctx) => {
    applyStatusCategory(ctx, cats => cats.includes("EVOLUTIONARY"));
    ctx.addLog(`🧪 【皮皮】：對雙方施加了所有【衍化類】異常狀態！`, "effect");
  },
  "測試·附屬類": (ctx) => {
    applyStatusCategory(ctx, cats => cats.includes("AUXILIARY"));
    ctx.addLog(`🧪 【皮皮】：對雙方施加了所有【附屬類】異常狀態！`, "effect");
  }
};

