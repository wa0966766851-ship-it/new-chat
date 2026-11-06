/**
 * 產生 src/data/legacyBuiltinSignatures.json：Git 歷史中「內建精靈定義」的指紋。
 * 存檔沒有記錄基準（builtinEffectBindings）時，指紋完全相同才視為未改過的舊內建並自動升級。
 *
 * 用法：node --import tsx scripts/generate_legacy_builtin_signatures.ts <elfId...> [--ref=<commit>]...
 *   - 每個 --ref 會以 git worktree 取出該版本、載入當時的 DEFAULT_ELVES（含延後載入的精靈），
 *     再以「目前」程式的 definitionSignatures 計算指紋；未指定 --ref 時使用 HEAD。
 *   - 只合併指定 elfId 的指紋（排序、去重），不刪既有資料。
 */
import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const root = resolve(import.meta.dirname, '..');
const target = join(root, 'src/data/legacyBuiltinSignatures.json');
/** 子程序：在指定工作目錄載入當時的內建精靈並輸出成 JSON（函式與 undefined 不影響指紋）。 */
if (process.env.LEGACY_SIG_CHILD) {
  const {createServer} = await import('vite');
  const server = await createServer({root: process.cwd(), server: {middlewareMode: true, hmr: false, watch: null}, appType: 'custom', logLevel: 'silent'});
  try {
    const m = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
    await m.loadImportedElves?.();
    const wanted = new Set(process.env.LEGACY_SIG_IDS!.split(','));
    const elves = m.DEFAULT_ELVES.filter((e: any) => wanted.has(String(e.id)));
    writeFileSync(process.env.LEGACY_SIG_OUT!, JSON.stringify(elves));
  } finally { await server.close(); }
  process.exit(0);
}

const args = process.argv.slice(2);
const refs = args.filter(a => a.startsWith('--ref=')).map(a => a.slice(6));
const ids = args.filter(a => !a.startsWith('--'));
if (!ids.length) { console.error('用法：generate_legacy_builtin_signatures.ts <elfId...> [--ref=<commit>]...'); process.exit(2); }
if (!refs.length) refs.push('HEAD');

const {definitionSignatures} = await import(pathToFileURL(join(root, 'src/data/builtinEffectBindings.ts')).href);
const data = JSON.parse(readFileSync(target, 'utf8'));
const work = mkdtempSync(join(tmpdir(), 'legacy-sig-'));
try {
  for (const ref of refs) {
    const dir = join(work, ref.replace(/[^\w.-]/g, '_'));
    execFileSync('git', ['worktree', 'add', '--detach', dir, ref], {cwd: root, stdio: 'ignore'});
    try {
      symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
      const out = join(work, `${ref.replace(/[^\w.-]/g, '_')}.json`);
      execFileSync(process.execPath, ['--import', pathToFileURL(join(root, 'node_modules/tsx/dist/loader.mjs')).href, join(root, 'scripts/generate_legacy_builtin_signatures.ts')],
        {cwd: dir, stdio: 'inherit', env: {...process.env, LEGACY_SIG_CHILD: '1', LEGACY_SIG_IDS: ids.join(','), LEGACY_SIG_OUT: out}});
      if (!existsSync(out)) throw new Error(`${ref} 沒有輸出`);
      for (const elf of JSON.parse(readFileSync(out, 'utf8'))) {
        const entry = (data.elves[String(elf.id)] ??= {});
        for (const [key, signature] of Object.entries(definitionSignatures(elf))) {
          const list: string[] = (entry[key] ??= []);
          if (!list.includes(signature as string)) list.push(signature as string);
        }
        console.log(`${ref}: ${elf.id} ${elf.name}`);
      }
    } finally { execFileSync('git', ['worktree', 'remove', '--force', dir], {cwd: root, stdio: 'ignore'}); }
  }
} finally { rmSync(work, {recursive: true, force: true}); }
for (const id of ids) {
  const entry = data.elves[id];
  if (entry) data.elves[id] = Object.fromEntries(Object.keys(entry).sort().map(k => [k, [...new Set<string>(entry[k])].sort()]));
}
writeFileSync(target, JSON.stringify(data, null, 1) + '\n');
