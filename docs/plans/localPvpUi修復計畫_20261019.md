# 雙人同屏（PVP）UI 修復計畫（DSH 2026-10-19 18:50）

## 根因（已證實）
引擎層 PVP 完整支持（p1_select→p2_select→resolving，onSkillSelect/onSwitchElf/onUseItem 雙側接口、
p2Team/p2ActiveIndex/p2ItemInventory/p2Marks 全在 state）。UI 層只渲染 P1 操作面板：
- BattleScreen.ui.tsx 的 renderSkillRow / renderTacticalOther（換人+藥劑）全部硬編碼 p1
- BattleScreen.tsx Context 的 onSkillSelect/onSwitchElf/onUseItem 被包成 p1-only
- PHASE_LABEL 的 p2_select 文案是 PVE 視角（「對手選擇」）

## 修改範圍（3 個檔案）

### 1. BattleScreen.tsx（Context 層）
- battleMode==='PVP' 時 Context 暴露 activeControlSide（依 phase 推導）
- onSkillSelect/onSwitchElf/onUseItem 不再包 p1，直接傳雙側原函數

### 2. BattleScreen.ui.tsx（渲染層）
- 解構 p2ActiveIndex、p2ItemInventory
- const actSide = battleMode==='PVP' ? (phase==='p2_select'?'p2':'p1') : 'p1'
- renderSkillRow：技能按鈕讀 actSide 的精靈，呼叫 props.onSkillSelect(actSide,...)
- renderTacticalOther TEAM 頁：PVP 時列 actSide 的隊伍、onSwitchElf(actSide,...)
- 藥劑頁：庫存讀 actSide 的 ItemInventory、onUseItem(actSide,...)
- PHASE_LABEL：PVP 時 p2_select 顯示「P2 選擇指令」

### 3. tests/localPvpUI.semantic.test.tsx（新增）
- PVP 掛載 → P1 選招 → 斷言 phase==='p2_select' 且存在 P2 技能按鈕
- P2 技能點擊 → 斷言結算（turnNumber+1）
- P2 藥劑扣自身庫存
- forced_switch_p2 時 P2 換人面板可操作
- PVE 回歸不受影響

## 驗收
- 新測試綠 + 既有回歸 0 紅 + tsc/build


## ✅ 執行完成（2026-10-19 19:10）

- BattleScreen.tsx：Context 雙側分流（activeControlSide + onSkillSelect/onSwitchElf/onUseItem 依 phase 選側）
- BattleScreen.ui.tsx：
  - 解構補 p2ActiveIndex；新增 actSide/actElf/actTeam/actActiveIndex/actSelectedSkill/actInventory 派生
  - renderSkillRow：技能面板渲染當前操作側（data-act-side 標記），禁用/選中/幻覺提示全部雙側化
  - renderTacticalOther TEAM 頁：換人列表/高亮/禁用雙側化
  - 藥劑頁：庫存與使用雙側化
  - PHASE_LABEL_PVP：「P2 選擇指令」「P2 請換人」（PVE 文案不動）
- tests/localPvpUI.semantic.test.ts（新）：3 情境首跑綠
  1. P1 選招 → phase='p2_select' 且面板 data-act-side='p2' 顯示 P2 技能
  2. P2 出招 → 回合推進、回 p1_select
  3. PVE 回歸：面板恆 'p1'

驗收：tsc 0 | 8 支回歸 0 紅 | bundle 705.74kB
