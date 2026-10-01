import { writeFileSync, readdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { DEFAULT_ELVES } from '../src/data/defaultElves';
import { describeExecution, auditProgram } from '../src/blocks/audit';
import { getElfTraitEntries } from '../src/components/ElfTraitCards';
import { SOUL_MARK_MAPPING } from '../src/effects/battleEventRegistry';
// Node 不支援 Vite import.meta.glob；讀取同一套已存在模組與映射，不偽造 handler。
const skillNames = new Set<string>(), exportedHandlers = new Set<string>();
for (const file of readdirSync('src/effects').filter(f => f.endsWith('Registry.ts') && f !== 'battleEventRegistry.ts')) {
  const module = await import(pathToFileURL(resolve('src/effects', file)).href);
  for (const [key, value] of Object.entries(module)) {
    if (key.endsWith('_SKILLS') && value && typeof value === 'object') Object.keys(value).forEach(name => skillNames.add(name));
    if (typeof value === 'function') exportedHandlers.add(key);
  }
}
const handlers = { skill: (name: string) => skillNames.has(name), soul: (name: string) => exportedHandlers.has(SOUL_MARK_MAPPING[name]) };

/** 這是可追蹤的核對清單，不把存在 handler 當作子句語意已正確。 */
const rows = DEFAULT_ELVES.map(elf => {
  const skills = [...(elf.skills || []), ...(elf.skillPool || [])].filter((s, i, all) => all.findIndex(other => other.name === s.name && other.description === s.description) === i);
  const entries = [
    { kind: '魂印', name: elf.soulMark?.name || '無魂印', sourceText: elf.soulMark?.description || '', ...describeExecution({ elf }, handlers) },
    ...getElfTraitEntries(elf).filter(t => t.kind !== '專屬特性／魂印').map(trait => ({ kind: trait.kind, name: trait.name, sourceText: trait.description, ...describeExecution({ trait }, handlers) })),
    ...skills.map(skill => ({ kind: '技能', name: skill.name, sourceText: skill.description || '', ...describeExecution({ skill }, handlers) })),
  ];
  return { id: elf.id, name: elf.name, entries: entries.map(({ program, ...entry }) => ({ ...entry, clauses: auditProgram(program) })) };
});
const all = rows.flatMap(r => r.entries.flatMap(e => e.clauses)).filter(c => !c.explanation);
const markdown = ['# 全精靈效果實裝核對清單', '', '此清單由目前資料與解析器產生，涵蓋魂印、特質、攜帶及預備技能。**每句語意驗證均待確認**；handler 存在不等於實裝正確，未解析不等於專屬程式未實裝。詳情、原文、觸發、參數與傷害建議見 JSON。原始 TXT 有疑慮的效果不得強制改成 blocks 執行。', '', '| ID | 精靈 | 效果組 | 可稽核子句 | 已解析 | 未解析 |', '|---|---|---:|---:|---:|---:|',
  ...rows.map(r => { const c = r.entries.flatMap(e => e.clauses).filter(c => !c.explanation); return `| ${r.id} | ${r.name} | ${r.entries.length} | ${c.length} | ${c.filter(x => x.parsed).length} | ${c.filter(x => !x.parsed).length} |`; }), '', `精靈 ${rows.length}；子句 ${all.length}；語意確認狀態：全部保留待確認，本工具不推定測試覆蓋。`, '', '測試證據須逐句補上：輸入狀態 → 執行節點 → 預期結果 → 實際結果；尤其是傷害類型、作用域、下場保留、成功／失敗分支與額外行動。', ''].join('\n');
const json = JSON.stringify({ schemaVersion: 1, note: 'parsed ≠ implemented ≠ semantically verified', elves: rows }, null, 2) + '\n';
if (process.argv.includes('--check')) {
  assert.ok(readFileSync('docs/全精靈效果實裝核對.json', 'utf8') === json, '核對 JSON 需重新產生：npm run audit:implementation');
  assert.ok(readFileSync('docs/全精靈效果實裝核對.md', 'utf8') === markdown, '核對 MD 需重新產生：npm run audit:implementation');
}
if (process.argv.includes('--write')) {
  writeFileSync('docs/全精靈效果實裝核對.json', json);
  writeFileSync('docs/全精靈效果實裝核對.md', markdown);
}
console.log(markdown);
