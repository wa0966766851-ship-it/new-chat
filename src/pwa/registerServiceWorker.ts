/**
 * Service Worker 註冊
 *
 * 為什麼要小心：
 *   這是個會持續更新的專案，SW 快取策略錯了會讓使用者卡在舊版本。
 *   所以：
 *     1. **dev 模式不註冊**（會干擾 HMR）
 *     2. 只在 production build 註冊
 *     3. 註冊失敗不影響主功能（靜默）
 *     4. 有新版本時提示使用者（不自動重整，避免打斷對戰）
 */

export interface SWRegistrationResult {
  registered: boolean;
  reason?: "dev" | "unsupported" | "error";
}

export async function registerServiceWorker(): Promise<SWRegistrationResult> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return { registered: false, reason: "unsupported" };
  }

  // dev 模式不註冊：Vite HMR 與 SW 快取會互相干擾
  // 專案沒有 import.meta.env 型別，改用 build 時注入的常數判斷
  // （dev 時 __APP_BUILD_ID__ 仍會存在，但 dev server 不會提供 sw.js）
  const isDev = typeof location !== "undefined" && /localhost|127\.0\.0\.1/.test(location.hostname);
  if (isDev) {
    return { registered: false, reason: "dev" };
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

    // 有新版本時：提示（不自動重整）
    reg.addEventListener("updatefound", () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          // 交給既有的更新提示機制（SiteUpdateNotice）處理
          window.dispatchEvent(new CustomEvent("sw-update-available"));
        }
      });
    });

    return { registered: true };
  } catch {
    return { registered: false, reason: "error" };
  }
}