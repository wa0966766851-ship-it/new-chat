import type {SwfClipData} from '@seer-pet-anim/swf-bundle';
import {bodyTiles,nativeBodyBounds,nativeRestBounds,type NativeBounds} from '../petAnimationGeometry';
import {finishPetPreparation} from './preparationScheduler';
export type PetPreparedGeometry={rest:NativeBounds|null;bounds:Map<string,(NativeBounds|null)[]>};
const cache=new WeakMap<SwfClipData,PetPreparedGeometry>();
function* build(clip:SwfClipData):Generator<void,PetPreparedGeometry>{
 const standby=clip.sequences.find(s=>s.name==='standby')?.frames||[],tiles=new Set<string>();
 for(const frame of standby){for(const key of bodyTiles([frame.mesh]))tiles.add(key);yield;}
 const bounds:PetPreparedGeometry['bounds']=new Map();
 for(const seq of clip.sequences){const frames:(NativeBounds|null)[]=[];for(const f of seq.frames){frames.push(nativeBodyBounds(f.mesh,tiles)??nativeBodyBounds(f.mesh));yield;}bounds.set(seq.name,frames);}
 return {rest:nativeRestBounds(standby.map(f=>f.mesh)),bounds};
}
/** 每份解碼結果只掃一次全部影格；弱參照快取隨圖集釋放。 */
export async function preparePetGeometry(clip:SwfClipData,signal?:AbortSignal){signal?.throwIfAborted();const hit=cache.get(clip);if(hit)return hit;const result=await finishPetPreparation(build(clip),signal);cache.set(clip,result);return result;}
export function sharePetGeometry(source:SwfClipData,target:SwfClipData){const hit=cache.get(source);if(hit)cache.set(target,hit);}
