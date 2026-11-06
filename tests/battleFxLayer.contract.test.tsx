import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BattleFxLayer} from '../src/components/battle/BattleFxLayer';
import {BATTLE_LAYERS} from '../src/battle/battleLayers';
// 層級合約：對戰訊息 < 全屏演出層 < 精靈 < HUD < 指令列 < 飄字；HUD 與指令列永遠在全屏層之上，全屏層不攔截點擊、鋪滿整個戰鬥區。
const ui=readFileSync(new URL('../src/components/BattleScreen.ui.tsx',import.meta.url),'utf8');
const sprite=readFileSync(new URL('../src/components/battle/ProportionalSprite.tsx',import.meta.url),'utf8');
const z=BATTLE_LAYERS;
assert.ok(z.LOG<z.FX_BACKDROP&&z.FX_BACKDROP<z.SPRITES&&z.SPRITES<z.HUD&&z.HUD<z.CONTROLS&&z.CONTROLS<z.POPUPS,'LOG < FX_BACKDROP < SPRITES < HUD < CONTROLS < POPUPS');
// 實際元素與常數一致（避免只改常數不改畫面）：這些元素的 z 一律取自 battleLayers，不再寫死 z-N class。
const inlineZ=(re:RegExp,label:string,expected:string)=>{const m=re.exec(ui);assert.ok(m,`找不到 ${label}`);assert.equal(m![1],expected,`${label} 取 Z.${expected.replace('Z.','')}`);};
inlineZ(/style=\{\{ zIndex: (Z\.\w+) \}\} className="absolute left-1\/2 -translate-x-1\/2 w-\[94%\]/,'對戰訊息欄','Z.LOG');
inlineZ(/short:w-\[min\(300px,28%\)\] flex flex-col gap-1\.5 short:gap-1`\} style=\{\{ zIndex: (Z\.\w+) \}\}/,'上方 HUD','Z.HUD');
inlineZ(/style=\{\{ zIndex: (Z\.\w+) \}\} className="absolute inset-x-2 sm:inset-x-3 bottom-2 pointer-events-auto"/,'下方指令列','Z.CONTROLS');
assert.match(sprite,/zIndex:fxActive\|\|\(showActions&&action!=='standby'\)\?BATTLE_LAYERS\.SPRITES:undefined/,'全屏期間所有精靈（含被打的一側）提到全屏層之上；平時只有出招者 SPRITES');
assert.equal(z.SPRITES,25);
// 所有 z-index：沒有任何一層（除全域載入阻擋 fixed z-[100]／彈窗）高於 HUD／指令列，指令列與 HUD 不被全屏層蓋住。
const zs=[...ui.matchAll(/(?<![\w-])z-(\d+)(?![\w-])/g)].map(m=>Number(m[1]));
assert.ok(zs.every(n=>n<=z.HUD),'BattleScreen.ui 內剩餘的 z-N class（卡片內部堆疊）不高於 HUD');
// 掛載位置：在 data-battle-root 內、場地之後，且只掛一次。
assert.equal([...ui.matchAll(/<BattleFxLayer\s*\/>/g)].length,1,'只掛一個全屏演出層');
assert.ok(ui.indexOf('<BattleFxLayer')>ui.indexOf('{renderFixedLayout()}')&&ui.indexOf('<BattleFxLayer')<ui.indexOf('{/* Trait / Soul Mark Modal */}'),'掛在 battle root 內、場地之後');
assert.ok(ui.indexOf('data-battle-root')<ui.indexOf('<BattleFxLayer'),'位於 battle root 之內');
// 渲染結果：鋪滿、不攔截點擊、z-index 取常數；沒有全屏序列時隱藏。
const html=renderToStaticMarkup(<BattleFxLayer/>);
assert.match(html,/data-battle-fx-layer/);assert.match(html,/class="[^"]*\babsolute\b[^"]*\binset-0\b/,'inset-0 鋪滿 battle root');
assert.match(html,/pointer-events-none/,'不攔截點擊');
assert.match(html,new RegExp(`z-index:${z.FX_BACKDROP}`));assert.match(html,/visibility:hidden/,'沒有全屏序列時整層隱藏');
assert.match(html,/aria-hidden="true"/);
console.log('BattleFxLayer 層級合約（LOG < FX_BACKDROP < SPRITES < HUD < CONTROLS < POPUPS）、鋪滿、不攔截點擊通過');
