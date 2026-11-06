import {PNG} from 'pngjs';

/** Only for reviewed artwork with no intentional green: remove residual green spill. */
export function removeGreenSpill(bytes){
 const p=PNG.sync.read(bytes);
 for(let j=0;j<p.data.length;j+=4)if(p.data[j+3])p.data[j+1]=Math.min(p.data[j+1],Math.max(p.data[j],p.data[j+2]));
 return PNG.sync.write(p);
}

/** Deterministic matte extraction for explicitly green-screen-generated artwork.
 * Small enclosed green jewellery is retained. Never run on normal source art.
 */
export function chromaSprite(bytes,{hardKey=false,minGreenRegion=40}={}){
 if(!Number.isInteger(minGreenRegion)||minGreenRegion<1)throw Error('Invalid green region size');
 const p=PNG.sync.read(bytes),n=p.width*p.height,seen=new Uint8Array(n),mask=new Uint8Array(n);
 const green=i=>{const j=i*4;return p.data[j+1]>100&&p.data[j+1]-Math.max(p.data[j],p.data[j+2])>18;};
 for(let seed=0;seed<n;seed++){
  if(seen[seed]||!green(seed))continue;
  const region=[seed];seen[seed]=1;
  for(let q=0;q<region.length;q++){
   const i=region[q],x=i%p.width,y=Math.floor(i/p.width);
   for(const k of [x?i-1:-1,x<p.width-1?i+1:-1,y?i-p.width:-1,y<p.height-1?i+p.width:-1]){
    if(k>=0&&!seen[k]&&green(k)){seen[k]=1;region.push(k);}
   }
  }
  if(region.length>=minGreenRegion)for(const i of region)mask[i]=1;
 }
 let removed=0;
 for(let i=0;i<n;i++)if(mask[i]){
  const j=i*4,r=p.data[j],g=p.data[j+1],b=p.data[j+2],excess=g-Math.max(r,b);
  if(hardKey&&g>150&&excess>18){p.data.fill(0,j,j+4);removed++;continue;}
  const alpha=Math.max(0,1-excess/255);
  if(alpha<.12){p.data.fill(0,j,j+4);removed++;continue;}
  p.data[j]=Math.min(255,r/alpha);p.data[j+1]=Math.max(0,(g-255*(1-alpha))/alpha);p.data[j+2]=Math.min(255,b/alpha);p.data[j+3]=Math.round(p.data[j+3]*alpha);
 }
 if(removed/n<.1)throw Error('Not a green-screen sprite; refusing to alter it');
 return PNG.sync.write(p);
}
