import assert from 'node:assert/strict';
import type { Elf } from '../src/types';
import { refreshExplorationElf } from '../src/modes/interstellar/v2/definitionSync';
import * as E from '../src/modes/interstellar/v2/engine';

const stats = { hp: 120, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 };
const source: Elf = {
  id: 'test-definition', name: '新版精靈', type: '電', level: 100, baseStats: stats,
  calculatedStats: { ...stats }, maxHp: 500, currentHp: 500,
  soulMark: { name: '新版魂印', description: '新版魂印描述' },
  trait: { name: '新版特質', description: '新版特質描述' },
  skills: [{ name: '原技能', category: '屬性', type: '電', power: 0, pp: 10, maxPp: 10, description: '新版描述' }],
  skillPool: [{ name: '池中技能', category: '特殊', type: '電', power: 150, pp: 8, description: '新版池描述' }],
};
const stone = { name: '火系技能石S', isSkillStone: true, category: '特殊', type: '火', power: 160, pp: 1, maxPp: 5, description: '保留技能石' };
const unknown = { name: '未知替換技能', category: '特殊', type: '水', power: 99, pp: 3, maxPp: 5, description: '不要刪除' };
const saved: Elf = {
  ...structuredClone(source), name: '舊版精靈', currentHp: 123, battleId: 'instance-2', level: 87,
  soulMark: { name: '舊魂印', description: '舊描述' },
  skills: [
    { ...source.skillPool![0], description: '舊池描述', pp: 2, power: 1, priority: 99, battleSlot: 0 },
    { ...source.skills[0], description: '舊描述', pp: 4, currentPp: 4 }, stone, unknown,
  ] as any,
  statStages: { atk: 2 } as any, statuses: [{ name: '麻痺', duration: 2 }],
  marks: [{ id: 'saved-mark', stacks: 3 }] as any,
  evs: { ...stats, hp: 0 }, runBoost: .25, explorationVitals: true,
} as Elf;
const beforeSaved = structuredClone(saved), beforeSource = structuredClone(source);
const refreshed = refreshExplorationElf(saved, [source]);
assert.equal(refreshed.name, source.name);
assert.deepEqual(refreshed.soulMark, source.soulMark);
assert.deepEqual(refreshed.trait, source.trait);
assert.equal(refreshed.skills[0].power, 150);
assert.equal(refreshed.skills[0].description, '新版池描述');
assert.equal(refreshed.skills[0].priority, undefined, '刪除已被來源撤回的舊效果旗標');
assert.equal(refreshed.skills[0].pp, 2);
assert.equal(refreshed.skills[0].maxPp, 8, '無maxPp的來源以定義PP建立上限，不以剩餘PP建立');
assert.equal(refreshed.skills[1].pp, 4);
assert.equal(refreshed.skills[1].currentPp, 4);
assert.deepEqual(refreshed.skills.slice(2), [stone, unknown]);
for (const key of ['currentHp', 'maxHp', 'battleId', 'level', 'evs', 'statStages', 'statuses', 'marks', 'runBoost']) {
  assert.deepEqual((refreshed as any)[key], (saved as any)[key], key);
}
assert.deepEqual(saved, beforeSaved); assert.deepEqual(source, beforeSource);
assert.equal(refreshExplorationElf(refreshed, [source]), refreshed, '相同定義不重複改寫');
assert.equal(refreshExplorationElf(saved, [{ ...source, id: 'other' }]), saved, '不以同名套用其他ID');
const custom = { ...saved, isCustom: true };
assert.equal(refreshExplorationElf(custom, [source]), custom);
assert.equal(refreshExplorationElf(saved, [{ ...source, isCustom: true }]), saved);
const capped = refreshExplorationElf({ ...saved, skills: [{ ...source.skills[0], pp: 19 }] }, [source]);
assert.equal(capped.skills[0].pp, 10, '新上限降低時限制溢出PP');
const extended = refreshExplorationElf({ ...saved, globalPpMaxOffset: 5, skills: [{ ...source.skills[0], pp: 17, ppMaxOffset: 3 }] }, [source]);
assert.equal(extended.skills[0].pp, 17, '保留個體與技能的合法PP擴張');

