/**
 * 測試／稽核腳本專用入口：等同 defaultElves，但已完成匯入精靈的延後載入。
 * 應用程式本身不得引用此檔（頂層 await 會讓首頁等待匯入資料）。
 */
export * from "./defaultElves";
import { loadImportedElves } from "./defaultElves";
await loadImportedElves();
