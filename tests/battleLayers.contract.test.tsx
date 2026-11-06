import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BattleFxLayer} from '../src/components/battle/BattleFxLayer';
import {BATTLE_LAYERS as Z,BATTLE_MODAL_MIN_Z} from '../src/battle/battleLayers';
// 層級合約（2026-11-06）：全屏底片鋪滿整個戰鬥畫面（battle root 的 inset-0），且「所有資訊顯示與按鈕」都在底片之上、底片不攔截點擊。
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const ui=read('src/components/BattleScreen.ui.tsx'),sprite=read('src/components/battle/ProportionalSprite.tsx'),legacy=read('src/shell/LegacyShell.tsx'),aegis=read('src/shell/AegisShell.tsx'),hub=read('src/components/ControlHub.tsx'),layerSrc=read('src/components/battle/BattleFxLayer.tsx');
const valueOf=(token:string)=>{const m=/^Z\.(\w+)$/.exec(token);assert.ok(m&&m[1] in Z,`未知層級 ${token}`);return Z[m![1] as keyof typeof Z];};

// 1) 順序：FIELD < LOG < FX_BACKDROP < SPRITES < HUD < CONTROLS < POPUPS < 彈窗
assert.ok(Z.FIELD<Z.LOG&&Z.LOG<Z.FX_BACKDROP&&Z.FX_BACKDROP<Z.SPRITES&&Z.SPRITES<Z.HUD&&Z.HUD<Z.CONTROLS&&Z.CONTROLS<Z.POPUPS&&Z.POPUPS<BATTLE_MODAL_MIN_Z,'FIELD<LOG<FX_BACKDROP<SPRITES<HUD<CONTROLS<POPUPS<MODAL');

// 2) 底片層：battle root 直屬子層、inset-0 鋪滿、不裁在場地或精靈畫布內、不攔截點擊
const html=renderToStaticMarkup(<BattleFxLayer/>);
assert.match(html,/class="[^"]*\babsolute\b[^"]*\binset-0\b/,'absolute inset-0');
assert.match(html,/pointer-events-none/,'pointer-events none');
assert.doesNotMatch(html,/(width|height|top|left|right|bottom|margin|transform|inset)\s*:/,'沒有任何縮小／位移整層的內聯樣式');
assert.doesNotMatch(html,/\b(inset-x|inset-y|w-|h-|top-|left-|right-|bottom-|m[trblxy]?-|scale-|translate-)/,'class 不縮小／位移整層');
assert.match(html,new RegExp(`z-index:${Z.FX_BACKDROP}`));
assert.match(layerSrc,/BATTLE_LAYERS\.FX_BACKDROP/,'底片層 z 取自 battleLayers');
const rootTag=/<div ref=\{battleRootRef\} data-battle-root[^\n]*?className="([^"]*)"/.exec(ui);assert.ok(rootTag,'找不到 battle root');
assert.match(rootTag![1],/\bh-full\b/);assert.match(rootTag![1],/\bw-full\b/);assert.match(rootTag![1],/\brelative\b/,'battle root 是底片的定位基準');
assert.doesNotMatch(rootTag![1],/\bz-|isolate|\btransform\b|\bscale-/,'battle root 不自成 stacking context／縮放，底片與 HUD 在同一層級空間比較');
const indentOf=(needle:string)=>{const i=ui.indexOf(needle);assert.ok(i>0,needle);return /(^|\n)( *)[^\n]*$/.exec(ui.slice(0,i))![2].length;};
assert.equal(indentOf('<BattleFxLayer />'),indentOf('{renderFixedLayout()}'),'底片層與場地／HUD 圖層同為 battle root 的直屬子層（不在場地容器內）');
const field=/ref=\{fieldRef\} className="([^"]*)"/.exec(ui);assert.ok(field);assert.doesNotMatch(field![1],/\bz-|isolate/,'場地容器不設 z-index（否則精靈被關在底片之下）');
assert.doesNotMatch(/ref=\{fieldRef\}[^\n]*/.exec(ui)![0],/zIndex/,'場地容器沒有內聯 z-index');

