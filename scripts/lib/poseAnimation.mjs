import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {rigidAttachmentQuad} from './rigidAttachments.mjs';

const fail = message => { throw new Error(message); };
const finitePair = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

/** Fixed-canvas replacement drawings. No automatic centering, stretching or crossfade. */
export function compilePoseAnimation(spec, readImage) {
  if (!/^\w+$/.test(spec.id ?? '')) fail('Invalid animation ID');
  if (!['left', 'right', 'front'].includes(spec.facing)) fail('Source facing must be explicit');
  const [width, height] = spec.canvas ?? [];
  if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 4096)) fail('Invalid fixed canvas');
  if (!Number.isFinite(spec.fps) || spec.fps < 1 || spec.fps > 60) fail('Invalid frame rate');
  if (!finitePair(spec.anchor) || spec.anchor[0] < 0 || spec.anchor[0] > width || spec.anchor[1] < 0 || spec.anchor[1] > height) fail('Invalid shared anchor');
  const ppu = spec.pixelsPerUnit ?? 100;
  if (!Number.isFinite(ppu) || ppu <= 0) fail('Invalid pixelsPerUnit');
  if(spec.idleGrid&&(!finitePair(spec.idleGrid)||spec.idleGrid.some((v,i)=>!Number.isInteger(v)||v<2||v>[48,64][i]))) fail('Invalid idle grid');
  for(const item of [...(spec.idleZones??[]),...(spec.idlePins??[])]){
    if(!['x','y','rx','ry'].every(k=>Number.isFinite(item[k]))||item.rx<=0||item.ry<=0) fail('Invalid idle region');
    if(!['dx','dy','delay'].every(k=>item[k]===undefined||Number.isFinite(item[k]))) fail('Invalid idle displacement');
  }
  if((spec.idleZones??[]).some(z=>!['breath','cloth'].includes(z.kind))) fail('Invalid idle wave');
  if((spec.idleZones??[]).some(z=>z.cycles!==undefined&&(!Number.isInteger(z.cycles)||z.cycles<1||z.cycles>4))) fail('Invalid idle cycles');
  const poses = new Map(), unique = new Map();
  for (const [id, pose] of Object.entries(spec.poses ?? {})) {
    if (pose.facing !== undefined && pose.facing !== spec.facing) fail(`${id}: pose facing differs; normalize the reviewed drawing before import`);
    if (pose.review?.accepted !== true || !pose.review?.note?.trim()) fail(`${id}: drawing has not passed visual review`);
    const bytes = readImage(pose.file);
    const sha256 = hash(bytes);
    if (sha256 !== pose.sha256) fail(`${id}: reviewed image has changed`);
    const png = PNG.sync.read(bytes);
    if (png.width !== width || png.height !== height) fail(`${id}: canvas differs; align the drawing before import`);
    let left = width, top = height, right = -1, bottom = -1, transparent = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const a = png.data[(y * width + x) * 4 + 3];
      if (a < 8) transparent++;
      if (a <= 16) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < left) fail(`${id}: empty drawing`);
    if (transparent / (width * height) < .02) fail(`${id}: missing transparent background`);
    const margin = spec.margin ?? 2;
    if (!Number.isInteger(margin) || margin < 0 || margin > Math.min(width, height) / 2) fail('Invalid safety margin');
    if (left < margin || top < margin || right >= width - margin || bottom >= height - margin) fail(`${id}: artwork touches canvas edge; inspect head, weapon and feet`);
    for (const [name, point] of Object.entries(pose.anchors ?? {})) {
      if (!finitePair(point) || point[0] < 0 || point[0] >= width || point[1] < 0 || point[1] >= height) fail(`${id}: invalid ${name} anchor`);
    }
    const tile = unique.get(sha256) ?? {png, sha256, box: [left, top, right - left + 1, bottom - top + 1]};
    unique.set(sha256, tile); poses.set(id, {tile, anchors: pose.anchors ?? {}, review: pose.review});
  }
  if (!poses.size) fail('No reviewed drawings');
  if((spec.rigidAttachments?.length??0)>32)fail('Too many rigid attachments');
  if(spec.rigidAttachments?.length&&spec.idleZones?.length)fail('Rigid attachments cannot use the legacy displacement field');
  for(const part of spec.rigidAttachments??[]){
    if(!poses.has(part.pose)||!poses.has(part.basePose)||part.pose===part.basePose)fail('Invalid rigid attachment pose');
    if(!finitePair(part.pivot)||!['dx','dy','degrees','delay'].every(k=>part[k]===undefined||Number.isFinite(part[k])))fail('Invalid rigid attachment transform');
    if(part.cycles!==undefined&&(!Number.isInteger(part.cycles)||part.cycles<1||part.cycles>4))fail('Invalid rigid attachment cycles');
    if(part.behind!==undefined&&typeof part.behind!=='boolean')fail('Invalid rigid attachment layer');
    if(part.anchors!==undefined&&(!Array.isArray(part.anchors)||new Set(part.anchors).size!==part.anchors.length||part.anchors.some(name=>!finitePair(poses.get(part.basePose).anchors[name]))))fail('Invalid rigid attachment anchors');
  }
  const anchorOwners=new Set();
  for(const part of spec.rigidAttachments??[])for(const name of part.anchors??[]){
    const key=part.basePose+':'+name;if(anchorOwners.has(key))fail('Duplicate rigid attachment anchor');anchorOwners.add(key);
  }
  const sequences = {};
  for (const [name, seq] of Object.entries(spec.sequences ?? {})) {
    if (!Array.isArray(seq.drawings) || !seq.drawings.length) fail(`${name}: no drawings`);
    const drawings = seq.drawings.flatMap(item => {
      if (!poses.has(item.pose)) fail(`${name}: unknown pose ${item.pose}`);
      if (!Number.isInteger(item.hold) || item.hold < 1 || item.hold > 600) fail(`${name}: invalid hold`);
      return Array(item.hold).fill(item.pose);
    });
    if (drawings.length > 1200) fail(`${name}: sequence is too long`);
    const hits = seq.hits ?? [];
    if (!Array.isArray(hits) || hits.some((n, i) => !Number.isInteger(n) || n < 0 || n >= drawings.length || (i && n <= hits[i - 1]))) fail(`${name}: invalid impact frames`);
    const events = seq.events ?? {};
    for (const [event, n] of Object.entries(events)) if (!Number.isInteger(n) || n < 0 || n >= drawings.length) fail(`${name}: invalid ${event} event`);
    if (events.launch !== undefined && hits.length && events.launch >= hits[0]) fail(`${name}: launch must precede impact`);
    if (events.recover !== undefined && hits.length && events.recover < hits.at(-1)) fail(`${name}: recovery precedes impact`);
    if (seq.loop && drawings[0] !== drawings.at(-1)) fail(`${name}: loop must return to its starting drawing`);
    sequences[name] = {drawings, hits, loop: !!seq.loop, events};
  }
  if (!sequences.standby) fail('Missing standby sequence');
  const maxSide = Math.min(4096, spec.maxAtlasSide ?? 4096), gutter = 2;
  let x = gutter, y = gutter, row = 0, atlasWidth = 0;
  for (const tile of unique.values()) {
    const [, , w, h] = tile.box;
    if (w + gutter * 2 > maxSide || h + gutter * 2 > maxSide) fail('Drawing exceeds atlas budget');
    if (x + w + gutter > maxSide) { x = gutter; y += row + gutter; row = 0; }
    tile.at = [x, y]; x += w + gutter; row = Math.max(row, h); atlasWidth = Math.max(atlasWidth, x);
  }
  const atlasHeight = y + row + gutter;
  if (atlasHeight > maxSide) fail('Too many drawings for one atlas; reduce resolution or split the asset');
  const rgbaBytes = atlasWidth * atlasHeight * 4;
  if (rgbaBytes > (spec.maxRgbaBytes ?? 64 * 1024 * 1024)) fail('Decoded image exceeds memory budget');
  const atlas = new PNG({width: atlasWidth, height: atlasHeight});
  for (const tile of unique.values()) {
    const [l, t, w, h] = tile.box, [ax, ay] = tile.at;
    for (let j = 0; j < h; j++) tile.png.data.copy(atlas.data, ((ay + j) * atlasWidth + ax) * 4, ((t + j) * width + l) * 4, ((t + j) * width + l + w) * 4);
  }
  const atlasBytes = PNG.sync.write(atlas);
  const uvOf = tile => [tile.at[0] / atlasWidth, tile.at[1] / atlasHeight, (tile.at[0] + tile.box[2]) / atlasWidth, (tile.at[1] + tile.box[3]) / atlasHeight];
  const geometry = tile => {
    const [l, t, w, h] = tile.box;
    // Shared source coordinates survive cropping. Never refit each pose to its own bounds.
    const L = l / ppu, R = (l + w) / ppu, T = (height - t) / ppu, B = (height - t - h) / ppu;
    return [L, T, R, T, R, B, L, B];
  };
  const first = poses.get(sequences.standby.drawings[0]).tile;
  const manifest = {
    id: spec.id, elfId: String(spec.elfId), elfName: spec.elfName, fps: spec.fps, facing: spec.facing,
    ...(spec.presentation?{presentation:spec.presentation}:{}),...(spec.physicalMotion?{physicalMotion:spec.physicalMotion}:{}),
    ...(spec.idleZones?.length?{idleMotion:{zones:spec.idleZones,
      ...(spec.idleGrid?{grid:spec.idleGrid}:{}),...(spec.idlePins?{pins:spec.idlePins}:{})}}:{}),
    canvas: [width, height], pixelsPerUnit: ppu,
    atlas: {file: 'atlas.png', width: atlasWidth, height: atlasHeight},
    character: {uv: uvOf(first), size: first.box.slice(2)}, sha256: hash(atlasBytes), size: atlasBytes.length,
    sequences: Object.fromEntries(Object.entries(sequences).map(([name, seq]) => [name, {
      frames: seq.drawings.length, hits: seq.hits, loop: seq.loop, events: seq.events,
      quads: seq.drawings.map((id,i) => { const p = poses.get(id);
          const base={c: geometry(p.tile), buv: uvOf(p.tile), a: 1, anchors: {...p.anchors}};
        const parts=(spec.rigidAttachments??[]).filter(part=>part.basePose===id);
        if(parts.length){
          const u=base.buv;
          const partQuad=part=>{const tile=poses.get(part.pose).tile;return rigidAttachmentQuad(geometry(tile),uvOf(tile),[width,height],ppu,part,name==='standby'?i/Math.max(1,seq.drawings.length-1):0);};
          for(const part of parts)for(const anchor of part.anchors??[]){
            const point=p.anchors[anchor],v=[point[0]/ppu,(height-point[1])/ppu];
            const moved=rigidAttachmentQuad([...v,...v,...v,...v],[0,0,1,1],[width,height],ppu,part,name==='standby'?i/Math.max(1,seq.drawings.length-1):0).p;
            base.anchors[anchor]=[moved[0]*ppu,height-moved[1]*ppu];
          }
          base.g=[...parts.filter(part=>part.behind===true).map(partQuad),
            {p:base.c,u:[u[0],u[1],u[2],u[1],u[2],u[3],u[0],u[3]]},
            ...parts.filter(part=>part.behind!==true).map(partQuad)];
        }
        return base;
      }),
    }])),
    production: {method: 'replacement-drawings', anchor: spec.anchor, uniqueDrawings: unique.size,
      rgbaBytes, poses: Object.fromEntries([...poses].map(([id, p]) => [id, {sha256: p.tile.sha256, anchors: p.anchors, review: p.review}])),
      framePoses: Object.fromEntries(Object.entries(sequences).map(([name, seq]) => [name, seq.drawings]))},
  };
  return {manifest, atlasBytes};
}
