import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {kitEntryIssue} from '../src/effects/effectConnection';
import {action as a} from '../src/data/reviewedSequenceSkillKits';
import {signIconFor} from '../src/battle/effectIcons';

// 2026-10-29：印記積木完整度稽核。
// 24 個戰鬥印記都必須：(1) 能用通用 op 建立 (2) 通過合約驗證 (3) 能解析到圖示。

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PUBLIC = decodeURIComponent(ROOT) + 'public';

const MARKS: [string, string][] = [
  ['八荒', '八'], ['四象待解除', '象'], ['未暝之夜', '暝'], ['永恆之水', '水'],
  ['伏魔印記', '伏'], ['英雄之耀', '耀'], ['埒殘銜闕', '埒'], ['真龍・治癒', '真'],
  ['能量', '能'], ['堅壁解析', '壁'], ['寂殺之魄', '寂'], ['無色龍鱗', '鱗'],
  ['萬相乖離', '萬'], ['肅霜之禁', '肅'], ['詩章', '詩'], ['墮魔印記', '墮'],
  ['龍魂之力', '力'], ['龍魂之源', '源'], ['龍魂印記', '魂'], ['燦界聖芒', '燦'],
  ['霜寒幽光', '霜'], ['魔王咒怨', '咒'], ['魔軀枷鎖', '枷'], ['ᛏ 戰神符文', '符'],
];

const entry = (node: any, trig: string, raw: string, body: any[], order: number) => ({
  codeId: 'effect_sequence' as const, source: 'soulmark' as const, role: 'innate' as const,
  node, order, customText: raw, params: { clause: { raw, trig, parsed: true, body } },
});

test('每個印記都能用 resource_mark_add 建立並通過合約', () => {
  for (const [name, ch] of MARKS) {
    const kit = entry('battle_start', 'battle_start', `建立【${name}】`, [{
      acts: [a('resource_mark_add', {
        id: 'audit.mark', name, displayChar: ch, unit: '層', side: 'self', scope: 'elf',
        persistsOffField: true, amount: 1, maxCount: 9, description: `${name}稽核用`,
      })],
    }], 1);
    assert.equal(kitEntryIssue(kit as any), null, `${name} 應可建立`);
  }
});

test('resource_mark_add 缺 description 會被合約擋下', () => {
  const kit = entry('battle_start', 'battle_start', '缺描述', [{
    acts: [a('resource_mark_add', {
      id: 'audit.mark', name: '測試', displayChar: '測', unit: '層', side: 'self',
      scope: 'elf', persistsOffField: true, amount: 1, maxCount: 9,
    })],
  }], 1);
  assert.ok(kitEntryIssue(kit as any), '缺 description 應被擋');
});

test('mark_count 可作為條件讀取印記層數', () => {
  const kit = entry('after_action', 'self_after_skill', '讀取層數', [{
    cond: [{ c: 'mark_count', p: { side: 'self', id: 'audit.mark', op: '不小於', amount: 1 }, label: '持有' }],
    acts: [a('heal', { side: 'self', ratio: 0.1 })],
  }], 2);
  assert.equal(kitEntryIssue(kit as any), null);
});

test('resource_mark_remove 可清除印記', () => {
  const kit = entry('after_action', 'self_after_skill', '清除印記', [{
    acts: [a('resource_mark_remove', { id: 'audit.mark', side: 'self', scope: 'elf' })],
  }], 3);
  assert.equal(kitEntryIssue(kit as any), null);
});

test('24 個印記都能解析到圖示且檔案存在', () => {
  const missing: string[] = [];
  for (const [name] of MARKS) {
    const icon = signIconFor(name);
    if (!icon) { missing.push(`${name}（無對應）`); continue; }
    const local = decodeURIComponent(PUBLIC) + icon;
    if (!fs.existsSync(local)) missing.push(`${name}（缺檔 ${icon}）`);
  }
  assert.deepEqual(missing, [], `以下印記缺圖示：${missing.join('、')}`);
});

test('已知官方對應不得被破壞', () => {
  const pairs: [string, number][] = [
    ['英雄之耀', 133], ['亮節', 134], ['威怯', 135], ['武誅', 136], ['英雄之誡', 137],
    ['永恆之水', 108], ['寂殺之魄', 110], ['肅霜之禁', 111], ['魔王咒怨', 121],
    ['嫉妒', 225], ['星芳之纏', 96], ['星海之浸', 97], ['星火之灼', 98],
    ['精靈護盾', 2], ['精靈護罩', 3],
    ['紅色龍鱗', 48], ['黃色龍鱗', 49], ['藍色龍鱗', 50], ['白色龍鱗', 51],
  ];
  for (const [name, id] of pairs) {
    assert.equal(signIconFor(name), `/seer/signbuff/${id}.png`, `${name} 應對到 ${id}`);
  }
});

console.log('印記積木完整度：24 個印記建立/讀取/清除/圖示 全部通過');
