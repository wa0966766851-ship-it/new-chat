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
  // 原搬移指紋保留；只允許確實轉成Kit的指定技能退出handler，不能掩蓋其他遺失。
  const migrations:Record<string,string[]>={'聖光氣':['300','5000'],'神聖復甦':['5000'],'神聖啟示歌':['5000'],'鎖魂曲':['5008'],'黯·萬魂歸寂':['5001'],'光榮之夢':['5000'],'劫盡歸塵':['5009'],
    // 5029 異境神霆·雷伊 四技（GPT 完成 Kit 遷移；handler 已除名，於此登記避免基準誤報）
    '同塵祭':['5029'],'天雷誅殺':['5029'],'異境神霆':['5029'],'空墟赫星':['5029'],
    // 未接通73項（Claude 雲端）：A/B/C 組已轉真 Kit 並移除 handler
    '不淨者之約':['5007'],'懼噬.虛實逆寫':['5025'],'星垂穹儀':['5027'],'王·肅正協議':['5016'],'蟲后之冠':['5018'],
    // legacyWrapped 拆解（DSH 20261017）：arena_16 剛莖棍壓、5023 械律·置換、5009 辟冥·鎮獄斷、5018 王·鏽腑喰心已轉真 Kit
    '剛莖棍壓':['arena_16'],'械律·置換':['5023'],'辟冥·鎮獄斷':['5009'],'王·鏽腑喰心':['5018'],'王·夜予寒吟':['5013']};
  const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {kitEntryIssue}=await server.ssrLoadModule('/src/effects/effectConnection.ts');
  for(const [name,ids] of Object.entries(migrations)) {
    assert.ok(baseline.skills.includes(name),`遷移必須對應原基準：${name}`);assert.ok(!actual.skills.includes(name));
    for(const id of ids) {
      const elf=DEFAULT_ELVES.find((e:any)=>String(e.id)===id);
      const skill=[...elf.skills,...(elf.skillPool||[])].find((s:any)=>s.name===name);
      assert.equal(skill?.effectMode,'kit',`${id}/${name}不能刪handler後沒有新入口`);
      assert.ok(skill.kit.length);for(const entry of skill.kit)assert.equal(kitEntryIssue(entry),null);
    }
  }
  // 過渡橋接：legacy_handler 包裝需要可解析的原 handler；原本走通用文字路徑、沒有專屬程式的技能，以「行為相同的轉呼叫通用路徑」登記一個橋接 handler。
  // 只允許指定名單新增，且拆成通用積木後必須連同包裝一起移除；任何其他新增入口一律視為錯誤。
  const bridges:Record<string,string>={}; // 王·夜予寒吟已轉真 Kit（DSH 20261017），橋接清空。
  for(const [name,id] of Object.entries(bridges)) {
    assert.ok(!baseline.skills.includes(name),`橋接不得覆蓋原基準入口：${name}`);
    const elf=DEFAULT_ELVES.find((e:any)=>String(e.id)===id);
    assert.ok([...elf.skills,...(elf.skillPool||[])].some((s:any)=>s.name===name),`${id}/${name}橋接必須對應真實技能`);
  }
  assert.deepEqual(actual,{...baseline,skills:[...baseline.skills.filter((name:string)=>!migrations[name]),...Object.keys(bridges)].sort()},'除指定Kit遷移與指定橋接外，原註冊表所有入口必須保持');
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
