// AI 對新機制的認識（2026-10-30）。
//
// 原本 AI 的印記計算只讀 state[sideMarks]（當前在場者的鏡像），
// 完全看不到：場下精靈的印記、以及像詩章這種由引擎規則直接寫進 elf.marks 的快照資源。
// 這會讓 AI 評估不出「對手次元龍累積了多少體力上限」也不會為了保詩章而換人。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const EVAL = 'src/battle/ai/evaluation.ts';
const read = (p: string) => readFileSync(p, 'utf8');

let count = 0;
const check = (name: string, run: () => void) => { run(); count++; console.log(`✓ ${name}`); };

check('POSITION_WEIGHTS 有 poem（詩章）權重', () => {
  const src = read(EVAL);
  assert.match(src, /poem:\s*6,/, '必須有 poem 權重');
  assert.match(src, /WEIGHT_LABELS[\s\S]{0,600}poem:/, '必須有 poem 顯示標籤');
});

check('印記計算同時讀「側級印記」與「精靈自身印記」', () => {
  const src = read(EVAL);
  assert.match(src, /const markById = new Map<string, any>\(\);/, '必須建立去重表');
  assert.match(src, /for \(const m of state\[`\$\{side\}Marks`\]\)/, '必須讀側級印記');
  assert.match(src, /for \(const m of \(\(e as any\)\.marks \|\| \[\]\)\)/, '必須讀精靈自身印記');
});

check('詩章以「快照體力上限總和」計價，不是用 polarity', () => {
  const src = read(EVAL);
  assert.match(src, /const snapshots = m\?\.effects\?\.poemHpSnapshots;/, '必須讀 poemHpSnapshots');
  assert.match(src, /Array\.isArray\(snapshots\) && snapshots\.length/, '必須判斷非空');
  assert.match(src, /add\('poem', body \* clamp\(totalHp \/ max, 0, 20\) \* POSITION_WEIGHTS\.poem\)/, '必須按體力上限比例計分');
});

check('詩章計價後 continue，不再重複算 polarity 分', () => {
  const src = read(EVAL);
  const block = src.slice(src.indexOf('const snapshots = m?.effects?.poemHpSnapshots'));
  const poemLine = block.indexOf("add('poem'");
  const cont = block.indexOf('continue;');
  assert.ok(poemLine > 0 && cont > poemLine, 'add(poem) 之後必須 continue');
});

console.log(`\nAI 機制認識：${count} 項通過`);
