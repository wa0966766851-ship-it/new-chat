/** 僅在使用者點選複製時讀取已展示的圖片；不把圖片傳送至外部服務。 */
export async function copyImageToClipboard(src: string) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("此環境不支援圖片剪貼簿，請使用最新版瀏覽器或桌面版。");
  }
  const png = (async () => {
    const response = await fetch(src);
    if (!response.ok) throw new Error("圖片讀取失敗");
    const blob = await response.blob();
    if (blob.type === "image/png") return blob;
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("無法處理圖片");
      context.drawImage(bitmap, 0, 0);
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob(value =>
        value ? resolve(value) : reject(new Error("圖片轉換失敗")), "image/png"));
    } finally { bitmap.close(); }
  })();
  // 權限若先遭拒，圖片仍可能稍後讀取失敗；兩條非同步路徑都必須有錯誤接收者。
  void png.catch(() => {});
  // 立即建立寫入動作，保留點擊的使用者授權；圖片取得仍可非同步。
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}
