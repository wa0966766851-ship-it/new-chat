import type {SwfClipData,SwfFrameMesh,SwfMaterialState} from '@seer-pet-anim/swf-bundle';
import {customIdleMesh,type CustomIdleZone,type CustomIdleOptions} from './customIdleMesh';

/** 自製動作素材的 manifest（由 scripts/build_custom_animation.mjs 產出）。 */
export interface CustomAnimManifest {
  id:string; elfId:string; elfName:string; fps:number;
  facing:'left'|'right'|'front';
  canvas:[number,number]; pixelsPerUnit:number;
  atlas:{file:string;width:number;height:number};
  character:{uv:[number,number,number,number];size:[number,number]};
  sha256:string; size:number;
  idleMotion?:CustomIdleOptions&{zones:CustomIdleZone[]};
  sequences:Record<string,{
    frames:number; hits:number[]; loop?:boolean;
    events?:{launch?:number;recover?:number};
    quads:{c?:number[];a:number;buv?:number[];f?:number[];fuv?:number[];g?:{p:number[];u:number[]}[];anchors?:Record<string,readonly [number,number]>}[];
  }>;
}

// Per-drawing anchors use the same source coordinates as the body, independent of
// the current visible bounds. Native clips have no entry and retain their behavior.
const customManifests=new WeakMap<SwfClipData,CustomAnimManifest>();
// preparePetFx returns a shallow clip copy. An enumerable symbol preserves the
// authored anchors through that copy without exposing them as a public field.
const CUSTOM_MANIFEST=Symbol('custom-animation-presentation');
export function customFramePresentation(clip:SwfClipData,sequence:string,frame:number){
  const manifest=customManifests.get(clip)??(clip as SwfClipData & {[CUSTOM_MANIFEST]?:CustomAnimManifest})[CUSTOM_MANIFEST],seq=manifest?.sequences[sequence];
  if(!manifest||!seq)return undefined;
  const point=seq.quads[frame]?.anchors?.muzzle;
  return {launch:seq.events?.launch,muzzle:point?[point[0],manifest.canvas[1]-point[1]] as const:undefined};
}

/** 一般材質：normal 混合、simple shader。與官方 .pet 的本體圖層同一個狀態。 */
const CONTENT_MATERIAL:SwfMaterialState={
  blendMode:'normal',shaderKind:'simple',srcBlend:1,dstBlend:0,blendOp:0,stencilId:0,
};

/** 光效材質：add 混合。光暈／光束要靠加法才會發亮；用 normal 會蓋住本體、看起來像貼紙。 */
// 光效材質：add 混合。renderFxLayers 預設 true，add 圖層會被正常繪製，
// 而且加法混合才會發亮；normal 會把光效畫成半透明色塊蓋住本體。
const FX_MATERIAL:SwfMaterialState={
  blendMode:'add',shaderKind:'simple',srcBlend:1,dstBlend:1,blendOp:0,stencilId:0,
};

const UV=[0,0,1,0,1,1,0,1];
const INDEX=[2,1,0,0,3,2];

/** 一個四邊形 → 4 個頂點。positions 是「世界座標」，播放器不再額外縮放。 */
function quad(
  positions:number[], uvs:number[],
  x0:number,y0:number,x1:number,y1:number,
  u0:number,v0:number,u1:number,v1:number,
){
  positions.push(x0,y0, x1,y0, x1,y1, x0,y1);
  uvs.push(u0,v0, u1,v0, u1,v1, u0,v1);
}

/**
 * manifest → SwfClipData。
 *
 * 為什麼要做這一層：播放器（SwfPlayer）只認 SwfClipData —— 一張圖集 + 每段序列的
 * 逐幀 mesh。自製素材的圖集與 mesh 我們自己產，但格式完全一樣，所以不必改播放器。
 *
 * 座標：manifest 的世界座標已是「像素 / pixelsPerUnit」，y 向上；播放器把頂點當
 * Unity 單位看，最後由 setFixedTransform 換算成螢幕 px，與官方素材一致。
 */
