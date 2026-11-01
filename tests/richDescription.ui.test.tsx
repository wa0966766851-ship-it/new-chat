// 精靈／魂印／技能／印記描述的共用渲染：`>` 縮排、`**` 粗體、`##` 標題、`---` 分隔線、CRLF 斷行。
// 驗收重點：畫面上不得再出現 Markdown 原始符號，且層級要真的變成縮排。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { RichDescription, RichInline } from '../src/components/RichDescription';
import { parseRichDescription, parseInlineDescription, richDescriptionToText } from '../src/utils/richDescription';

let checks = 0;
const ok = (name: string) => { checks++; console.log(`✓ ${name}`); };
const draw = (markup: string) => new JSDOM(markup).window.document;

// ── 一、摩哥斯魂印原文（含 CRLF、多級 `>`、`**`、`---`、`##`）實際渲染 ──
const kitSource = fs.readFileSync(new URL('../src/data/migratedMogosSoulKit.ts', import.meta.url), 'utf8');
const mogos = JSON.parse(kitSource.match(/description:\s*("(?:[^"\\]|\\.)*")/)![1]) as string;
assert.ok(mogos.includes('\r\n'), '原文含 CRLF');
assert.ok(mogos.includes('**') && mogos.includes('##') && mogos.includes('---') && mogos.includes('>>>'), '原文含全部 Markdown 符號');

const doc = draw(renderToStaticMarkup(<RichDescription text={mogos} />));
const text = doc.body.textContent || '';
assert.ok(!text.includes('**'), '不顯示 **');
assert.ok(!text.includes('##'), '不顯示 ##');
assert.ok(!text.includes('\r'), '不顯示 CR');
assert.ok(!text.includes('---'), '不顯示 ---');
assert.ok(!/(^|\n)\s*>/.test(text), '不顯示行首 >');
assert.ok(!/(^|\n)\s*>>/.test(text), '不顯示 >>');
ok('摩哥斯魂印原文渲染後無殘留 Markdown 符號');

// 粗體真的加粗、分隔線與標題真的成元素
assert.ok(doc.querySelectorAll('strong').length >= 5, `粗體元素 ${doc.querySelectorAll('strong').length} 個`);
assert.ok(doc.querySelectorAll('[data-rich-kind="divider"]').length >= 2, '分隔線成元素');
assert.ok(doc.querySelectorAll('[data-rich-kind="heading"]').length >= 1, '標題成元素');
assert.ok(doc.querySelector('strong')!.textContent!.includes('自身擁有魂珠時'), '粗體內容正確');
ok('粗體／分隔線／標題都渲染為真實元素');

// 層級：> 的層數 → 縮排；>>> 比 >> 更深
const indented = [...doc.querySelectorAll('[data-rich-kind="text"]')];
const depthOf = (d: string) => indented.filter(e => e.getAttribute('data-rich-depth') === d);
assert.ok(depthOf('1').length > 0 && depthOf('2').length > 0 && depthOf('3').length > 0, '出現 1／2／3 級');
const px = (d: string) => Number((depthOf(d)[0] as HTMLElement).getAttribute('style')!.match(/padding-inline-start:\s*(\d+)px/)![1]);
assert.equal(px('1'), 16); assert.equal(px('2'), 32); assert.equal(px('3'), 48);
assert.ok(px('3') > px('2') && px('2') > px('1'), '層級越深縮排越大');
assert.ok((depthOf('3')[0] as HTMLElement).getAttribute('style')!.includes('border-inline-start-width'), '有左側層級線');
ok('`>` 層數轉為 16/32/48px 縮排與左側層級線');

// ── 二、CRLF 與 LF 結果一致、換行正確斷行 ──
assert.deepEqual(parseRichDescription(mogos.replace(/\r\n/g, '\n')), parseRichDescription(mogos));
const multi = draw(renderToStaticMarkup(<RichDescription text={'第一行\r\n第二行\r第三行\n第四行'} />));
const lines = [...multi.querySelectorAll('[data-rich-kind="text"]')].map(e => e.textContent);
assert.deepEqual(lines, ['第一行', '第二行', '第三行', '第四行']);
ok('CRLF／CR／LF 都正確斷行且結果一致');

// ── 三、行內解析：粗體、程式碼、連結；乘號不被吃掉 ──
assert.deepEqual(parseInlineDescription('**粗體**與普通'), [{ text: '粗體', bold: true }, { text: '與普通' }]);
assert.deepEqual(parseInlineDescription('總和*70，1/3；-1。'), [{ text: '總和*70，1/3；-1。' }]);
const inline = draw(renderToStaticMarkup(<RichInline text="**甲**`code`[連](https://x.test)" />));
assert.equal(inline.querySelector('strong')!.textContent, '甲');
assert.equal(inline.querySelector('code')!.textContent, 'code');
assert.equal(inline.querySelector('a')!.getAttribute('href'), 'https://x.test');
ok('行內粗體／程式碼／連結正確；乘號與比例不受影響');

// ── 四、純文字輸出（tooltip／複製）不含符號且保留縮排 ──
const plain = richDescriptionToText(mogos);
assert.ok(!plain.includes('**') && !plain.includes('##') && !plain.includes('\r'));
assert.ok(plain.split('\n').some(l => l.startsWith('    ')), '純文字保留層級縮排');
assert.ok(plain.includes('自身擁有魂珠時：'));
ok('純文字輸出去符號並保留縮排');

// ── 五、空值與 HTML 注入 ──
assert.equal(renderToStaticMarkup(<RichDescription text="" />), '');
assert.equal(renderToStaticMarkup(<RichDescription text={undefined} />), '');
assert.ok(renderToStaticMarkup(<RichDescription text="" fallback="尚無描述" />).includes('尚無描述'));
const escaped = renderToStaticMarkup(<RichDescription text={'<script>alert(1)</script>\n第二行'} />);
assert.ok(!escaped.includes('<script>')); assert.ok(escaped.includes('&lt;script&gt;'));
ok('空描述回退文字與 HTML 轉義');

// ── 六、主要渲染點都已接入共用元件（靜態檢查，避免再有漏網的原始 description） ──
const sites: [string, RegExp][] = [
  ['BattleComponents.tsx', /<RichDescription[^>]*selectedElf\.description/],
  ['BattleScreen.ui.tsx', /<RichDescription text=\{mark\.description\}/],
  ['BossStatusSection.tsx', /<RichDescription[^>]*bossTraitText/],
  ['ClauseBreakdownCard.tsx', /<RichDescription text=\{mainText\}/],
  ['EffectDescription.tsx', /RichInline/],
  ['EffectVerificationWorkbench.tsx', /<RichDescription text=\{definition\.description\}/],
];
for (const [file, pattern] of sites) {
  const src = fs.readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8');
  assert.match(src, pattern, `${file} 已接入共用描述渲染`);
  ok(`${file} 已接入共用描述渲染`);
}
// 已接入的檔案不得再直接把 description 塞進純文字標籤
for (const file of ['BattleComponents.tsx', 'BossStatusSection.tsx', 'ClauseBreakdownCard.tsx', 'EffectVerificationWorkbench.tsx', 'BossStatusSection.tsx']) {
  const src = fs.readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8');
  assert.doesNotMatch(src, /whitespace-pre-(?:wrap|line)"[^>]*>\s*\{[^}]*(?:description|mainText)/, `${file} 不再直出原始描述`);
}
ok('既有渲染點不再直接輸出含 Markdown 的原始描述');

console.log(`${checks} rich description checks passed`);
