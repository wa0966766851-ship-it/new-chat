// Offline close-up for authored joints. Browser acceptance is still required.
import fs from 'node:fs';
import path from 'node:path';
import {PNG} from 'pngjs';
const args=process.argv.slice(2),get=(n,d)=>{const i=args.indexOf('--'+n);return i<0?d:args[i+1];};
const file=get('manifest','build/original-motion-v4/wuxu_zhuixing/manifest.json');
const out=get('out','docs/custom-anim/review-20261106/torso-joint-sheet.png');
const m=JSON.parse(fs.readFileSync(file,'utf8'));
const atlas=PNG.sync.read(fs.readFileSync(path.join(path.dirname(file),m.atlas.file??'atlas.png')));
const sequence=get('sequence','standby'),seq=m.sequences[sequence];
if(!seq)throw new Error('Unknown sequence '+sequence);
const indices=get('frames','').split(',').filter(Boolean).map(Number);
if(!indices.length)indices.push(0,Math.floor((seq.frames-1)/4),Math.floor((seq.frames-1)*3/4));
if(indices.length!==3||indices.some(v=>!Number.isInteger(v)||v<0||v>=seq.frames))throw new Error('Expected three valid frame indices');
const scale=.35,w=Math.round(m.canvas[0]*scale),h=Math.round(m.canvas[1]*scale),ppu=m.pixelsPerUnit??100;
const result=new PNG({width:w*3,height:h*2});
for(let row=0;row<2;row++)for(let col=0;col<3;col++){
 const bg=row?[235,235,235]:[11,13,17],ox=col*w,oy=row*h;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const at=((y+oy)*result.width+x+ox)*4;result.data.set([...bg,255],at);}
 const q=seq.quads[indices[col]],quads=q.g??[{p:q.c,u:[q.buv[0],q.buv[1],q.buv[2],q.buv[1],q.buv[2],q.buv[3],q.buv[0],q.buv[3]]}];
 for(const quad of quads){
  const p=quad.p.map((v,i)=>i%2?(m.canvas[1]-v*ppu)*scale:v*ppu*scale),u=quad.u;
  const ax=p[2]-p[0],ay=p[3]-p[1],bx=p[6]-p[0],by=p[7]-p[1],det=ax*by-ay*bx;
  if(Math.abs(det)<1e-9)continue;
  const x0=Math.max(0,Math.floor(Math.min(p[0],p[2],p[4],p[6]))),x1=Math.min(w-1,Math.ceil(Math.max(p[0],p[2],p[4],p[6])));
  const y0=Math.max(0,Math.floor(Math.min(p[1],p[3],p[5],p[7]))),y1=Math.min(h-1,Math.ceil(Math.max(p[1],p[3],p[5],p[7])));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const dx=x+.5-p[0],dy=y+.5-p[1],s=(dx*by-dy*bx)/det,t=(ax*dy-ay*dx)/det;if(s<0||s>1||t<0||t>1)continue;
   const tx=(u[0]+s*(u[2]-u[0])+t*(u[6]-u[0]))*atlas.width-.5;
   const ty=(u[1]+s*(u[3]-u[1])+t*(u[7]-u[1]))*atlas.height-.5;
   const fx=Math.floor(tx),fy=Math.floor(ty),samples=[[fx,fy,(1-(tx-fx))*(1-(ty-fy))],[fx+1,fy,(tx-fx)*(1-(ty-fy))],[fx,fy+1,(1-(tx-fx))*(ty-fy)],[fx+1,fy+1,(tx-fx)*(ty-fy)]];
   let a=0;const rgb=[0,0,0];
   for(const [sx,sy,weight] of samples){if(sx<0||sx>=atlas.width||sy<0||sy>=atlas.height)continue;const at=(sy*atlas.width+sx)*4,alpha=atlas.data[at+3]/255*weight;a+=alpha;for(let c=0;c<3;c++)rgb[c]+=atlas.data[at+c]*alpha;}
   const at=((y+oy)*result.width+x+ox)*4;for(let c=0;c<3;c++)result.data[at+c]=Math.round(rgb[c]+result.data[at+c]*(1-a));
  }
 }
}
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,PNG.sync.write(result));
fs.writeFileSync(out+'.json',JSON.stringify({source:file,sequence,frames:indices,rows:['dark','light'],scale,note:'Offline geometry/edge inspection only; not browser playback evidence'},null,2)+'\n');
console.log(out);
