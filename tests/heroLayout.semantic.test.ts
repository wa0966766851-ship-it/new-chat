import assert from 'node:assert/strict';
import { readHeroLayout, writeHeroLayout, heroImageStyle } from '../src/shell/art/heroLayout';
import { addMember, emptyDraft, moveMember, setStarter } from '../src/shell/teamDraft';
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
} });
values.set('seer_aegis_hero_layout', JSON.stringify({ scale: 1.2, offsetY: -12, fit: 'contain' }));
assert.equal(readHeroLayout().offsetX, 0, '舊版只存上下位置的設定仍能載入');
writeHeroLayout({ scale: 1.4, offsetX: 21, offsetY: -18, fit: 'contain' });
const saved = readHeroLayout();
assert.equal(saved.offsetX, 21);
assert.equal(saved.offsetY, -18);
assert.match(String(heroImageStyle(saved).transform), /translate\(21%, -18%\) scale\(1.4\)/);
values.set('seer_aegis_hero_layout', '{invalid');
assert.equal(readHeroLayout().scale, 1, '損壞設定回復安全預設');
let draft = emptyDraft();
for (let i = 0; i < 8; i++) draft = addMember(draft, { id: `elf${i}`, name: `Elf${i}`, skills: [] } as any);
assert.equal(setStarter(draft, draft.members[7].battleId!).starterBattleId, draft.starterBattleId, '待命精靈不能直接指定為首發');
draft = moveMember(draft, 0, 7);
assert.equal(draft.starterBattleId, draft.members[0].battleId, '首發移到待命區後改由出戰區首位接替');
assert.equal(moveMember(draft, -1, 1), draft, '無效來源索引不應移動最後一隻精靈');
console.log('立繪設定相容／保存與出戰首發邊界通過');
