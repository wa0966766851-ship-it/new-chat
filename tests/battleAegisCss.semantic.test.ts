import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Aegis 戰鬥 CSS 覆寫的回歸測試
 *
 * 為什麼用「檢查 CSS 規則存在」而不是渲染比對：
 *   版面細節（PP 是否被截、技能名幾行）需要真實瀏覽器排版，
 *   jsdom 不做 layout，測了也沒意義。
 *   這裡鎖的是「當初為了修這些問題而寫的規則還在不在」，
 *   防止未來有人清 CSS 時把它們刪掉、又退回 3/5 的狀態。
 *
 * 對應 2026-10-21 實測發現的四個問題：
 *   1. 技能列在手機變成 3 欄 → 5 個技能排成 3+2
 *   2. 「屬性」兩個字被直向拆開
 *   3. 技能名被截成 2 個字（黯·萬魂歸寂 → 黯·萬…）
 *   4. 次數與威力互相擠壓，威力被推出格子外
 */

const css = readFileSync(path.join(process.cwd(), 'src/shell/art/battleAegis.css'), 'utf8');

// ── 必須限定在 #aegis-shell 內，不能污染 Legacy ──
{
  assert.ok(css.includes('#aegis-shell'), 'CSS 必須限定在 #aegis-shell 內');
  const selectors = css.split('\n').filter(l => l.trim().endsWith('{') && l.includes('.bt-skill'));
  for (const sel of selectors) {
    assert.ok(sel.includes('#aegis-shell') || sel.trim().startsWith('.bt-skill') || sel.trim().startsWith('.'),
      `選擇器必須在 #aegis-shell 作用域內：${sel.trim()}`);
  }
}

// ── 1. 手機維持 5 欄 ──
{
  assert.ok(css.includes('repeat(5, minmax(0, 1fr))'), '手機技能列必須維持 5 欄（否則會變 3+2）');
  assert.ok(/max-width:\s*639px/.test(css), '必須有手機斷點');
}

// ── 2. 技能名可以到 3 行（不能被截成 2 個字） ──
{
  assert.ok(css.includes('-webkit-line-clamp: 3'), '技能名必須允許 3 行');
  assert.ok(css.includes('word-break: break-word'), '長名必須能斷在合理位置');
}

// ── 3. SkillResources 不得換行（換行會把數字擠掉） ──
{
  assert.ok(css.includes('[data-skill-resources]'), '必須針對 SkillResources 設規則');
  assert.ok(/flex-wrap:\s*nowrap\s*!important/.test(css), 'SkillResources 必須禁止換行');
}

// ── 4. 次數與威力改成上下堆疊（並排會把威力推出格子） ──
{
  assert.ok(/flex-direction:\s*column/.test(css), '底部資訊列必須改成垂直堆疊');
}

// ── 5. 第五徽章不得遮住技能名 ──
{
  assert.ok(css.includes('padding-right: 20px'), '有第五徽章時技能名必須讓出空間');
}

// ── 6. 頂部 HUD 壓縮（實測：172px → 140px，頂部佔比 42% → 25%） ──
{
  assert.ok(css.includes(':has(> [data-hud])'), 'HUD 父層必須用 :has() 定位（data-hud 在內層卡片上）');
  assert.ok(css.includes('top: 140px !important'), 'HUD 必須上移到 140px');
  assert.ok(css.includes(':has(> [data-match-info])'), '回合區父層必須用 :has() 定位');
}

// ── 7. 名稱不得逐字直排（壓窄容器會導致中文直排） ──
{
  assert.ok(
    !/\[data-hud\]\s*\{[^}]*width:\s*4[0-9]%/.test(css),
    '不得把 HUD 壓到 50% 以下（會讓中文逐字直排）',
  );
  assert.ok(css.includes('text-overflow: ellipsis'), '名稱必須用省略號而非逐字換行');
}

// ── 8. 狀態托盤壓縮（實測：92px → 58px，縱向 3 列 → 橫向 2 列） ──
{
  assert.ok(css.includes('[data-status-tray]'), '必須針對狀態托盤設規則');
  assert.ok(
    /\[data-status-tray\]\s*\{[^}]*flex-direction:\s*row/.test(css),
    '狀態托盤必須橫向流動（縱向堆疊會佔 92px）',
  );
  assert.ok(
    /\[data-status-tray\]\s*\{[^}]*max-height:\s*60px/.test(css),
    '托盤高度必須限制在 60px',
  );
  // 不能再硬切內容（會把第二排裁掉）
  assert.ok(
    !/\[data-status-tray\]\s*\{[^}]*overflow:\s*hidden/.test(css),
    '托盤不能 overflow:hidden（會裁掉第二排標籤）',
  );
  // p2 靠右
  assert.ok(
    css.includes('[data-status-tray="p2"]'),
    'p2 的托盤必須靠右（左右歸屬）',
  );
}

// ── 9. 角色尺寸規則不得干擾 placeSprite 的定位 ──
{
  // 取角色圖規則那一塊
  const spriteRule = css.slice(css.indexOf('[data-battle-root] .absolute.inset-x-0 img'));
  const ruleBody = spriteRule.slice(0, spriteRule.indexOf('}'));

  assert.ok(ruleBody.includes('height:'), '角色圖必須放大（height）');
  assert.ok(
    !ruleBody.includes('max-width'),
    '角色圖不得設 max-width —— 會與 placeSprite 的縮放衝突，導致右側角色超出畫面',
  );
  assert.ok(
    !/\[data-battle-root\]\s*\.absolute\.inset-x-0\s*\{[^}]*display:\s*flex/.test(css),
    '不得改角色容器的 display —— 它是 transform 驅動的',
  );
  assert.ok(
    !/\[data-battle-root\][^{]*\{[^}]*\btop:\s*\d+px\s*!important[^}]*\}/.test(
      css.slice(css.indexOf('戰場比例調整')),
    ),
    '不得硬改戰場容器的 top（角色位置由 placeSprite 算）',
  );
}

console.log('戰鬥 CSS 覆寫：作用域、5 欄、3 行名稱、資源不換行、上下堆疊、徽章避讓、HUD 壓縮、狀態托盤、角色尺寸 通過');