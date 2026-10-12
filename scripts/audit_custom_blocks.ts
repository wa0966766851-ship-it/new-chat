/** 盤點 blocks/custom.ts 的專屬句子：原文、所屬精靈、分類提示。輸出 docs/audits/custom-blocks-inventory.md */
import { readFileSync, writeFileSync } from 'node:fs';
import { CUSTOM, CUSTOM_SOBIRAT_ROUND_END } from '../src/blocks/custom';

const source = JSON.parse(readFileSync('src/data/elfSourceText.json', 'utf8'));
const owners = new Map<string, Set<string>>();
const norm = (s: string) => s.replace(/[\s■🎯◇>＞「」『』【】]/g, '');
const texts: Array<[string, string]> = [];
(function walk(node: any, path: string[]) {
  if (typeof node === 'string') { texts.push([path.join('/'), norm(node)]); return; }
  if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, [...path, k]);
})(source, []);

const tags: Array<[string, RegExp]> = [
  ['系統資源(異能/星執/詩章/符文/咒怨/命運之輪)', /異能|星執|詩章|符文|咒怨|命運之輪/],
  ['印記/層數', /印記|層|標記/], ['下一隻/登場', /下一隻|出場|登場|入場/], ['場下', /場下|下場/],
  ['次數(下N次)', /下\d+次|下次/], ['回合期限', /\d+回合/], ['秒殺/擊敗', /秒殺|擊敗/],
  ['免疫/抵擋', /免疫|抵擋/], ['傷害上限/倍率', /無法超過|上限|翻倍|減半|提升\d+%|減少\d+%/],
  ['PP', /PP/], ['護盾/護罩', /護盾|護罩/], ['異常/能力', /異常|能力/],
];
const rows: string[] = [];
const entries = [...Object.entries(CUSTOM), ...Object.entries(CUSTOM_SOBIRAT_ROUND_END)];
for (const [key, def] of entries) {
  const k = norm(key);
  const where = new Set<string>();
  for (const [path, text] of texts) if (text.includes(k)) where.add(path.split('/').slice(0, 2).join('/'));
  const hit = tags.filter(([, re]) => re.test(key)).map(([name]) => name);
  rows.push(`| ${key.replace(/\|/g, '\\|').slice(0, 70)} | ${[...where].slice(0, 3).join('、') || '(原文未比對到)'} | ${def.trig ?? ''} | ${hit.join('、') || '—'} | |`);
}
const md = `# 專屬句子（blocks/custom.ts）盤點

自動產生：\`node --import tsx scripts/audit_custom_blocks.ts\`。共 ${entries.length} 條。

「處置」欄由人工逐條填寫：(a) 可改成現有 op、(b) 需要新通用 op（併入翻新計畫 P3）、(c) 系統資源（併入 P3-6）。
「分類提示」只是關鍵字比對，不能當成處置結論。

| 原文（鍵） | 所屬（原文比對） | 觸發 | 分類提示 | 處置 |
|---|---|---|---|---|
${rows.join('\n')}
`;
writeFileSync('docs/audits/custom-blocks-inventory.md', md);
console.log(`custom blocks: ${entries.length}, unmatched owners: ${rows.filter(r => r.includes('原文未比對到')).length}`);
