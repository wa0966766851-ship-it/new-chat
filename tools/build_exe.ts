// tools/build_exe.ts
// 對等 SeerBot tools/build_exe.py：版本唯一來源 version.ts，一鍵打出 Electron 安装包 + 可携版。
// 步驟：
//   1. prepare_share --force 產生乾淨副本（清帳號/路徑/快取/log）
//   2. 在副本上 npm install + lint + test + build:electron（build 本身含 vite + esbuild）
//   3. electron-builder 打 nsis + portable（讀 electron-builder.yml 與 package.json version）
//   4. 搬到 dist_release/<APP_NAME><VERSION>/ + 驗證 + 產生更新包 zip
// 用法：
//   npx tsx tools/build_exe.ts [--version X.Y.Z | --bump | --keep-version]
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(path.join(__dirname, ".."));
const VERSION_FILE = path.join(ROOT, "version.ts");
const PKG_FILE = path.join(ROOT, "package.json");

function readVersion(): string {
  const text = fs.readFileSync(VERSION_FILE, "utf8");
  const m = text.match(/VERSION\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("cannot parse VERSION from version.ts");
  return m[1];
}
function writeVersion(v: string): void {
  const text = fs.readFileSync(VERSION_FILE, "utf8");
  fs.writeFileSync(VERSION_FILE, text.replace(/VERSION\s*=\s*"[^"]+"/, `VERSION = "${v}"`));
}
function bumpPatch(v: string): string {
  const parts = v.split(".").map((x) => parseInt(x, 10));
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join(".");
}
function syncPackageVersion(v: string): void {
  const pkg = JSON.parse(fs.readFileSync(PKG_FILE, "utf8"));
  pkg.version = v;
  fs.writeFileSync(PKG_FILE, JSON.stringify(pkg, null, 2) + "\n");
}
function run(cmd: string, cwd: string): void {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit", shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh" });
}
function mustExist(p: string, label: string): void {
  if (!fs.existsSync(p)) throw new Error(`verify failed: missing ${label}: ${p}`);
}

const args = process.argv.slice(2);
let version = readVersion();
if (args.includes("--bump")) {
  version = bumpPatch(version);
  writeVersion(version);
} else {
  const i = args.indexOf("--version");
  if (i >= 0 && args[i + 1]) {
    version = args[i + 1];
    writeVersion(version);
  }
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`VERSION must be semver x.y.z, got "${version}"`);
}
// --keep-version 什麼都不做，直接用現值
syncPackageVersion(version);
console.log(`building ${version}`);

// 步驟0：擋 share 副本誤打
if (fs.existsSync(path.join(ROOT, ".share_copy"))) {
  throw new Error("Refusing: running inside a share copy. Run from the real project root.");
}

// 步驟1：乾淨副本
const shareDir = path.join(ROOT, "..", "SeerSim_share");
run(`npx tsx tools/prepare_share.ts --force --src "${ROOT}" --out "${shareDir}"`, ROOT);

// 步驟2：在副本上安裝 + 驗證 + 建置
run("npm install", shareDir);
run("npm run lint", shareDir);
run("npm test", shareDir);

// 步驟3：electron-builder（nsis + portable 都在 yml 裡）
// 注意：npm run build:electron 只是 vite + esbuild，並不會產出 exe，
// 真正的安裝包一定要再跑 electron-builder，所以這裡分兩段跑。
run("npm run build:electron", shareDir);
// 乾淨副本預設沒有 electron / electron-builder，先補上才打得動
run("npm install -D electron electron-builder", shareDir);
// Electron 本體約 110MB，GitHub 直連慢時容易 600s 超時。
// 預設走 npmmirror 鏡像加速，失敗自動重試 3 次；也可用環境變數覆寫。
if (!process.env.ELECTRON_MIRROR) {
  process.env.ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/";
}
if (!process.env.ELECTRON_BUILDER_BINARIES_MIRROR) {
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/";
}
let built = false;
let lastErr: any = null;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    console.log(`electron-builder attempt ${attempt}/3 ...`);
    run("npx electron-builder --config electron-builder.yml --win nsis portable --publish never", shareDir);
    built = true;
    break;
  } catch (err) {
    lastErr = err;
    console.error(`attempt ${attempt} failed, ${attempt < 3 ? "retrying in 10s ..." : "no more retries."}`);
    if (attempt < 3) execSync("ping -n 10 127.0.0.1 >nul", { cwd: ROOT, stdio: "inherit", shell: "cmd.exe" });
  }
}
if (!built) throw lastErr;

// 步驟4：收集產物到 dist_release/<APP_NAME><VERSION>/
const appName = "賽爾對戰模擬器";
const outDir = path.join(ROOT, "dist_release", `${appName}${version}`);
fs.mkdirSync(outDir, { recursive: true });
const shareDist = path.join(shareDir, "dist");
const copyRecursive = (src: string, dest: string) => {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
};
// electron-builder 會把安裝包吐到 dist-electron/（已在 yml 用 directories.output 分開，
// 避免跟 vite 的 dist/ 混在一起自己包自己），全部搬過去
for (const cand of [path.join(shareDir, "dist-electron"), shareDir]) {
  if (!fs.existsSync(cand)) continue;
  for (const name of fs.readdirSync(cand)) {
    if (/\.(exe|msi|zip|yml|blockmap)$/i.test(name)) {
      fs.copyFileSync(path.join(cand, name), path.join(outDir, name));
    }
  }
}
// 打包資訊
const info = {
  app: appName,
  version,
  builtAt: new Date().toISOString(),
  sourceCommit: (() => {
    try {
      return execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim();
    } catch {
      return null;
    }
  })(),
};
fs.writeFileSync(path.join(outDir, "打包資訊.json"), JSON.stringify(info, null, 2));

// 步驟5：驗證（對等 SeerBot verify_release）
const mustDirs = ["dist", "electron"];
for (const d of mustDirs) mustExist(path.join(ROOT, d), d);
mustExist(path.join(ROOT, "index.html"), "index.html");
mustExist(path.join(ROOT, "electron-builder.yml"), "electron-builder.yml");
const exes = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((n) => n.endsWith(".exe")) : [];
if (!exes.length) throw new Error(`verify failed: no exe in ${outDir}`);
console.log(`verify ok: ${exes.join(", ")}`);
console.log(`done: ${outDir}`);
