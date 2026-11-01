import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { DEFAULT_ELVES } from '../src/data/defaultElves';
import { buildDestinyPool, pullFromDestinyPool } from '../src/utils/destinyGacha';
import { getElfDisplayRank, explainElfDisplayRank } from '../src/utils/elfDisplayRank';
import { rankStats, describeRankRule, DESTINY_RANKS } from '../src/utils/destinyRankMeta';
import { XI_FILES, typeIconUrls } from '../src/battle/seerAssets';

// 命運之輪以真實圖鑑資料驗證：D-07 不重複、707070＝A、分級統計、D-01／D-12／D-13 靜態資源。
const lcg = (s: number) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const pool = buildDestinyPool(DEFAULT_ELVES, lcg(1));
assert.equal(pool.filter(e => e.id.startsWith('classic_c_')).length, 0, 'D-07：不得補入舊版 classic_c 卡');
const stats = rankStats(pool);
assert.equal(stats.total, pool.length); assert.equal(DESTINY_RANKS.reduce((n, r) => n + stats.counts[r], 0), pool.length, '四級張數相加＝池總數');
assert.ok(stats.counts.C >= 2, 'C 級至少 2 隻才能保底開局');
const liujie = pool.filter(e => e.name.includes('六界神王')); assert.equal(liujie.length, 1, '池內六界神王只有 1 張（圖鑑 5031）');

let draws = 0;
for (let seed = 1; seed <= 300; seed++) {
  const rng = lcg(seed * 7919);
  for (const prefix of ['p1', 'p2']) {
    const cards = pullFromDestinyPool(pool, rng, prefix); draws++;
    assert.equal(cards.length, 12);
    assert.equal(new Set(cards.map(c => c.name)).size, 12, `seed ${seed} ${prefix}：12 連抽出現重複精靈`);
    assert.equal(new Set(cards.map(c => c.id)).size, 12);
    for (const [r, n] of [['S', 1], ['A', 3], ['C', 2]] as const) assert.ok(cards.filter(c => c.destinyRank === r).length >= n, `保底 ${r}`);
  }
}

// 墜霆.雷伊 707070 明確設為 A；魔化.雷伊 7070 維持 B
const fall = DEFAULT_ELVES.find(e => e.id === '707070')!, magic = DEFAULT_ELVES.find(e => e.id === '7070')!;
assert.equal(fall.destinyRank, 'A', '資料需明設 A 級'); assert.equal(getElfDisplayRank(fall), 'A'); assert.equal(explainElfDisplayRank(fall).source, 'preset');
assert.equal(getElfDisplayRank(magic), 'B'); assert.equal(pool.find(e => e.id === '707070')!.destinyRank, 'A');
// 其他既有裁定不變
assert.equal(getElfDisplayRank(DEFAULT_ELVES.find(e => e.name.includes('悲歌.索比拉特'))!), 'C');
assert.equal(getElfDisplayRank(DEFAULT_ELVES.find(e => e.name.includes('皮特薩拉羅'))!), 'B');

// 規則文字與規則表同源
for (const r of DESTINY_RANKS) assert.ok(describeRankRule(r).startsWith(r));

// D-01：底圖放在 public，網址與檔案一致
assert.ok(existsSync(new URL('../public/images/img_018.png', import.meta.url)), 'public/images/img_018.png 必須存在（dist／Electron 才有）');
assert.ok(readFileSync(new URL('../src/components/destiny/DestinyWheelClassic.tsx', import.meta.url), 'utf8').includes("/images/img_018.png"));

// D-12：屬性圖標候選只含實際存在的檔
const xiDir = new URL('../public/seer/xi/', import.meta.url); const have = new Set(readdirSync(xiDir));
for (const name of XI_FILES) assert.ok(have.has(`${name}.png`), `XI_FILES 列了不存在的檔：${name}`);
for (const t of ['機械·暗影', '機械.暗影', '邪靈·戰鬥', '混沌·電', '神秘·電', '混沌·水']) for (const u of typeIconUrls(t)) {
  if (!u.startsWith('/seer/xi/')) continue; const f = decodeURIComponent(u.slice('/seer/xi/'.length).split('?')[0]); assert.ok(have.has(f), `${t} 的候選 ${f} 不存在`);
}

// D-13：外部字型非阻塞、離線不卡首屏；外部背景圖有底色
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
assert.ok(!/@import\s+url\(['"]?https?:/.test(css), 'index.css 不得以 @import 阻塞載入外部字型');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const link = html.match(/<link[^>]+fonts\.googleapis\.com\/css2[^>]*>/); assert.ok(link, 'index.html 應有字型連結'); assert.match(link![0], /media="print"/); assert.match(link![0], /onload="this\.media='all'"/);
assert.match(readFileSync(new URL('../src/components/ThemeController.tsx', import.meta.url), 'utf8'), /backgroundColor:\s*"#0A0C10"/);
console.log(`命運真實卡池：${draws} 次 12 連抽無重複精靈、707070＝A、分級統計相加、底圖／圖標／字型資源通過（池 ${pool.length} 張：S${stats.counts.S} A${stats.counts.A} B${stats.counts.B} C${stats.counts.C}）`);
