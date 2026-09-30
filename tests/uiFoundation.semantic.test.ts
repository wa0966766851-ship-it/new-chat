import assert from "node:assert/strict";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import type { Elf } from "../src/types";
import { expandRows, unpackJson } from "../src/data/packedJson";
import { getElfDisplayRank } from "../src/utils/elfDisplayRank";
import { readStoredRecord } from "../src/utils/safeStorage";
import { getElfTraitEntries } from "../src/components/ElfTraitCards";
import { ElfReadOnlyProfile } from "../src/components/ElfReadOnlyProfile";
import { EffectLibraryModal } from "../src/components/EffectLibraryModal";
import { copyImageToClipboard } from "../src/utils/copyImage";

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run(); passed++; console.log(`✓ ${name}`);
}
const stats = { hp: 120, atk: 170, def: 125, spatk: 170, spdef: 125, speed: 140 };
const elf = {
  id: "fixture", name: "測試精靈", type: "神秘.電", level: 100, baseStats: stats,
  calculatedStats: stats, currentHp: -210, maxHp: 992,
  soulMark: { name: "异", description: "魂印完整描述", effectType: "custom", effectValue: 0 },
  skills: [{ name: "測試技能", category: "特殊", type: "電", power: 120, pp: 3, maxPp: 20, description: "完整技能描述", effectType: "none", effectDetail: "" }],
} as Elf;

await check("資料字典還原文字、數字、空值與陣列", () => {
  assert.deepEqual(unpackJson({ strings: ["文字", "key"], root: [2, 1, [1, 0, [0, 70], false, null]] }), { key: ["文字", 70, false, null] });
});
await check("共用預設資料不共用可修改物件", () => {
  const rows = expandRows({ defaults: { nested: { values: [1] } }, rows: [{}, {}] });
  rows[0].nested.values.push(2);
  assert.deepEqual(rows[1].nested.values, [1]);
});
await check("悲歌 C 級優先於舊 S 標籤", () => assert.equal(getElfDisplayRank({ ...elf, name: "悲歌.索比拉特", destinyRank: "S" }), "C"));
await check("命運之輪特殊效果文本固定 C 級", () => assert.equal(getElfDisplayRank({ ...elf, description: "命運之輪特殊效果：測試", destinyRank: "S" }), "C"));
await check("未驗證精靈不因多技能／第五技能自動升 S", () => assert.equal(getElfDisplayRank({ ...elf, skills: Array(7).fill({ ...elf.skills[0], isFifthSkill: true }) }), "A"));
await check("已列名雷伊參考 S 保留", () => assert.equal(getElfDisplayRank({ ...elf, name: "異境神霆·雷伊" }), "S"));
for (const text of ["bad json", "[]", "null", "12", '"文字"']) {
  await check(`損壞或非物件存檔不使頁面崩潰 (${text})`, () => {
    assert.deepEqual(readStoredRecord("fixture", { getItem: () => text }), {});
  });
}
await check("存檔無讀取權限時回預設值", () => assert.deepEqual(readStoredRecord("fixture", { getItem: () => { throw new Error("denied"); } }), {}));
await check("有效存檔保留內容", () => assert.deepEqual(readStoredRecord("fixture", { getItem: () => '{"a":{"title":"原內容"}}' }), { a: { title: "原內容" } }));
await check("所有特質來源保留；僅相同名稱且描述相同才去重", () => {
  const item = { name: "神明", description: "原描述" };
  const entries = getElfTraitEntries({ ...elf, trait: { ...elf.soulMark, name: "通用" }, alienTraits: {
    gen2Trait: { name: "電氣纏繞", description: "二代描述" }, exclusiveTrait: item,
    exclusiveTraits: [item, { name: "神明", description: "不同描述" }],
    alienTrait: { name: "異能", description: "異能描述" }, generalTrait: { name: "其他", description: "其他描述" },
  } as any });
  assert.equal(entries.length, 7);
  assert.equal(entries.filter(entry => entry.name === "神明").length, 2);
});
await check("唯讀詳情預設特性在最上方，無編輯儲存入口", () => {
  const html = renderToStaticMarkup(React.createElement(ElfReadOnlyProfile, { elf, onClose: () => {} }));
  assert.match(html, /魂印完整描述/);
  assert.doesNotMatch(html, /保存精靈|修改精靈|儲存精靈/);
});
await check("隱匿詳情不洩漏精靈名稱、魂印、技能及屬性", () => {
  const html = renderToStaticMarkup(React.createElement(ElfReadOnlyProfile, { elf: { ...elf, isConcealed: true }, onClose: () => {} }));
  assert.match(html, /未知精靈/);
  for (const secret of [elf.name, elf.soulMark.description, elf.skills[0].name, elf.type]) assert.ok(!html.includes(secret));
});

