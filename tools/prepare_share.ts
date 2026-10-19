// tools/prepare_share.ts --force
// 對等 SeerBot tools/prepare_share.py：產出乾淨副本給打包用。
// 清掉：個人帳號/金鑰、快取、日誌、本機備份、release/dist 產物。
// 刻意不帶：node_modules（打包機重裝）、model 概念對應物（此專案無大模型）。
// 用法：npx tsx tools/prepare_share.ts --force [--src <dir>] [--out <dir>]
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { shouldDropShareFile } from './shareFilePolicy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
  "node_modules", "dist", "release", ".git", "build", "dist-electron",
  ".seer-cache", "_修正前備份", "_asset_backup",
  "release", "dist_release",
]);

function shouldDropDir(rel: string): boolean {
  const parts = rel.split(path.sep).filter(Boolean);
  if (parts.some((p) => p.startsWith("_備份"))) return true;
  return parts.some((p) => DROP_DIRS.has(p));
}
function shouldDropFile(rel: string): boolean {
  return shouldDropShareFile(rel);
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
    const st = fs.lstatSync(cur);
    if(st.isSymbolicLink()){skipped++;return;}
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

// 先驗證來源與輸出，不能在清除／複製之後才發現自己位於分享副本。
if (fs.existsSync(path.join(SRC, '.share_copy'))) throw new Error('Refusing: source is a share copy.');
const rel = path.relative(SRC, OUT);
const back = path.relative(OUT, SRC);
const inside = (r: string) => !!r && r !== '..' && !r.startsWith('..' + path.sep) && !path.isAbsolute(r);
if (!rel || inside(back) || (inside(rel) && rel.split(path.sep)[0] !== 'build')) throw new Error('Source/output must not overlap outside excluded build/.');
for (const target of [SRC, OUT]) for (let cur = target;; cur = path.dirname(cur)) {
  if (fs.existsSync(cur) && fs.lstatSync(cur).isSymbolicLink()) throw new Error('Source/output must not use directory links.');
  if (cur === path.dirname(cur)) break;
}
if (OUT === path.parse(OUT).root) throw new Error('Output cannot be a drive root.');
if (fs.existsSync(OUT) && fs.readdirSync(OUT).length && !fs.existsSync(path.join(OUT,'.share_copy'))) throw new Error('Refusing to overwrite an unmarked directory.');
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
