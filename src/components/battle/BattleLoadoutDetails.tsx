import React from 'react';
import { Flame, Glasses, Shield, Trophy } from 'lucide-react';
import { loadoutLabel, type Loadout } from '../../utils/destinyLoadout';
import { suitPortraitUrls } from '../../data/suitArt';
import { ChainImage } from '../SeerImages';
import { EffectDescription } from '../EffectDescription';

export type BattleLoadout = Partial<Record<keyof Loadout, string>>;

const entries = [
  ['suit', '套裝', Shield],
  ['eyewear', '目鏡', Glasses],
  ['title', '稱號', Trophy],
  ['flame', '戰鬥火焰', Flame],
] as const;

export function BattleLoadoutDetails({ loadout }: { loadout?: BattleLoadout }) {
  return <ul className="space-y-2">
    {entries.map(([key, category, Icon]) => {
      const id = loadout?.[key];
      const info = id ? loadoutLabel(key, id) : undefined;
      const emblem = <Icon aria-hidden="true" size={27} color={info?.color} />;
      return <li key={key} className="flex items-start gap-3 rounded-lg border border-slate-700 p-2.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded bg-slate-950 text-slate-300">
          {info && id && (key === 'suit' || key === 'eyewear')
            ? <ChainImage urls={suitPortraitUrls(id)} fallback={emblem} alt="" className="h-full w-full object-contain" />
            : emblem}
        </span>
        <div className="min-w-0">
          <div className="text-xs text-slate-400">{category}</div>
          <div className="font-bold">{info?.name ?? '未裝備'}</div>
          {info?.desc && <EffectDescription description={info.desc} className="text-sm text-slate-300" />}
        </div>
      </li>;
    })}
  </ul>;
}
