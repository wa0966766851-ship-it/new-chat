import type {SwfPlayer} from '@seer-pet-anim/swf-renderer';
import type {SwfClipData} from '@seer-pet-anim/swf-bundle';
import {yieldPetTask} from './preparationScheduler';
/** 原始像素分塊，不縮圖。避免 8192² 單次 texImage2D 長時間佔住 UI。 */
export const PET_UPLOAD_TILE_SIZE=4096;
export async function warmPetTextures(player:unknown,signal?:AbortSignal){
 // swf-renderer 尚無分批上傳 API；private 欄位只集中在此相容層。缺欄位時保留套件原有載入。
 const p=player as {app?:{renderer?:{texture?:{initSource?:(source:unknown)=>void}}};atlasLayout?:{tiles:{texture:{source:unknown}}[]}};
 const manager=p.app?.renderer?.texture,tiles=p.atlasLayout?.tiles;
 if(!manager?.initSource||!tiles)return;
 for(const tile of tiles){signal?.throwIfAborted();await yieldPetTask();signal?.throwIfAborted();manager.initSource(tile.texture.source);}
}
/** GPU 建立與上傳依序進行；已取消的皮膚不再建立畫布，所有位圖仍由原有生命週期釋放。 */
let mounting:Promise<unknown>=Promise.resolve();
export function mountPetPlayer(player:SwfPlayer,host:HTMLElement,clip:SwfClipData,signal?:AbortSignal){
 const task=mounting.then(async()=>{signal?.throwIfAborted();await yieldPetTask();signal?.throwIfAborted();
  await player.mount(host,clip,{transparent:true,mode:'fixed',clock:'manual',signal,...(Math.max(clip.atlasWidth,clip.atlasHeight)>=8192?{maxTextureSize:PET_UPLOAD_TILE_SIZE}:{})});
  await warmPetTextures(player,signal);
 });
 mounting=task.catch(()=>{});return task;
}
