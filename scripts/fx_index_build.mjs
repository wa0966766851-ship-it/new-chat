/**
 * 官方特效库索引生成器
 *
 * 扫描所有可用特效来源，建立可搜索的索引：
 *   - public/elf-fx/*           已提取的特效块（PNG + index.json）
 *   - pet-animation-cache      官方 .bundle 动画包（可解析）
 *
 * 输出：docs/fx-catalog.json + docs/fx-catalog.md
 *
 * 用法：
 *   node scripts/fx_index_build.mjs            # 扫描并生成
 *   node scripts/fx_index_build.mjs --extract  # 额外从 bundle 提取特效块
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const OUT_JSON = 'docs/fx-catalog.json';
const OUT_MD = 'docs/fx-catalog.md';
const EXTRACT = process.argv.includes('--extract');

const catalog = { generatedAt: new Date().toISOString(), sources: [], blocks: [] };

// ── 来源 1：已提取的特效块 ──────────────────────────
function scanElfFx() {
  const base = 'public/elf-fx';
  if (!fs.existsSync(base)) return;
  for (const dir of fs.readdirSync(base)) {
    const full = path.join(base, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    const indexPath = path.join(full, 'index.json');
    const source = { kind: 'elf-fx', elf: dir, dir: full, count: 0 };
    catalog.sources.push(source);

    let items = [];
    if (fs.existsSync(indexPath)) {
      items = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    } else {
      // 没有 index.json 就直接扫 PNG
      items = fs.readdirSync(full).filter(f => f.endsWith('.png')).map(f => {
        const buf = fs.readFileSync(path.join(full, f));
        const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
        return { name: f, w, h, fi: -1 };
      });
    }

    for (const it of items) {
      const fp = path.join(full, it.name);
      if (!fs.existsSync(fp)) continue;
      const size = fs.statSync(fp).size;
      catalog.blocks.push({
        source: 'elf-fx', elf: dir, file: it.name, path: fp,
        w: it.w, h: it.h, frameIndex: it.fi, bytes: size,
        area: it.w * it.h,
        category: classify(it.w, it.h, size),
      });
      source.count++;
    }
  }
}

// ── 来源 2：官方 .bundle 动画包 ──────────────────────
function scanBundles() {
  const bases = [
    path.join(process.env.LOCALAPPDATA || '', 'SeerBattleSim', 'pet-animation-cache'),
  ];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    const files = fs.readdirSync(base).filter(f => f.endsWith('.bundle'));
    const source = { kind: 'bundle', dir: base, count: files.length };
    catalog.sources.push(source);
    for (const f of files) {
      const fp = path.join(base, f);
      const st = fs.statSync(fp);
      catalog.blocks.push({
        source: 'bundle', elf: '(bundle)', file: f, path: fp,
        w: 0, h: 0, frameIndex: -1, bytes: st.size, area: 0,
        category: 'bundle',
        note: '官方动画包，需 swf-bundle 解析',
      });
    }
  }
}

// ── 分类 ────────────────────────────────────────────
function classify(w, h, bytes) {
  const area = w * h;
  if (area >= 500 * 400) return 'fullscreen';   // 全屏爆炸
  if (area >= 200 * 200) return 'large';        // 大特效
  if (area >= 100 * 100) return 'medium';       // 中特效
  return 'small';                                // 小粒子
}

scanElfFx();
scanBundles();

// 统计
const stats = {};
for (const b of catalog.blocks) {
  stats[b.category] = (stats[b.category] || 0) + 1;
}
catalog.stats = stats;

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(catalog, null, 1));
console.log(`✅ ${OUT_JSON}  (${catalog.blocks.length} 个特效块)`);
console.log('   分类: ' + Object.entries(stats).map(([k,v]) => `${k}=${v}`).join('  '));

// Markdown 索引
const md = [];
md.push('# 特效庫索引');
md.push('');
md.push(`> 生成時間：${catalog.generatedAt}`);
md.push(`> 總計：**${catalog.blocks.length}** 個特效塊`);
md.push('');
md.push('## 分類統計');
md.push('');
md.push('| 分類 | 數量 | 用途 |');
md.push('|---|---:|---|');
const catDesc = { fullscreen: '全屏爆炸、大招', large: '大範圍特效', medium: '中等特效', small: '粒子、光點', bundle: '官方動畫包' };
for (const [k, v] of Object.entries(stats)) {
  md.push(`| ${k} | ${v} | ${catDesc[k] || ''} |`);
}
md.push('');
md.push('## 大特效（適合轟炸）');
md.push('');
md.push('| 精靈 | 文件 | 尺寸 | 幀 | 大小 |');
md.push('|---|---|---|---:|---:|');
for (const b of catalog.blocks.filter(x => x.category === 'fullscreen' || x.category === 'large').sort((a,b) => b.area - a.area)) {
  md.push(`| ${b.elf} | ${b.file} | ${b.w}×${b.h} | ${b.frameIndex} | ${(b.bytes/1024).toFixed(0)} KB |`);
}
md.push('');
md.push('## 全部特效塊');
md.push('');
md.push('| 精靈 | 文件 | 尺寸 | 幀 | 分類 |');
md.push('|---|---|---|---:|---|');
for (const b of catalog.blocks.sort((a,b) => a.elf.localeCompare(b.elf) || a.file.localeCompare(b.file))) {
  md.push(`| ${b.elf} | ${b.file} | ${b.w}×${b.h} | ${b.frameIndex} | ${b.category} |`);
}
fs.writeFileSync(OUT_MD, md.join('\n'));
console.log(`✅ ${OUT_MD}`);
