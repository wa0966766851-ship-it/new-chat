import type {SwfClipData,SwfFrameMesh,SwfSubMesh} from '@seer-pet-anim/swf-bundle';
import type {PetFullscreenConfig} from './petAnimationAssets';
import type {NativeBounds} from './petAnimationGeometry';

/** B 方案（保守版）：只略過「寬度接近整個戰場（≥3 倍待機高）、且又高又厚」的 add 圖塊——也就是真正的全屏底片。
 * 門檻必須遠大於一般光效：實測 22 隻素材中沒有任何合法特效達到 3 倍待機高，所以正常情況下一層都不會被略過。
 * 以待機高度為尺度，不因視窗或 P1/P2 鏡射改變結果。狹長落雷/光束保留。
 * 不處理遮罩群組、不改 normal、不改待機；這只是顯示策略，不判定素材有錯。
 * 2026-11-01：被判定為全屏底片的圖塊不再「丟掉」——戰鬥小畫布（clip）仍不畫它們，
 * 但會收進 fxClip（只含這些圖塊、影格/序列與 clip 一一對齊），由 BattleFxLayer 的全屏畫布播放。
 * 哪些序列走全屏層：素材未登記 fullscreen.sequences 時自動偵測（有圖塊被判定為底片的序列），登記後以登記為準。
 */
export const LARGE_ADD_POLICY={minWidth:3,minHeight:1.5,minArea:5} as const;
const cache=new WeakMap<SwfClipData,Map<string,PreparedPetFx>>();
export interface PreparedPetFx{
 /** 戰鬥小畫布用：全屏底片圖塊已移除（與舊行為相同）。 */
 clip:SwfClipData;
 /** 全屏層用：只含底片圖塊；沒有任何序列需要全屏層時為 null。序列／影格數與 clip 相同，可同步播放。 */
 fxClip:SwfClipData|null;
 report:ReturnType<typeof makeReport>;
}
type Quad={sequence:string;width:number;height:number};
function quadBounds(mesh:SwfFrameMesh,start:number){
 let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
 for(let v=start;v<start+4;v++){const x=mesh.positions[v*2],y=mesh.positions[v*2+1];left=Math.min(left,x);right=Math.max(right,x);bottom=Math.min(bottom,y);top=Math.max(top,y);}
 return {left,right,bottom,top,width:right-left,height:top-bottom};
}
export function isLargeAddQuad(width:number,height:number,restHeight:number){
 const p=LARGE_ADD_POLICY;
 return Number.isFinite(width+height+restHeight)&&restHeight>0&&width>=restHeight*p.minWidth&&height>=restHeight*p.minHeight&&width*height>=restHeight*restHeight*p.minArea;
}
const round=(n:number)=>Math.round(n*100)/100;
const dedupe=(list:Quad[])=>{const seen=new Map<string,{sequence:string;count:number;maxWidth:number;maxHeight:number}>();
 for(const q of list){const key=q.sequence+'|'+q.width+'x'+q.height;const hit=seen.get(key);if(hit)hit.count++;else seen.set(key,{sequence:q.sequence,count:1,maxWidth:q.width,maxHeight:q.height});}
 return [...seen.values()];};
