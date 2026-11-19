// 2026-11-16：選招合法性單一來源（引擎／AI／介面共用，第五技能同規則）＋轉化技能＝轉化前固有＋轉化後固有＋轉化後附加。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
let n = 0; const ok = (s: string) => { n++; console.log('✓ ' + s); };
try {
  const { skillSelectionBlock, skillSelectable } = await server.ssrLoadModule('/src/battle/ai/legalActions.ts');
  const { projectIllusionSkill } = await server.ssrLoadModule('/src/battle/illusionSkillProjection.ts');
  const sk = (o: any) => ({ name: '技', category: '物理', type: '普通', power: 80, pp: 5, maxPp: 5, description: '', ...o });
  const elf = (skills: any[], extra: any = {}) => ({ id: 'e', battleId: 'e', name: 'E', type: '普通', currentHp: 100, maxHp: 100, skills, statStages: {}, ...extra });
  const st = (self: any, timers: any[] = []) => ({ p1: self, p2: elf([sk({})]), p1Timers: timers, p2Timers: [] }) as any;
  const fifth = sk({ name: '五', isFifthSkill: true, pp: 0, maxPp: 1 });
  let e = elf([sk({}), sk({ name: '廢', isAbolished: true }), sk({ name: '屬', category: '屬性', power: 0 }), sk({}), fifth]);
  assert.equal(skillSelectionBlock(st(e), 'p1', e, 0), ''); assert.equal(skillSelectable(st(e), 'p1', e, 0), true);
  assert.equal(skillSelectionBlock(st(e), 'p1', e, 1), '技能已被廢除');
  assert.equal(skillSelectionBlock(st(e), 'p1', e, 4), 'PP 已耗盡', '第五技能與一般技能同規則');
  ok('PP／廢除／第五技能共用判定與原因');
  const block = [{ id: 't', kind: 'uses', remaining: 1, payload: { blockAttack: true } }];
  const s2 = st(e, block);
  const reason = skillSelectionBlock(s2, 'p1', e, 0);
  assert.equal(reason, '無法選擇攻擊技能'); assert.equal(skillSelectionBlock(s2, 'p1', e, 2), '', '屬性技能不受影響'); ok('封鎖攻擊技能：只擋攻擊技能');
  e = elf([sk({ charge: 0 })]);
  assert.equal(skillSelectionBlock(st(e), 'p1', e, 0), '充能不足'); ok('充能不足另列原因');
  const seq = (raw: string, role: string, node = 'on_skill_use') => ({ codeId: 'effect_sequence', node, source: 'skill', role, order: 0, customText: raw, params: { clause: { raw, trig: 'use', parsed: true, body: [] } } });
  const orig = { name: '原', description: '■ 固有A\n🎯 附加A', effectMode: 'kit', kit: [seq('■ 固有A', 'innate'), seq('🎯 附加A', 'attached'), seq('■ 行動後', 'innate', 'after_action')], pp: 5, maxPp: 5, priority: 0 };
  const tgt = { name: '轉', description: '■ 固有B\n🎯 附加B', effectMode: 'kit', kit: [seq('■ 固有B', 'innate'), seq('🎯 附加B', 'attached')], pp: 10, priority: 0 };
  const r = projectIllusionSkill(orig, tgt, 0);
  assert.deepEqual(r.kit.map((x: any) => x.customText), ['■ 固有A', '■ 固有B', '🎯 附加B'], '原固有＋轉化固有＋轉化附加；原附加不重播；原行動後固有由原槽接點執行');
  assert.equal(r.pp, 5, 'PP 沿用原槽'); assert.equal(r.convertedFrom.name, '原');
  ok('轉化技能效果組成');
  const legacy = projectIllusionSkill(orig, { ...tgt, effectMode: undefined, kit: undefined }, 0);
  assert.equal(legacy.kit, undefined, '轉化後為非積木技能時不改寫其執行路徑'); ok('非積木轉化目標不受影響');
  console.log(`選招與轉化：${n} 項通過`);
} finally { await server.close(); }
process.exit(0);
