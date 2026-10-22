/**
 * Capacitor 設定 — 把 PWA 包成 Android / iOS 原生殼
 *
 * 為什麼選 Capacitor 而不是 Electron：
 *   Electron 是桌面殼（已有）；Capacitor 是把同一份 dist/ 包成手機 App，
 *   兩者不衝突，共用同一份前端建置產物。
 *
 * 前置需求（本機目前沒有）：
 *   - Android：Android Studio + JDK 17 + Android SDK
 *   - iOS：macOS + Xcode（Windows 上無法建置）
 *
 * 使用方式（裝好環境後）：
 *   npx cap add android
 *   npm run build
 *   npx cap sync
 *   npx cap open android
 *
 * 注意：
 *   webDir 指向 dist（vite build 產物），不是專案根目錄。
 *   server.androidScheme 用 https，避免 mixed content。
 */
/**
 * 本地型別宣告
 *
 * 為什麼不 import @capacitor/cli：
 *   該套件尚未安裝（本機沒有 Android SDK），
 *   import 會讓 tsc 失敗。等實際要打包時再 `npm i -D @capacitor/cli`，
 *   那時可把這裡換回官方型別。
 */
interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: { androidScheme?: string };
  android?: { allowMixedContent?: boolean; backgroundColor?: string };
  ios?: { contentInset?: string; backgroundColor?: string };
  plugins?: Record<string, Record<string, unknown>>;
}

const config: CapacitorConfig = {
  appId: 'online.seer.simulator',
  appName: '賽爾號模擬器',
  webDir: 'dist',

  // 讓 WebView 用 https 載入本地資源（避免部分 API 被判定不安全）
  server: {
    androidScheme: 'https',
  },

  android: {
    // 允許混合內容（本地資源 + 遠端 SeerAPI 圖片）
    allowMixedContent: true,
    // 背景色與 PWA theme_color 一致，避免啟動白閃
    backgroundColor: '#0A0C10',
  },

  ios: {
    contentInset: 'always',
    backgroundColor: '#0A0C10',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#0A0C10',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;