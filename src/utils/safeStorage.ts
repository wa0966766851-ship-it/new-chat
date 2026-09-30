export function readStoredRecord<T>(key: string, storage?: Pick<Storage, "getItem">): Record<string, T> {
  try {
    const value = JSON.parse((storage ?? localStorage).getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    // 不刪除／覆寫損壞的存檔，讓使用者仍可備份與修復。
    console.warn(`無法讀取 ${key}，本頁暫用預設資料；原存檔未修改。`);
    return {};
  }
}
