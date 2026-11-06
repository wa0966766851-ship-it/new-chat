/** Offline proof only. No OpenCV dependency enters the game or its bundle. */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {PNG} from 'pngjs';
import {chromaSprite} from './lib/chromaSprite.mjs';
const input=process.argv[2],args=process.argv.slice(3),option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
if(!input)throw Error('Usage: node scripts/experiment_idle_flow.mjs <reviewed 3x2 key sheet> [--id <id> --draft <directory>]');
const id=option('--id')??'liuren-v3';if(!/^[\w-]+$/.test(id))throw Error('Invalid output ID');
const require=createRequire(path.resolve('.seer-cache/art-tools/package.json'));
const cv=require('@techstark/opencv-js');
if(!cv.Mat)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('OpenCV init timeout')),15000);cv.onRuntimeInitialized=()=>{clearTimeout(timer);resolve();};});
// Keep authoring intermediates outside Vite's emptyOutDir preview build.
const dir=option('--draft')??'docs/custom-anim/drafts/20261105-liuren-v3',out=path.resolve(id==='liuren-v3'?'build/custom-idle-flow-v3':`build/custom-idle-flow-${id}`);
fs.mkdirSync(dir,{recursive:true});
fs.mkdirSync(path.join(out,'frames'),{recursive:true});fs.copyFileSync(input,`${dir}/idle-clean-source.png`);
const source=PNG.sync.read(fs.readFileSync(input)),w=source.width/3,h=source.height/2;
if(!Number.isInteger(w)||!Number.isInteger(h))throw Error('Expected an equal 3x2 sheet');
const keys=[];
for(let k=0;k<6;k++){
 const p=new PNG({width:w,height:h});
 for(let y=0;y<h;y++)source.data.copy(p.data,y*w*4,((Math.floor(k/3)*h+y)*source.width+k%3*w)*4,((Math.floor(k/3)*h+y)*source.width+k%3*w+w)*4);
 const bytes=chromaSprite(PNG.sync.write(p),{hardKey:true,minGreenRegion:args.includes('--remove-green-islands')?1:40});
 fs.writeFileSync(`${out}/key-${k}.png`,bytes);keys.push(PNG.sync.read(bytes));
}
const gray=p=>{
 const m=new cv.Mat(h,w,cv.CV_8UC1);
 // Include alpha so dark cloth outlines remain trackable against transparency.
 for(let i=0;i<w*h;i++){const j=i*4,a=p.data[j+3]/255;m.data[i]=Math.round(a*(140+.45*(.299*p.data[j]+.587*p.data[j+1]+.114*p.data[j+2])));}
 return m;
};
const mats=keys.map(gray),flow=(a,b)=>{const m=new cv.Mat();cv.calcOpticalFlowFarneback(a,b,m,.5,4,21,5,7,1.5,0);return m;};
const sample=(data,x,y,c,stride)=>{
 x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,x1=Math.min(w-1,ix+1),y1=Math.min(h-1,iy+1);
 return data[(iy*w+ix)*stride+c]*(1-fx)*(1-fy)+data[(iy*w+x1)*stride+c]*fx*(1-fy)+data[(y1*w+ix)*stride+c]*(1-fx)*fy+data[(y1*w+x1)*stride+c]*fx*fy;
};
const premul=keys.map(p=>{const a=new Float32Array(p.data.length);for(let i=0;i<a.length;i+=4){const alpha=p.data[i+3]/255;for(let c=0;c<3;c++)a[i+c]=p.data[i+c]*alpha;a[i+3]=p.data[i+3];}return a;});
// Standard APNG chunks, lossless PNG payloads; no GIF palette damage to dark art.
const crcTable=Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
const chunk=(type,data)=>{const head=Buffer.from(type),bytes=Buffer.concat([head,data]);let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);const result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);bytes.copy(result,4);result.writeUInt32BE((crc^0xffffffff)>>>0,result.length-4);return result;};
const pngChunks=bytes=>{const parts=[];for(let pos=8;pos<bytes.length;){const length=bytes.readUInt32BE(pos),type=bytes.toString('ascii',pos+4,pos+8);parts.push({type,data:bytes.subarray(pos+8,pos+8+length)});pos+=12+length;}return parts;};
const frames=[],diagnostics=[];const steps=8;
for(let k=0;k<6;k++){
 const next=(k+1)%6,f=flow(mats[k],mats[next]),b=flow(mats[next],mats[k]);
 const forward=f.data32F,backward=b.data32F;
 let max=0,sum=0,count=0;
 for(let i=0;i<forward.length;i+=2)if(keys[k].data[i*2+3]>128){const d=Math.hypot(forward[i],forward[i+1]);max=Math.max(max,d);sum+=d;count++;}
 diagnostics.push({pair:[k,next],meanOpaqueDisplacement:sum/count,maxOpaqueDisplacement:max});
 for(let step=0;step<steps;step++){
  const t=step/steps,p=new PNG({width:w,height:h});
  if(!step)keys[k].data.copy(p.data);
  else for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   let ax=x,ay=y,bx=x,by=y;
   for(let n=0;n<3;n++){
    const dx=sample(forward,ax,ay,0,2),dy=sample(forward,ax,ay,1,2);ax=x-t*dx;ay=y-t*dy;
    const ex=sample(backward,bx,by,0,2),ey=sample(backward,bx,by,1,2);bx=x-(1-t)*ex;by=y-(1-t)*ey;
   }
   const j=(y*w+x)*4;
   const alpha=sample(premul[k],ax,ay,3,4)*(1-t)+sample(premul[next],bx,by,3,4)*t;
   p.data[j+3]=Math.round(alpha);
   for(let c=0;c<3;c++)p.data[j+c]=alpha>0?Math.round((sample(premul[k],ax,ay,c,4)*(1-t)+sample(premul[next],bx,by,c,4)*t)*255/alpha):0;
  }
  const bytes=PNG.sync.write(p);fs.writeFileSync(`${out}/frames/${String(frames.length).padStart(2,'0')}.png`,bytes);frames.push(bytes);
 }
 f.delete();b.delete();console.log('Interpolated key pair '+k+' -> '+next);
}
for(const m of mats)m.delete();
const parts=[Buffer.from([137,80,78,71,13,10,26,10])],first=pngChunks(frames[0]);parts.push(chunk('IHDR',first.find(c=>c.type==='IHDR').data));
const actl=Buffer.alloc(8);actl.writeUInt32BE(frames.length);parts.push(chunk('acTL',actl));let seq=0;
for(let i=0;i<frames.length;i++){
 const control=Buffer.alloc(26);control.writeUInt32BE(seq++);control.writeUInt32BE(w,4);control.writeUInt32BE(h,8);control.writeUInt16BE(1,20);control.writeUInt16BE(24,22);control[24]=0;control[25]=0;parts.push(chunk('fcTL',control));
 for(const c of pngChunks(frames[i]).filter(c=>c.type==='IDAT'))if(!i)parts.push(chunk('IDAT',c.data));else {const n=Buffer.alloc(4);n.writeUInt32BE(seq++);parts.push(chunk('fdAT',Buffer.concat([n,c.data])));}
}
parts.push(chunk('IEND',Buffer.alloc(0)));const apng=Buffer.concat(parts);fs.writeFileSync(`${out}/idle-flow.png`,apng);
fs.writeFileSync(`${dir}/idle-flow-review.json`,JSON.stringify({status:'experimental-not-published',method:'Farneback bidirectional inverse warp with premultiplied alpha interpolation',frames:frames.length,fps:24,bytes:apng.length,diagnostics,reference:'https://docs.opencv.org/4.12.0/db/d7f/tutorial_js_lucas_kanade.html'},null,2)+'\n');
fs.writeFileSync(`${out}/index.html`,`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>六刃待機補幀候選</title><style>body{margin:0;background:#10141c;color:#ddd;font:16px sans-serif}header{padding:20px}main{display:flex;justify-content:space-around}section{text-align:center}img{width:min(44vw,512px);height:auto}.p1{transform:scaleX(-1)}button{padding:10px;margin:8px}</style><header><h1>六刃：待機補幀候選，尚未替換正式動畫</h1><p>48 格／24fps，衣襬逐格過渡；不平移整張立繪。檢查臉、盔甲、刀鏈是否扭曲、雙影或跳格。</p><button id="toggle">對照單張原圖</button><output id="status">補幀播放</output></header><main><section><p>P1 →</p><img class="p1" src="idle-flow.png"></section><section><p>← P2</p><img src="idle-flow.png"></section></main><script>let still=false;document.querySelector('button').onclick=()=>{still=!still;document.querySelectorAll('img').forEach(i=>i.src=still?'key-0.png':'idle-flow.png');document.querySelector('output').textContent=still?'單張原圖':'補幀播放';};</script></html>`);
console.log(JSON.stringify({preview:out,frames:frames.length,bytes:apng.length}));
