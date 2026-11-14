// Aegis 目錄（2026-11-07）：側欄列出幾乎所有頁面與子分頁，每一項都真的能到達。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AEGIS_DIRECTORY, directoryEntries, SHELL_FEATURES } from '../src/shell/features';
import { CONTROL_SECTIONS } from '../src/utils/controlSettings';

const entries = directoryEntries();
const keys = entries.map(e => e.key);
assert.equal(new Set(keys).size, keys.length, '目錄鍵不重複');
// 一、所有登記的功能都在目錄裡（不再有「缺頁」）
for (const f of SHELL_FEATURES) assert.ok(entries.some(e => e.feature === f.id), `目錄缺少 ${f.label}（${f.id}）`);
// 二、每一項：有動作或有子項；子項一定有動作
for (const g of AEGIS_DIRECTORY) for (const e of g.entries) {
  assert.ok(e.action || e.children?.length, `${e.label} 沒有動作也沒有子項`);
  for (const c of e.children || []) assert.ok(c.action, `${e.label} › ${c.label} 沒有動作`);
}
// 三、子分頁涵蓋：百科六頁、控制中心全部分區、四種對戰模式、三種新增精靈方式
const enc = readFileSync(new URL('../src/components/Encyclopedia.tsx', import.meta.url), 'utf8');
const encTabs = [...enc.matchAll(/\['(\w+)', '[^']+'\]/g)].map(m => m[1]);
assert.ok(encTabs.length >= 6, '讀到百科分頁');
for (const t of encTabs) assert.ok(entries.some(e => e.action?.kind === 'encyclopedia' && e.action.tab === t), `目錄缺百科分頁 ${t}`);
for (const s of CONTROL_SECTIONS) assert.ok(entries.some(e => e.action?.kind === 'settings' && e.action.section === s.id), `目錄缺控制中心「${s.title}」`);
for (const f of ['normal_6v6', 'solo_1v1', 'peak_6v6', 'peak_3v3']) assert.ok(entries.some(e => e.action?.kind === 'battle' && e.action.format === f), `目錄缺對戰模式 ${f}`);
for (const t of ['ai', 'manual', 'blockly']) assert.ok(entries.some(e => e.action?.kind === 'editor' && e.action.tab === t), `目錄缺新增精靈 ${t}`);
// 四、殼真的使用目錄（側欄與手機底部「目錄」），並處理所有動作種類
const shell = readFileSync(new URL('../src/shell/AegisShell.tsx', import.meta.url), 'utf8');
assert.ok(shell.includes('<DirectoryRail') && shell.includes('directory={'), 'Aegis 側欄與底部欄都接上目錄');
for (const kind of new Set(entries.map(e => e.action?.kind).filter(Boolean))) assert.ok(shell.includes(`case '${kind}'`), `AegisShell 未處理目錄動作 ${kind}`);
assert.ok(shell.includes('initialTab={encyclopediaTab}'), '百科依目錄開到指定分頁');
console.log(`Aegis 目錄：${AEGIS_DIRECTORY.length} 群組、${entries.length} 項，涵蓋所有功能與子分頁`);
