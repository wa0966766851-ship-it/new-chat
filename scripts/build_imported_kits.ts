/**
 * 匯入精靈 → 預先煉成的連鎖 Kit（戰鬥中不即時解析描述）。
 *   node --import tsx scripts/build_imported_kits.ts src/data/imported/wiki_4937.json
 * 輸出同名 .kits.json：只收整份 complete 的定義；不完整的技能列在 blocked，匯入時不放進技能池（不做部分轉換）。
 */
import { createServer } from 'vite';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const file = process.argv[2];
if (!file) { console.error('用法：build_imported_kits.ts <匯入精靈 json>'); process.exit(2); }
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
let failed = false;
try {
  const { distillEffect } = await server.ssrLoadModule('/src/effects/distillEffect.ts');
  const elf = JSON.parse(readFileSync(file, 'utf8'));
  const sha = (s: string) => createHash('sha256').update(s || '').digest('hex');
  const out: any = { elfId: elf.id, soul: null, skills: {}, blocked: [] };
  const soul = distillEffect({ name: elf.soulMark.name || '魂印', description: elf.soulMark.description }, 'soul');
  if (!soul.complete) { failed = true; out.blocked.push({ name: '魂印', issues: soul.issues }); }
  else out.soul = { sourceSha256: sha(elf.soulMark.description), kit: soul.kit };
  const seen = new Set<string>();
  for (const s of [...elf.skills, ...elf.skillPool]) {
    if (seen.has(s.name)) continue; seen.add(s.name);
    const r = distillEffect(s, 'skill');
    if (r.complete) out.skills[s.name] = { sourceSha256: sha(s.description), kit: r.kit };
    else { out.blocked.push({ name: s.name, issues: r.issues.map((i: any) => ({ reason: i.reason, text: i.text })) }); if (elf.skills.some((c: any) => c.name === s.name)) failed = true; }
  }
  writeFileSync(file.replace(/\.json$/, '.kits.json'), JSON.stringify(out, null, 2) + '\n');
  // 打包：同資料夾所有匯入精靈＋Kit → gzip（首頁初始 JS 預算；格式同 descriptions.compressed.json）
  const dir = dirname(file), pack: any[] = [];
  for (const f of readdirSync(dir).filter(f => /^wiki_\d+\.json$/.test(f)).sort()) {
    const kitsFile = join(dir, f.replace(/\.json$/, '.kits.json'));
    // 打包時去掉只供追溯的欄位（原始檔仍保留）：來源資訊、與子句原文重複的 customText（載入時由 clause.raw 補回）
    const elf = JSON.parse(readFileSync(join(dir, f), 'utf8')), kits = JSON.parse(readFileSync(kitsFile, 'utf8'));
    const slim = (s: any) => { const { source, ...rest } = s; return rest; };
    const slimKit = (kit: any[]) => kit.map(e => e.params?.clause?.raw === e.customText ? (({ customText, ...r }) => r)(e) : e);
    delete elf.source; if (elf.soulMark) elf.soulMark = slim(elf.soulMark);
    elf.skills = elf.skills.map(slim); elf.skillPool = elf.skillPool.map(slim);
    if (kits.soul) kits.soul.kit = slimKit(kits.soul.kit);
    for (const k of Object.values<any>(kits.skills)) k.kit = slimKit(k.kit);
    delete kits.blocked;
    pack.push({ elf, kits });
  }
  writeFileSync(join(dir, 'imported.compressed.json'), JSON.stringify({ schemaVersion: 1, gzip: gzipSync(Buffer.from(JSON.stringify(pack)), { level: 9 }).toString('base64') }) + '\n');
  console.log(`魂印 ${out.soul ? '完成' : '未完成'}；技能 ${Object.keys(out.skills).length} 份完成、${out.blocked.length} 份擱置：${out.blocked.map((b: any) => b.name).join('、')}`);
} finally { await server.close(); }
process.exit(failed ? 1 : 0);
