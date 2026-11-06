import type {VisibleBox} from './spriteMetrics';

export interface WeaponPose {x:number;y:number;angle:number;length:number;strike:number;phase:'guard'|'gather'|'cut'|'swing'|'return'}
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const homes=[[-.58,.16,-.30],[-.43,.05,-.18],[-.24,-.025,-.08],[.24,-.025,.08],[.43,.05,.18],[.58,.16,.30]];
/** Six physical props, one shared playback clock. Coordinates are stage pixels.
 * No damage settlement, viewport assumptions, random numbers or orbiting idle.
 * The authored source sword points DOWN; angle is relative to that source.
 */
export function weaponVolleyPoses(input:{caster:VisibleBox;target:VisibleBox|null;side:'p1'|'p2';sequence:string;frame:number;frames:number;hit:number;launch:number}):WeaponPose[]{
 const {caster:b,target,side,sequence,frame,frames,hit,launch}=input;
 const h=b.bottom-b.top,w=b.right-b.left,cx=(b.left+b.right)/2,dir=side==='p1'?1:-1;
 const idle=sequence==='standby'||sequence==='hited'||sequence==='transform',buff=sequence==='cp'||sequence==='extra';
 const t=clamp(frame/Math.max(1,frames-1)),wave=t*Math.PI*2;
 return homes.map(([hx,hy,tilt],i)=>{
  const home={x:cx+dir*hx*w,y:b.top+(hy+.28)*h,angle:-dir*tilt};
  const pose:WeaponPose={...home,length:h*.57,strike:0,phase:'guard'};
  if(idle){
   // Four-second closed sway: each steel blade remains perfectly rigid.
   pose.y+=(Math.sin(wave+i*.85)-Math.sin(i*.85))*h*.018;
   pose.angle+=dir*(Math.sin(wave+i*.6)-Math.sin(i*.6))*.025;
   return pose;
  }
  if(buff||!target){
   const lift=Math.sin(Math.PI*t);pose.y-=lift*h*.10;
   pose.x+=dir*hx*w*lift*.16;pose.angle+=dir*tilt*lift*.4;return pose;
  }
  const tx=(target.left+target.right)/2,th=target.bottom-target.top;
  const ty=target.top+th*(.32+(i%3)*.12),order=[0,3,1,4,2,5][i];
  // Opposite swords take turns. All six cross the victim, then return along
  // an outer path; none disappear at contact or teleport back into the fan.
  const first=Math.max(launch+2,hit-4),last=Math.min(frames-9,hit+5);
  const strike=Math.round(mix(first,Math.max(first,last),order/5));
  const start=Math.max(launch, strike-10),cutStart=strike-3,cutEnd=strike+3,end=Math.min(frames-1,strike+14);
  const gather=smooth(frame/Math.max(1,start));
  const gx=home.x-dir*hx*w*.18,gy=home.y-h*.10;
  pose.x=mix(home.x,gx,gather);pose.y=mix(home.y,gy,gather);pose.phase='gather';
  const flightAngle=Math.atan2(ty-gy,tx-gx)-Math.PI/2;
  // Shortest angular turn: P2 never spins a full revolution to face left.
  const delta=Math.atan2(Math.sin(flightAngle-home.angle),Math.cos(flightAngle-home.angle));
  pose.angle=home.angle+delta*gather;
  const cutTilt=[-.48,.48,0,-.7,.7,0][i],radius=h*.20;
  const swing=(f:number)=>{
   const theta=(clamp((f-cutStart)/6)-.5)*1.8;
   return {x:tx+dir*Math.sin(theta)*radius,y:ty+(1-Math.cos(theta))*radius,angle:-dir*(Math.PI/2+theta+cutTilt)};
  };
  const entry=swing(cutStart),exit=swing(cutEnd);
  if(frame>=start&&frame<cutStart){
   const u=smooth((frame-start)/Math.max(1,cutStart-start));
   pose.x=mix(gx,entry.x,u);pose.y=mix(gy,entry.y,u)-Math.sin(Math.PI*u)*h*(i%2?.13:-.13);
   pose.angle=flightAngle;pose.phase='cut';
  }else if(frame>=cutStart&&frame<=cutEnd){
   Object.assign(pose,swing(frame));pose.phase='swing';
  }else if(frame>cutEnd){
   const u=smooth((frame-cutEnd)/Math.max(1,end-cutEnd));
   pose.x=mix(exit.x,home.x,u);pose.y=mix(exit.y,home.y,u)-Math.sin(Math.PI*u)*h*(.23+i*.025);
   const turn=Math.atan2(Math.sin(exit.angle-home.angle),Math.cos(exit.angle-home.angle));
   pose.angle=home.angle+turn*(1-u);pose.phase='return';
  }
  pose.strike=Math.max(0,1-Math.abs(frame-strike)/3);
  return pose;
 });
}
