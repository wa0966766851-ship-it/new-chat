import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

type Chunk = { file: string; imports?: string[]; isEntry?: boolean };
const dist = resolve("dist");
const manifest = JSON.parse(readFileSync(resolve(dist, ".vite/manifest.json"), "utf8")) as Record<string, Chunk>;
const entry = Object.entries(manifest).find(([, chunk]) => chunk.isEntry);
assert.ok(entry, "請先建置，產生前端載入清單");
const initial = new Set<string>();
function visit(key: string) {
  if (initial.has(key)) return;
  initial.add(key);
  for (const imported of manifest[key].imports || []) visit(imported);
}
visit(entry[0]);
for (const key of initial) {
  assert.ok(!/vendor-blockly|blockly-core-|codexRegistry|blockLibrary|abilityRegistry|KitEffectBuilder|ElfBlocklyPanel|cardTemplates|EffectLibraryModal|ControlHubPanel|EvNaturePanel|ResistancePanel|TypeMatchupPanel|InscriptionModal|importedElves|data\/imported\//.test(key),
    `首頁不應提前載入未開啟的效果工具／設定／調校面板：${key}`);
}
// 匯入精靈（API 匯入的資料與打包檔）只能經動態 import 取得：首頁初始區塊不得含其模組或其特有字串。
for (const key of initial) {
  const text = readFileSync(resolve(dist, manifest[key].file), "utf8");
  assert.ok(!text.includes("匯入精靈資料版本不相容"), `首頁初始區塊不應內含匯入精靈資料模組：${key}`);
  assert.ok(!text.includes("staged_arena_"), `首頁初始區塊不應內含階段競技場精靈資料模組：${key}`);
}
assert.ok(Object.entries(manifest).some(([key,chunk])=>/reviewedKits\.deferred/.test(key)&&!initial.has(key)&&chunk.isDynamicEntry),'競技場圖紙應隨精靈延後載入');
assert.ok(Object.entries(manifest).some(([key, chunk]) => /stagedArenaElves/.test(key) && !initial.has(key) && chunk.isDynamicEntry), "階段競技場精靈應為獨立的延後載入區塊");
assert.ok(Object.entries(manifest).some(([key, chunk]) => /importedElves/.test(key) && !initial.has(key) && chunk.isDynamicEntry), "匯入精靈應為獨立的延後載入區塊");
const entryBytes = statSync(resolve(dist, entry[1].file)).size;
assert.ok(entryBytes < 480_000, `首頁主區塊超過480 kB回歸預算：${entryBytes}`);
for (const [key, chunk] of Object.entries(manifest)) {
  if (/codexRegistry|blockLibraryData|blockly-core-|vendor-blockly/.test(key)) {
    assert.ok(statSync(resolve(dist, chunk.file)).size < 500_000, `效果／積木區塊超過500 kB預算：${key}`);
  }
}
// Include every JS chunk, not just Blockly/data: a new page must not silently
// bring back the warning after the homepage has been reduced.
for (const [key, chunk] of Object.entries(manifest)) {
  assert.ok(statSync(resolve(dist, chunk.file)).size < 500_000, `JS 區塊超過500 kB預算：${key}`);
}
// Vite's page manifest omits Worker chunks. Include those assets so background
// modules cannot evade the same limit applied to pages.
const jsAssets = readdirSync(resolve(dist, "assets")).filter(file => file.endsWith(".js"));
for (const file of jsAssets) {
  assert.ok(statSync(resolve(dist, "assets", file)).size < 500_000, `頁面／Worker JS 區塊超過500 kB預算：${file}`);
}
console.log(`全部 ${jsAssets.length} 個頁面／Worker JS 區塊均低於500 kB。`);

// 精靈動作（pixi／Unity 解碼／圖像編解碼／@seer-pet-anim）只在使用者切到「精靈動作」且真的要播放時才動態載入：
// 首頁初始區塊不得含它們，也不得靜態引入它們。500 kB 上限不設例外：最大的 vendor-pet-pixi 已拆為獨立區塊。
for (const key of initial) {
  assert.ok(!/vendor-pet|PetActionSprite|HomePetActionLayer|swf-renderer|swf-bundle/.test(`${key} ${manifest[key].file}`), `首頁初始區塊不得含精靈動作依賴：${key}`);
}
assert.ok(Object.entries(manifest).some(([key, chunk]) => /PetActionSprite/.test(key) && chunk.isDynamicEntry && !initial.has(key)), "PetActionSprite 應為獨立的延後載入區塊");

// 區塊之間不得有「靜態引入循環」：manualChunks 把互相依賴的套件拆到不同區塊時，ES 模組循環會讓先求值的區塊
// 在對方尚未初始化前就使用它（Cannot access 'x' before initialization），精靈動作會永遠載入失敗。
{
  const deps = new Map<string, string[]>();
  for (const file of jsAssets) {
    const text = readFileSync(resolve(dist, "assets", file), "utf8");
    const list = new Set<string>();
    for (const match of text.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) if (jsAssets.includes(match[1])) list.add(match[1]);
    deps.set(file, [...list]);
  }
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visitChunk = (file: string) => {
    if (state.get(file) === 2) return;
    if (state.get(file) === 1) assert.fail(`區塊間存在靜態引入循環：${[...stack.slice(stack.indexOf(file)), file].join(" -> ")}`);
    state.set(file, 1); stack.push(file);
    for (const dep of deps.get(file) || []) visitChunk(dep);
    stack.pop(); state.set(file, 2);
  };
  for (const file of jsAssets) visitChunk(file);
  console.log("區塊間無靜態引入循環。");
}

// buffer-setup（把 Buffer 設到 globalThis）必須與 buffer 同在最先求值的共用塊；@jimp 等模組求值時就讀全域 Buffer。
for (const pattern of [/^vendor-pet-shared-/, /^ai-vendor-(?!image)/]) {
  const file = jsAssets.find(name => pattern.test(name));
  assert.ok(file, `找不到 ${pattern} 區塊`);
  assert.ok(/\.Buffer\|\|\(\w+\.Buffer=\w+\.Buffer\)/.test(readFileSync(resolve(dist, "assets", file), "utf8")), `${file} 必須含 buffer-setup（全域 Buffer 設定），否則 image 區塊先求值時 Buffer 未定義`);
}
let initialBytes = 0;
for (const key of initial) {
  const bytes = readFileSync(resolve(dist, manifest[key].file));
  initialBytes += bytes.length;
  console.log(`${manifest[key].file}: ${(bytes.length / 1000).toFixed(2)} kB / gzip ${(gzipSync(bytes).length / 1000).toFixed(2)} kB`);
}
// 20261012：匯入精靈（資料＋打包檔）與階段競技場精靈（stagedArenaElves＋heavyweights.json）已改為延後載入（loadImportedElves），
// 首頁初始 JS 964.2 → 955.1 → 938.4 kB；預算由 960 kB 降為 950 kB（餘裕約 11.6 kB）。
assert.ok(initialBytes < 950_000, `首頁初始 JS 超過950 kB回歸預算：${initialBytes}`);
console.log(`首頁靜態 JS 總量 ${(initialBytes / 1000).toFixed(2)} kB；延後載入與主區塊大小回歸檢查通過。`);
