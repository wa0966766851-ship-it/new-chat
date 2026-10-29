import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
const dixin = (DEFAULT_ELVES as any[]).find((e: any) => e.id === '5017');
const jiuding = dixin.skills.find((s: any) => s.name === '九鼎震八荒');
for (const e of jiuding.kit) {
  if (e.node !== 'on_kill') continue;
  console.log('on_kill entry:', JSON.stringify(e, null, 1).slice(0, 1500));
}
await server.close();
