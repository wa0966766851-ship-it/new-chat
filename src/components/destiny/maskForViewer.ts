import type { Elf } from "../../types";
import { maskElfIdentity, type BattleViewMode, type Side } from "../../battle/viewerPerspective";

/**
 * 命運之輪各圖版／詳情顯示精靈資料前的唯一遮蔽入口（走 hiddenFromViewer／maskElfIdentity）。
 * 凡是顯示名稱、技能、魂印、特質的地方都要先過這裡；隱匿精靈在不可見的一方只會得到「未知精靈」替身。
 */
export function maskForViewer<T extends Elf>(elf: T, owner: Side, mode: BattleViewMode): T {
  return maskElfIdentity(elf, owner, mode) as T;
}
