import React, { useState } from 'react';
export interface EnvScene { src: string; name: string; tone: string; portraitFocus?: string; }
export const ENV_SCENES: EnvScene[] = [
  { src: '/aegis/env_hangar.png', name: '軌道機庫', tone: '#38BDF8' },
  { src: '/env_ruins.png', name: '廢墟都市', tone: '#60A5FA' },
  { src: '/aegis/env_temple.png', name: '遺跡神殿', tone: '#A5B4FC' },
];
export interface BackdropProps { image?: string | null; heroArt?: string | null; desaturate?: number; sceneOpacity?: number; }
/** 圖片用 img 的真實錯誤事件備援；不以日期輪替，不拿角色立繪充當環境。 */
export function AegisBackdrop({ image, heroArt, desaturate = .15, sceneOpacity = 1 }: BackdropProps) {
  const [failed, setFailed] = useState<string[]>([]);
  const candidates = image === null ? [] : [...new Set([image ?? ENV_SCENES[0].src, ...ENV_SCENES.map(s => s.src)])];
  const src = candidates.find(s => !failed.includes(s));
  return <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0, background: '#0b1722' }}>
    {src && <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: 'center 45%', opacity: sceneOpacity, filter: `saturate(${1-desaturate})` }} onError={() => setFailed(old => [...old, src])} />}
    {heroArt && <img src={heroArt} alt="" className="absolute right-0 bottom-0 w-3/5 h-5/6 object-contain" />}
    <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg,rgba(5,14,22,.12) 25%,rgba(5,14,22,.42) 66%,rgba(5,14,22,.72)),linear-gradient(0deg,rgba(5,14,22,.72),transparent 40%,rgba(5,14,22,.15))' }} />
  </div>;
}
