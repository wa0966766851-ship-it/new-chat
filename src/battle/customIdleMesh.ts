export interface CustomIdleZone {kind:'breath'|'cloth';x:number;y:number;rx:number;ry:number;dx?:number;dy?:number;delay?:number;cycles?:number}
export interface CustomIdlePin {x:number;y:number;rx:number;ry:number}
export interface CustomIdleOptions {grid?:readonly [number,number];pins?:readonly CustomIdlePin[]}
/** Connected local deformation: pinned face/feet, a closed four-second cycle. */
export function customIdleMesh(box:readonly number[],uv:readonly number[],canvas:readonly number[],ppu:number,phase:number,zones:readonly CustomIdleZone[],options:CustomIdleOptions={}){
 const [l,t,w,h]=box,[cw,ch]=canvas;
 const cols=Math.max(2,Math.min(48,Math.round(options.grid?.[0]??16)));
 const rows=Math.max(2,Math.min(64,Math.round(options.grid?.[1]??22))),cells=[];
 const point=(x:number,y:number)=>{
  let dx=0,dy=0;
  for(const z of zones){
   const nx=(x/cw-z.x)/z.rx,ny=(y/ch-z.y)/z.ry,r=nx*nx+ny*ny;if(r>=1)continue;
   const angle=phase*Math.PI*2*(z.cycles??1);
   const weight=(1-r)**2,wave=z.kind==='breath'?(1-Math.cos(angle))/2:Math.sin(angle+(z.delay??0))-Math.sin(z.delay??0);
   dx+=(z.dx??0)*weight*wave;dy+=(z.dy??0)*weight*wave;
  }
  // A rigid inner ellipse and smooth outer falloff keep faces, boots and weapons
  // intact without cutting them out of the original texture.
  let movable=1;
  for(const pin of options.pins??[]){
   const r=Math.sqrt(((x/cw-pin.x)/pin.rx)**2+((y/ch-pin.y)/pin.ry)**2);
   const t=Math.max(0,Math.min(1,(r-.7)/.3));
   movable*=t*t*(3-2*t);
  }
  return [(x+dx*movable)/ppu,(ch-y-dy*movable)/ppu];
 };
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const x0=l+w*i/cols,x1=l+w*(i+1)/cols,y0=t+h*j/rows,y1=t+h*(j+1)/rows;
  const u0=uv[0]+(uv[2]-uv[0])*i/cols,u1=uv[0]+(uv[2]-uv[0])*(i+1)/cols;
  const v0=uv[1]+(uv[3]-uv[1])*j/rows,v1=uv[1]+(uv[3]-uv[1])*(j+1)/rows;
  cells.push({p:[...point(x0,y0),...point(x1,y0),...point(x1,y1),...point(x0,y1)],u:[u0,v0,u1,v0,u1,v1,u0,v1]});
 }return cells;
}