const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import("react-dom/client");
const root = createRoot(document.getElementById("root")!);
await act(async () => root.render(React.createElement(ElfReadOnlyProfile, { elf, onClose: () => {}, getSkillMaxPp: () => 27 })));
await check("能力分頁保留負體力；點選技能不顯示能力面板", async () => {
  const button = [...document.querySelectorAll('nav button')].find(node => node.textContent === "能力資料")!;
  await act(async () => button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
  assert.match(document.body.textContent!, /-210 \/ 992/);
  assert.ok(!document.body.textContent!.includes("魂印完整描述"));
});
await check("技能分頁使用戰鬥傳入的動態 PP 上限", async () => {
  const button = [...document.querySelectorAll('nav button')].find(node => node.textContent === "技能")!;
  await act(async () => button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
  assert.match(document.body.textContent!, /PP 3 \/ 27/);
  assert.match(document.body.textContent!, /完整技能描述/);
  assert.ok(!document.body.textContent!.includes("目前體力"));
});
await act(async () => root.unmount());
const libraryRoot = createRoot(document.getElementById("root")!);
await act(async () => libraryRoot.render(React.createElement(EffectLibraryModal, { isOpen: true, onClose: () => {}, onSelectModule: () => {} })));
await check("效果引用資料庫首頁最多 32 張，不渲染整庫", () => {
  assert.equal([...document.querySelectorAll('button')].filter(node => node.textContent?.includes("一鍵引用此模組")).length, 32);
});
await check("效果引用資料庫末頁替換卡片，不累積頁面", async () => {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent === "末頁")!;
  await act(async () => button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
  const count = [...document.querySelectorAll('button')].filter(node => node.textContent?.includes("一鍵引用此模組")).length;
  assert.ok(count > 0 && count <= 32);
  assert.equal((document.querySelector('nav button:last-child') as HTMLButtonElement).disabled, true);
});
await check("效果引用資料庫換分類回第一頁", async () => {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent?.includes("控場/麻痺"))!;
  await act(async () => button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
  assert.match(document.querySelector('nav')!.textContent!, /第 1 \//);
});
await act(async () => libraryRoot.unmount());
dom.window.close();

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalItem = Object.getOwnPropertyDescriptor(globalThis, "ClipboardItem");
const originalFetch = globalThis.fetch;
const image = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
let written: Blob | undefined;
class FakeClipboardItem { constructor(public data: Record<string, Promise<Blob>>) {} }
Object.defineProperty(globalThis, "ClipboardItem", { value: FakeClipboardItem, configurable: true });
Object.defineProperty(globalThis, "navigator", { value: { clipboard: { write: async (items: FakeClipboardItem[]) => { written = await items[0].data["image/png"]; } } }, configurable: true });
globalThis.fetch = async () => new Response(image);
try {
  await check("圖片複製寫入 PNG 本身，而不是網址文字", async () => {
    await copyImageToClipboard("/fixture.png");
    assert.equal(written?.type, "image/png");
    assert.deepEqual(new Uint8Array(await written!.arrayBuffer()), new Uint8Array(await image.arrayBuffer()));
  });
  await check("圖片讀取失敗不得宣稱複製成功", async () => {
    globalThis.fetch = async () => new Response(null, { status: 404 });
    await assert.rejects(copyImageToClipboard("/missing.png"), /圖片讀取失敗/);
  });
  await check("剪貼簿權限失敗向介面回報", async () => {
    globalThis.fetch = async () => new Response(image);
    Object.defineProperty(globalThis, "navigator", { value: { clipboard: { write: async () => { throw new Error("permission denied"); } } }, configurable: true });
    await assert.rejects(copyImageToClipboard("/fixture.png"), /permission denied/);
  });
} finally {
  globalThis.fetch = originalFetch;
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else Reflect.deleteProperty(globalThis, "navigator");
  if (originalItem) Object.defineProperty(globalThis, "ClipboardItem", originalItem);
  else Reflect.deleteProperty(globalThis, "ClipboardItem");
}
console.log(`UI／資料基礎語意測試 ${passed} 項通過。`);
