// 技能無效的演出順序與附加效果（2026-11-07）。
// 5021 神懺福音之章（自身能力下降→對手下次攻擊技能無效）：
// 一、對手被無效的那一招仍要播出招動畫，且「技能無效-0」跳字排在出招之後（過去跳字直接寫入時間軸，
//     搶在佇列裡的動畫之前，看起來像對手當回合無法行動、無效次數也還掛著）。
// 二、無效次數在這一招消耗；下一回合對手的攻擊照常結算。
// 三、被無效的技能其 🎯 附加效果（例：未擊敗對手則下次先制+2）不觸發。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
try {
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { prepareSavedBattleRoster } = await server.ssrLoadModule('/src/data/prepareSavedBattleRoster.ts');
  const dragon = DEFAULT_ELVES.find((e: any) => e.id === '5021');
  const foe = DEFAULT_ELVES.find((e: any) => e.id === '5009');
  const t1 = prepareSavedBattleRoster([structuredClone(dragon)], [structuredClone(dragon)], false, 'p1');
  const t2 = prepareSavedBattleRoster([structuredClone(foe)], [structuredClone(foe)], false, 'p2');
  const engine = createBattleEngine({ initialP1Team: t1, initialP2Team: t2, p1StarterId: t1[0].battleId, p2StarterId: t2[0].battleId, battleMode: 'PVP', preparedTeams: true, isFast: () => false, randomSeed: 7 });
  const order: string[] = [];
  const animate = engine.presentation.animate.bind(engine.presentation);
  engine.presentation.animate = (anim: any, _d: number, en: boolean) => { order.push(`anim:${anim.side}:${anim.skillName}`); return animate(anim, 0, en); };
  const record = engine.presentation.record.bind(engine.presentation);
  engine.presentation.record = (e: any) => { if (e.type === 'notice') order.push(`notice:${e.side}:${e.text}`); return record(e); };
  engine.mount(); engine.start(); await engine.idle();
  let st = engine.getState();
  engine.dispatch({ type: 'UPDATE_ELF', side: 'p1', elf: { statStages: { ...st.p1.statStages, atk: -1 } } });
  await engine.idle(); st = engine.getState();
  const gospel = st.p1.skills.find((s: any) => s.name === '神懺福音之章');
  const strike = st.p2.skills.find((s: any) => s.name === '辟冥·鎮獄斷');
  assert.ok(gospel && strike);
  const timersOf = (s: any) => [...(s.p2Timers || []), ...Object.values(s.p2ElfState || {}).flatMap((x: any) => x.timers || [])];
  engine.onSkillSelect('p1', gospel); engine.onSkillSelect('p2', strike);
  await engine.idle(); await engine.presentation.wait(); st = engine.getState();
  const logs = st.logs.map((l: any) => l.text);
  assert.ok(logs.some((t: string) => t.includes('使用的【辟冥·鎮獄斷】無效')), '對手攻擊被無效');
  const anim = order.indexOf('anim:p2:辟冥·鎮獄斷'), notice = order.indexOf('notice:p1:技能無效-0');
  assert.ok(anim >= 0, '被無效的技能仍播出招動畫');
  assert.ok(notice > anim, `技能無效跳字排在出招動畫之後：${order.join(' → ')}`);
  assert.equal(timersOf(st).filter((t: any) => t.payload?.block?.invalid).length, 0, '無效次數已消耗');
  assert.equal(timersOf(st).filter((t: any) => t.payload?.block?.prioNext || /先制\+2/.test(String(t.id)) && /辟冥/.test(String(t.id))).length, 0, '被無效技能的附加「未擊敗對手則下次先制+2」不觸發');
  console.log('✓ 技能無效：出招動畫→跳字、次數消耗、附加效果不觸發');
  // 下一回合：對手攻擊照常命中（不會再被同一個無效擋下）。
  const before = st.logs.length;
  const other = st.p1.skills.find((s: any) => s.category !== '屬性' && s.name !== '神懺福音之章');
  engine.onSkillSelect('p1', other); engine.onSkillSelect('p2', st.p2.skills.find((s: any) => s.name === '辟冥·鎮獄斷'));
  await engine.idle(); await engine.presentation.wait(); st = engine.getState();
  const next = st.logs.slice(before).map((l: any) => l.text);
  assert.ok(next.some((t: string) => t.includes('使用了【辟冥·鎮獄斷】')), '下一回合對手正常出手');
  assert.ok(!next.some((t: string) => t.includes('【技能無效】')), '下一回合不再被無效');
  console.log('✓ 下一回合對手攻擊照常結算');
  engine.unmount();
} finally { await server.close(); }
process.exit(0);
