import { readFileSync, writeFileSync } from 'node:fs';

// 對原文只修標記與已確認的錯字，不重新編寫效果內容。
const path = 'src/data/elfSourceText.json';
const data = JSON.parse(readFileSync(path, 'utf8'));
for (const entry of Object.values(data) as any[]) for (const skill of Object.values(entry.skills || {}) as any[]) {
  skill.d = skill.d.split('\n').map((line: string) => {
    if (/^🎯\s*(?:將)?(?:對手能力提升|自身能力下降).*視為.*能力(?:下降|提升)/.test(line) || /^🎯\s*對手為自身天敵時額外先制/.test(line) || /^🎯\s*技能威力額外提升/.test(line)) return line.replace(/^🎯/, '■');
    // 成功／失敗延伸仍屬於上一條效果，不是另一條獨立附加效果。
    if (/^🎯\s*(?:消除成功|消除失敗|未觸發|若未觸發)/.test(line)) return line.replace(/^🎯/, '  >');
    return line.replace('自身非所有非附屬類異常狀態', '自身所有非附屬類異常狀態');
  }).join('\n');
}
writeFileSync(path, JSON.stringify(data, null, 2) + '\n');

// 這招實際走積木；刪除完全不會執行且充滿替代實裝的舊 handler，避免再次誤判。
const registry = 'src/effects/brinkkRegistry.ts';
const old = readFileSync(registry, 'utf8');
const start = old.indexOf('  "深潛者盛宴": (ctx) => {');
if (start >= 0) writeFileSync(registry, old.slice(0, start).replace(/,\s*$/, '\n') + '};\n');
