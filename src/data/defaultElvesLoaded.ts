/**
 * ⚠️ 這是「轉發殼」，不是實際內容。
 *
 * 真正的内容在：src/data/defaultElves.ts
 * 本檔只多做了「等待匯入精靈載入完成」這一步。
 *
 * 測試／稽核腳本專用入口：等同 defaultElves，但已完成匯入精靈的延後載入。
 * 應用程式本身不得引用此檔（頂層 await 會讓首頁等待匯入資料）。
 */
export * from "./defaultElves";
import { loadImportedElves } from "./defaultElves";
await loadImportedElves();
