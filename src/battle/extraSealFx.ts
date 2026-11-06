import type {VisibleBox} from './spriteMetrics';

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
/** Shared playback clock only: these phases never apply damage or statuses. */
export function extraSealPhase(frame:number,frames:number){
 const t=clamp(frame/Math.max(1,frames-1));
 return {t,open:smooth(t/.18),bind:smooth((t-.4)/.22),
  fracture:Math.sin(Math.PI*clamp((t-.67)/.2)),fade:1-smooth((t-.84)/.16),
  pages:Array.from({length:9},(_,i)=>{
   const travel=smooth((t-.1-i*.018)/.39);
   return {travel,alpha:smooth((t-.08-i*.018)/.06)*(1-smooth((t-.76-i*.006)/.12))};
  })};
}

interface SealFrame {frame:number;frames:number;caster:VisibleBox;target:VisibleBox}
export interface SealArt {page?:HTMLImageElement;claw?:{open:HTMLImageElement;closed?:HTMLImageElement};impact?:{image:HTMLImageElement;cols:number;rows:number;frames:number}}
/** Opt-in book curse. Screen positions use actual visible bodies, not fixed P1/P2 offsets. */
export function drawExtraSeal(ctx:CanvasRenderingContext2D,state:SealFrame,
 rect:{left:number;top:number},side:'p1'|'p2',palette:{color:string;secondary:string},art?:SealArt){
 const p=extraSealPhase(state.frame,state.frames),d=side==='p1'?1:-1;
 const own=state.caster,target=state.target;
 const h=Math.max(1,target.bottom-target.top),size=Math.max(18,Math.min(60,h*.12));
 const sx=(own.left+own.right)/2-rect.left+d*(own.right-own.left)*.16;
 const sy=own.top+(own.bottom-own.top)*.39-rect.top;
 const tx=(target.left+target.right)/2-rect.left,ty=target.top+h*.48-rect.top;
 const span=Math.min(h*.29,Math.max(size,(target.right-target.left)*.42));
 const stroke=(points:number[][],width:number,color:string)=>{
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
 };
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 // The open book writes a short stream; no permanent spinning caster halo.
 ctx.globalCompositeOperation='lighter';ctx.globalAlpha=p.open*p.fade*.75;
 for(let i=0;i<3;i++){
  const dy=(i-1)*size*.16;
  stroke([[sx-d*size*.3,sy+dy],[sx,sy+dy-size*.1],[sx+d*size*.32,sy+dy]],1.3,palette.secondary);
 }
 // Spectral arms are summoned at the seal, not physical projectiles from the body.
 // Two authored finger poses keep the grasp readable without stretching a flat palm.
 if(art?.claw?.open.complete&&art.claw.open.naturalWidth>0){
  const appear=smooth((p.t-.38)/.13),close=smooth((p.t-.57)/.14);
  const fade=1-smooth((p.t-.79)/.16),width=Math.min(240,h*.52);
  for(const direction of [-1,1]){
   ctx.save();ctx.translate(tx+direction*width*(.94-.14*appear),ty+direction*h*.04);
   ctx.scale(-direction,1);ctx.rotate((1-close)*-.13);
   ctx.globalCompositeOperation='source-over';
   const closed=art.claw.closed?.complete&&art.claw.closed.naturalWidth>0?art.claw.closed:null;
   const blend=closed?smooth((p.t-.6)/.1):0;
   const hand=(image:HTMLImageElement,alpha:number)=>{
    ctx.globalAlpha=appear*fade*alpha*.94;
    const height=width*image.naturalHeight/image.naturalWidth;
    ctx.drawImage(image,0,-height*.5,width,height);
   };
   // Transparent ghost textures may dissolve between key poses; the human never crossfades.
   hand(art.claw.open,1-blend);if(closed)hand(closed,blend);
   ctx.restore();
  }
 }
 // Pages originate at the book, follow broad curved lanes, then form two cuffs.
 for(let i=0;i<p.pages.length;i++){
  const page=p.pages[i],v=page.travel,band=i%2?1:-1;
  const endAngle=i*Math.PI*2/9+p.bind*.28;
  const ex=tx+Math.cos(endAngle)*span,ey=ty+band*h*.2+Math.sin(endAngle)*size*.24;
  const x=sx+(ex-sx)*v,y=sy+(ey-sy)*v-Math.sin(Math.PI*v)*size*(1.2+i%3*.42);
  if(page.alpha<=0)continue;
  ctx.save();ctx.translate(x,y);ctx.rotate(d*((1-v)*-.32+Math.sin(endAngle)*.25));
  const w=size*.43,ph=size*.68,curl=Math.sin(v*Math.PI)*w*.16;
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=page.alpha;
  if(art?.page?.complete&&art.page.naturalWidth>0){
   ctx.drawImage(art.page,-w*.68,-ph*.63,w*1.36,ph*1.26);
   ctx.restore();continue;
  }
  ctx.fillStyle='#14121e';ctx.strokeStyle=palette.color;ctx.lineWidth=1.2;
  ctx.beginPath();ctx.moveTo(-w*.5,-ph*.5);ctx.quadraticCurveTo(curl,-ph*.64,w*.5,-ph*.46);
  ctx.lineTo(w*.48,ph*.46);ctx.lineTo(w*.2,ph*.42);ctx.lineTo(w*.02,ph*.5);
  ctx.lineTo(-w*.17,ph*.44);ctx.lineTo(-w*.51,ph*.49);ctx.closePath();ctx.fill();ctx.stroke();
  // Broken engraved marks, rather than bright empty rectangular cards.
  ctx.globalAlpha=page.alpha*.75;
  for(let row=0;row<5;row++){
   const yy=-ph*.32+row*ph*.145;
   stroke([[-w*.29,yy],[-w*.1,yy-ph*.025],[w*.05,yy+ph*.025],[w*.27,yy]],.8,palette.secondary);
   if((row+i)%2)stroke([[w*.04,yy-ph*.04],[w*.04,yy+ph*.055]],.8,palette.color);
  }
  ctx.restore();
 }
 // Bind the target first, then tear along a single narrow fault. Readable silhouette stays visible.
 ctx.globalCompositeOperation='lighter';ctx.globalAlpha=p.bind*p.fade;
 for(const band of [-1,1]){
  const y=ty+band*h*.2;
  ctx.strokeStyle=palette.color;ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(tx,y,span,Math.max(5,size*.2),-.1*d,0,Math.PI*2*p.bind);ctx.stroke();
  for(let i=0;i<5;i++){
   const x=tx-span+i*span*.5;
   stroke([[x,y-size*.08],[x+d*size*.07,y+size*.08]],1,palette.secondary);
  }
 }
 if(p.fracture>0){
  const top=ty-h*.31,bottom=ty+h*.31;
  const fault=Array.from({length:13},(_,i)=>[tx+d*Math.sin(i*2.7)*size*.09*p.fracture,top+(bottom-top)*i/12]);
  ctx.globalAlpha=p.fracture*.7;stroke(fault,size*.11,palette.color);
  ctx.globalAlpha=p.fracture;stroke(fault,Math.max(1,size*.025),palette.secondary);
  for(let i=0;i<12;i++){
   const a=i*2.39996,r=size*(.16+(1-p.fracture)*1.4);
   const x=tx+Math.cos(a)*r,y=ty+Math.sin(a)*h*.27;
   stroke([[x,y],[x+Math.cos(a)*size*.13,y+Math.sin(a)*size*.13]],1.2,palette.secondary);
  }
 }
 const impact=art?.impact,impactFrame=Math.floor((p.t-.65)/.35*(impact?.frames??0));
 if(impact?.image.complete&&impact.image.naturalWidth>0&&impactFrame>=0&&impactFrame<impact.frames){
  const cw=impact.image.naturalWidth/impact.cols,ch=impact.image.naturalHeight/impact.rows;
  // Source cells are square and low-resolution; never stretch to a full character height.
  const diameter=Math.min(256,h*.65);
  ctx.save();ctx.translate(tx,ty+h*.12);ctx.scale(d,1);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=p.fade*.8;
  ctx.drawImage(impact.image,impactFrame%impact.cols*cw,Math.floor(impactFrame/impact.cols)*ch,cw,ch,-diameter/2,-diameter/2,diameter,diameter);
  ctx.restore();
 }
 ctx.restore();
 return p;
}
