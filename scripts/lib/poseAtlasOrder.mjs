// Offline authoring helper. Match the compiler's shelf packing without touching
// image pixels, anchors or animation timing. Exhaustive only for small studies.
import {PNG} from 'pngjs';
export function orderPoseAtlas(poses,readImage,maxSide=4096){
 const sizes=Object.entries(poses).map(([id,pose])=>{
  const p=PNG.sync.read(readImage(pose.file));let l=p.width,t=p.height,r=-1,b=-1;
  for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3]>16){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
  if(r<l)throw Error('Empty pose '+id);
  return {id,w:r-l+1,h:b-t+1};
 });
 if(sizes.length>8)throw Error('Exact atlas order is limited to eight drawings');
 let best=null;
 function visit(order,left){
  if(left.length){for(let i=0;i<left.length;i++)visit([...order,left[i]],left.filter((_,j)=>j!==i));return;}
  let x=2,y=2,row=0,width=0;
  for(const q of order){if(q.w+4>maxSide||q.h+4>maxSide)return;if(x+q.w+2>maxSide){x=2;y+=row+2;row=0;}x+=q.w+2;row=Math.max(row,q.h);width=Math.max(width,x);}
  const height=y+row+2;if(height>maxSide)return;
  const area=width*height;
  if(!best||area<best.area)best={area,width,height,ids:order.map(q=>q.id)};
 }
 visit([],sizes);
 if(!best)throw Error('No valid shelf layout within atlas side limit');
 return {poses:Object.fromEntries(best.ids.map(id=>[id,poses[id]])),layout:best};
}
