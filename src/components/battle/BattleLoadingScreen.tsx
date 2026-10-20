import React from 'react';
import type { Elf } from '../../types';
import { formatLabel } from '../../battle/introPlan';
import { BattleIntro } from './BattleIntro';

const starter = (team: Elf[], id: string) => team.find(e => e.battleId === id || e.id === id) || team[0];

/** 與正式入戰動畫共用立繪、朝向與隱匿規則；由 Suspense 決定結束，沒有假進度。 */
export function BattleLoadingScreen({ p1Team, p2Team, p1StarterId, p2StarterId, format }: {
  p1Team: Elf[]; p2Team: Elf[]; p1StarterId: string; p2StarterId: string; format?: string;
}) {
  const p1 = starter(p1Team, p1StarterId), p2 = starter(p2Team, p2StarterId);
  if (!p1 || !p2) return null;
  return <BattleIntro p1={p1} p2={p2} format={formatLabel(format)} loading
    plan={{ play: false, ms: 0, variant: 'reduced' }} onDone={() => {}} />;
}
