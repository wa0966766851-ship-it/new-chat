// 通用搜尋（2026-11-07）：多關鍵字、排除、片語、同義詞、簡繁、全形、相關度排序；套用到效果庫。
import assert from 'node:assert/strict';
import { searchList, normalizeSearchText } from '../src/utils/textSearch';
import { searchCardTemplates, REAL_CARD_EFFECT_MODULES } from '../src/data/cardTemplates';
const items = [
  { t: '麻痺藥劑', tags: ['麻痺'], b: '令對手麻痺 2 回合' },
  { t: '必中打擊', tags: [], b: '■ 必中' },
  { t: '強制存活', tags: ['免死'], b: '體力歸零時保留 1 點' },
  { t: '中毒藥劑', tags: ['中毒'], b: '令對手中毒 3 回合，附加傷害' },
  { t: '普通攻擊', tags: [], b: '造成傷害；說明提到麻痺' },
];
const run = (q: string) => searchList(items, q, x => ({ title: x.t, tags: x.tags, body: [x.b] })).map(x => x.t);
assert.deepEqual(run(''), items.map(x => x.t), '空查詢原樣');
assert.deepEqual(run('麻痺'), ['麻痺藥劑', '普通攻擊'], '標題命中排前');
assert.deepEqual(run('麻痹'), ['麻痺藥劑', '普通攻擊'], '簡體／異體字');
assert.deepEqual(run('藥劑 對手 -中毒'), ['麻痺藥劑'], '多關鍵字＋排除');
assert.deepEqual(run('必定命中'), ['必中打擊'], '同義詞');
assert.deepEqual(run('免死'), ['強制存活'], '同義詞（標籤）');
assert.deepEqual(run('"附加傷害"'), ['中毒藥劑'], '片語');
assert.equal(normalizeSearchText('ＡＢＣ１'), 'abc1', '全形轉半形');
assert.equal(normalizeSearchText('体力伤害'), '體力傷害', '簡轉繁');
// 效果庫：多關鍵字縮小、空白不再當成字面
const all = searchCardTemplates('').length, one = searchCardTemplates('傷害').length, two = searchCardTemplates('傷害 回合').length;
assert.equal(all, REAL_CARD_EFFECT_MODULES.length); assert.ok(one > 0 && two > 0 && two <= one, `多關鍵字縮小範圍（${one}→${two}）`);
console.log('通用搜尋：多關鍵字、排除、片語、同義詞、簡繁、全形、相關度、效果庫 通過');
