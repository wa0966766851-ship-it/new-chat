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
/** 待機首幀是本體擺放基準；整段聯集會把後續擴散光暈、飄移一起算入，導致本體縮水。
 * 空幀跳過；後續光效仍原樣播放，只有縮放基準固定，不以某個動畫中最大的光效決定體型。 */
export function nativeRestBounds(meshes:NativeMesh[]):NativeBounds|null{
 for(const mesh of meshes){const box=nativeBodyBounds(mesh);if(box)return box;}
 return null;
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
