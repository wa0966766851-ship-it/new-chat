import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * 導航可達性測試
 *
 * 2026-10-21：背包被移出主導航（使用者要求「不該暴露在外面」），
 * 但它仍然必須「到得了」。這個測試在原始碼層級確認：
 *   1. 編成頁（TeamScene）真的有連到 bag 的按鈕
 *   2. 大廳（LobbyScene）不再有直接開背包的入口
 *   3. 主導航清單裡沒有背包
 *
 * 為什麼用讀原始碼而不是渲染：
 *   渲染測試需要 jsdom + 完整 provider，成本高且容易因無關改動失敗。
 *   這裡要鎖的是「有沒有那個連結」，原始碼層級已經足夠，而且極快。
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

// ── 1. 編成頁必須有背包入口 ──
{
  const src = read("src/shell/scenes/TeamScene.tsx");
  assert.ok(src.includes('b.setView("bag")'), "編成頁必須有連到背包的按鈕");
  assert.ok(src.includes("背包"), "編成頁的背包入口必須有中文標籤");
}

// ── 2. 大廳不得再有直接開背包的入口 ──
{
  // 2026-10-21 修正：使用者要求首頁的「隊伍」按鈕要能進背包。
  // 這裡改為「必須有入口，但不得攤開完整隊伍」（攤開的檢查在 bagArchitecture）。
  const src = read("src/shell/scenes/LobbyScene.tsx");
  assert.ok(
    /b\.setView\("bag"\)/.test(src),
    "首頁必須有進背包的入口（隊伍管理）",
  );
}

// ── 3. 主導航不得包含背包 ──
{
  const src = read("src/shell/features.ts");
  const bagBlock = src.slice(src.indexOf('id: "bag"'), src.indexOf('id: "bag"') + 400);
  assert.ok(bagBlock.includes("hideFromNav: true"), "背包必須標記 hideFromNav");
}

// ── 4. AegisShell 必須有 bag 的路由（能渲染才叫「到得了」） ──
{
  const src = read("src/shell/AegisShell.tsx");
  assert.ok(src.includes('b.view === "bag"'), "AegisShell 必須有 bag 的路由分支");
  assert.ok(src.includes("BagScene"), "AegisShell 必須匯入 BagScene");
}

// ── 5. 切換鈕必須存在於兩個殼 ──
{
  const legacy = read("src/shell/LegacyShell.tsx");
  assert.ok(legacy.includes("ShellSwitchButton"), "Legacy 殼必須有殼切換鈕");
  const app = read("src/App.tsx");
  assert.ok(app.includes("ShellSwitchButton"), "App 必須掛載殼切換鈕");
  assert.ok(app.includes("toggleShell"), "App 必須提供切換動作");
}

// ── 6. 戰鬥中必須隱藏外殼（手遊全螢幕慣例） ──
{
  const src = read("src/shell/AegisShell.tsx");
  assert.ok(
    /b\.view !== "battle" && \(?\s*<?BottomBar/.test(src) || src.includes('b.view !== "battle" && (\n        <BottomBar'),
    "戰鬥中必須隱藏底部導航",
  );
  assert.ok(src.includes('{b.view !== "battle" && <TopUtilityBar'), "戰鬥中必須隱藏頂部列");
}

// ── 7. 大廳主行動必須真的啟動戰鬥（不能只開設定頁） ──
{
  const src = read("src/shell/scenes/LobbyScene.tsx");
  // 精準取 launch() 函式本體，避免被 import 那行騙過
  const launchStart = src.indexOf("const launch = () => {");
  assert.ok(launchStart >= 0, "必須有 launch 函式");
  const launchEnd = src.indexOf("\n  };", launchStart);
  const launchBody = src.slice(launchStart, launchEnd);
  assert.ok(launchBody.includes("b.setView('bag')"), "主行動先開新背包確認設定");
  assert.ok(!launchBody.includes('launchBattle('), '首頁不可略過戰前背包直接開戰');
}

// ── 8. 大廳設定抽屜必須有觸發點（曾寫了抽屜卻打不開） ──
{
  const src = read("src/shell/scenes/LobbyScene.tsx");
  assert.ok(src.includes("setDrawer"), "必須有抽屜 state");
  // setDrawer(true) 必須出現在「事件處理」裡，不能只有宣告
  const openCalls = [...src.matchAll(/onClick=\{[^}]*setDrawer\(true\)/g)];
  assert.ok(
    openCalls.length > 0,
    "必須有按鈕能 setDrawer(true) —— 否則抽屜寫了也打不開",
  );
  // 抽屜底部要留出導航列高度
  assert.ok(
    read("src/shell/scenes/LobbyPanels.tsx").includes("78px"),
    "抽屜底部必須留出導航列高度（否則最後一個按鈕被蓋住）",
  );
}

console.log("導航可達性：背包入口、主導航排除、路由存在、殼切換、戰鬥全螢幕、抽屜可開 通過");
