/*
 * Service Worker — 離線快取（Phase 6）
 *
 * 策略：**不快取 HTML，只快取靜態資源**
 *
 * 為什麼：
 *   這是個持續更新的專案（版本號在 version.ts，網站會提示更新）。
 *   如果快取 HTML，使用者會卡在舊版本，看不到更新提示。
 *   所以：
 *     - HTML / API → network-first（永遠先拿新的）
 *     - 圖片 / JS / CSS（帶 hash）→ cache-first（省流量）
 *
 * 版本升級：改 CACHE_VERSION 就會清掉舊快取。
 */

// 2026-11-14 v2：只有 /assets/ 下帶雜湊的建置產物用快取優先；其餘（資料 JSON、立繪、動畫）改網路優先，
// 否則更新後仍讀到舊資料／舊圖。換版號會清掉 v1 留下的舊快取。
const CACHE_VERSION = "aegis-v2";
const STATIC_CACHE = `static-${CACHE_VERSION}`;

/** 只快取這些（避免把 API 回應也存起來） */
const CACHEABLE = /\.(?:png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf|otf|css|js|json)$/i;

/** 不快取的路徑（會變動的資料） */
const NEVER_CACHE = [/^\/api\//, /^\/seer\//, /^\/version\.json/, /^\/sw\.js/, /^\/$/];

self.addEventListener("install", event => {
  // 不做 precache：這個專案的資源太多，硬編清單會過期
  // 只確保 SW 立刻接管
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      // 清掉舊版本快取
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k.startsWith("static-") && k !== STATIC_CACHE).map(k => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 只處理同源
  if (url.origin !== self.location.origin) return;

  // 明確不快取的路徑 → 直接放行
  if (NEVER_CACHE.some(re => re.test(url.pathname))) return;

  // 只快取靜態副檔名
  if (!CACHEABLE.test(url.pathname)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);

      // 非雜湊檔：網路優先，離線時才用快取
      if (!url.pathname.startsWith("/assets/")) {
        try {
          const res = await fetch(req);
          if (res.ok && res.type === "basic") cache.put(req, res.clone()).catch(() => {});
          return res;
        } catch (err) {
          const old = await cache.match(req);
          if (old) return old;
          throw err;
        }
      }

      // cache-first：/assets/ 檔名帶雜湊，內容變了檔名就會變
      const hit = await cache.match(req);
      if (hit) return hit;

      try {
        const res = await fetch(req);
        // 只快取成功的同源回應
        if (res.ok && res.type === "basic") {
          // clone 一份存起來（不能存已消費的 body）
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch (err) {
        // 離線且沒快取 → 讓瀏覽器自己處理錯誤
        throw err;
      }
    })(),
  );
});