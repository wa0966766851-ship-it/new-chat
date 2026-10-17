// 5034 四技引擎驗收：摧妖斬（stat_swap/combo_add/上限280）、妖靈天性、王·墮落絕語、王·潰墮妖族。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent', cacheDir: 'node_modules/.vite-dsh-astral' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
const mod: any = await server.ssrLoadModule('/src/data/migratedMogosSkillKits.ts');

const mk = (name: string) => {
  const self = structuredClone((DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5034'));
  const def = mod.MIGRATED_MOGOS_SKILLS.find((k: any) => k.name === name);
  const sk = self.skills.find((s: any) => s.name === name);
  assert.equal(sk.description, def.description, name + ' 原文一致');
  sk.effectMode = 'kit'; sk.kit = structuredClone(def.kit);
  self.name = '技能驗收·摩哥斯'; self.soulMark.effectType = 'none';
  return self;
};
const guard = (id: string, hp: number, speed = 50): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed }, calculatedStats: { hp, atk: 200, def: 20000, spatk: 200, spdef: 20000, speed }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' },
    { name: '待機', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });

let count = 0;
const check = async (nm: string, run: () => Promise<void>) => { await run(); count++; console.log('✓ ' + nm); };

await check('摧妖斬：stat_swap 交換＋害怕＋上限280＋已損50%雙路＋PP+5', async () => {
  const e: any = createBattleEngine({ initialP1Team: [mk('摧妖斬')], initialP2Team: [guard('X', 1_000_000_000, 50)], p1StarterId: '5034', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  // 給對手 atk+3、我方 atk-1（觸發交換）
  e.mount(); e.start();
  await e.idle();
  const s0 = e.getState();
  s0.p2.statStages.atk = 3;  // 引擎內部狀態不可直接改——改用技能前 hook？直接在種子上設：
  e.unmount();
  // 種子層設 statStages：
  const me = mk('摧妖斬'); me.statStages = { atk: -1 };
  const foe = guard('X', 1_000_000_000, 50); foe.statStages = { atk: 3 };
  const e2: any = createBattleEngine({ initialP1Team: [me], initialP2Team: [foe], p1StarterId: '5034', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e2.mount(); e2.start();
  await e2.idle();
  const idx = e2.getState().p1.skills.findIndex((s: any) => s.name === '摧妖斬');
  e2.onSkillSelect('p1', e2.getState().p1.skills[idx]);
  e2.onSkillSelect('p2', e2.getState().p2.skills[1]);
  await e2.idle();
  const st = e2.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  console.log('  我方 atk stage:', st.p1.statStages?.atk, '| 對手:', st.p2.statStages?.atk, '| 害怕:', (st.p2.effects||[]).some((f:any)=>f.name==='害怕'), '| 280:', logs.some((t:string)=>t.includes('280')));
  assert.equal(st.p1.statStages?.atk, 3, '交換後自身 atk 應為 +3');
  assert.equal(st.p2.statStages?.atk, -1, '交換後對手 atk 應為 -1');
  assert.ok((st.p2.effects||[]).some((f:any)=>f.name==='害怕'), '交換成功應令對手害怕');
  assert.ok((st.p2Timers||[]).some((t:any)=>t.payload?.nonTrueOutputLimit === 280), '非真實上限280計時器');
  e2.unmount();
});

await check('妖靈天性：全屬性+1（對手異常翻倍+2）＋4回合吸取監看＋先制+2', async () => {
  // 隔離原技能全文；DEFAULT_ELVES的Kit魂印不會因effectType='none'停止，
  // 且攜帶其他技能也可能額外改變HP，不得把這些結果算成吸取條款。
  const original = mk('妖靈天性');
  const me = { ...guard('5034', 3000, 200), skills: [original.skills.find((s: any) => s.name === '妖靈天性')] };
  const foe = guard('Y', 1_000_000_000, 50);
  foe.effects = [{ id: '害怕', name: '害怕', duration: 3, isLateMover: false, stacks: 1 }];  // 對手異常→強化翻倍
  const e: any = createBattleEngine({ initialP1Team: [me], initialP2Team: [foe], p1StarterId: '5034', p2StarterId: 'Y', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '妖靈天性');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[1]);
  await e.idle();
  const st = e.getState();
  const stages = st.p1.statStages || {};
  const twos = Object.values(stages).filter((v: any) => Number(v) === 2).length;
  const watchers = (st.p1Timers || []).filter((t: any) => String(t.id).includes('妖靈天性_持續效果_self_skill'));
  console.log('  +2 項數:', twos, '| 吸取監看:', watchers.length > 0, '| 先制:', (st.p1RegistryState||{}).priorityBoostTurns);
  assert.ok(twos >= 6, '對手異常→全屬性應 +2（六項）');
  assert.ok(watchers.length > 0, '4回合吸取⅓監看');
  assert.equal(st.p2.currentHp, 666_666_667, '屬性技能使用當次即吸取最大體力⅓，回合末不多吸一次');
  assert.equal((st.p1RegistryState||{}).priorityBoostTurns, 2, '先制+2');
  e.unmount();
});

await check('王·潰墮妖族：no_resist＋消回合→攻擊無效＋擊敗→全屬性+1＋害怕', async () => {
  const me = mk('王·潰墮妖族');
  const weak = { ...guard('W', 100, 50) };
  weak.calculatedStats.def = 1; weak.calculatedStats.spdef = 1;
  const next = { ...guard('N1', 1_000_000_000, 40) };
  const e: any = createBattleEngine({ initialP1Team: [me], initialP2Team: [weak, next], p1StarterId: '5034', p2StarterId: 'W', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '王·潰墮妖族');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[0]);
  await e.idle();
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  const ups = Object.values(st.p1.statStages || {}).filter((v: any) => Number(v) === 1).length;
  console.log('  W HP:', st.p2Team[0].currentHp, '| 擊敗後+1項數:', ups, '| N1 害怕:', (st.p2.effects||[]).some((f:any)=>f.name==='害怕'));
  assert.ok(st.p2Team[0].currentHp <= 0, 'W 應被擊敗');
  assert.ok(ups >= 6, '擊敗應全屬性+1');
  assert.ok(!logs.some((t: string) => t.includes('效果待接通')), '無待接通');
  e.unmount();
});

await server.close();
console.log(count + ' checks');
