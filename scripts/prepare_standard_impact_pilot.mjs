/** Re-render an installed standard impact clip; keep source RGBA and metadata. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {buildFrameMesh,insetQuadUvs} from '../node_modules/@seer-pet-anim/swf-bundle/dist/mesh.js';
const args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const id=arg('--id','11'),palette=arg('--palette','green'),owner=arg('--owner','wuxu_liuren');
if(!/^\d+$/.test(id)||!['green','source'].includes(palette)||!/^\w+$/.test(owner))throw Error('Invalid impact candidate arguments');
const dir=`docs/custom-anim/review-20261106/standard-fx-${id}`;
const source=fs.readFileSync(dir+'/atlas.png'),atlas=PNG.sync.read(source);
const tree=JSON.parse(fs.readFileSync(dir+'/clip.json','utf8'));
const frames=tree.Sequences[0].Frames.map(f=>buildFrameMesh(f.MeshData,[]));
const all=frames.flatMap(f=>Array.from(f.positions)),xs=all.filter((_v,i)=>i%2===0),ys=all.filter((_v,i)=>i%2===1);
const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
const cell=256,cols=5,rows=Math.ceil(frames.length/cols),sheet=new PNG({width:cols*cell,height:rows*cell});
const scale=(cell-12)/Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1]);
const cx=(bounds[0]+bounds[2])/2,cy=(bounds[1]+bounds[3])/2;
for(const [f,m] of frames.entries())for(let q=0;q<m.positions.length/2;q+=4){
 insetQuadUvs(m.uvs,q*2,atlas.width,atlas.height);
 const p=Array.from(m.positions.slice(q*2,(q+4)*2), (v,i)=>i%2?cell/2-(v-cy)*scale:cell/2+(v-cx)*scale);
 const uv=Array.from(m.uvs.slice(q*2,(q+4)*2));
 const ax=p[2]-p[0],ay=p[3]-p[1],bx=p[6]-p[0],by=p[7]-p[1],det=ax*by-ay*bx;
 if(Math.abs(det)<1e-8)continue;
 for(let y=Math.max(0,Math.floor(Math.min(...p.filter((_v,i)=>i%2))));y<Math.min(cell,Math.ceil(Math.max(...p.filter((_v,i)=>i%2))));y++)
 for(let x=Math.max(0,Math.floor(Math.min(...p.filter((_v,i)=>i%2===0))));x<Math.min(cell,Math.ceil(Math.max(...p.filter((_v,i)=>i%2===0))));x++){
  const dx=x+.5-p[0],dy=y+.5-p[1],s=(dx*by-dy*bx)/det,t=(ax*dy-ay*dx)/det;
  if(s<0||s>1||t<0||t>1)continue;
  const u=uv[0]+s*(uv[2]-uv[0])+t*(uv[6]-uv[0]),v=uv[1]+s*(uv[3]-uv[1])+t*(uv[7]-uv[1]);
  // Texture2D.getImage() has the opposite row orientation from parseBundleCore's atlasPixels.
  const sx=Math.max(0,Math.min(atlas.width-1,Math.floor(u*atlas.width))),sy=Math.max(0,Math.min(atlas.height-1,Math.floor(v*atlas.height)));
  const at=(sy*atlas.width+sx)*4,a=atlas.data[at+3]/255*m.mulColors[q*4+3];if(a<=0)continue;
  const rgb=[0,1,2].map(c=>Math.min(255,Math.max(0,atlas.data[at+c]*m.mulColors[q*4+c]+m.addColors[q*4+c]*255)));
  // Keep the white hot core; remap saturated amber to restrained emerald.
  const low=Math.min(...rgb),lum=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722,chroma=lum-low;
  const tinted=palette==='source'?rgb:[low+chroma*.18,low+chroma*.85,low+chroma*.38];
  const dst=((Math.floor(f/cols)*cell+y)*sheet.width+f%cols*cell+x)*4,old=sheet.data[dst+3]/255,out=a+old*(1-a);
  for(let c=0;c<3;c++)sheet.data[dst+c]=(tinted[c]*a+sheet.data[dst+c]*old*(1-a))/out;
  sheet.data[dst+3]=out*255;
 }
}
const bytes=PNG.sync.write(sheet),name=`impact-${palette}`,out=`build/original-motion-v4/${owner}/standard-${name}.png`;
fs.writeFileSync(out,bytes);fs.writeFileSync(dir+`/${name}.png`,bytes);
const meta={source:`U DefaultPackage / skill/${id}/${id}.skill.prefab`,role:'visual candidate, numeric type mapping not independently confirmed',sourceAtlasSha256:crypto.createHash('sha256').update(source).digest('hex'),fps:tree.FrameRate,cols,rows,frames:frames.length,cell,sourceBounds:bounds,downloadBytes:bytes.length,decodedBytes:sheet.width*sheet.height*4,palette:palette==='source'?'original source colors':'black steel body; emerald midtones; pale white core; no original amber'};
fs.writeFileSync(dir+`/${name}.json`,JSON.stringify(meta,null,2)+'\n');console.log(meta);
