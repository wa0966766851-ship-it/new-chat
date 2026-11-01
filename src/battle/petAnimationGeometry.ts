/** 純演出座標；不參與命中判定、傷害或效果結算。 */
export function actionApproach(frame:number, hitFrame:number, endFrame:number) {
  if (frame <= 0 || frame >= endFrame) return 0;
  // 命中前靠近、短暫停留後收招。尺寸與鏡射均保持不變。
  const t=frame<=hitFrame?frame/Math.max(1,hitFrame):Math.max(0,1-(frame-hitFrame)/Math.max(1,endFrame-hitFrame));
  return t*t*(3-2*t);
}
/**
 * 攻擊接觸位移：讓攻擊者「前緣」抵達對手可見框的「近側邊緣」（再穿入 overlap px 以呈現接觸）。
 * sourceFront＝攻擊者靜止時的前緣 x；targetNear＝對手可見框面向攻擊者的邊緣 x；direction＝攻擊者面向（+1 右／-1 左）。
 * 回傳需平移的 px；已越過或方向相反時為 0。maxShift 為視窗／場域允許的最大位移（選填）。
 */
export function attackContact(sourceFront:number,targetNear:number,direction:number,overlap=0,maxShift=Infinity) {
  const dir=direction<0?-1:1;
  const shift=(targetNear+dir*overlap-sourceFront)*dir;
  if(!(shift>0))return 0;
  return dir*Math.min(shift,Math.max(0,maxShift));
}

export type NativeBounds={left:number;right:number;top:number;bottom:number};
type NativeMesh={positions:ArrayLike<number>;uvs:ArrayLike<number>};
/** 以待機出現過的圖塊辨認本體，排除攻擊才出現的大型光束／爆炸。 */
const tileKey=(uv:ArrayLike<number>,offset:number)=>Array.from({length:8},(_,i)=>Math.round(uv[offset+i]*65536)).join(',');
export function bodyTiles(meshes:NativeMesh[]){const keys=new Set<string>();for(const m of meshes)for(let i=0;i+7<m.uvs.length;i+=8)keys.add(tileKey(m.uvs,i));return keys;}
export function nativeBodyBounds(mesh:NativeMesh,tiles?:Set<string>):NativeBounds|null{
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(let i=0;i+7<mesh.positions.length;i+=8){if(tiles&&!tiles.has(tileKey(mesh.uvs,i)))continue;
  for(let j=i;j<i+8;j+=2){left=Math.min(left,mesh.positions[j]);right=Math.max(right,mesh.positions[j]);top=Math.min(top,mesh.positions[j+1]);bottom=Math.max(bottom,mesh.positions[j+1]);}}
 return Number.isFinite(left)&&right>left&&bottom>top?{left,right,top,bottom}:null;
}
/** 待機中「少見又特大」的圖塊（一閃而過的光暈／背景片）不是本體，不可進入尺寸基準。
 * 判定同時要求：只出現在不到 1/3 的待機影格（持久出現的圖塊一律視為本體，含翅膀、披風、逐格換圖的身體），
 * 且單塊尺寸遠超各影格高度的中位數（高 >1.5 倍或寬 >3 倍）。影格少於 3 張時資料不足，不排除任何圖塊。 */
export const REST_OUTLIER={maxShare:1/3,minFrames:3,height:1.5,width:3} as const;
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)/2)];};
function tileBoxes(mesh:NativeMesh){
 const out:{key:string;width:number;height:number}[]=[];
 for(let i=0;i+7<mesh.positions.length;i+=8){let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
  for(let j=i;j<i+8;j+=2){l=Math.min(l,mesh.positions[j]);r=Math.max(r,mesh.positions[j]);t=Math.min(t,mesh.positions[j+1]);b=Math.max(b,mesh.positions[j+1]);}
  out.push({key:tileKey(mesh.uvs,i),width:r-l,height:b-t});}
 return out;
}
/** 待機本體圖塊集合＝待機全部圖塊扣掉「少見又特大」者；戰鬥與首頁的尺寸基準／姿勢框共用。 */
export function restBodyTiles(meshes:NativeMesh[]):Set<string>{
 const frames=meshes.map(tileBoxes).filter(f=>f.length);
 const all=new Set<string>();for(const f of frames)for(const t of f)all.add(t.key);
 if(frames.length<REST_OUTLIER.minFrames)return all;
 const share=new Map<string,number>();for(const f of frames)for(const key of new Set(f.map(t=>t.key)))share.set(key,(share.get(key)||0)+1);
 const heights=meshes.map(m=>nativeBodyBounds(m)).filter((b):b is NativeBounds=>!!b).map(b=>b.bottom-b.top);
 const typical=median(heights);
 const keep=new Set<string>();
 for(const f of frames)for(const t of f){
  const rare=(share.get(t.key)||0)/frames.length<REST_OUTLIER.maxShare;
  if(rare&&(t.height>typical*REST_OUTLIER.height||t.width>typical*REST_OUTLIER.width))continue;
  keep.add(t.key);}
 return keep.size?keep:all;
}
/** 尺寸基準（待機身體框）：以待機首個有內容的影格為擺放基準；整段聯集會把後續擴散光暈、飄移一起算入而讓本體縮水。
 * 2026-11-01 加固：先排除「少見又特大」的圖塊（restBodyTiles）；若首幀仍與各幀高度中位數差超過 20%（首幀特效），
 * 改用高度居中位的那一幀。空幀跳過；後續光效仍原樣播放，只有縮放基準固定。 */
export function nativeRestBounds(meshes:NativeMesh[]):NativeBounds|null{
 const tiles=restBodyTiles(meshes);
 const boxes=meshes.map(m=>nativeBodyBounds(m,tiles)).filter((b):b is NativeBounds=>!!b);
 if(!boxes.length)return null;
 if(boxes.length<REST_OUTLIER.minFrames)return boxes[0];
 const heights=boxes.map(b=>b.bottom-b.top),typical=median(heights);
 if(Math.abs(heights[0]-typical)<=typical*.2)return boxes[0];
 return boxes.find(b=>b.bottom-b.top===typical)??boxes[0];
}
/** 畫布地平線以下保留浮動／受擊的空間。擴張畫布同時下移底緣，不改角色比例或世界座標。 */
export function petCanvasFrame(stageHeight:number,bodyHeight:number,battle=true){
 const footroom=battle?Math.max(32,Math.min(160,bodyHeight*.4)):0;
 return {height:stageHeight+footroom,footroom,baseline:stageHeight};
}
/** 將原廠自帶的本體平移先扣除，再沿站位路徑接近。每一影格本體前緣均不可越過接觸點。
 * rootOffset 是當前本體中心相對待機中心的原生位移，poseHalfWidth 是當前姿勢半寬（均為螢幕 px）。 */
export function retargetAttack(origin:number,targetNear:number,direction:number,restHalfWidth:number,rootOffset:number,poseHalfWidth:number,approach:number,overlap=0){
 const dir=direction<0?-1:1;
 const shift=attackContact(origin+dir*restHalfWidth,targetNear,dir,overlap);
 const progress=Math.max(0,Math.min(1,approach));
 const desiredCenter=origin+(shift+dir*(restHalfWidth-poseHalfWidth))*progress;
 const cap=targetNear+dir*overlap-dir*poseHalfWidth;
 const bodyCenter=dir>0?Math.min(desiredCenter,cap):Math.max(desiredCenter,cap);
 return {translation:bodyCenter-rootOffset,bodyCenter,front:bodyCenter+dir*poseHalfWidth,contact:origin+shift};
}
