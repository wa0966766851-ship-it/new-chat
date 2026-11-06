/** Rigid authored props: one rotation/translation for all four corners.
 * No UV flow, per-pixel displacement or elliptic center stretching.
 */
export function rigidAttachmentQuad(c,uv,canvas,ppu,part,phase){
 const wave=Math.sin(phase*Math.PI*2*(part.cycles??1)+(part.delay??0))-Math.sin(part.delay??0);
 const angle=(part.degrees??0)*Math.PI/180*wave,co=Math.cos(angle),si=Math.sin(angle),p=[];
 for(let i=0;i<8;i+=2){
  const x=c[i]*ppu-part.pivot[0],y=canvas[1]-c[i+1]*ppu-part.pivot[1];
  p.push((part.pivot[0]+x*co-y*si+(part.dx??0)*wave)/ppu,
   (canvas[1]-part.pivot[1]-x*si-y*co-(part.dy??0)*wave)/ppu);
 }
 return {p,u:[uv[0],uv[1],uv[2],uv[1],uv[2],uv[3],uv[0],uv[3]]};
}
