import React from 'react';
import {registerFxHost,useFullscreenFxActive} from '../../battle/fullscreenFx';

/** 戰鬥畫面的層級（z-index）合約，tests/battleFxLayer.contract.test.ts 鎖定：
 *  對戰訊息 20 < 全屏演出層 24 < 出招／全屏期間的精靈 25 < 上方 HUD、下方指令列、飄字 30。
 *  全屏演出只蓋住背景、場地與訊息欄；HUD 與指令列永遠在最上方；整層 pointer-events:none。 */
export const BATTLE_LAYER_Z={log:20,fx:24,sprite:25,hud:30} as const;

/** 鋪滿整個戰鬥區域（掛在 data-battle-root 內、inset-0）的全屏演出層。
 * 本元件只提供 host 並廣播 active 狀態；實際的 WebGL 畫布由 PetActionSprite 在載入後掛進來
 *（避免把播放器相依套件拉進戰鬥主檔），沒有全屏序列播放時整層 visibility:hidden。 */
export function BattleFxLayer(){
 const ref=React.useRef<HTMLDivElement>(null);
 const active=useFullscreenFxActive();
 React.useEffect(()=>ref.current?registerFxHost(ref.current):undefined,[]);
 return <div ref={ref} aria-hidden="true" data-battle-fx-layer data-fx-active={active} className="absolute inset-0 overflow-hidden pointer-events-none" style={{zIndex:BATTLE_LAYER_Z.fx,visibility:active?'visible':'hidden'}}/>;
}
