/** 戰鬥畫面的層級（z-index）單一來源。tests/battleLayers.contract.test.tsx 鎖定順序與實際元素。
 * 規則：全屏底片（FX_BACKDROP）只蓋住背景、場地與訊息欄；所有資訊顯示與按鈕（HUD／CONTROLS／POPUPS）永遠在它之上。
 * - FIELD：場地容器與背景網格；刻意「不設 z-index」（設了會形成 stacking context，把精靈關在底片之下），數值 0 僅作排序參考。
 * - SPRITES：全屏期間所有精靈、平時出招者；高於底片，兩隻都看得到。
 * - HUD：上方雙方卡片（名稱、體力、護盾、效果標籤列）與中央回合／比分面板。
 * - CONTROLS：下方指令列（技能、分頁、速度、托管、撤退、護盾切換）。
 * - POPUPS：飄字、提示框；彈窗（modal）一律用 MODAL 以上。 */
export const BATTLE_LAYERS={FIELD:0,LOG:20,FX_BACKDROP:24,SPRITES:25,HUD:30,CONTROLS:32,POPUPS:40} as const;
/** 戰鬥內全螢幕彈窗／阻擋層的最低層級（BattleScreen 內的 fixed inset-0 彈窗皆不低於此值）。 */
export const BATTLE_MODAL_MIN_Z=95;
export type BattleLayerName=keyof typeof BATTLE_LAYERS;
