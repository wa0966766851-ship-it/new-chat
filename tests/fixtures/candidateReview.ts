import {MaterialResolver,parseBundleInWorker,disposeSwfClipData} from '@seer-pet-anim/swf-bundle';
import {loadMaterialBundle} from '@seer-pet-anim/swf-bundle/parse';
import {SwfPlayer} from '@seer-pet-anim/swf-renderer';
import candidates from '../../docs/audits/2026-11-26-animation-candidates.json';
const material=await(await fetch('/api/pet-animations/bundle/materials')).arrayBuffer();
const resolver=new MaterialResolver();await loadMaterialBundle(material,resolver);
let player:SwfPlayer|undefined,previous:any;
(window as any).reviewCandidate=async(id:number,sequence='standby',frame=0)=>{
 player?.destroy();if(previous)disposeSwfClipData(previous);
 const row=candidates.find(c=>c.id===id);if(!row)throw Error('未在審查清單');
 const bytes=await(await fetch(`/candidate-bundles/${row.path}.bundle`)).arrayBuffer();
 const clip=await parseBundleInWorker(bytes,`${id}.pet`,resolver.snapshot());previous=clip;
 player=new SwfPlayer();await player.mount(document.querySelector('#pet')!,clip,{mode:'fit',transparent:true});
 player.setSequence(sequence);player.pause();player.gotoFrame(frame);player.draw();
 document.querySelector('#label')!.textContent=`${id} ${sequence} 原生朝向，無水平鏡射`;
 return {id,sequences:clip.sequences.map(s=>({name:s.name,frames:s.frames.length}))};
};
(window as any).reviewReady=true;