// 3) 戰鬥畫面內的資訊與按鈕：每個元素的 z 都高於 FX_BACKDROP（取自 battleLayers 常數）
const inlineZ=(re:RegExp,label:string)=>{const m=re.exec(ui);assert.ok(m,`找不到 ${label}`);return {label,z:valueOf(m![1])};};
const inside=[
 inlineZ(/short:w-\[min\(300px,28%\)\] flex flex-col gap-1\.5 short:gap-1`\} style=\{\{ zIndex: (Z\.\w+) \}\}/,'上方雙方 HUD（名稱／體力／護盾／效果標籤列）'),
 inlineZ(/style=\{\{ zIndex: (Z\.\w+) \}\} className="absolute top-\[56px\] sm:top-2 left-1\/2/,'回合數／中央比分面板'),
 inlineZ(/style=\{\{ zIndex: (Z\.\w+) \}\} className="absolute inset-x-2 sm:inset-x-3 bottom-2 pointer-events-auto"/,'下方指令列（技能／分頁／速度／托管／撤退）'),
 inlineZ(/style=\{\{ zIndex: (Z\.\w+) \}\}\s*className=\{`absolute bottom-\[30%\]/,'飄字（場地尚未量測的退路）'),
];
const popups=[...ui.matchAll(/<AnchoredToVisible[^>]*? z=\{(Z\.\w+)\}/g)];assert.equal(popups.length,2,'飄字與技能名橫幅都帶 z');
for(const m of popups)inside.push({label:'飄字／技能名橫幅',z:valueOf(m[1])});
for(const e of inside)assert.ok(e.z>Z.FX_BACKDROP,`${e.label} 的 z(${e.z}) 必須高於 FX_BACKDROP(${Z.FX_BACKDROP})`);
assert.ok(sprite.includes('z?: number')&&/style=\{\{ bottom: fallbackBottom, zIndex: z \}\}/.test(sprite),'AnchoredToVisible 把 z 套到元素上');
// 戰鬥內所有 fixed 彈窗／阻擋層：z 不低於 MODAL_MIN，一定在底片之上
const fixedZ=[...ui.matchAll(/className="[^"]*\bfixed\b[^"]*\bz-\[(\d+)\]/g)].map(m=>Number(m[1])).concat([...ui.matchAll(/position: 'fixed',[\s\S]{0,200}?zIndex: (\d+)/g)].map(m=>Number(m[1])));
assert.ok(fixedZ.length>=4,'找到所有 fixed 彈窗');assert.ok(fixedZ.every(n=>n>=BATTLE_MODAL_MIN_Z&&n>Z.FX_BACKDROP),`fixed 彈窗 z ≥ ${BATTLE_MODAL_MIN_Z}`);
// 沒有任何殘留的寫死 z-N class 落在 24 以上而不經常數（一般 z-N 只允許是卡片內部堆疊）
assert.ok([...ui.matchAll(/(?<![\w-])z-(\d+)(?![\w-])/g)].every(m=>Number(m[1])<=10),'BattleScreen.ui 內剩下的 z-N class 都是卡片內部小層級（≤10）');

// 4) 戰鬥畫面外（殼層）的按鈕：battle root 被關在殼的內容容器 stacking context 內，外面的按鈕 z 必須高於該容器
const ctx=(src:string,re:RegExp,label:string)=>{const m=re.exec(src);assert.ok(m,`找不到 ${label}`);return Number(m![1]);};
const legacyContent=ctx(legacy,/className="flex-grow flex flex-col h-full overflow-hidden relative z-\[(\d+)\]"/,'Legacy 內容容器'),aegisContent=ctx(aegis,/className="flex-1 min-h-0 flex relative z-(\d+)"/,'Aegis 內容容器');
const outside=[
 {label:'右上：靜音／控制中心（ControlHub）',z:ctx(hub,/className="fixed top-2\.5 right-6 sm:right-8 z-\[(\d+)\]/,'ControlHub')},
 {label:'左上：展開側邊欄選單鈕（Legacy）',z:ctx(legacy,/className="fixed top-4 left-0 z-\[(\d+)\]/,'選單鈕')},
 {label:'Legacy 側邊欄（compact）',z:ctx(legacy,/isCompactLayout \? "fixed inset-y-0 left-0 z-\[(\d+)\]"/,'側邊欄')},
 {label:'殼切換鈕（右下，portal）',z:ctx(legacy,/zIndex: (\d+) \}\}\s+className="flex items-center gap-2 px-3 py-2\.5/,'殼切換鈕')},
];
for(const e of outside){assert.ok(e.z>legacyContent,`${e.label} z(${e.z}) > Legacy 內容容器(${legacyContent})`);}
for(const e of outside.filter(e=>!/側邊欄|選單鈕/.test(e.label)))assert.ok(e.z>aegisContent,`${e.label} z(${e.z}) > Aegis 內容容器(${aegisContent})`);
// 兩個殼的戰鬥內容容器本身都低於這些外部按鈕；而底片層的 z 只在容器內比較，不會蓋過它們
assert.ok(Z.CONTROLS<BATTLE_MODAL_MIN_Z);
console.log('battleLayers 合約：底片鋪滿 battle root、HUD／回合面板／指令列／飄字／彈窗與殼層按鈕皆高於 FX_BACKDROP 通過');