function makeReport(restHeight:number,counts:{removedQuads:number;keptAddQuads:number;normalRemoved:number},removed:Quad[],pending:Quad[],fullscreen:{sequences:string[];mode:'auto'|'explicit'},backdropBounds:Record<string,NativeBounds>,backdropFrames:Record<string,(NativeBounds|null)[]>){
 return {restHeight,...counts,policy:LARGE_ADD_POLICY,removed:dedupe(removed),pending:dedupe(pending),fullscreen,backdropBounds,backdropFrames};
}
const range=(sm:SwfSubMesh,from:number,to:number):SwfSubMesh=>({...sm,startVertex:sm.startVertex+from*4,indexStart:sm.indexStart+from*6,indexCount:(to-from)*6});
function prepare(source:SwfClipData,config?:PetFullscreenConfig):PreparedPetFx{
 let low=Infinity,high=-Infinity;
 for(const f of source.sequences.find(s=>s.name==='standby')?.frames??[])for(let i=1;i<f.mesh.positions.length;i+=2){low=Math.min(low,f.mesh.positions[i]);high=Math.max(high,f.mesh.positions[i]);}
 const restHeight=high-low;
 let removedQuads=0,keptAddQuads=0,normalRemoved=0;
 const removed:Quad[]=[],pending:Quad[]=[];
 const removedBySequence=new Map<string,number>(),bounds:Record<string,NativeBounds>={};
 /** 每影格同時產出：小畫布用的 keep 與全屏層用的 fx（被判定為底片的圖塊）。 */
 const frameBoxesBySequence=new Map<string,(NativeBounds|null)[]>();
 const fxFramesBySequence=new Map<string,ReturnType<typeof scanFrame>['fx'][]>();
 function scanFrame(seqName:string,frame:SwfClipData['sequences'][number]['frames'][number]){
  let masked=false,changed=false,frameBox:NativeBounds|null=null;
  const keep:SwfSubMesh[]=[],fx:SwfSubMesh[]=[];
  for(const sm of frame.mesh.subMeshes){
   const kind=sm.material.shaderKind;
   if(kind==='incrMask')masked=true;
   const blend=sm.material.blendMode;
   if(masked||kind!=='simple'||(blend!=='add'&&blend!=='normal')||sm.indexCount%6!==0){keep.push(sm);if(kind==='decrMask')masked=false;continue;}
   let run=-1,fxRun=-1;
   const count=sm.indexCount/6;
   const flushKeep=(end:number)=>{if(run>=0){keep.push(range(sm,run,end));run=-1;}};
   const flushFx=(end:number)=>{if(fxRun>=0){fx.push(range(sm,fxRun,end));fxRun=-1;}};
   for(let q=0;q<count;q++){
    const box=quadBounds(frame.mesh,sm.startVertex+q*4);
    const asQuad=(seq:string):Quad=>({sequence:seq,width:round(box.width/restHeight),height:round(box.height/restHeight)});
    if(isLargeAddQuad(box.width,box.height,restHeight)){
     // add：全屏底片；normal：橫跨整個戰場的大矩形只有背景片會這樣，本體與特效都遠小於門檻。
     flushKeep(q);if(fxRun<0)fxRun=q;removedQuads++;removed.push(asQuad(seqName));changed=true;normalRemoved+=blend==='normal'?1:0;
     frameBox=frameBox?{left:Math.min(frameBox.left,box.left),right:Math.max(frameBox.right,box.right),top:Math.min(frameBox.top,box.bottom),bottom:Math.max(frameBox.bottom,box.top)}:{left:box.left,right:box.right,top:box.bottom,bottom:box.top};
     removedBySequence.set(seqName,(removedBySequence.get(seqName)||0)+1);
     const b=bounds[seqName];
     bounds[seqName]=b?{left:Math.min(b.left,box.left),right:Math.max(b.right,box.right),top:Math.min(b.top,box.bottom),bottom:Math.max(b.bottom,box.top)}:{left:box.left,right:box.right,top:box.bottom,bottom:box.top};}
    else {flushFx(q);keptAddQuads++;if(run<0)run=q;
      // 單邊很大、另一邊不足門檻：保守保留（可能是落雷／光束），標記待確認。
      if(box.width>=restHeight*1.5||box.height>=restHeight*1) pending.push(asQuad(seqName));}
   }
   flushKeep(count);flushFx(count);
  }
  return {frame:changed?{...frame,mesh:{...frame.mesh,subMeshes:keep}}:frame,fx:{...frame,mesh:{...frame.mesh,subMeshes:fx}},box:frameBox};
 }
 const sequences=source.sequences.map(seq=>{
  if(seq.name==='standby')return seq;
  const scanned=seq.frames.map(frame=>scanFrame(seq.name,frame));
  fxFramesBySequence.set(seq.name,scanned.map(s=>s.fx));
  frameBoxesBySequence.set(seq.name,scanned.map(s=>s.box));
  return {...seq,frames:scanned.map(s=>s.frame)};
 });
 // 哪些序列走全屏層：明確登記優先；否則「有底片圖塊被判定」的序列自動納入。
 const explicit=config?.sequences;
 const flagged=(explicit?explicit.filter(name=>fxFramesBySequence.has(name)):[...removedBySequence.keys()]);
 const hasBackdrop=flagged.some(name=>(removedBySequence.get(name)||0)>0);
 const flaggedSet=new Set(flagged);
 const fxClip=hasBackdrop?{...source,sequences:source.sequences.map(seq=>{
  const frames=fxFramesBySequence.get(seq.name);
  return {...seq,frames:seq.frames.map((frame,i)=>flaggedSet.has(seq.name)&&frames?frames[i]:{...frame,mesh:{...frame.mesh,subMeshes:[]}})};
 })} as SwfClipData:null;
 const flaggedBounds:Record<string,NativeBounds>={},flaggedFrames:Record<string,(NativeBounds|null)[]>={};for(const name of flagged){if(bounds[name])flaggedBounds[name]=bounds[name];const fb=frameBoxesBySequence.get(name);if(fb)flaggedFrames[name]=fb;}
 return {clip:{...source,sequences},fxClip,report:makeReport(restHeight,{removedQuads,keptAddQuads,normalRemoved},removed,pending,{sequences:hasBackdrop?flagged:[],mode:explicit?'explicit':'auto'},flaggedBounds,flaggedFrames)};
}
/** CPU 圖集與頂點共用，只建立新的 draw ranges；不修改共享 clip，P1/P2 可各自使用。
 * fullscreen 為素材的逐隻覆寫（PET_ANIMATION_ASSETS[*].fullscreen）；同一 clip 不同設定各自快取。 */
export function preparePetFx(source:SwfClipData,fullscreen?:PetFullscreenConfig):PreparedPetFx{
 let byConfig=cache.get(source);if(!byConfig){byConfig=new Map();cache.set(source,byConfig);}
 const key=fullscreen?.sequences?fullscreen.sequences.join('|')+'#':'auto';
 let result=byConfig.get(key);if(!result){result=prepare(source,fullscreen);byConfig.set(key,result);}
 return result;
}
