/** 額外行動技能表（2026-11-16）：具名額外行動的登記、引用一致性與戰鬥紀錄顯示。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHarness } from './helpers/migrationHarness';
import { EXTRA_ACTION_SKILLS, extraActionSkill, extraActionSkillsOf, extraActionTitle } from '../src/data/extraActionSkills';

let checks = 0;
// 一、表內 id 唯一、欄位完整；程式與 Kit 引用的 skillId 都已登記
assert.equal(new Set(EXTRA_ACTION_SKILLS.map(s => s.id)).size, EXTRA_ACTION_SKILLS.length, 'id 不重複');
assert.ok(EXTRA_ACTION_SKILLS.every(s => s.name && s.type && s.summary && s.elfIds.length), '欄位完整');
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name)) : /\.(ts|tsx)$/.test(d.name) ? [path.join(dir, d.name)] : []);
const used = new Set<string>();
for (const f of walk('src')) for (const m of fs.readFileSync(f, 'utf8').matchAll(/skillId:\s*['"]([a-z_]+)['"]/g)) used.add(m[1]);
for (const id of used) assert.ok(extraActionSkill(id), `引用的額外行動 ${id} 已登記`);
for (const s of EXTRA_ACTION_SKILLS) assert.ok(used.has(s.id) || s.id.startsWith('wraith_'), `登記的 ${s.id} 有排入處`);
assert.ok(fs.readFileSync('src/utils/traitsEngine.ts', 'utf8').includes("'wraith_doom' : 'wraith_curse'"), '蝕言兩種魔咒帶 skillId');
checks++;
// 二、顯示
assert.equal(extraActionTitle({ label: 'x', skillId: 'puni_light' }), '【珀妮·光擊】（光系）');
assert.equal(extraActionTitle({ label: '舊效果' }), '舊效果', '未登記沿用 label');
assert.deepEqual(extraActionSkillsOf('5023').map(s => s.name), ['賽博怨靈·魔咒', '賽博怨靈·滅靈魔咒']);
checks++;
// 三、實戰：斯嘉麗＋珀妮出手流程結束後的額外行動以技能名稱與系別記錄
const h = await createHarness();
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const can = DEFAULT_ELVES.find((e: any) => String(e.id) === '5014');
  for (const side of ['p1', 'p2'] as const) {
    const self = { ...structuredClone(can), skills: [h.wait()], battleId: 'CAN', id: '5014' };
    const r = await h.play(side, { self, opp: h.unit('對手', 1000000, [h.wait()]) }, 1);
    assert.ok(r[0].logs.some(l => l.includes('【額外行動】【珀妮·光擊】（光系）')), `${side} 珀妮額外行動以名稱記錄：` + r[0].logs.filter(l => l.includes('額外')).join('｜'));
    assert.ok(r[0].opp.currentHp < 1000000, `${side} 光擊造成傷害`);
    checks++;
  }
} finally { await h.close(); }
console.log(`額外行動技能表：${checks} 項通過`);
