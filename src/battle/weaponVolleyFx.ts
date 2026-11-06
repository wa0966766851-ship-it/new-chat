import type {CustomFxFrame,WeaponVolleyConfig} from './customBattleFx';
import {weaponVolleyPoses} from './weaponVolleyMotion';

/** Optional prop-layer pilot. One decoded image is shared by all six blades.
 * Its body drawing must have the baked-in weapons removed before opting in.
 */
export const weaponIsHeld=(config:WeaponVolleyConfig,sequence:string,frame:number)=>!!config.held&&config.held.sequences.includes(sequence)&&frame>=config.held.from&&frame<config.held.until;
export function createWeaponVolleyFx(config:WeaponVolleyConfig){
 const image=new Image();image.decoding='async';image.src=config.sprite;
 const impact=config.impact?new Image():null;if(impact){impact.decoding='async';impact.src=config.impact!.sprite;}
 let failed=false;image.onerror=()=>{failed=true;};
 let rest:CustomFxFrame['caster']|null=null;
 return {
  draw(ctx:CanvasRenderingContext2D,state:CustomFxFrame,rect:DOMRect,side:'p1'|'p2',hit:number,launch:number){
   if(config.impact)ctx.canvas.dataset.weaponImpact=impact?.complete&&impact.naturalWidth?'ready':'pending';
   if(failed||!image.complete||!image.naturalWidth)return false;
   if(state.sequence==='standby')rest={...state.caster};
   // A lunging drawing is wider and lower. Its five support swords must not
   // abruptly shrink or spread to the width of the extended hand-held blade.
   const box=rest?{left:(state.caster.left+state.caster.right)/2-(rest.right-rest.left)/2,right:(state.caster.left+state.caster.right)/2+(rest.right-rest.left)/2,top:state.caster.bottom-(rest.bottom-rest.top),bottom:state.caster.bottom}:state.caster;
   const input={...state,caster:box,side,hit,launch},poses=weaponVolleyPoses(input),held=weaponIsHeld(config,state.sequence,state.frame);
   ctx.save();ctx.globalCompositeOperation='source-over';
   // A short swept ribbon follows the actual sword geometry, rather than
   // translating a slash icon across the stage. No stored/independent clock.
   for(let age=4;age>0;age--){
    const before=weaponVolleyPoses({...input,frame:Math.max(0,state.frame-age)});
    const after=weaponVolleyPoses({...input,frame:Math.max(0,state.frame-age+1)});
    for(let i=0;i<6;i++){
     const p=before[i],q=after[i];if(q.phase!=='swing'||held&&i===0)continue;
     const point=(v:typeof p,k:number)=>({x:v.x-Math.sin(v.angle)*v.length*k-rect.left,y:v.y+Math.cos(v.angle)*v.length*k-rect.top});
     const a=point(p,.47),b=point(q,.47);
     ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=(5-age)*.065;
     // A filled quad between rotated blades becomes a conspicuous green
     // triangle. Trace only the cutting tip; keep the steel blade readable.
     ctx.strokeStyle='#1ba357';ctx.lineWidth=4;ctx.lineCap='round';
     ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
     ctx.strokeStyle='#b9ffd0';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
    }
   }
   for(const [i,p] of poses.entries()){
    if(held&&i===0)continue; // This sword is in the actor drawing, not a seventh prop.
    const x=p.x-rect.left,y=p.y-rect.top,width=p.length*image.naturalWidth/image.naturalHeight;
    // A dark steel core stays opaque. Only the thin afterimage uses additive
    // mixing, so the weapons cannot turn into six luminous green triangles.
    if(p.phase==='cut'){
     ctx.save();ctx.translate(x,y);ctx.rotate(p.angle);ctx.globalAlpha=.34;
     ctx.strokeStyle='#62d77d';ctx.lineWidth=Math.max(1,width*.05);
     ctx.beginPath();ctx.moveTo(0,-p.length*.7);ctx.lineTo(0,p.length*.42);ctx.stroke();ctx.restore();
    }
    ctx.save();ctx.translate(x,y);ctx.rotate(p.angle);ctx.drawImage(image,-width/2,-p.length/2,width,p.length);ctx.restore();
    if(p.strike>0){
     ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=p.strike;
     ctx.strokeStyle='#b5ffd0';ctx.lineWidth=1.8;ctx.translate(x,y);ctx.rotate(p.angle);
     ctx.beginPath();ctx.moveTo(-width*.7,-p.length*.24);ctx.lineTo(width*.7,p.length*.24);ctx.stroke();ctx.restore();
     ctx.save();ctx.globalCompositeOperation='lighter';
     for(let j=0;j<7;j++){
      const a=j*2.399+i*.75,r=(1-p.strike)*p.length*.42;
      ctx.globalAlpha=p.strike*.8;ctx.strokeStyle=j%2?'#65e79b':'#dbffe4';ctx.lineWidth=j%2?1:2;
      ctx.beginPath();ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r*.6);ctx.lineTo(x+Math.cos(a)*(r+p.length*.07),y+Math.sin(a)*(r+p.length*.07)*.6);ctx.stroke();
     }
     ctx.restore();
    }
   }
   if(impact?.complete&&impact.naturalWidth&&config.impact&&state.target&&['attack','ultimate','sa'].includes(state.sequence)){
    const f=Math.floor(state.frame-hit),sheet=config.impact;
    if(f>=0&&f<sheet.frames){
     ctx.canvas.dataset.weaponImpactFrame=String(f);
     const target=state.target,size=Math.min(target.bottom-target.top,(box.bottom-box.top)*.75);
     const cw=impact.naturalWidth/sheet.cols,ch=impact.naturalHeight/sheet.rows;
     ctx.save();ctx.translate((target.left+target.right)/2-rect.left,(target.top+target.bottom)/2-rect.top);
     ctx.scale(side==='p1'?1:-1,1);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.8;
     ctx.drawImage(impact,f%sheet.cols*cw,Math.floor(f/sheet.cols)*ch,cw,ch,-size/2,-size/2,size,size);ctx.restore();
    }else delete ctx.canvas.dataset.weaponImpactFrame;
   }
   ctx.restore();return true;
  },
  destroy(){image.onerror=null;image.onload=null;image.removeAttribute('src');impact?.removeAttribute('src');},
 };
}
