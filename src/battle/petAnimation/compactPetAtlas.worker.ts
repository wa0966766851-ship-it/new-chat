/** 大型位圖縮放使用轉移所有權，避免複製整張圖集或在畫面執行緒等待。 */
type ResizeRequest = { atlas: ImageBitmap; width: number; height: number };
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<ResizeRequest>) => void) | null;
  postMessage: (message: { atlas: ImageBitmap; resized: boolean }, transfer: Transferable[]) => void;
};

worker.onmessage = async ({data: {atlas, width, height}}) => {
  try {
    const resized = await createImageBitmap(atlas, {
      resizeWidth: width, resizeHeight: height, resizeQuality: 'high', premultiplyAlpha: 'none',
    });
    try {
      worker.postMessage({atlas: resized, resized: true}, [resized]);
    } catch (error) {
      resized.close();
      throw error;
    }
    atlas.close();
  } catch {
    // 保留來源位圖，讓呼叫端沿用瀏覽器本來的縮放路徑。
    worker.postMessage({atlas, resized: false}, [atlas]);
  }
};

export {};

