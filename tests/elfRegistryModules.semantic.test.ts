import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'vite';

const root = new URL('../', import.meta.url);
const manifest: Record<string, string> = JSON.parse(readFileSync(new URL('src/effects/elves/modules.json', root), 'utf8'));
const baseline = JSON.parse(readFileSync(new URL('tests/fixtures/elfRegistryBeforeMove.json', root), 'utf8'));
assert.equal(Object.keys(manifest).length, 34);
assert.equal(new Set(Object.values(manifest)).size, 34, '一個生產模組只列一次');
for (const [old, canonical] of Object.entries(manifest)) {
  assert.ok(!existsSync(new URL('src/effects/' + old, root)), '不能留下新舊兩份實裝');
  assert.ok(existsSync(new URL('src/effects/elves/' + canonical, root)), canonical);
}
const server = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null },
  plugins: [{ name: 'headless-registry-contract', configResolved(config) { config.server.hmr = false; config.server.watch = null; } }] });
try {
  const registry = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { ELF_REGISTRY_MODULES } = await server.ssrLoadModule('/src/effects/elves/index.ts');
  assert.deepEqual(Object.keys(ELF_REGISTRY_MODULES).sort(), Object.keys(manifest).map(f => './' + f).sort());
  const actual = {
    skills: Object.keys(registry.getBattleSkillRegistry()).sort(),
    souls: Object.keys(registry.getSoulMarkRegistry()).sort(),
    afterHit: Object.keys(registry.getBattleSkillAfterHitRegistry()).sort(),
    invalid: Object.keys(registry.getBattleSkillOnInvalidRegistry()).sort(),
  };
  assert.deepEqual(actual, baseline, '搬移前後真正Vite入口的技能／魂印／命中後／無效分支不得遺失或新增');
  const expected: Record<string, any> = {};
  for (const [, mod] of Object.entries(ELF_REGISTRY_MODULES).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    for (const [name, value] of Object.entries(mod as object)) if (name.endsWith('_SKILLS')) Object.assign(expected, value);
  }
  const skills = registry.getBattleSkillRegistry();
  for (const [name, handler] of Object.entries(expected)) assert.equal(skills[name], handler, '同名歷史匯出維持原勝出者：' + name);
  for (const [elfName, handlerName] of Object.entries(registry.SOUL_MARK_MAPPING)) {
    let handler: unknown;
    for (const [, mod] of Object.entries(ELF_REGISTRY_MODULES).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
      if (typeof (mod as any)[handlerName as string] === 'function') handler = (mod as any)[handlerName as string];
    }
    if (handler) assert.equal(registry.getSoulMarkRegistry()[elfName], handler, elfName + '必須仍掛到同一handler');
  }
  console.log(`精靈模組搬移契約：34個模組、${actual.skills.length}技能鍵、${actual.souls.length}魂印別名完整；不代表逐句語意通過。`);
} finally { await server.close(); }
