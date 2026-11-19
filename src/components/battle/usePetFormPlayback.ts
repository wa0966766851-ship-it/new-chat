import React from 'react';
import type { Elf } from '../../types';
import { battleFormAssets, playsFormTransform, settledFormAsset } from '../../battle/battleFormPresentation';
import type { PetAnimationAssetId } from '../../battle/petAnimationAssets';
import type { PetAction } from '../../battle/petAnimationRegistry';
import { beginPetFormTransition } from '../../battle/petFormTransitions';

type Asset = PetAnimationAssetId;
type SlotState = 'ready' | 'failed';
type Transition = {from: Asset; to: Asset; finish: () => void};

/** 同一隻在場精靈最多保留一組型態播放器。先讓目前外觀就緒，再準備另一個。 */
export function usePetFormPlayback(elf: Elf, side: 'p1'|'p2', requested: Asset|null,
  action: PetAction, enabled: boolean) {
  const forms = battleFormAssets(elf);
  const identity = `${elf.battleId || elf.id}:${elf.name}:${elf.skinId || ''}`;
  const slotKey = (asset: Asset) => `${identity}:${asset}`;
  const [selected,setSelected] = React.useState<{identity:string;asset:Asset|null}>({identity,asset:requested});
  const [slots,setSlots] = React.useState<Record<string,SlotState>>({});
  const [pending,setPending] = React.useState<Transition>();
  React.useEffect(()=>setSelected(old=>old.identity===identity?old:{identity,asset:requested}),[identity]);
  const active = selected.identity===identity && selected.asset && forms.includes(selected.asset) ? selected.asset : requested;
  const currentReady = !!active && slots[slotKey(active)]==='ready';
  const targetReady = !!requested && slots[slotKey(requested)]==='ready';
  const assets = enabled && active ? currentReady && forms.length ? forms : [active] : [];
  const report = (asset: Asset, state?: SlotState) => {
    const key = slotKey(asset);
    setSlots(old => {
      if (old[key]===state) return old;
      const next = {...old};
      if (state) next[key]=state;
      else delete next[key];
      return next;
    });
  };

  React.useEffect(() => {
    if (!enabled || !active || !requested || settledFormAsset(active,requested,action)===active || !targetReady) return;
    const commit = () => {setSelected({identity,asset:requested});setPending(undefined);};
    if (!currentReady || !playsFormTransform(active,requested)) {
      commit();
      return;
    }

    const release = beginPetFormTransition(side,elf);
    let alive = true;
    const finish = () => {if (alive) commit();};
    const watchdog = setTimeout(finish,5500);
    setPending({from:active,to:requested,finish});
    return () => {alive=false;clearTimeout(watchdog);release();};
  },[enabled,active,requested,action,targetReady,currentReady,identity,side]);

  const transition = action==='standby' && pending?.from===active && pending.to===requested ? pending : undefined;
  return {active,assets,currentReady,transition,slotKey,report,
    formsReady: forms.every(asset=>slots[slotKey(asset)]==='ready'),
    preparing: forms.some(asset=>!slots[slotKey(asset)])};
}
