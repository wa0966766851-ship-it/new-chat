import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BattleFxLayer,BATTLE_LAYER_Z} from '../src/components/battle/BattleFxLayer';
// 層級合約：對戰訊息 < 全屏演出層 < 出招精靈 < HUD／指令列；HUD 與指令列永遠最上，全屏層不攔截點擊、鋪滿整個戰鬥區。
const ui=readFileSync(new URL('../src/components/BattleScreen.ui.tsx',import.meta.url),'utf8');
const sprite=readFileSync(new URL('../src/components/battle/ProportionalSprite.tsx',import.meta.url),'utf8');
const z=BATTLE_LAYER_Z;
assert.ok(z.log<z.fx&&z.fx<z.sprite&&z.sprite<z.hud,'20 < 24 < 25 < 30');
// 實際 class 與常數一致（避免只改常數不改畫面）
const classZ=(re:RegExp,label:string)=>{const m=re.exec(ui);assert.ok(m,`找不到 ${label}`);return Number(m![1]);};
assert.equal(classZ(/absolute z-(\d+) left-1\/2 -translate-x-1\/2 w-\[94%\]/,'對戰訊息欄'),z.log,'對戰訊息欄 z-20');
assert.equal(classZ(/ref=\{el => \{ hudRefs\.current\[side\] = el; \}\}[^\n]*? z-(\d+) flex flex-col/,'上方 HUD'),z.hud,'上方 HUD z-30');
assert.equal(classZ(/absolute inset-x-2 sm:inset-x-3 bottom-2 z-(\d+) pointer-events-auto/,'下方指令列'),z.hud,'下方指令列 z-30');
assert.match(sprite,/zIndex:fxActive\|\|\(showActions&&action!=='standby'\)\?25:undefined/,'全屏期間所有精靈（含被打的一側）提到全屏層之上；平時只有出招者 25');
assert.equal(z.sprite,25);
// 所有 z-index：沒有任何一層（除全域載入阻擋 fixed z-[100]／彈窗）高於 HUD／指令列，指令列與 HUD 不被全屏層蓋住。
const zs=[...ui.matchAll(/(?<![\w-])z-(\d+)(?![\w-])/g)].map(m=>Number(m[1]));
assert.ok(zs.every(n=>n<=z.hud),'BattleScreen.ui 內一般 z-N 皆不高於 HUD／指令列 (30)');
// 掛載位置：在 data-battle-root 內、場地之後，且只掛一次。
assert.equal([...ui.matchAll(/<BattleFxLayer\s*\/>/g)].length,1,'只掛一個全屏演出層');
assert.ok(ui.indexOf('<BattleFxLayer')>ui.indexOf('{renderFixedLayout()}')&&ui.indexOf('<BattleFxLayer')<ui.indexOf('{/* Trait / Soul Mark Modal */}'),'掛在 battle root 內、場地之後');
assert.ok(ui.indexOf('data-battle-root')<ui.indexOf('<BattleFxLayer'),'位於 battle root 之內');
// 渲染結果：鋪滿、不攔截點擊、z-index 取常數；沒有全屏序列時隱藏。
const html=renderToStaticMarkup(<BattleFxLayer/>);
assert.match(html,/data-battle-fx-layer/);assert.match(html,/class="[^"]*\babsolute\b[^"]*\binset-0\b/,'inset-0 鋪滿 battle root');
assert.match(html,/pointer-events-none/,'不攔截點擊');
assert.match(html,new RegExp(`z-index:${z.fx}`));assert.match(html,/visibility:hidden/,'沒有全屏序列時整層隱藏');
assert.match(html,/aria-hidden="true"/);
console.log('BattleFxLayer 層級合約（訊息 20 < 全屏 24 < 精靈 25 < HUD／指令列 30）、鋪滿、不攔截點擊通過');
