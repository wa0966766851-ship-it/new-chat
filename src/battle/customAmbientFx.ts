import type {CustomFxConfig,CustomFxFrame} from './customBattleFx';

/** Anchored ambient details, no spinning orbit and no whole-character motion. */
export function drawCustomAmbient(ctx:CanvasRenderingContext2D,state:CustomFxFrame,rect:DOMRect,config:CustomFxConfig){
 const b=state.caster,w=b.right-b.left,h=b.bottom-b.top,x=(b.left+b.right)/2-rect.left,y=b.top-rect.top;
 const t=state.frame/Math.max(1,state.frames-1)*Math.PI*2,pulse=.5-.5*Math.cos(t);
 ctx.save();ctx.globalCompositeOperation='lighter';
 const mote=(px:number,py:number,r:number,alpha:number)=>{
  ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(px,py,0,px,py,r*4);g.addColorStop(0,config.secondary);g.addColorStop(.25,config.color);g.addColorStop(1,'transparent');
  ctx.fillStyle=g;ctx.fillRect(px-r*4,py-r*4,r*8,r*8);
 };
 if(config.style==='railgun'){
  // Power cells pulse in place. Nothing rotates around the face or weapon.
  const dir=state.mirrored?-1:1;
  for(let i=0;i<3;i++)mote(x+dir*w*(.08+i*.035),y+h*(.38+i*.035),1.6,.14+pulse*.22);
 }else if(config.style==='sigil'){
  // Ghost's eyes and a few rising wisps; paths close at the loop boundary.
  mote(x-w*.08,y+h*.17,1.5,.16+pulse*.16);mote(x+w*.04,y+h*.17,1.5,.16+pulse*.16);
  for(let i=0;i<5;i++){
   const a=t+i*1.6;ctx.globalAlpha=.08+.1*(.5+.5*Math.sin(a));ctx.strokeStyle=config.color;ctx.lineWidth=1;
   const px=x+(i-2)*w*.09,py=y+h*(.25+i*.06)-Math.sin(t)*h*.006;
   ctx.beginPath();ctx.moveTo(px,py+14);ctx.bezierCurveTo(px-4,py+5,px+4,py-4,px,py-14);ctx.stroke();
  }
 }else if(config.style==='vortex'){
  for(let i=0;i<6;i++)mote(x+(i-2.5)*w*.11,y+h*(.14+Math.abs(i-2.5)*.04),1,.08+.16*(.5+.5*Math.sin(t+i*.8)));
 }else{
  for(let i=0;i<4;i++)mote(x+(i-1.5)*w*.14,y+h*(.3+i*.1),1.2,.1+pulse*.15);
 }
 ctx.restore();
}
