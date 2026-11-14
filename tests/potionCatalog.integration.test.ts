// 擴充藥劑實戰（2026-11-07）：藥劑反噬傷害、扣 PP、干擾計時器、附加異常、附屬強化、持續恢復（在場／不在場／額外），
// 以及藥劑反噬下的反轉；全部經引擎 onUseItem 結算。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
let checks = 0; const ok = (label: string) => { checks++; console.log('✓ ' + label); };
try {
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { BATTLE_ITEMS, getItemCategory, ITEM_CATEGORIES } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const { switchRestrictions, itemRestrictions, potionBacklash } = await server.ssrLoadModule('/src/battle/actionRestrictions.ts');
  const { getStatuses } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const potion = (id: string) => { const p = BATTLE_ITEMS.find((i: any) => i.id === id); assert.ok(p, id); return p; };
  const wait = { name: '等', category: '屬性', type: '普通', power: 0, pp: 10, maxPp: 20, isSureHit: true, description: '' };
  const mk = (id: string, speed: number, extra: any = {}): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: 5000, maxHp: 10000,
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, calculatedStats: { hp: 10000, atk: 100, def: 100, spatk: 100, spdef: 100, speed },
    statStages: {}, skills: [{ ...wait }], ...extra });
  const start = async (p1Extra: any = {}, p1Team: any[] = []) => {
    const engine = createBattleEngine({ initialP1Team: [mk('A', 200, p1Extra), ...p1Team], initialP2Team: [mk('X', 100)], p1StarterId: 'A', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, randomSeed: 3 });
    engine.mount(); engine.start(); await engine.idle(); return engine;
  };
  const turn = async (engine: any, item?: string) => {
    const st = engine.getState();
    if (item) engine.onUseItem('p1', potion(item)); else engine.onSkillSelect('p1', st.p1.skills[0]);
    engine.onSkillSelect('p2', engine.getState().p2.skills[0]);
    await engine.idle(); return engine.getState();
  };
  /** p1 出招（或用藥）、p2 用藥（或出招）。 */
  const engineTurnBoth = (engine: any, p1Item: string | null, p2Item: string | null) => {
    if (p1Item) engine.onUseItem('p1', potion(p1Item)); else engine.onSkillSelect('p1', engine.getState().p1.skills[0]);
    if (p2Item) engine.onUseItem('p2', potion(p2Item)); else engine.onSkillSelect('p2', engine.getState().p2.skills[0]);
  };
  const once = async (item: string, p1Extra: any = {}) => { const en = await start(p1Extra); const st = await turn(en, item); en.unmount(); return st; };

  // 目錄：唯一 ID（ASCII）、每種都有分類、新分類都有道具。
  const ids = BATTLE_ITEMS.map((i: any) => i.id);
  assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every((id: string) => /^[\x20-\x7e]+$/.test(id)));
  for (const cat of ['regen', 'offense', 'inflict', 'buff']) {
    assert.ok(ITEM_CATEGORIES.some((c: any) => c.key === cat), cat);
    assert.ok(BATTLE_ITEMS.some((i: any) => getItemCategory(i) === cat), `${cat} 有道具`);
  }
  ok('目錄：唯一 ID、新分類（持續恢復／攻擊干擾／附加異常／強化狀態）');

  // 一、藥劑反噬傷害（對手）：固定與百分比；無視護盾／抗性。反噬中改打自己。
  let st = await once('atk_dmg_300');
  assert.equal(st.p2.currentHp, 4700); assert.equal(st.p1.currentHp, 5000);
  st = await once('atk_pct_20');
  assert.equal(st.p2.currentHp, 3000);
  st = await once('atk_dmg_300', { potionBacklashTurns: 2 });
  assert.equal(st.p1.currentHp, 4700, '反噬中改為使用方受到藥劑反噬傷害'); assert.equal(st.p2.currentHp, 5000);
  ok('藥劑反噬傷害：固定／百分比、反噬時改為自己');

  // 二、扣 PP（對手）；反噬中改扣自己。
  st = await once('atk_pp_3');
  assert.equal(st.p2.skills[0].pp, 10 - 3 - 1, '對手扣 3 再自己出手 1');
  st = await once('atk_pp_3', { potionBacklashTurns: 2 });
  assert.equal(st.p1.skills[0].pp, 7); assert.equal(st.p2.skills[0].pp, 9);
  ok('扣除 PP：對手／反噬時改為自己');

  // 三、干擾計時器：藥劑反噬／禁止藥劑（全隊）、禁止切換（在場）。
  let en = await start({}, [mk('B', 150)]);
  st = await turn(en, 'atk_backlash_2');
  assert.ok(potionBacklash(st, 'p2'), '對手進入藥劑反噬');
  assert.equal(potionBacklash(st, 'p2').scope, 'team');
  en.unmount();
  st = await once('atk_itemlock_2');
  assert.ok(itemRestrictions(st, 'p2').blocked, '對手無法使用藥劑');
  st = await once('atk_switchlock_2');
  assert.ok(switchRestrictions(st, 'p2').blocked, '對手無法主動切換');
  st = await once('atk_itemlock_2', { potionBacklashTurns: 2 });
  assert.ok(itemRestrictions(st, 'p1').blocked && !itemRestrictions(st, 'p2').blocked, '反噬時禁止藥劑落在自己');
  ok('干擾：藥劑反噬／禁止藥劑（全隊）、禁止切換（在場）、反噬轉向');

  // 四、附加異常（對手）；反噬中改為自己進入。
  st = await once('inflict_poison');
  assert.ok((getStatuses(st.p2)['中毒'] || 0) > 0, '對手中毒');
  st = await once('inflict_poison', { potionBacklashTurns: 2 });
  assert.ok((getStatuses(st.p1)['中毒'] || 0) > 0 && !(getStatuses(st.p2)['中毒'] > 0), '反噬中自己中毒');
  ok('附加異常：對手／反噬時改為自己');
  // 2026-11-14：每款附加異常藥劑實戰都能讓對手進入所列異常（無抗性的測試單位）。
  const failedInflict: string[] = [];
  for (const item of BATTLE_ITEMS.filter((i: any) => i.inflictStatuses?.length && !i.oppDamage)) {
    const s = await once(item.id);
    for (const x of item.inflictStatuses) if (!((getStatuses(s.p2)[x.name] || 0) > 0)) failedInflict.push(`${item.name}:${x.name}`);
  }
  assert.deepEqual(failedInflict, [], '附加異常藥劑未生效');
  ok('附加異常：全部藥劑實戰生效');

  // 五、附屬強化（自身）；反噬中改為解除。
  st = await once('buff_rage');
  assert.ok((getStatuses(st.p1)['狂暴'] || 0) > 0, '自身狂暴');
  st = await once('buff_rage', { potionBacklashTurns: 2, battleStatuses: { '狂暴': 3 } });
  assert.ok(!((getStatuses(st.p1)['狂暴'] || 0) > 0), '反噬中解除自身狂暴');
  ok('附屬強化：附加／反噬時解除');

  // 六、持續恢復：在場 10%×3 回合（第 1、2、3 回合結束各一次，第 4 回合不再）。
  en = await start();
  st = await turn(en, 'regen_hp_a');
  assert.equal(st.p1.currentHp, 6000, '使用當回合結束第一次恢復');
  st = await turn(en); assert.equal(st.p1.currentHp, 7000);
  st = await turn(en); assert.equal(st.p1.currentHp, 8000);
  st = await turn(en); assert.equal(st.p1.currentHp, 8000, '三回合後結束');
  en.unmount();
  ok('持續恢復：在場 3 回合各一次');

  // 七、不在場（後援）與額外精靈：只回指定對象；在場不受影響。
  en = await start({}, [mk('B', 150), mk('E', 150, { isExtra: true })]);
  st = await turn(en, 'regen_hp_bx');
  const B = st.p1Team.find((e: any) => e.battleId === 'B'), E = st.p1Team.find((e: any) => e.battleId === 'E');
  assert.equal(st.p1.currentHp, 5000, '在場不受影響');
  assert.equal(B.currentHp, 6000, '後援恢復'); assert.equal(E.currentHp, 6000, '額外精靈恢復');
  en.unmount();
  en = await start({}, [mk('B', 150)]);
  st = await turn(en, 'regen_pp_ab');
  assert.equal(st.p1.skills[0].pp, 10 - 0 + 1, '在場：使用藥劑不出招，回合結束 +1');
  assert.equal(st.p1Team.find((e: any) => e.battleId === 'B').skills[0].pp, 11, '後援 PP +1');
  en.unmount();
  ok('持續恢復：後援＋額外、在場＋後援 PP');

  // 八、反噬中使用持續恢復 → 整段反轉為每回合藥劑反噬傷害。
  // 第 1 回合對手用「反轉藥劑・2」令我方藥劑反噬（計時器，第 2 回合結束到期）；第 2 回合我方用持續恢復 → 反轉。
  en = await start();
  engineTurnBoth(en, null, 'atk_backlash_2'); await en.idle();
  st = en.getState(); assert.ok(potionBacklash(st, 'p1'), '我方進入藥劑反噬');
  st = await turn(en, 'regen_hp_a');
  assert.equal(st.p1.currentHp, 4000, '第 2 回合結束受到反噬 10%');
  assert.ok(!potionBacklash(st, 'p1'), '藥劑反噬已到期');
  st = await turn(en); assert.equal(st.p1.currentHp, 3000, '反噬已結束，仍依使用當下整段反轉');
  st = await turn(en); assert.equal(st.p1.currentHp, 2000, '第三次');
  st = await turn(en); assert.equal(st.p1.currentHp, 2000, '三回合後結束');
  en.unmount();
  ok('持續恢復：反噬中使用整段反轉');

  // 九、藥劑附加的異常走正式附加流程：異常免疫擋下、反彈給使用方、已處於則重置；解除時觸發「異常結束」響應。
  const { getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const withReg = async (reg: any, item: string) => {
    const e = await start();
    e.dispatch({ type: 'UPDATE_REGISTRY_STATE', side: 'p2', state: reg }); await e.idle();
    const r = await turn(e, item); e.unmount(); return r;
  };
  st = await withReg({ immuneStatusTurns: 3 }, 'inflict_poison');
  assert.ok(!((getStatuses(st.p2)['中毒'] || 0) > 0), '對手免疫異常：藥劑附加被擋下');
  assert.ok(st.logs.some((l: any) => /異常免疫/.test(l.text)));
  st = await withReg({ reflectStatusTurns: 3 }, 'inflict_poison');
  assert.ok((getStatuses(st.p1)['中毒'] || 0) > 0 && !((getStatuses(st.p2)['中毒'] || 0) > 0), '對手反彈異常：改由使用方中毒');
  st = await withReg({ immuneStatusTurns: 3 }, 'inflict_paralysis');
  assert.ok(!((getStatuses(st.p2)['麻痺'] || 0) > 0), '控制類同樣被免疫');
  // 已處於：重置為指定回合（舊欄位較長也一併重置）
  en = await createBattleEngine({ initialP1Team: [mk('A', 200)], initialP2Team: [mk('X', 100, { battleStatuses: { '中毒': 9 } })], p1StarterId: 'A', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, randomSeed: 3 });
  en.mount(); en.start(); await en.idle();
  st = await turn(en, 'inflict_poison');
  assert.ok((getStatuses(st.p2)['中毒'] || 0) <= 3 && (getStatuses(st.p2)['中毒'] || 0) > 0, `已處於則重置為 3 回合（實際 ${getStatuses(st.p2)['中毒']}）`);
  en.unmount();
  // 解除響應：藥劑附加的異常被解除時，受方收到「異常結束」事件。
  const ended: string[] = [];
  getSoulMarkRegistry()['A'] = (_ctx: any, event: string, data: any) => { if (event === 'ON_STATUS_ENDED') ended.push(data?.status || data?.name || data?.id); return false; };
  en = await start();
  en.dispatch({ type: 'UPDATE_REGISTRY_STATE', side: 'p2', state: { reflectStatusTurns: 1 } }); await en.idle();
  st = await turn(en, 'inflict_poison');
  assert.ok((getStatuses(st.p1)['中毒'] || 0) > 0, '被反彈：自己中毒（藥劑附加的異常）');
  en.dispatch({ type: 'UPDATE_REGISTRY_STATE', side: 'p2', state: { reflectStatusTurns: 0 } }); await en.idle();
  st = await turn(en, 'special_170_clear');
  assert.ok(!((getStatuses(st.p1)['中毒'] || 0) > 0), '解除異常藥劑可解除藥劑附加的異常');
  assert.ok(ended.some(n => /中毒/.test(String(n))), `解除時觸發異常結束響應（收到：${ended.join('、')}）`);
  delete getSoulMarkRegistry()['A'];
  en.unmount();
  ok('藥劑異常：免疫／反彈／重置／解除響應');

  console.log(`擴充藥劑實戰 ${checks} 項通過`);
} finally { await server.close(); }
process.exit(0);
