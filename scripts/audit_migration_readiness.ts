/** 發布前結構複核：接線、包裝與可疑佔位分列；絕不由合約通過推算戰鬥正確率。 */
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
try {
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { effectDefinitionEntries } = await server.ssrLoadModule('/src/battle/effectSources.ts');
  const { describeExecution } = await server.ssrLoadModule('/src/blocks/audit.ts');
  const { kitEntryIssue } = await server.ssrLoadModule('/src/effects/effectConnection.ts');
  const rows: any[] = [];
  for (const elf of DEFAULT_ELVES) {
    const definitions = [
      ...effectDefinitionEntries(elf).map((d: any) => ({ d: d.soul ? { ...d, kit: d.kit ?? elf.kit } : d, args: d.soul ? { elf } : { trait: d } })),
      ...[...(elf.skills || []), ...(elf.skillPool || [])].filter((s: any, i: number, all: any[]) => all.findIndex(t => t.name === s.name && t.description === s.description) === i)
        .map((d: any) => ({ d, args: { elf, skill: d } })),
    ];
    for (const { d, args } of definitions) {
      const route = describeExecution(args);
      const flags: any[] = [];
      for (const entry of d.kit || []) {
        const issue = kitEntryIssue(entry);
        if (issue) flags.push({ category: 'contract', reason: issue, text: entry.customText, path: `kit[${entry.order}]` });
        const visit = (v: any, path: string) => {
          if (!v || typeof v !== 'object') return;
          if (v.op === 'noop' && !/^\s*(?:[■🎯◇]\s*)?[（(]?無特殊(?:效果|魂印)[）)]?\s*$/.test(entry.customText || '')) {
            flags.push({ category: 'placeholder', reason: '有具體效果文字但動作為noop，須核對是否缺實作', text: entry.customText, path });
          }
          if (v.op === 'dmg' && v.p?.flat === 0 && !v.p?.ratio) {
            flags.push({ category: 'placeholder', reason: '零固定數值傷害，須核對是否為佔位', text: entry.customText, path });
          }
          if (v.op === 'turn_key_set') {
            flags.push({ category: 'reader-review', reason: '持續狀態寫入須另查事件讀取端；本標記不是判定缺失', key: v.p?.key, text: entry.customText, path });
          }
          Object.entries(v).forEach(([key, child]) => {
            if (Array.isArray(child)) child.forEach((item, i) => visit(item, `${path}.${key}[${i}]`));
            else if (child && typeof child === 'object') visit(child, `${path}.${key}`);
          });
        };
        visit(entry.params, `kit[${entry.order}]`);
      }
      rows.push({ elfId: elf.id, elf: elf.name, name: d.name, route: route.route, legacyWrapped: route.legacyWrapped === true, flags });
    }
  }
  const summary = {
    definitions: rows.length, wiredIncludingWrappers: rows.filter(r => r.route === 'kit').length,
    legacyWrapped: rows.filter(r => r.legacyWrapped).length,
    nonWrappedKitRoutes: rows.filter(r => r.route === 'kit' && !r.legacyWrapped).length,
    unconnected: rows.filter(r => r.route !== 'kit').length,
    definitionsNeedingPlaceholderReview: rows.filter(r => r.flags.some((f: any) => f.category === 'placeholder')).length,
    definitionsWithContractIssues: rows.filter(r => r.flags.some((f: any) => f.category === 'contract')).length,
    semanticAccuracy: null,
  };
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(),
    note: 'nonWrappedKitRoutes只是路由分類，不是完整遷移或正確率；flags必須人工查證，不能當錯誤份數。semanticAccuracy=null代表尚無全來源代表性驗收數據。', summary,
    remaining: rows.filter(r => r.legacyWrapped || r.route !== 'kit'), reviewRequired: rows.filter(r => r.flags.length) };
  if (process.argv.includes('--write')) writeFileSync('docs/audits/migration-readiness-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await server.close(); }
