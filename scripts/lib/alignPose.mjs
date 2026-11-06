import {PNG} from 'pngjs';

/** Whole-drawing alignment around a reviewed landmark. No limb extraction. */
export function alignPose(bytes,{canvas,scale,offset}){
 const source=PNG.sync.read(bytes),target=new PNG({width:canvas[0],height:canvas[1]});
 for(let y=0;y<target.height;y++)for(let x=0;x<target.width;x++){
  const sx=(x-offset[0]+.5)/scale-.5,sy=(y-offset[1]+.5)/scale-.5;
  if(sx<0||sy<0||sx>source.width-1||sy>source.height-1)continue;
  const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;let a=0;const rgb=[0,0,0];
  for(let j=0;j<2;j++)for(let k=0;k<2;k++){
   const i=(Math.min(iy+j,source.height-1)*source.width+Math.min(ix+k,source.width-1))*4;
   const w=(j?fy:1-fy)*(k?fx:1-fx),alpha=source.data[i+3]/255;a+=alpha*w;
   for(let c=0;c<3;c++)rgb[c]+=source.data[i+c]*alpha*w;
  }
  const o=(y*target.width+x)*4;
  for(let c=0;c<3;c++)target.data[o+c]=a?Math.round(rgb[c]/a):0;
  target.data[o+3]=Math.round(a*255);
 }
 return PNG.sync.write(target);
}