let run = E.createRun({ pool: [source], equipType: 'suit', equipId: '', modifiers: [], startingShards: 3, seed: 543 });
run = { ...run, team: [saved], scene: { kind: 'map' }, lineup: ['instance-2'], bench: [], revision: 12, beans: 321, potions: 1 };
const synchronized = E.syncRunDefinitions(run, [source]);
assert.deepEqual({ ...synchronized, team: [] }, { ...run, team: [] }, '只同步精靈定義，不改地圖、貨幣、藥劑、名單或隨機序列');
const pending = { ...run, pendingBattle: { id: 'battle-pending', nodeId: null, encounter: { kind: 'combat' as const, title: 'test', enemies: [], scale: 1 } } };
assert.equal(E.syncRunDefinitions(pending, [source]), pending, '未結算戰鬥不得中途替換規則');

const values = new Map([[E.RUN_KEY_V2, JSON.stringify(run)], ['unrelated', 'keep']]);
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
const resumed = E.resumeRunV2(storage, [source])!;
assert.equal(resumed.revision, 13);
assert.deepEqual(JSON.parse(storage.getItem(E.definitionSyncBackupKey(run.runId))!), run, '第一次寫回前備份完整舊局面');
assert.equal(storage.getItem('unrelated'), 'keep');
const once = storage.getItem(E.RUN_KEY_V2);
assert.equal(E.resumeRunV2(storage, [source])!.revision, 13);
assert.equal(storage.getItem(E.RUN_KEY_V2), once, '重複載入不製造修訂、不補PP');
const anotherRun = { ...run, runId: 'another-run' };
storage.setItem(E.RUN_KEY_V2, JSON.stringify(anotherRun));
E.resumeRunV2(storage, [source]);
assert.deepEqual(JSON.parse(storage.getItem(E.definitionSyncBackupKey(anotherRun.runId))!), anotherRun, '不同局各自備份');
assert.deepEqual(JSON.parse(storage.getItem(E.definitionSyncBackupKey(run.runId))!), run, '不覆蓋上一局備份');
const broken = { ...storage, setItem: () => { throw new Error('quota'); }, getItem: (key: string) => key === E.RUN_KEY_V2 ? JSON.stringify(run) : null };
assert.throws(() => E.resumeRunV2(broken, [source]), /quota/, '備份失敗不得繼續覆寫原檔');

const changedSource = { ...source, baseStats: { ...stats, hp: 150 } };
const oldPanel = E.snapshotElf(run, source);
const living = { ...oldPanel, currentHp: oldPanel.maxHp - 100 };
const migrated = E.syncRunDefinitions({ ...run, team: [living] }, [changedSource]).team[0];
assert.deepEqual(migrated.calculatedStats, E.snapshotElf(run, changedSource).calculatedStats);
assert.equal(migrated.currentHp, migrated.maxHp - 100, '種族值改版仍保留已損失體力');
assert.equal(E.syncRunDefinitions({ ...run, team: [{ ...living, currentHp: 0 }] }, [changedSource]).team[0].currentHp, 0, '陣亡不復活');
const negative = { ...living, currentHp: -123, survivalRule: { mode: 'god_descent', active: true, preserveOffField: true, minHp: -10000 } } as Elf;
assert.equal(E.syncRunDefinitions({ ...run, team: [negative] }, [changedSource]).team[0].currentHp, -123, '神降負血不重置');
assert.deepEqual(E.syncRunDefinitions({ ...run, team: [negative] }, [changedSource]).team[0].survivalRule, negative.survivalRule);
storage.setItem(E.RUN_KEY_V2, '{broken');
assert.equal(E.resumeRunV2(storage, [source]), null);
assert.equal(storage.getItem(E.RUN_KEY_V2), '{broken', '損壞存檔不默默覆寫');
console.log('回廊定義同步：魂印／特質／技能更新、HP/PP/名單保留、自訂隔離、備份、冪等、戰鬥延後與負血保留通過');
