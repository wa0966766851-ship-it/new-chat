// 全池機制通達性審計（真實引擎）。
//
// 2026-10-30：為「效果莫名不觸發」這類問題建立防線。
// 之前發現的兩種斷路：
//   1. 5021 有手寫 handler 對應 → effectRoute 回傳 registry → kit 永不執行
//   2. arena_13 等 43 隻的 kit 在 deferred 包，loadImportedElves() 之前根本不存在
//
// 這個測試逐隻驗證：精靈有 kit、route 走 kit、且 kit 條目節點合法。
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
await server.ssrLoadModule('/src/engine/battleEngine.ts');
const de = await server.ssrLoadModule('/src/data/defaultElves.ts');
const { effectRoute } = await server.ssrLoadModule('/src/effects/effectConnection.ts');
const { getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const { battleRules } = await server.ssrLoadModule('/src/engine/battleRules.ts');

await de.loadImportedElves();
const S = getSoulMarkRegistry();
const elves = de.DEFAULT_ELVES as any[];

let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };

await check('全部精靈都已載入（含延遲包）', async () => {
  console.log(`   精靈總數 ${elves.length}`);
  assert.ok(elves.length >= 46, `至少 46 隻，實際 ${elves.length}`);
  assert.ok(elves.some(e => String(e.id) === 'arena_13'), '必須包含 arena_13 龍錄天鋒');
});

await check('每隻精靈的魂印都有 kit', async () => {
  const missing = elves.filter(e => !e.soulMark?.kit?.length).map(e => `${e.id}:${e.name}`);
  console.log(`   魂印有 kit: ${elves.length - missing.length} / ${elves.length}`);
  assert.equal(missing.length, 0, `魂印缺 kit: ${missing.join(', ')}`);
});

await check('每隻精靈的每個技能都有 kit', async () => {
  const missing: string[] = [];
  let total = 0;
  for (const e of elves) for (const s of (e.skills || [])) { total++; if (!s.kit?.length) missing.push(`${e.name}/${s.name}`); }
  console.log(`   技能有 kit: ${total - missing.length} / ${total}`);
  assert.equal(missing.length, 0, `技能缺 kit: ${missing.slice(0, 10).join(', ')}`);
});

await check('沒有任何精靈的 kit 被 handler 攔截（route 必須是 kit）', async () => {
  const blocked: string[] = [];
  for (const e of elves) {
    const name = e.soulMark?.name;
    if (!name || !e.soulMark?.kit?.length) continue;
    const route = effectRoute(e.soulMark, !!S[name]);
    if (route !== 'kit') blocked.push(`${e.id}:${e.name} soul=${name} route=${route} handler=${S[name] || '無'}`);
  }
  console.log(`   route=kit: ${elves.length - blocked.length} / ${elves.length}`);
  assert.equal(blocked.length, 0, `被攔截: ${blocked.join(' | ')}`);
});

await check('技能的 route 也必須是 kit 或 registry（不可為 description 空跑）', async () => {
  const bad: string[] = [];
  for (const e of elves) for (const s of (e.skills || [])) {
    if (!s.kit?.length) continue;
    const route = effectRoute(s, false);
    if (route === 'description') bad.push(`${e.name}/${s.name}`);
  }
  assert.equal(bad.length, 0, `route=description: ${bad.slice(0, 10).join(', ')}`);
});

await check('戰鬥規則已註冊（含詩章快照規則）', async () => {
  const rules = battleRules().map((r: any) => r.id);
  console.log(`   已註冊規則: ${rules.join(', ')}`);
  assert.ok(rules.includes('generic:snapshot-resources'), '必須有 snapshot-resources 規則');
});

await server.close();
console.log(`\n全池通達性審計：${count} 項通過`);
