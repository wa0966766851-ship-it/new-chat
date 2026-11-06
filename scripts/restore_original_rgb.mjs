/** Offline conservation step after ImageGen matte extraction; no runtime dependency.
 * Requires the exact same-size source and registered mask. Saves a sibling candidate.
 * High-confidence eroded interiors retain original RGB byte-for-byte.
 * Only soft boundaries are decontaminated against white.
 * This cannot certify faint-effect completeness: inspect on both dark and light.
 */
import fs from 'node:fs';
import {PNG} from 'pngjs';
const [sourceFile,maskFile,outFile]=process.argv.slice(2);
if(!outFile||outFile===sourceFile||outFile===maskFile)throw Error('Usage: source mask new-output');
const source=PNG.sync.read(fs.readFileSync(sourceFile)),mask=PNG.sync.read(fs.readFileSync(maskFile));
if(source.width!==mask.width||source.height!==mask.height)throw Error('Mask dimensions differ; do not rescale automatically');
const out=new PNG({width:source.width,height:source.height});
let protectedPixels=0,changedProtectedRGB=0;
for(let j=0;j<source.data.length;j+=4){
 const rgb=[source.data[j],source.data[j+1],source.data[j+2]],pixel=j/4,x=pixel%source.width,y=Math.floor(pixel/source.width);
 let interior=mask.data[j+3]>=250;
 for(let dy=-3;interior&&dy<=3;dy++)for(let dx=-3;interior&&dx<=3;dx++){
  const nx=x+dx,ny=y+dy;
  if(nx<0||ny<0||nx>=source.width||ny>=source.height||mask.data[(ny*source.width+nx)*4+3]<250)interior=false;
 }
 // White-paper colour-to-alpha only at boundaries. Do not turn white hair translucent.
 const colourAlpha=1-Math.min(...rgb)/255;
 const blueEnergy=rgb[2]-rgb[0]>15&&rgb[2]-rgb[1]>5;
 // The generated mask is not authoritative inside dark coat/skin/metal.
 // Keep those original regions solid even when its mask has false holes.
 const solid=interior||(Math.min(...rgb)<225&&!blueEnergy);
 const a=solid?1:colourAlpha>=.025&&(mask.data[j+3]>2||Math.min(...rgb)<230)?colourAlpha:0;
 for(let c=0;c<3;c++)out.data[j+c]=a===1?rgb[c]:a>0?Math.max(0,Math.min(255,Math.round((rgb[c]-255*(1-a))/a))):0;
 out.data[j+3]=Math.round(a*255);
 if(solid){protectedPixels++;if(rgb.some((v,c)=>v!==out.data[j+c]))changedProtectedRGB++;}
}
fs.writeFileSync(outFile,PNG.sync.write(out));
console.log(JSON.stringify({source:[source.width,source.height],protectedPixels,changedProtectedRGB,output:outFile,note:'Candidate: alpha edges and faint effects need visual review.'},null,2));
