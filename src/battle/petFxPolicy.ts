import type {SwfClipData,SwfFrameMesh,SwfSubMesh} from '@seer-pet-anim/swf-bundle';

/** B 方案（保守版）：只略過「寬度接近整個戰場（≥3 倍待機高）、且又高又厚」的 add 圖塊——也就是真正的全屏底片。
 * 門檻必須遠大於一般光效：實測 22 隻素材中沒有任何合法特效達到 3 倍待機高，所以正常情況下一層都不會被略過。
 * 以待機高度為尺度，不因視窗或 P1/P2 鏡射改變結果。狹長落雷/光束保留。
 * 不處理遮罩群組、不改 normal、不改待機；這只是顯示策略，不判定素材有錯。
 */
export const LARGE_ADD_POLICY={minWidth:3,minHeight:1.5,minArea:5} as const;
const cache=new WeakMap<SwfClipData,ReturnType<typeof prepare>>();
function quadBounds(mesh:SwfFrameMesh,start:number){
 let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
 for(let v=start;v<start+4;v++){const x=mesh.positions[v*2],y=mesh.positions[v*2+1];left=Math.min(left,x);right=Math.max(right,x);bottom=Math.min(bottom,y);top=Math.max(top,y);}
 return {width:right-left,height:top-bottom};
}
export function isLargeAddQuad(width:number,height:number,restHeight:number){
 const p=LARGE_ADD_POLICY;
 return Number.isFinite(width+height+restHeight)&&restHeight>0&&width>=restHeight*p.minWidth&&height>=restHeight*p.minHeight&&width*height>=restHeight*restHeight*p.minArea;
}
function prepare(source:SwfClipData){
 let low=Infinity,high=-Infinity;
 for(const f of source.sequences.find(s=>s.name==='standby')?.frames??[])for(let i=1;i<f.mesh.positions.length;i+=2){low=Math.min(low,f.mesh.positions[i]);high=Math.max(high,f.mesh.positions[i]);}
 const restHeight=high-low;
 let removedQuads=0,keptAddQuads=0,normalRemoved=0;
 type Quad={sequence:string;width:number;height:number};
 const removed:Quad[]=[],pending:Quad[]=[];const round=(n:number)=>Math.round(n*100)/100;
 const sequences=source.sequences.map(seq=>seq.name==='standby'?seq:{...seq,frames:seq.frames.map(frame=>{
  let masked=false,changed=false;
  const subMeshes:SwfSubMesh[]=[];
  for(const sm of frame.mesh.subMeshes){
   const kind=sm.material.shaderKind;
   if(kind==='incrMask')masked=true;
   const blend=sm.material.blendMode;
   if(masked||kind!=='simple'||(blend!=='add'&&blend!=='normal')||sm.indexCount%6!==0){subMeshes.push(sm);if(kind==='decrMask')masked=false;continue;}
   let run=-1;
   const count=sm.indexCount/6;
   const flush=(end:number)=>{if(run>=0){subMeshes.push({...sm,startVertex:sm.startVertex+run*4,indexStart:sm.indexStart+run*6,indexCount:(end-run)*6});run=-1;}};
   for(let q=0;q<count;q++){
    const box=quadBounds(frame.mesh,sm.startVertex+q*4);
    const asQuad=(seq:string):Quad=>({sequence:seq,width:round(box.width/restHeight),height:round(box.height/restHeight)});
    if(isLargeAddQuad(box.width,box.height,restHeight)){
     // add：全屏底片；normal：橫跨整個戰場的大矩形只有背景片會這樣，本體與特效都遠小於門檻。
     flush(q);removedQuads++;removed.push(asQuad(seq.name));changed=true;normalRemoved+=blend==='normal'?1:0;}
    else {keptAddQuads++;if(run<0)run=q;
      // 單邊很大、另一邊不足門檻：保守保留（可能是落雷／光束），標記待確認。
      if(box.width>=restHeight*1.5||box.height>=restHeight*1) pending.push(asQuad(seq.name));}
   }
   flush(count);
  }
  return changed?{...frame,mesh:{...frame.mesh,subMeshes}}:frame;
 })});
 const dedupe=(list:Quad[])=>{const seen=new Map<string,{sequence:string;count:number;maxWidth:number;maxHeight:number}>();
  for(const q of list){const key=q.sequence+'|'+q.width+'x'+q.height;const hit=seen.get(key);if(hit)hit.count++;else seen.set(key,{sequence:q.sequence,count:1,maxWidth:q.width,maxHeight:q.height});}
  return [...seen.values()];};
 return {clip:{...source,sequences},report:{restHeight,removedQuads,keptAddQuads,normalRemoved,policy:LARGE_ADD_POLICY,removed:dedupe(removed),pending:dedupe(pending)}};
}
/** CPU 圖集與頂點共用，只建立新的 draw ranges；不修改共享 clip，P1/P2 可各自使用。 */
export function preparePetFx(source:SwfClipData){let result=cache.get(source);if(!result){result=prepare(source);cache.set(source,result);}return result;}
