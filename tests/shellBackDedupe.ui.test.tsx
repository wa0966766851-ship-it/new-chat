import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

// Aegis 殼層返回與頁面內建返回不重複（2026-11-07）：有殼層返回時隱藏頁內「返回首頁／返回大廳／←」。
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement, IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
const { createRoot } = await import('react-dom/client');
const { ShellBackContext } = await import('../src/shell/shellBack');
const UpdatesPage = (await import('../src/components/UpdatesPage')).default;
const root = createRoot(document.getElementById('root')!);
const render = async (shell: boolean) => act(async () => root.render(React.createElement(ShellBackContext.Provider, { value: shell }, React.createElement(UpdatesPage, { elves: [], onBack: () => {}, onEditElf: () => {} }))));
const hasBack = () => [...document.querySelectorAll('button')].some(b => b.textContent?.trim() === '返回首頁');
await render(false); assert.ok(hasBack(), '沒有殼層返回時保留頁內返回');
await render(true); assert.ok(!hasBack(), '殼層已有返回時隱藏頁內返回');
await act(async () => root.unmount());

// 其餘頁面以原始碼確認接上 useShellBack（元件過大，不在此渲染）
for (const [file, marker] of [['src/components/ElfEditor.tsx', 'id="btn-editor-back"'], ['src/components/destiny/DestinyWheelClassic.tsx', '返回大廳'], ['src/components/destiny/DestinyWheelB/DestinyWheelB.tsx', 'data-testid="b-back"']] as const) {
  const src = readFileSync(file, 'utf8'); assert.ok(src.includes('useShellBack()'), `${file} 使用 useShellBack`);
  const at = src.indexOf(marker); assert.ok(at > 0 && src.lastIndexOf('!shellBack', at) > at - 400, `${file} 的返回鈕受 shellBack 控制`);
}
const shell = readFileSync('src/shell/AegisShell.tsx', 'utf8');
assert.match(shell, /<ShellBackContext\.Provider value=\{canGoBack\}>/); assert.match(shell, /useEdgeSwipeBack\(shellBack, canGoBack\)/);
assert.match(shell, /b\.view === "custom" && \(b\.editingElf \|\| b\.editorTab\)\) \{ b\.setEditingElf\(null\); b\.setEditorTab\(undefined\); return b\.setView\("bag"\)/, '編輯器的殼層返回＝原本頁內返回（回背包）');
console.log('殼層返回去重：更新頁實測、編輯器／命運之輪 A・B 受控、編輯器返回語意一致');
process.exit(0);
