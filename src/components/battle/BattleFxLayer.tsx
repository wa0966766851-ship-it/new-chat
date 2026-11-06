import React from 'react';
import {registerFxHost,useFullscreenFxActive} from '../../battle/fullscreenFx';
import {BATTLE_LAYERS} from '../../battle/battleLayers';

/** 鋪滿整個戰鬥畫面（data-battle-root 的 inset-0，含上方 HUD、中央訊息欄、兩側標籤列與下方指令列底下）的全屏演出層。
 * 本元件只提供 host 並廣播 active 狀態；實際的 WebGL 畫布由 PetActionSprite 在載入後掛進來
 *（避免把播放器相依套件拉進戰鬥主檔），沒有全屏序列播放時整層 visibility:hidden。 */
export function BattleFxLayer(){
 const ref=React.useRef<HTMLDivElement>(null);
 const active=useFullscreenFxActive();
 React.useEffect(()=>ref.current?registerFxHost(ref.current):undefined,[]);
 return <div ref={ref} aria-hidden="true" data-battle-fx-layer data-fx-active={active} className="absolute inset-0 overflow-hidden pointer-events-none" style={{zIndex:BATTLE_LAYERS.FX_BACKDROP,visibility:active?'visible':'hidden'}}/>;
}
