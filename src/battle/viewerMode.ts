import { createContext, useContext } from 'react';
import type { BattleViewMode } from './viewerPerspective';

/** 戰鬥畫面的可見性模式；預設 PVE，由戰鬥容器提供。 */
export const BattleViewModeContext = createContext<BattleViewMode>('PVE');
export const useBattleViewMode = () => useContext(BattleViewModeContext);
export const toViewMode = (mode?: string): BattleViewMode => mode === 'PVP' ? 'PVP' : 'PVE';
