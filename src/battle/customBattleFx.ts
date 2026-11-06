import type {VisibleBox} from './spriteMetrics';
import {setFullscreenFxActive} from './fullscreenFx';
import {drawCustomAmbient} from './customAmbientFx';
import {createWeaponVolleyFx} from './weaponVolleyFx';
import {drawExtraSeal} from './extraSealFx';

export type CustomFxStyle='railgun'|'sigil'|'slash'|'vortex';
export interface WeaponVolleyConfig {sprite:string;held?:{sequences:readonly string[];from:number;until:number};impact?:{sprite:string;cols:number;rows:number;frames:number}}
export interface CustomFxConfig {style:CustomFxStyle;color:string;secondary:string;muzzle?:readonly [number,number];trajectory?:'orbital';focusExtra?:boolean;extraSeal?:boolean;extraSealArt?:{page:string;claw?:{open:string;closed?:string};impact?:{sprite:string;cols:number;rows:number;frames:number}};melee?:boolean;meleeSequences?:readonly string[];contactDepth?:number;ambient?:boolean;impactSheet?:string;weaponVolley?:WeaponVolleyConfig}
export const isMeleePresentationSequence=(config:CustomFxConfig|undefined,sequence:string)=>!!config?.melee&&(config.meleeSequences??['attack']).includes(sequence);
export interface CustomFxFrame {
 sequence:string;frame:number;frames:number;hits:readonly number[];
 caster:VisibleBox;target:VisibleBox|null;mirrored:boolean;
 launch?:number;muzzlePoint?:{x:number;y:number};
}
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
/** 與播放器共用影格時鐘；僅繪圖，不觸發任何戰鬥規則。 */
export function customFxPhase(sequence:string,frame:number,frames:number,hits:readonly number[],launchFrame?:number){
 const active=!['standby','hited','transform'].includes(sequence)&&frames>1;
 const previous=hits.filter(h=>h<=frame).at(-1),next=hits.find(h=>h>frame);
 const hit=previous!==undefined&&frame-previous<Math.min(12,next===undefined?12:(next-previous)/2)
  ?previous:next??previous??Math.round(frames*.55);
 const duration=Math.max(1,hit),fallback=Math.max(1,hit-Math.min(10,Math.max(3,duration*.24)));
 const launch=typeof launchFrame==='number'&&Number.isFinite(launchFrame)&&launchFrame>=0&&launchFrame<hit?launchFrame:fallback;
 return {active,hit,charge:clamp(frame/launch),travel:clamp((frame-launch)/Math.max(1,hit-launch)),
  impact:clamp((frame-hit)/Math.max(5,Math.min(18,frames-hit-1))),afterHit:frame>=hit,
  buff:sequence==='cp'||sequence==='extra',ultimate:sequence==='ultimate',launch};
}

