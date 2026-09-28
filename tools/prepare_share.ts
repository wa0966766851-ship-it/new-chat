// tools/prepare_share.ts --force
// 對等 SeerBot tools/prepare_share.py：產出乾淨副本給打包用。
// 清掉：個人帳號/金鑰、快取、日誌、本機備份、release/dist 產物。
// 刻意不帶：node_modules（打包機重裝）、model 概念對應物（此專案無大模型）。
// 用法：npx tsx tools/prepare_share.ts --force [--src <dir>] [--out <dir>]
import * as fs from "node:fs";
import * as path from "node:path";

const args = process.argv.slice(2);
function opt(name: string, dflt: string): string {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
const FORCE = args.includes("--force");
const SRC = path.resolve(opt("--src", path.join(__dirname, "..")));
const OUT = path.resolve(opt("--out", path.join(SRC, "..", "SeerSim_share")));

if (!FORCE) {
  console.error("Refusing without --force. This wipes the output dir.");
  process.exit(1);
}

// 永不帶走的東西（對照 SeerBot：帳號/路徑/pet_bags/截圖/log）
const DROP_DIRS = new Set([
  "node_modules", "dist", "release", ".git",
  ".seer-cache", "_修正前備份", "_asset_backup",
  "release", "dist_release",
]);
const DROP_FILES = new Set([".env", ".env.local", "server.log", "launcher/server.log"]);
const DROP_SUFFIX = [".log"];

function shouldDropDir(rel: string): boolean {
  const parts = rel.split(path.sep).filter(Boolean);
  if (parts.some((p) => p.startsWith("_備份"))) return true;
  return parts.some((p) => DROP_DIRS.has(p));
}
function shouldDropFile(rel: string): boolean {
  const base = path.basename(rel);
  if (DROP_FILES.has(base)) return true;
  if (DROP_SUFFIX.some((s) => base.endsWith(s))) return true;
  if (base === ".env" || base.startsWith(".env.")) return true;
  return false;
}

function copyClean(srcDir: string, destDir: string): { dirs: number; files: number; skipped: number } {
  let dirs = 0;
  let files = 0;
  let skipped = 0;
  const walk = (cur: string) => {
    const rel = path.relative(srcDir, cur);
    if (rel && shouldDropDir(rel)) {
      skipped++;
      return;
    }
    const st = fs.statSync(cur);
    if (st.isDirectory()) {
      const target = path.join(destDir, rel);
      fs.mkdirSync(target, { recursive: true });
      dirs++;
      for (const name of fs.readdirSync(cur)) walk(path.join(cur, name));
    } else if (st.isFile()) {
      if (rel && shouldDropFile(rel)) {
        skipped++;
        return;
      }
      const target = path.join(destDir, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(cur, target);
      files++;
    }
  };
  walk(srcDir);
  return { dirs, files, skipped };
}

if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const stat = copyClean(SRC, OUT);
console.log(`prepare_share: ${SRC} -> ${OUT}`);
console.log(`dirs=${stat.dirs} files=${stat.files} skipped=${stat.skipped}`);

// 寫一份 share 標記，避免有人從副本再打一次包
fs.writeFileSync(path.join(OUT, ".share_copy"), `share copy of ${SRC} at ${new Date().toISOString()}\n`);
if (fs.existsSync(path.join(SRC, ".share_copy"))) {
  console.error("Refusing: source looks like a share copy (.share_copy exists).");
  process.exit(1);
}
