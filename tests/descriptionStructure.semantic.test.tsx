import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { descriptionStructure, descriptionFingerprint, type DescriptionNode } from '../src/utils/descriptionStructure';
import { EffectDescription } from '../src/components/EffectDescription';
import { EffectBlockToggle } from '../src/components/EffectBlockToggle';
import { OTHERWORLD_REY_TEXT } from '../src/data/otherworldReyDescriptions';
import { plainDescription } from '../src/utils/descFormat';
import { readFileSync } from 'node:fs';

let checks = 0;
function check(name: string, run: () => void) { run(); checks++; console.log(`✓ ${name}`); }
function flatten(nodes: DescriptionNode[]): DescriptionNode[] { return nodes.flatMap(n => [n, ...flatten(n.children)]); }
const source = '# 魂印\n每次登場時：\n> **為對手附加3回合的星火之灼**\n>> 註：重复獲取重置\n\n【回合結束】\n- 恢復1/3體力，攻擊-1；總和*70。\n  - 僅恢復成功才執行\n---';
check('標題、引用、巢狀清單保留父子关系與來源行號', () => {
  const tree = descriptionStructure(source);
  const root = tree.nodes[0], trigger = root.children[0];
  assert.equal(root.text, '魂印'); assert.equal(root.kind, 'section');
  assert.equal(trigger.text, '每次登場時：');
  assert.equal(trigger.children[0].text, '為對手附加3回合的星火之灼');
  assert.equal(trigger.children[0].sourceLine, 3);
  assert.equal(trigger.children[0].children[0].kind, 'note');
  assert.equal(tree.nodes[1].children[0].children[0].text, '僅恢復成功才執行');
  assert.equal(tree.nodes[1].children[0].text, '恢復1/3體力，攻擊-1；總和*70。');
});
check('Markdown章節深度與跳級不造新效果', () => {
  const tree = descriptionStructure('# A\n### B\n>> 子效果\n# C\n內容');
  assert.equal(tree.nodes.length, 2);
  assert.equal(tree.nodes[0].children[0].text, 'B');
  assert.equal(tree.nodes[0].children[0].children[0].text, '子效果');
  assert.equal(flatten(tree.nodes).length, 5);
});
check('雷伊明確補充歸屬與神降生命週期說明', () => {
  assert.equal(descriptionFingerprint(OTHERWORLD_REY_TEXT.soul), '10931485');
  const soul = descriptionStructure(OTHERWORLD_REY_TEXT.soul);
  assert.equal(soul.nodes[0].children[0].children[0].text, '複製成功則令自身麻痺。');
  const attack = soul.nodes.find(n => n.text === '使用攻擊技能時')!;
  assert.ok(attack.children[0].children[0].text.includes('上述吸取'));
  const thunder = descriptionStructure(OTHERWORLD_REY_TEXT.thunder);
  const god = thunder.nodes.find(n => n.text === '神降效果')!;
  assert.equal(god.children.at(-1)!.kind, 'note');
  assert.equal(god.children.at(-2)!.kind, 'note');
  assert.ok(!god.children.some(n => n.children.some(c => c.text === '神降狀態下場後保留。')));
});
check('使用者確認的雷伊回合縮減補充同屬一條，其他不明指代仍待核', () => {
  const tree = descriptionStructure(OTHERWORLD_REY_TEXT.soul);
  assert.equal(tree.unresolved.length, 0);
  const trigger = flatten(tree.nodes).find(n => n.text === '對手每次回合類效果開始時變為1回合。')!;
  assert.deepEqual(trigger.children.map(n => n.text), ['觸發成功則當回合令自身麻痺。', '每減少1回合令自身麻痺回合數+1。']);
  assert.ok(trigger.children.every(n => n.parentId === trigger.id));
  const unknown = descriptionStructure('效果甲\n觸發成功則回血');
  assert.equal(unknown.nodes.length, 2); assert.equal(unknown.unresolved.length, 1);
});
check('自訂原文變更時不套舊關聯、CRLF不造成失配', () => {
  const modified = OTHERWORLD_REY_TEXT.thunder + '\n自訂效果';
  const god = descriptionStructure(modified).nodes.find(n => n.text === '神降效果')!;
  assert.notEqual(god.children.at(-2)!.kind, 'note');
  assert.deepEqual(descriptionStructure(OTHERWORLD_REY_TEXT.soul.replace(/\n/g, '\r\n')), descriptionStructure(OTHERWORLD_REY_TEXT.soul));
});
check('完整原文不被改寫，複製純文字的既有契約不變', () => {
  const before = OTHERWORLD_REY_TEXT.thunder;
  const expected = before.split('\n').filter(line => line.trim() && !/^【[^】]+】$/.test(line));
  assert.deepEqual(flatten(descriptionStructure(before).nodes).filter(n => n.kind !== 'section')
    .sort((a, b) => a.sourceLine - b.sourceLine).map(n => n.text), expected);
  assert.equal(OTHERWORLD_REY_TEXT.thunder, before);
  assert.equal(plainDescription('> **總和*70，1/3；-1。**'), '總和*70，1/3；-1。');
  assert.equal(descriptionStructure('').nodes.length, 0);
});
check('實際描述元件的章節、說明與子效果DOM', () => {
  const markup = renderToStaticMarkup(<EffectDescription description={OTHERWORLD_REY_TEXT.thunder} />);
  const doc = new JSDOM(markup).window.document;
  const section = doc.querySelector('section[aria-label="神降效果"]')!;
  assert.equal(section.querySelectorAll('[data-description-kind="note"]').length, 2);
  assert.ok(section.textContent!.includes('神降狀態下場後保留。'));
  assert.equal(doc.querySelectorAll('section').length, 3);
  const childDoc = new JSDOM(renderToStaticMarkup(<EffectDescription description={source} renderText={text => <em>{text}</em>} />)).window.document;
  assert.ok(childDoc.querySelector('[data-source-line="3"] [data-source-line="4"] em'));
});
check('共用元件不輸出HTML原文、沒有強迫橫向定寬與省略', () => {
  const markup = renderToStaticMarkup(<EffectDescription description={'<script>alert(1)</script>\n長內容'} />);
  assert.ok(!markup.includes('<script>')); assert.ok(markup.includes('&lt;script&gt;'));
  const implementation = readFileSync(new URL('../src/components/EffectDescription.tsx', import.meta.url), 'utf8');
  assert.ok(implementation.includes('break-words'));
  assert.ok(!/line-clamp|truncate|w-\[\d+px\]/.test(implementation));
});
check('主要畫面均接入共用元件，編輯器仍保留關鍵字說明', () => {
  for (const name of ['StartScreen', 'BattleScreen.ui', 'ElfReadOnlyProfile', 'ElfTraitCards', 'StatusInspector', 'ElfEditor', 'LazyBlockProgramView']) {
    const file = readFileSync(new URL(`../src/components/${name}.tsx`, import.meta.url), 'utf8');
    assert.ok(file.includes('<EffectDescription'), name);
  }
  const editor = readFileSync(new URL('../src/components/ElfEditor.tsx', import.meta.url), 'utf8');
  assert.ok(editor.includes('renderText={line => line.split(regex)'));
});
check('描述預設文字；積木仍保留手動切換', () => {
  const markup = renderToStaticMarkup(<EffectBlockToggle><EffectDescription description="預設原文" /></EffectBlockToggle>);
  const doc = new JSDOM(markup).window.document;
  assert.equal(doc.querySelector('[data-active="true"]')?.textContent, '描述');
  assert.ok(doc.body.textContent!.includes('預設原文'));
  assert.ok(doc.querySelector('[data-active="false"]')?.textContent?.includes('積木'));
  assert.ok(!markup.includes('載入語意積木'));
  const start = readFileSync(new URL('../src/components/StartScreen.tsx', import.meta.url), 'utf8');
  assert.ok(start.includes('[blockView, setBlockView] = useState(false)'));
  assert.ok(start.includes('setBlockView(false)'));
});
console.log(`${checks} description structure checks passed`);