/** 全場一張輕量畫布：光束不受角色圖集邊緣裁切，命中點每幀讀取對手實際框。 */
export function createCustomBattleFx(host:HTMLElement,config:CustomFxConfig,side:'p1'|'p2'){
 const canvas=document.createElement('canvas');canvas.dataset.customBattleFx=side;
 canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;visibility:hidden;z-index:26';
 canvas.setAttribute('aria-hidden','true');
 // 命中光效在本體(25)前、HUD(30)後；全屏底片仍留在原本的24層。
 // 若掛在底片 host 裡，實心角色會把整條落砲遮掉，只剩外圈。
 (host.parentElement??host).appendChild(canvas);const ctx=canvas.getContext('2d');const key='custom-'+side;
 const impactArt=config.impactSheet?new Image():null;
 if(impactArt)impactArt.src=config.impactSheet!;
 const sealPage=config.extraSealArt?new Image():undefined;
 if(sealPage)sealPage.src=config.extraSealArt!.page;
 const sealImpact=config.extraSealArt?.impact?new Image():undefined;
 if(sealImpact)sealImpact.src=config.extraSealArt!.impact!.sprite;
 const clawOpen=config.extraSealArt?.claw?new Image():undefined;
 const clawClosed=config.extraSealArt?.claw?.closed?new Image():undefined;
 if(clawOpen)clawOpen.src=config.extraSealArt!.claw!.open;
 if(clawClosed)clawClosed.src=config.extraSealArt!.claw!.closed!;
 const weaponVolley=config.weaponVolley?createWeaponVolleyFx(config.weaponVolley):null;
 const line=(x1:number,y1:number,x2:number,y2:number,width:number,color:string)=>{
  if(!ctx)return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
 };
 const ring=(x:number,y:number,r:number,width:number,color:string)=>{
  if(!ctx||r<=0)return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
 };
 const glow=(x:number,y:number,r:number,color:string)=>{
  if(!ctx||r<=0)return;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
 };
 const column=(x:number,top:number,bottom:number,width:number)=>{
  if(!ctx||bottom<=top)return;
  const gradient=ctx.createLinearGradient(0,top,0,bottom);
  gradient.addColorStop(0,'transparent');gradient.addColorStop(.25,config.color+'55');
  gradient.addColorStop(.82,config.color+'cc');gradient.addColorStop(1,'#eafaff');
  ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(x-width*.62,top);ctx.lineTo(x+width*.62,top);
  ctx.quadraticCurveTo(x+width*.38,bottom-width*.55,x+width*.12,bottom);ctx.lineTo(x-width*.12,bottom);
  ctx.quadraticCurveTo(x-width*.38,bottom-width*.55,x-width*.62,top);ctx.fill();
  const core=ctx.createLinearGradient(0,top,0,bottom);core.addColorStop(0,'transparent');core.addColorStop(.6,'#d9f7ff99');core.addColorStop(1,'white');
  ctx.fillStyle=core;ctx.beginPath();ctx.moveTo(x-width*.1,top);ctx.lineTo(x+width*.1,top);ctx.lineTo(x+width*.035,bottom);ctx.lineTo(x-width*.035,bottom);ctx.closePath();ctx.fill();
 };
 const blades=(x:number,y:number,size:number,travel:number,tx:number,ty:number)=>{
  if(!ctx)return;ctx.save();ctx.globalCompositeOperation='source-over';
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3,orbit=size*(.22+(1-travel)*.9),px=x+Math.cos(a)*orbit,py=y+Math.sin(a)*orbit;
   ctx.save();ctx.translate(px,py);ctx.rotate(Math.atan2(ty-py,tx-px));
   ctx.fillStyle='#050c08';ctx.strokeStyle=config.color;ctx.lineWidth=1.5;
   ctx.beginPath();ctx.moveTo(size*.9,0);ctx.lineTo(-size*.35,-size*.12);ctx.lineTo(-size*.62,0);ctx.lineTo(-size*.35,size*.12);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }ctx.restore();
 };
 let lastSequence='',lastFrame=-1,contact:{x:number;y:number}|null=null;
 return {
  draw(state:CustomFxFrame){
   if(state.sequence!==lastSequence||state.frame<lastFrame)contact=null;
   lastSequence=state.sequence;lastFrame=state.frame;
   if(!ctx)return;const rect=host.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return;
   // 限制畫布解像度；不額外載入圖集，也不因高 DPR 暴增面積。
   const ratio=Math.min(window.devicePixelRatio||1,1.25),w=Math.round(rect.width*ratio),h=Math.round(rect.height*ratio);
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,rect.width,rect.height);
   const p=customFxPhase(state.sequence,state.frame,state.frames,state.hits,state.launch);
   const ambient=state.sequence==='standby'&&config.ambient===true;
   setFullscreenFxActive(key,p.active);canvas.style.visibility=p.active||ambient||weaponVolley?'visible':'hidden';
   canvas.dataset.phase=!p.active?'idle':p.buff?'buff':p.afterHit?'impact':state.frame>=p.launch?'flight':'charge';
   canvas.dataset.impact=String(p.impact);
   canvas.dataset.sequence=state.sequence;
   canvas.dataset.style=config.style;
   // Explicit authoring opt-in: ordinary/public assets keep their old route.
   // No overlay of six new swords over a drawing that still contains six.
   if(weaponVolley){
    canvas.dataset.weaponVolley=weaponVolley.draw(ctx,state,rect,side,p.hit,p.launch)?'ready':'pending';
    return;
   }
   if(ambient){drawCustomAmbient(ctx,state,rect,config);return;}
   if(!p.active)return;
   if(config.extraSeal&&state.sequence==='extra'&&state.target){
    canvas.dataset.sealVersion='book-v3';
    canvas.dataset.sealImpact=config.extraSealArt?.impact?.sprite??'none';
    const seal=drawExtraSeal(ctx,{...state,target:state.target},rect,side,config,{page:sealPage,claw:clawOpen?{open:clawOpen,closed:clawClosed}:undefined,impact:sealImpact?{...config.extraSealArt!.impact!,image:sealImpact}:undefined});
    canvas.dataset.phase=seal.t<.4?'inscribe':seal.t<.67?'bind':seal.t<.87?'seal':'recover';
    return;
   }
   const own=state.caster,other=state.target,m=config.muzzle??[.5,.45],u=state.mirrored?1-m[0]:m[0];
   const sx=(state.muzzlePoint?.x??(own.left+(own.right-own.left)*u))-rect.left,sy=(state.muzzlePoint?.y??(own.top+(own.bottom-own.top)*m[1]))-rect.top;
   const physical=isMeleePresentationSequence(config,state.sequence);
   // Keep the hit at its contact point while the sword returns to rest.
   // Following the recovery pose would drag the explosion back with the blade.
   if(physical&&p.afterHit&&!contact&&state.muzzlePoint)contact={x:sx,y:sy};
   const tx=physical&&state.muzzlePoint?(contact?.x??sx):other?(other.left+other.right)/2-rect.left:sx;
   const ty=physical&&state.muzzlePoint?(contact?.y??sy):other?other.top+(other.bottom-other.top)*.44-rect.top:sy;
   canvas.dataset.from=`${sx.toFixed(1)},${sy.toFixed(1)}`;canvas.dataset.to=`${tx.toFixed(1)},${ty.toFixed(1)}`;
   const size=Math.max(18,Math.min(90,(own.bottom-own.top)*.16)),t=state.frame/Math.max(1,state.frames-1);
   ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
   if(p.buff){
    const x=(own.left+own.right)/2-rect.left,y=own.top+(own.bottom-own.top)*.6-rect.top,a=Math.sin(Math.PI*t);
    ctx.globalAlpha=a*.8;glow(x,y,size*2.6,config.color);ring(x,y,size*(.6+t*1.8),3,config.secondary);
    for(let i=0;i<12;i++){const angle=i*Math.PI/6+t*2;line(x+Math.cos(angle)*size,y+Math.sin(angle)*size,x+Math.cos(angle)*size*1.2,y+Math.sin(angle)*size*1.2,2,config.color);}
    if(config.focusExtra&&state.sequence==='extra'&&other){
     const strength=Math.sin(Math.PI*t),r=size*(1.2+t*.8);ctx.globalAlpha=strength;
     ring(tx,ty,r,3,config.color);ring(tx,ty,r*.78,1.5,config.secondary);
     for(let i=0;i<6;i++){
      const a=i*Math.PI/3+t*Math.PI,b=a+Math.PI*2/3;
      line(tx+Math.cos(a)*r,ty+Math.sin(a)*r,tx+Math.cos(b)*r,ty+Math.sin(b)*r,2,config.secondary);
     }
     // 魔咒由多個刻印向對手收束，保留正式額外行動的既有結算時點。
     for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5,orbit=r*(2.4-1.8*t),px=tx+Math.cos(a)*orbit,py=ty+Math.sin(a)*orbit;
      glow(px,py,size*.45,config.color);line(px,py,tx,ty,1.5,config.secondary);
     }
     glow(tx,ty,size*(.6+strength),config.color);
     // Unwritten pages gather over the victim, then seal into a vertical rift.
     // A different silhouette from the ordinary round spell projectile.
     ctx.globalCompositeOperation='source-over';
     for(let i=0;i<7;i++){
      const gather=clamp(t*2-i*.065),angle=(i-3)*.22;
      const px=tx+(i-3)*size*(2.6-2.2*gather),py=ty-size*(1.5+.22*Math.abs(i-3))+(1-gather)*size*.6;
      ctx.save();ctx.translate(px,py);ctx.rotate(angle);ctx.globalAlpha=strength*.8;
      ctx.fillStyle='#1c0d2c';ctx.strokeStyle=config.color;ctx.lineWidth=1.2;
      ctx.fillRect(-size*.20,-size*.32,size*.4,size*.64);ctx.strokeRect(-size*.20,-size*.32,size*.4,size*.64);
      ctx.strokeStyle=config.secondary;
      for(let j=0;j<4;j++)line(-size*.13,-size*.22+j*size*.13,size*(j%2?.09:.14),-size*.17+j*size*.13,1,config.secondary);
      ctx.restore();
     }
     const close=clamp((t-.48)/.34);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=strength;
     for(const s of [-1,1]){
      const bx=tx+s*size*(1.3-close*.9);ctx.strokeStyle=config.color;ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(bx,ty-size*1.5);ctx.lineTo(bx+s*size*.18,ty-size*.5);ctx.lineTo(bx-s*size*.12,ty+size*.5);ctx.lineTo(bx,ty+size*1.4);ctx.stroke();
     }
     if(t>.6){const flash=Math.sin(Math.PI*clamp((t-.6)/.4));ctx.globalAlpha=flash*.8;line(tx,ty-size*1.7,tx,ty+size*1.5,Math.max(1,size*.08*flash),config.secondary);}
    }
   }else{
    const melee=isMeleePresentationSequence(config,state.sequence);
    // 咒術師的普通技能收斂，視覺重點交給額外行動。
    const emphasis=config.focusExtra ? .38 : 1;
    const chargeFade=p.afterHit?Math.max(0,1-p.impact*3):1;
    ctx.globalAlpha=chargeFade*(.2+p.charge*.7)*emphasis*(melee ? .18 : 1);glow(sx,sy,size*(.6+p.charge),config.color);
    ring(sx,sy,size*(1.45-p.charge*.9),2,config.secondary);
    for(let i=0;i<8;i++){const a=i*Math.PI/4+state.frame*.035;line(sx+Math.cos(a)*size*.8,sy+Math.sin(a)*size*.8,sx+Math.cos(a)*size,sy+Math.sin(a)*size,2,config.color);}
    if(other&&state.frame>=p.launch){
     const x=sx+(tx-sx)*p.travel,y=sy+(ty-sy)*p.travel;
     ctx.globalAlpha=(p.afterHit?Math.max(0,1-p.impact*3):1)*emphasis;
     if(melee){
      // Contact swipe stays on the opponent: no travelling magic projectile.
      if(p.travel>.55){
       ctx.save();ctx.translate(tx,ty);ctx.scale(side==='p1'?1:-1,1);
       const sweep=(p.travel-.55)/.45;ctx.strokeStyle=config.color;ctx.lineWidth=size*.09;
       ctx.beginPath();ctx.ellipse(-size*.2,0,size*1.4,size*.8,-.65,-1.2,-1.2+sweep*2.5);ctx.stroke();
       ctx.strokeStyle=config.secondary;ctx.lineWidth=2;ctx.stroke();ctx.restore();
      }
     }else if(config.style==='railgun'){
      if(config.trajectory==='orbital'){
       // Hold the descending column through impact; a one-frame flash followed
       // only by circles makes a heavy cannon read like a weak status effect.
       ctx.globalAlpha=(p.afterHit?Math.pow(1-p.impact,.65):1)*emphasis;
       // The barrel is aimed upwards, so the outgoing shot must follow its
       // elevation rather than tracking the enemy directly from the muzzle.
       const direction=side==='p1'?1:-1,skyY=Math.min(sy-size,Math.max(16,sy-size*4)),skyX=sx+direction*(sy-skyY)*.47;
       const rise=clamp(p.travel/.42),fall=clamp((p.travel-.42)/.58);
       if(p.travel<.65){
        const ex=sx+(skyX-sx)*rise,ey=sy+(skyY-sy)*rise;
        line(sx,sy,ex,ey,size*.22,config.color);line(sx,sy,ex,ey,Math.max(2,size*.07),'#f0fbff');glow(ex,ey,size*.6,config.secondary);
       }
       if(p.travel>=.42){
        const top=Math.max(110,ty-size*5),fy=top+(ty-top)*fall,thickness=size*(p.ultimate ? 1.9 : 1.15);
        column(tx,top,fy,thickness);
        glow(tx,fy,size*(p.ultimate?1.7:1.15),config.secondary);
        // Two brief satellite strikes keep the ultimate broad without
        // stretching or moving the character drawing.
        if(p.ultimate&&fall>.45)for(const offset of [-1,1]){
         const bx=tx+offset*thickness*.85;
         column(bx,top,top+(ty-top)*clamp((fall-.2)/.8),thickness*.23);
        }
        line(tx-thickness*.9,top,tx-thickness*.5,fy,2,config.secondary);line(tx+thickness*.9,top,tx+thickness*.5,fy,2,config.secondary);
       }
      }else{line(sx,sy,x,y,size*(p.ultimate ? .32 : .15),config.color);line(sx,sy,x,y,Math.max(2,size*.055),'#eefaff');glow(x,y,size*.8,config.secondary);}
     }else if(config.style==='slash'){
      const a=Math.atan2(ty-sy,tx-sx),r=size*(p.ultimate?2.4:1.5);
      ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.strokeStyle=config.color;ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,r,-1.25,1.25);ctx.stroke();ctx.strokeStyle='#fff4dc';ctx.lineWidth=2;ctx.stroke();ctx.restore();
     }else if(config.style==='sigil'){
      ctx.save();ctx.translate(x,y);ctx.rotate(state.frame*.035);ctx.strokeStyle=config.color;ctx.lineWidth=3;
      ctx.strokeRect(-size*.48,-size*.48,size*.96,size*.96);ctx.rotate(Math.PI/4);ctx.strokeStyle=config.secondary;ctx.lineWidth=1.5;ctx.strokeRect(-size*.48,-size*.48,size*.96,size*.96);ctx.restore();
      glow(x,y,size*.75,config.color);
     }else{
      // 黑色刀身以 normal 混合保留，刃光再用加法混合，黑色不會被吃成透明。
      blades(x,y,size,p.travel,tx,ty);
      for(let i=0;i<3;i++){const a=state.frame*.14+i*Math.PI*2/3;glow(x+Math.cos(a)*size*.35,y+Math.sin(a)*size*.35,size*.55,config.color);}
      ring(x,y,size*.58,2,config.secondary);
     }
    }
    if(other&&p.afterHit&&p.impact<1){
     const a=1-p.impact,r=size*(.5+p.impact*(config.trajectory==='orbital'?5:p.ultimate?4:2.5));ctx.globalAlpha=a*emphasis;
     if(melee){
      ctx.save();ctx.translate(tx,ty);ctx.rotate(side==='p1'?-.55:.55);
      ctx.fillStyle=config.secondary;ctx.beginPath();ctx.moveTo(-size*1.2*a,0);ctx.lineTo(0,-size*.08*a);ctx.lineTo(size*1.2*a,0);ctx.lineTo(0,size*.08*a);ctx.closePath();ctx.fill();
      ctx.restore();glow(tx,ty,size*.45*a,config.color);
     }else{glow(tx,ty,r*.95,config.color);ring(tx,ty,r,Math.max(1,4*a),config.secondary);ring(tx,ty,r*.65,1.5,config.color);}
     if(config.trajectory==='orbital'){
      const floor=other.bottom-rect.top;ctx.strokeStyle=config.secondary;ctx.lineWidth=Math.max(1,4*a);
      ctx.beginPath();ctx.ellipse(tx,floor,r*1.1,r*.2,0,0,Math.PI*2);ctx.stroke();
      glow(tx,ty,size*1.8*a,config.secondary);
      // Initial blast, rolling smoke, ballistic debris and a ground shock front.
      // Independent phases prevent a single expanding circle reading as a buff.
      const explosion=p.impact,burst=Math.sin(Math.PI*Math.min(1,explosion*2.5));
      ctx.globalCompositeOperation='source-over';
      for(let i=0;i<9;i++){
       const angle=i*2.39996,spread=size*(.25+explosion*2.8),px=tx+Math.cos(angle)*spread,py=ty+Math.sin(angle)*spread*.55-explosion*size;
       ctx.globalAlpha=(1-explosion)*.45;glow(px,py,size*(.6+explosion*.8),'#26364f');
      }
      if(impactArt?.complete&&impactArt.naturalWidth){
       const cell=Math.min(5,Math.floor(explosion*6)),cw=impactArt.naturalWidth/3,ch=impactArt.naturalHeight/2;
       const ew=size*(p.ultimate?7:5.5),eh=ew;ctx.globalAlpha=Math.min(1,(1-explosion)*2);
       ctx.drawImage(impactArt,cell%3*cw,Math.floor(cell/3)*ch,cw,ch,tx-ew/2,floor-eh*.88,ew,eh);
      }
      ctx.globalCompositeOperation='lighter';ctx.globalAlpha=burst*.75;
      glow(tx,ty,size*(1.4+explosion),'#fff0ca');
      for(let i=0;i<16;i++){
       const angle=i*2.39996,velocity=1+(i%4)*.35,dx=Math.cos(angle)*size*explosion*4*velocity,dy=-Math.abs(Math.sin(angle))*size*explosion*4+size*explosion*explosion*3;
       ctx.globalAlpha=(1-explosion)*.8;line(tx+dx,ty+dy,tx+dx-Math.cos(angle)*size*.18,ty+dy+size*.12,2, i%3?'#d9f7ff':'#ffb45c');
      }
     }
     for(let i=0;i<(p.ultimate?18:12);i++){
      const angle=i*2.39996+side.length,spread=r*(.8+(i%3)*.2);
      line(tx+Math.cos(angle)*spread,ty+Math.sin(angle)*spread,tx+Math.cos(angle)*(spread+size*.28*a),ty+Math.sin(angle)*(spread+size*.28*a),1.5,config.secondary);
     }
     if(config.style==='slash')for(let i=0;i<3;i++)line(tx-r*.8,ty-r*.6+i*size*.3,tx+r*.8,ty+r*.6+i*size*.3,3*a,config.secondary);
     if(config.style==='vortex'&&!melee)for(let i=0;i<6;i++){
      const angle=i*Math.PI/3+state.frame*.12;ctx.strokeStyle=config.secondary;ctx.lineWidth=2*a;ctx.beginPath();
      ctx.moveTo(tx+Math.cos(angle)*r,ty+Math.sin(angle)*r);ctx.quadraticCurveTo(tx+Math.cos(angle+1)*r*.55,ty+Math.sin(angle+1)*r*.55,tx,ty);ctx.stroke();
     }
     // Black blade silhouettes must be drawn after the additive impact glow;
     // otherwise the flash washes out all six blades at the decisive moment.
     if(config.style==='vortex'&&!melee)blades(tx,ty,size,1,tx,ty);
    }
   }
   ctx.restore();
  },
  destroy(){weaponVolley?.destroy();setFullscreenFxActive(key,false);canvas.remove();},
 };
}
