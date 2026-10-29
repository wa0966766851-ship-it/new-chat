/** 匯入精靈的煉成缺口：node --import tsx scripts/audit_imported_elf.ts src/data/imported/wiki_<ID>.json */
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
try {
  const { distillEffect } = await server.ssrLoadModule('/src/effects/distillEffect.ts');
  const elf = JSON.parse(readFileSync(process.argv[2] || 'src/data/imported/wiki_4937.json', 'utf8'));
  const show = (name: string, def: any, kind: 'skill'|'soul') => {
    const r = distillEffect(def, kind);
    console.log(`\n### ${name} complete=${r.complete} kit=${r.kit.length}`);
    for (const i of r.issues) console.log('  ✗', i.reason?.slice(0,60), '|', (i.text||i.raw||'').slice(0,110));
  };
  show('魂印', { name: '魂印', description: elf.soulMark.description }, 'soul');
  const seen = new Set();
  for (const s of elf.skillPool) { if (seen.has(s.name)) continue; seen.add(s.name); if (s.description === '無特殊效果') continue; show(s.name, s, 'skill'); }
} finally { await server.close(); }