export function customClipFromManifest(manifest:CustomAnimManifest,atlas:ImageBitmap):SwfClipData{
  const sequences=Object.entries(manifest.sequences).map(([name,seq])=>{
    const frames=seq.quads.map((original,index)=>{
      // Store a few authored zones, not ~9 MB of repeated idle vertices per elf.
      const uv=original.buv??manifest.character.uv,c=original.c,ppu=manifest.pixelsPerUnit;
      const q=name==='standby'&&manifest.idleMotion&&c?{...original,g:customIdleMesh(
        [c[0]*ppu,manifest.canvas[1]-c[1]*ppu,(c[2]-c[0])*ppu,(c[1]-c[5])*ppu],uv,manifest.canvas,ppu,
        index/Math.max(1,seq.frames-1),manifest.idleMotion.zones,manifest.idleMotion)}:original;
      const positions:number[]=[],uvs:number[]=[];
      // 本體：共用圖集裡的同一個角色格
      // 本體 UV：逐幀自己的圖集格。舊版一律用 manifest.character.uv，
      // 等於整段動畫貼同一張靜止圖，本體自然一動也不動。
      if(q.g&&q.g.length){
        // 逐幀網格：每個格子自帶 4 個頂點與 4 組 UV，共用同一張原始貼圖。
        // 這是真正的形變（頂點移動），不是整張圖拉伸。
        for(const cell of q.g){
          positions.push(cell.p[0],cell.p[1],cell.p[2],cell.p[3],cell.p[4],cell.p[5],cell.p[6],cell.p[7]);
          uvs.push(cell.u[0],cell.u[1],cell.u[2],cell.u[3],cell.u[4],cell.u[5],cell.u[6],cell.u[7]);
        }
      } else {
        const buv=(q.buv??manifest.character.uv) as [number,number,number,number];
        quad(positions,uvs,q.c![0],q.c![1],q.c![2],q.c![5],...buv);
      }
      // 光效：逐幀各自的格子
      if(q.f&&q.fuv){
        quad(positions,uvs,q.f[0],q.f[1],q.f[2],q.f[5],...q.fuv as [number,number,number,number]);
      }
      const vertCount=positions.length/2;
      const bodyVertCount=q.g&&q.g.length?q.g.length*4:4;
      const fxVertCount=q.f?4:0;
      const addColors=new Float32Array(vertCount*4);
      const mulColors=new Float32Array(vertCount*4);
      for(let v=0;v<vertCount;v++){
        // 前 4 個頂點是本體：用逐幀 alpha；後 4 個是光效：全不透明（亮度已烘進圖集）
        const bodyVerts=q.g&&q.g.length?q.g.length*4:4;
        const alpha=v<bodyVerts?q.a:1;
        mulColors[v*4]=1;mulColors[v*4+1]=1;mulColors[v*4+2]=1;mulColors[v*4+3]=alpha;
      }
      // 索引型別由 SwfFrameMesh 固定為 Uint16（上限 65535 頂點）。
      // 逐幀網格的格子數必須控制在這個上限內，網格密度不能無限制拉高。
      const indices=new Uint16Array(vertCount/4*6);
      // 播放器計算方式：indices[subMesh.indexStart + j] - subMesh.startVertex。
      // 所以這裡要放「絕對索引」，播放器自己會減掉起點。
      for(let k=0;k<vertCount/4;k++){
        for(let j=0;j<6;j++)indices[k*6+j]=INDEX[j]+k*4;
      }
      return {
        labels:[] as string[],
        mesh:{positions:new Float32Array(positions),uvs:new Float32Array(uvs),addColors,mulColors,indices,
          subMeshes:bodyVertCount>0&&fxVertCount>0
            ?[
              {startVertex:0,indexCount:bodyVertCount/4*6,indexStart:0,material:CONTENT_MATERIAL},
              {startVertex:bodyVertCount,indexCount:fxVertCount/4*6,indexStart:bodyVertCount/4*6,material:FX_MATERIAL},
            ]
            :[{startVertex:0,indexCount:indices.length,indexStart:0,material:CONTENT_MATERIAL}]},
      } satisfies {labels:string[];mesh:SwfFrameMesh};
    });
    // 命中幀以 label 表達：播放器 getSequences() 會把 labels 轉成 markers。
    for(const hit of seq.hits){const f=frames[hit];if(f)f.labels=['action_hit'];}
    for(const event of ['launch','recover'] as const){const index=seq.events?.[event];if(index!==undefined&&frames[index])frames[index].labels.push('action_'+event);}
    return {name,frames};
  });
  const clip={
    pixelsPerUnit:manifest.pixelsPerUnit,
    petId:0,
    name:manifest.elfName,
    frameRate:manifest.fps,
    atlasWidth:manifest.atlas.width,
    atlasHeight:manifest.atlas.height,
    atlas,
    sequences,
    materialWarnings:[],
  } as SwfClipData;
  customManifests.set(clip,manifest);
  Object.defineProperty(clip,CUSTOM_MANIFEST,{value:manifest,enumerable:true});
  return clip;
}

/** 讀 manifest + 圖集。快取由 petClipPool 負責，這裡只做一次轉換。 */
export async function loadCustomClip(baseUrl:string,signal?:AbortSignal,version?:string):Promise<SwfClipData>{
  const get=async(path:string,as:'json'|'blob')=>{
    const r=await fetch(baseUrl+path+(version?'?v='+encodeURIComponent(version):''),{signal,cache:as==='json'?'no-cache':'default'});
    if(!r.ok)throw Error('自製動作素材未就緒：'+baseUrl+path);
    return as==='json'?r.json():r.blob();
  };
  const [manifest,blob]=await Promise.all([get('/manifest.json','json') as Promise<CustomAnimManifest>,get('/atlas.png','blob') as Promise<Blob>]);
  if(version&&manifest.sha256!==version)throw Error('自製動作素材版本不一致，請重試載入');
  const atlas=await createImageBitmap(blob);
  return customClipFromManifest(manifest,atlas);
}
