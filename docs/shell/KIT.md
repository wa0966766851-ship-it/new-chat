# Aegis Shell — 施工規範（KIT）

先讀 `PLAN.md`。這份講**怎麼做**。

## 1. 新增一個功能（唯一正確流程）

```ts
// ① 先登記，再寫程式
// src/shell/features.ts
{
  id: "new_thing",
  label: "新功能",
  short: "New",
  kind: "screen",          // screen | overlay | action
  group: "play",           // play | roster | data | system
  legacy: false,           // Legacy 還沒做
  aegis: { status: "planned", phase: 3 },
}
```

② 在 Legacy 實作（例如 `src/shell/scenes/LegacyScenes.tsx` 加一個 `b.view === "new_thing"` 分支）
③ 把 `legacy` 改 true
④ Aegis 若還沒重寫，把 `aegis.status` 改成 `"delegated"` → **立刻可在 Aegis 使用**
⑤ 日後重寫成原生，才改成 `"live"`

> 跳過 ①，`npm run check:parity` 會失敗。

## 2. 一個畫面（Screen）長什麼樣

```tsx
// src/shell/scenes/NN_name.tsx
export function NameScene({ b }: { b: ShellBridge }) {
  return (
    <section
      data-scene="name"
      style={{ background: "var(--p-panel)", color: "var(--p-text)" }}
    >
      {/* 內容 */}
    </section>
  );
}
```

必填：
- `data-scene` — 讓 `check:parity` 與截圖工具能定位
- 顏色一律走 `var(--p-*)`，**不得寫死 hex**
- 時長一律走 `cueCss("name")`，**不得寫死 `300ms`**

## 3. 取資料

只能透過 `ShellBridge`（`src/shell/bridge.ts`）。
**禁止**在畫面裡直接 `useGameData()` 或 `localStorage.getItem`——
那會讓兩殼的資料來源分岔。

需要新資料？擴充 `ShellBridge`，兩殼同時拿到。

## 4. 觸控

| 手勢 | 規則 |
| --- | --- |
| 點擊 | 最小 44×44 CSS px |
| 長按 | `cueMs("longPress")` = 420ms |
| 拖曳排序 | 長按後才啟動，啟動時給震動 `navigator.vibrate(8)` |
| 滾動 | `touch-action: pan-y`，橫向元件另外標 `pan-x` |
| 安全區 | 頂部 `env(safe-area-inset-top)`、底部 `env(safe-area-inset-bottom)` |

## 5. 驗收

```bash
npx tsc --noEmit                     # 型別
node tools/ui_shot.mjs --preset mobile     # 390×844
node tools/ui_shot.mjs --preset desktop    # 1600×900
```

`ui_shot.mjs` 會回報 `overflowX`；**必須為 false**。
（不要用 `msedge --window-size=390`：headless 會加視窗邊框，實際 innerWidth≈492，看起來像溢出其實不是。）

## 6. 跑測試的環境問題（Windows）

`npm test` 可能因 esbuild 暫存目錄被鎖而中斷：

```
Error: remove C:\Users\...\Temp\esbuild-xxx: Access is denied.
```

這**不是程式錯誤**。繞過方式：

```powershell
$env:TEMP='<專案根>\.tmp-esbuild'; $env:TMP=$env:TEMP; npm test
```

另外：測試輸出裡的 `TypeError` 不一定是失敗，**先看 exit code**。
例如 `effectConditions.semantic.test.ts` 會故意拋 `battleId` 的 TypeError 來驗證閘門，但 exit 0。

## 7. 不要做的事

- 不要在 `AegisShell.tsx` 裡加業務邏輯——它只負責「框」。
- 不要為了 Aegis 改 Legacy 元件的樣式（會污染桌面版）。要改就抽成共用元件。
- 不要改 `server.ts` / `electron/` / `scripts/`。
- 不要改 `src/engine/`、`src/effects/`（戰鬥邏輯）。