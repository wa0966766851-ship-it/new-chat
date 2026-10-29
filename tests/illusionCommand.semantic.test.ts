// 稱號「超能兄弟」與特殊道具「幻化指令」：稱號數值、開局／登場放入道具、使用效果、覆寫下次幻化目標（只一次）、不可選消逝者；P1/P2。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent', cacheDir: 'node_modules/.vite-illusion-cmd' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
const kit: any = await server.ssrLoadModule('/src/data/migratedAstralAesfigSoulKit.ts');
const { TITLE_CATALOG } = await server.ssrLoadModule('/src/data/titles.ts');
const { applyEquipmentToElfStats } = await server.ssrLoadModule('/src/data/suitsAndEyewears.ts');
const { BATTLE_ITEMS, getItemCategory } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
const { bindBag, listBagElves } = await server.ssrLoadModule('/src/battle/bagTargets.ts');
const { hasBattleItem, createBattleItemInventory, grantBattleItem } = await server.ssrLoadModule('/src/battle/itemInventory.ts');
const { legalActions } = await server.ssrLoadModule('/src/battle/ai/legalActions.ts');

const TITLE = 'chaoneng_xiongdi', CMD = 'illusion_command';
const G = '星軌重構·艾斯菲格', F = '星核寰宇·艾斯菲亞';
let count = 0;
const check = async (nm: string, run: () => void | Promise<void>) => { await run(); count++; console.log('✓ ' + nm); };
const guard = (id: string, speed = 50, hp = 1e9): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed }, calculatedStats: { hp, atk: 200, def: 20000, spatk: 200, spdef: 20000, speed }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' },
    { name: '待機', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });
const brother = (id: '5032' | '5033'): any => {
  const e = structuredClone((DEFAULT_ELVES as any[]).find((x: any) => String(x.id) === id));
  if (id === '5033') { e.soulMark.effectMode = 'kit'; e.soulMark.kit = structuredClone(kit.MIGRATED_ASTRAL_AESFIG_SOUL_KIT.kit); }
  return e;
};
const other = (s: string) => s === 'p1' ? 'p2' : 'p1';

