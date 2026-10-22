import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * 背包頁的資訊架構測試
 *
 * 使用者要求（2026-10-21）：
 *   「問題就是隊伍 —— 你一直把背包暴露在首頁」
 *   「不是只有一方，是雙方背包在一個頁面，方便編輯」
 *
 * 這個測試鎖住三件事：
 *   1. 首頁不得攤開完整 12 隻隊伍（只能有摘要 + 入口）
 *   2. 背包頁必須同時顯示 P1 與 P2
 *   3. 首頁的「隊伍」按鈕必須連到背包
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

// ── 1. 首頁不得有完整隊伍格 ──
{
  const lobby = read("src/shell/scenes/LobbyScene.tsx");

  // 不得再有 MemberTile 的 12 格網格
  assert.ok(
    !/p1\.active\.map/.test(lobby),
    "首頁不得再攤開出戰 6 格（使用者明確要求收進背包）",
  );
  assert.ok(
    !/p1\.standby\.map/.test(lobby),
    "首頁不得再攤開待命 6 格",
  );

  // 必須有精簡摘要
  assert.ok(lobby.includes("SQUAD"), "首頁要有隊伍摘要標籤");
  assert.ok(/p1\.active\.slice\(0, 6\)/.test(lobby), "摘要只顯示前 6 個頭像");

  // 必須有進背包的按鈕
  assert.ok(
    /onClick=\{\(\) => b\.setView\("bag"\)\}/.test(lobby),
    "首頁的隊伍按鈕必須連到背包頁",
  );
}

// ── 2. 背包頁必須同時顯示雙方 ──
{
  const bag = read("src/shell/scenes/BagScene.tsx");
  assert.ok(bag.includes("TeamBoard"), "背包要有雙方隊伍看板");
  assert.ok(/tab === "team"/.test(bag), "背包要有獨立的隊伍分頁");

  const panel = read("src/shell/art/TeamPanel.tsx");
  // 必須同時渲染 P1 與 P2（同一頁，不用切換）
  assert.ok(/side="p1"/.test(panel), "必須渲染 P1");
  assert.ok(/side="p2"/.test(panel), "必須渲染 P2");

  // 左右並排（不是上下、不是切換）
  assert.ok(
    /className="team-columns flex gap-1\.5 flex-1 min-h-0"/.test(panel),
    "P1 與 P2 必須左右並排在同一列",
  );
  assert.ok(
    !panel.includes('side === "p1" ? "我方" : "對手"'),
    "不得用切換方式顯示雙方",
  );

  // 12 隻往下排（2 欄 × 6 列）
  assert.ok(
    /grid-cols-2/.test(panel),
    "12 隻精靈要用 2 欄往下排",
  );

  // 出戰 / 待命都要顯示
  assert.ok(panel.includes("出戰") || panel.includes("active"), "隊伍要標示出戰");
  assert.ok(panel.includes("standby") || panel.includes("待命"), "隊伍要標示待命");

  // 點精靈要有資訊與換人
  assert.ok(panel.includes("ElfInfoDrawer"), "點精靈要開資訊卡");
  assert.ok(panel.includes("ElfPickerDrawer"), "要能換精靈");
  assert.ok(panel.includes("onReplace"), "資訊卡要有換人入口");
}

// ── 3. 隊伍分頁不得顯示不相關的裝備 UI ──
{
  const bag = read("src/shell/scenes/BagScene.tsx");
  // 搜尋與角色選擇列在隊伍分頁要隱藏
  assert.ok(
    /tab === "elf"/.test(bag),
    "隊伍分頁要隱藏搜尋／角色列（與隊伍無關）",
  );
  assert.ok(
    /slotForTab &&/.test(bag) && !bag.includes('>對象</span>'),
    "隊伍層級裝備不應增加選擇個別精靈的操作",
  );
}

// ── 4. 隊伍分頁要能進編成（換人是主要入口，編成是次要） ──
{
  const bag = read("src/shell/scenes/BagScene.tsx");
  assert.ok(
    bag.includes('b.setView("custom")'),
    "背包要能跳到編成",
  );

  // 點精靈 → 資訊卡 → 換精靈（主要操作路徑）
  const panel = read("src/shell/art/TeamPanel.tsx");
  assert.ok(panel.includes("setSelected"), "點精靈要能選取");
  assert.ok(panel.includes("setPicking"), "要有換精靈流程");
  assert.ok(
    panel.includes("handleReplace") || panel.includes("localStorage.setItem"),
    "換人必須真的寫回存檔",
  );
}

// ── 5. 技能石不得出現在背包（屬於精靈編輯器） ──
{
  const bag = read("src/shell/scenes/BagScene.tsx");
  assert.ok(
    !/label:\s*"技能石"/.test(bag),
    "背包不得有技能石分頁（技能石是換精靈技能，屬於精靈編輯器）",
  );
  assert.ok(
    !/id:\s*"stone"/.test(bag),
    "背包不得有 stone 分頁",
  );
}

// ── 6. 套裝分頁要用卡片列 + 可拖曳 ──
{
  const bag = read("src/shell/scenes/BagScene.tsx");
  assert.ok(bag.includes("SuitRail"), "套裝要用卡片列（參考星蝕迴廊）");

  const rail = read("src/shell/art/SuitRail.tsx");
  assert.ok(rail.includes("useDragScroll"), "卡片列要支援拖曳（否則後面拉不到）");
  assert.ok(rail.includes("wheel"), "卡片列要支援滾輪");
  assert.ok(rail.includes("snap"), "卡片列要有 snap 對齊");
  assert.ok(/搜尋/.test(rail), "卡片列要保留搜尋");
}

console.log("背包資訊架構：首頁收斂、雙方同頁、隊伍分頁乾淨、可進編成 通過");