function make(side: 'p1' | 'p2', own: any[], foe: any[], starter: string, title: string | null = TITLE) {
  const e: any = createBattleEngine({ initialP1Team: side === 'p1' ? own : foe, initialP2Team: side === 'p2' ? own : foe,
    p1StarterId: side === 'p1' ? starter : foe[0].battleId, p2StarterId: side === 'p2' ? starter : foe[0].battleId,
    p1Title: side === 'p1' ? title ?? undefined : undefined, p2Title: side === 'p2' ? title ?? undefined : undefined,
    battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  return e;
}
/** 己方執行一個行動、對手待機，結算一回合。 */
async function turn(e: any, side: 'p1' | 'p2', act: { switchTo?: string; item?: any; skill?: number }) {
  await e.idle();
  const foe = other(side), waitFoe = () => {
    // 艾斯菲亞會抽走對手 PP：待機用完時改選其他可選技能，避免測試卡在選擇階段。
    const before = e.getState().phase;
    for (const slot of [1, 0]) { e.onSkillSelect(foe, e.getState()[foe].skills[slot]); if (e.getState().phase !== before) return; }
  };
  const run = () => {
    if (act.switchTo !== undefined) e.onSwitchElf(side, e.getState()[`${side}Team`].findIndex((x: any) => x.battleId === act.switchTo || x.name === act.switchTo));
    else if (act.item) e.onUseItem(side, act.item);
    else e.onSkillSelect(side, e.getState()[side].skills[act.skill ?? 1]);
  };
  if (side === 'p1') { run(); waitFoe(); } else { waitFoe(); run(); }
  await e.idle();
}
const inv = (e: any, side: string, id = CMD) => e.getState()[`${side}ItemInventory`]?.[id]?.left ?? 0;
const cmdItem = (picked?: any) => ({ ...BATTLE_ITEMS.find((i: any) => i.id === CMD), picked });

await check('稱號：超能兄弟在目錄內，體力+110、雙攻+30、速度+30', () => {
  const t = TITLE_CATALOG[TITLE]; assert.equal(t.name, '超能兄弟');
  assert.deepEqual(t.statBonus, { hp: 110, atk: 30, spatk: 30, speed: 30 });
  const stats = { hp: 300, atk: 200, def: 150, spatk: 200, spdef: 150, speed: 180 };
  assert.deepEqual(applyEquipmentToElfStats(stats, undefined, undefined, undefined, TITLE), { hp: 410, atk: 230, def: 150, spatk: 230, spdef: 150, speed: 210 });
  assert.ok(Object.values(TITLE_CATALOG).filter((x: any) => x.category === t.category).length > 1, '與既有稱號同類，首頁／回廊的稱號清單自動列出');
});
await check('道具：幻化指令為特殊道具、只能放入、未持有不可用、AI 列出背包目標', () => {
  const item = BATTLE_ITEMS.find((i: any) => i.id === CMD);
  assert.equal(item.name, '幻化指令'); assert.equal(getItemCategory(item), 'special');
  assert.equal(item.value, 200); assert.equal(item.ppValue, 1); assert.equal(item.pickTarget, 'bag_elf'); assert.equal(item.grantOnly, true);
  assert.equal(createBattleItemInventory()[CMD].left, 0);
  assert.equal(hasBattleItem(createBattleItemInventory(), CMD), false);
  assert.equal(hasBattleItem(undefined, CMD), false, '無庫存表（星蝕回廊）也不能憑空使用');
  const g = grantBattleItem(createBattleItemInventory(), CMD, 1)!; assert.equal(g[CMD].left, 1); assert.equal(hasBattleItem(g, CMD), true);
  assert.equal(grantBattleItem(createBattleItemInventory(), CMD, 500)![CMD].left, 99, '持有上限');
  const st: any = { p1: guard('a'), p2: guard('b'), p1Team: [guard('a')], p2Team: [guard('b')], p1Timers: [], p2Timers: [], p1ItemInventory: g, p2ItemInventory: g };
  const choices=legalActions(st, 'p1').filter((a: any) => a.kind === 'item' && a.id === CMD);
  assert.deepEqual(choices,[{kind:'item',id:CMD,picked:{side:'p2',battleId:'b'}}]);
});

for (const side of ['p1', 'p2'] as const) {
  const foeSide = other(side);
  await check(`${side} 戰鬥開始放入 1 個（非兄弟首發）；對手沒有；沒稱號沒有`, async () => {
    const e = make(side, [guard('A0'), brother('5033')], [guard('FOE', 40)], 'A0');
    await e.idle(); assert.equal(inv(e, side), 1); assert.equal(inv(e, foeSide), 0); e.unmount();
    const none = make(side, [guard('A0')], [guard('FOE', 40)], 'A0', null); await none.idle(); assert.equal(inv(none, side), 0); none.unmount();
  });
  await check(`${side} 兄弟首發：開始 1 + 登場 1 = 2；艾斯菲亞同理`, async () => {
    for (const id of ['5033', '5032'] as const) {
      const e = make(side, [brother(id), guard('A1')], [guard('FOE', 40)], id === '5033' ? G : F); await e.idle();
      assert.equal(inv(e, side), 2, id); e.unmount();
    }
  });
  await check(`${side} 兄弟每次登場都放入（換下再換上），非兄弟換上不放入`, async () => {
    const e = make(side, [guard('A0'), brother('5033'), brother('5032')], [guard('FOE', 40)], 'A0'); await e.idle();
    assert.equal(inv(e, side), 1);
    await turn(e, side, { switchTo: G }); assert.equal(inv(e, side), 2);
    await turn(e, side, { switchTo: F }); assert.equal(inv(e, side), 3);
    await turn(e, side, { switchTo: 'A0' }); assert.equal(inv(e, side), 3, '普通精靈登場不放入');
    await turn(e, side, { switchTo: G }); assert.equal(inv(e, side), 4, '再次登場再放入');
    e.unmount();
  });
  await check(`${side} 使用：恢復在場精靈 200 體力與所有技能 PP+1（不超過上限），消耗 1 個`, async () => {
    const a0 = guard('A0', 50, 5000); a0.currentHp = 1000; a0.skills[0].pp = 5; a0.skills[0].maxPp = 10; a0.skills[1].pp = 10; a0.skills[1].maxPp = 10;
    const foe = [guard('FOE', 40), guard('FB1'), guard('FB2')];
    const e = make(side, bindBag([a0, guard('S0'), guard('S1')], 1).slice(0, 1), bindBag(foe, 1).slice(0, 1), 'A0'); await e.idle();
    assert.equal(inv(e, side), 1);
    await turn(e, side, { item: cmdItem({ side: foeSide, battleId: 'FB1' }) });
    const s = e.getState()[side];
    assert.equal(s.currentHp, 1200); assert.equal(s.skills[0].pp, 6); assert.equal(s.skills[1].pp, 10, 'PP 已滿不超過上限');
    assert.equal(inv(e, side), 0);
    e.unmount();
  });
  await check(`${side} 覆寫下次幻化對象（含對手背包），只生效一次；之後回到原指定對象`, async () => {
    const own = bindBag([guard('A0'), brother('5033'), guard('A2'), guard('S0'), guard('S1'), guard('S2')], 3).slice(0, 3);
    const foe = bindBag([guard('FOE', 40), guard('F1'), guard('F2'), guard('FB0'), guard('FB1'), guard('FB2')], 3).slice(0, 3);
    const e = make(side, own, foe, 'A0'); await e.idle();
    await turn(e, side, { item: cmdItem({ side: foeSide, battleId: 'FB2' }) });          // 對手待命區的精靈
    await turn(e, side, { switchTo: G });
    assert.equal(e.getState()[side].illusion?.target?.name, 'FB2', '改為指定對手背包內的精靈（取消原本的 S1）');
    assert.equal(e.getState()[side].illusion?.target?.battleId, 'FB2');
    await turn(e, side, { switchTo: 'A0' }); assert.equal(e.getState()[side].illusion, undefined, '下場解除幻化');
    await turn(e, side, { switchTo: G });
    assert.equal(e.getState()[side].illusion?.target?.name, 'S1', '第二次回到原本的背包對應位數：覆寫只用一次');
    e.unmount();
  });
  await check(`${side} 可選己方出戰與待命、對手出戰；覆寫保留到下次幻化才消耗（中途不被清除）`, async () => {
    const own = bindBag([guard('A0'), brother('5033'), guard('A2'), guard('S0'), guard('S1'), guard('S2')], 3).slice(0, 3);
    const foe = bindBag([guard('FOE', 40), guard('F1'), guard('F2'), guard('FB0')], 3).slice(0, 3);
    const e = make(side, own, foe, 'A0'); await e.idle();
    const ids = listBagElves({ p1: e.getState().p1Team, p2: e.getState().p2Team }).map((x: any) => `${x.side}:${x.elf.battleId}:${x.zone}`);
    for (const want of [`${side}:A2:active`, `${side}:S0:standby`, `${foeSide}:FOE:active`, `${foeSide}:FB0:standby`]) assert.ok(ids.includes(want), want);
    await turn(e, side, { item: cmdItem({ side: foeSide, battleId: 'FOE' }) });
    await turn(e, side, { skill: 1 }); await turn(e, side, { skill: 1 });
    await turn(e, side, { switchTo: G }); assert.equal(e.getState()[side].illusion?.target?.battleId, 'FOE');
    e.unmount();
  });
  await check(`${side} 消逝者不可選：被拒絕且不扣庫存，改選合法對象才被接受`, async () => {
    const own = bindBag([guard('A0'), guard('A1'), guard('S0')], 2).slice(0, 2);
    const foe = [guard('FOE', 40), { ...guard('GONE'), isVanished: true }, guard('OK')];
    const e = make(side, own, foe, 'A0'); await e.idle();
    const ids = listBagElves({ p1: e.getState().p1Team, p2: e.getState().p2Team }).map((x: any) => x.elf.battleId);
    assert.ok(!ids.includes('GONE'), '挑選清單不含消逝者'); assert.ok(ids.includes('OK'));
    if (side === 'p2') e.onSkillSelect('p1', e.getState().p1.skills[1]);       // 先讓 P1 選完，輪到 P2 選擇行動
    const selecting = e.getState().phase; assert.equal(selecting, `${side}_select`);
    e.onUseItem(side, cmdItem({ side: foeSide, battleId: 'GONE' }));
    assert.equal(e.getState().phase, selecting, '消逝者被拒絕'); assert.equal(inv(e, side), 1);
    e.onUseItem(side, cmdItem());
    assert.equal(e.getState().phase, selecting, '沒選對象也不能使用');
    e.onUseItem(side, cmdItem({ side: foeSide, battleId: 'NOT_IN_BAG' }));
    assert.equal(e.getState().phase, selecting, '不在背包內的對象被拒絕');
    e.onUseItem(side, cmdItem({ side: foeSide, battleId: 'OK' }));
    assert.notEqual(e.getState().phase, selecting, '合法對象被接受'); e.unmount();
  });
  await check(`${side} 覆寫對象在幻化前已消逝：改用原本指定對象並清除覆寫；覆寫可補上缺失的原目標`, async () => {
    const own = bindBag([guard('A0'), brother('5033'), guard('A2')], 3).slice(0, 3);   // 無待命：原目標缺失
    const e = make(side, own, [guard('FOE', 40), guard('FB1')], 'A0'); await e.idle();
    await turn(e, side, { item: cmdItem({ side: foeSide, battleId: 'FB1' }) });
    await turn(e, side, { switchTo: G });
    assert.equal(e.getState()[side].illusion?.target?.battleId, 'FB1', '原本沒有可幻化的對象，覆寫補上');
    e.unmount();
    const own2 = bindBag([guard('A0'), brother('5033'), guard('A2'), guard('S0'), guard('S1'), guard('S2')], 3).slice(0, 3);
    const e2 = make(side, own2, [guard('FOE', 40), guard('FB1')], 'A0'); await e2.idle();
    await turn(e2, side, { item: cmdItem({ side: foeSide, battleId: 'FB1' }) });
    e2.dispatch({ type: 'UPDATE_TEAM', side: foeSide, team: e2.getState()[`${foeSide}Team`].map((x: any) => x.battleId === 'FB1' ? { ...x, isVanished: true } : x) });
    await turn(e2, side, { switchTo: G });
    assert.equal(e2.getState()[side].illusion?.target?.name, 'S1', '覆寫對象已消逝：回到原本指定對象');
    assert.ok(e2.getState().logs.some((l: any) => /已無法選取/.test(l.text)));
    await turn(e2, side, { switchTo: 'A0' }); await turn(e2, side, { switchTo: G });
    assert.equal(e2.getState()[side].illusion?.target?.name, 'S1', '覆寫已被消耗');
    e2.unmount();
  });
}

await check('消逝後才結算：useBattleItem 先驗證，不扣庫存也不回復', async () => {
  const e = make('p1', [guard('A0', 50, 5000), guard('S0')], [guard('FOE', 40), guard('LATE')], 'A0'); await e.idle();
  e.getState().p1.currentHp; const hp0 = e.getState().p1.currentHp;
  e.onUseItem('p1', cmdItem({ side: 'p2', battleId: 'LATE' }));
  e.dispatch({ type: 'UPDATE_TEAM', side: 'p2', team: e.getState().p2Team.map((x: any) => x.battleId === 'LATE' ? { ...x, isVanished: true } : x) });
  e.onSkillSelect('p2', e.getState().p2.skills[1]); await e.idle();
  assert.equal(inv(e, 'p1'), 1, '庫存未扣'); assert.equal(e.getState().p1.currentHp, hp0);
  assert.ok(e.getState().logs.some((l: any) => /未產生回復/.test(l.text)));
  e.unmount();
});

await check('星蝕回廊（無正式庫存表）：稱號放入道具後建立不限量庫存，一般藥劑仍可用、幻化指令只在持有時可用', async () => {
  const e: any = createBattleEngine({ initialP1Team: [guard('A0', 50, 5000), brother('5033')], initialP2Team: [guard('FOE', 40)], p1StarterId: 'A0', p2StarterId: 'FOE', p1Title: TITLE,
    battleMode: 'PVE', preparedTeams: true, specialMode: 'interstellar', isFast: () => true, onNode: () => {},
    interstellarOptions: { runId: 'r', battleId: 'b', battleSeed: 1, potionUsage: 0, maxPotionUsage: 3, relics: [], enemyRelics: [], onPotionUse: () => true, onBattleEnd: () => {} } });
  e.mount(); e.start(); await e.idle();
  const inventory = e.getState().p1ItemInventory; assert.ok(inventory, '放入道具時建立庫存表');
  assert.equal(inventory[CMD].left, 1); assert.equal(inventory.hp_50.left, Infinity, '一般藥劑不限量，沿用原本的藥劑次數規則');
  assert.equal(hasBattleItem(inventory, 'hp_50'), true);
  e.unmount();
});

await server.close();
console.log(count + ' checks');
