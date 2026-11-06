import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {compilePoseAnimation} from '../scripts/lib/poseAnimation.mjs';
import {customClipFromManifest, customFramePresentation, loadCustomClip} from '../src/battle/customPetClip.ts';

// Test drawings deliberately have different visible bounds and matching fixed coordinates.
// These are test pixels, never character artwork or production placeholders.
const make = (left, top, color) => {
  const png = new PNG({width: 64, height: 64});
  for (let y = top; y < 59; y++) for (let x = left; x < 46; x++) {
    const i = (y * 64 + x) * 4; png.data[i] = color; png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
};
const files = {rest: make(20, 20, 100), aim: make(12, 4, 200)};
const drawing = file => ({file, sha256: crypto.createHash('sha256').update(files[file]).digest('hex'),
  review: {accepted: true, note: 'Synthetic fixture reviewed for test geometry only'}, anchors: {muzzle: [14, 8], foot: [40, 58]}});
const spec = {id: 'test_pose', elfId: '0', elfName: 'test', canvas: [64, 64], fps: 24, facing: 'left', anchor: [32, 58],
  poses: {rest: drawing('rest'), aim: drawing('aim')}, sequences: {
    standby: {loop: true, drawings: [{pose: 'rest', hold: 3}]},
    sa: {drawings: [{pose: 'rest', hold: 2}, {pose: 'aim', hold: 3}, {pose: 'rest', hold: 2}], hits: [4], events: {launch: 2, recover: 5}},
  }};
const build = s => compilePoseAnimation(s, file => files[file]);
const {manifest: m, atlasBytes} = build(spec);
assert.equal(m.production.uniqueDrawings, 2);
assert.equal(m.sequences.sa.frames, 7);
assert.notDeepEqual(m.sequences.sa.quads[0].buv, m.sequences.sa.quads[2].buv, 'Distinct poses must use distinct texture cells');
assert.equal(m.sequences.sa.quads[0].c[5], m.sequences.sa.quads[2].c[5], 'Cropping must not change the foot baseline');
assert.equal(m.sequences.sa.quads[2].c[1], .6, 'Raised drawing keeps original canvas coordinates, no per-pose scaling');
assert.equal(m.production.rgbaBytes, m.atlas.width * m.atlas.height * 4);
assert.equal(m.sha256, crypto.createHash('sha256').update(atlasBytes).digest('hex'));
const clip = customClipFromManifest(m, {width: m.atlas.width, height: m.atlas.height});
assert.equal(clip.sequences[1].frames[4].labels.includes('action_hit'), true);
assert.equal(clip.sequences[1].frames[2].labels.includes('action_launch'), true);
assert.notDeepEqual([...clip.sequences[1].frames[0].mesh.uvs], [...clip.sequences[1].frames[2].mesh.uvs]);
assert.deepEqual(customFramePresentation(clip, 'sa', 2), {launch: 2, muzzle: [14, 56]});
assert.equal(customFramePresentation({}, 'sa', 2), undefined, 'Native clips are unaffected');
const reject = (mutate, pattern) => { const next = structuredClone(spec); mutate(next); assert.throws(() => build(next), pattern); };
reject(s => s.poses.aim.review.accepted = false, /visual review/);
reject(s => s.poses.aim.facing = 'right', /pose facing differs/);
reject(s => s.poses.aim.sha256 = 'stale', /has changed/);
reject(s => s.canvas[0] = 63, /canvas differs/);
reject(s => s.sequences.sa.drawings[0].pose = 'missing', /unknown pose/);
reject(s => s.sequences.sa.hits = [7], /impact frames/);
reject(s => s.sequences.sa.events.launch = 4, /precede impact/);
reject(s => s.sequences.sa.events.recover = 3, /recovery/);
reject(s => s.sequences.standby.drawings.push({pose: 'aim', hold: 1}), /return/);
reject(s => s.maxRgbaBytes = 10, /memory budget/);
reject(s => s.margin = 5, /canvas edge/);
reject(s => s.poses.aim.anchors.muzzle = [64, 5], /invalid muzzle/);
reject(s => s.idleGrid = [100, 36], /idle grid/);
reject(s => s.idlePins = [{x:.5,y:.5,rx:0,ry:.1}], /idle region/);
reject(s => s.idleZones = [{kind:'spin',x:.5,y:.5,rx:.1,ry:.1}], /idle wave/);
reject(s => s.idleZones = [{kind:'cloth',x:.5,y:.5,rx:.1,ry:.1,cycles:1.5}], /idle cycles/);
reject(s => s.rigidAttachments = [{basePose:'rest',pose:'missing',pivot:[10,10]}], /attachment pose/);
reject(s => s.rigidAttachments = [{basePose:'rest',pose:'aim',pivot:[NaN,10]}], /attachment transform/);
reject(s => s.rigidAttachments = [{basePose:'rest',pose:'aim',pivot:[10,10],behind:'yes'}], /attachment layer/);
reject(s => s.rigidAttachments = [{basePose:'rest',pose:'aim',pivot:[10,10],anchors:['missing']}], /attachment anchors/);
reject(s => s.rigidAttachments = [0,1].map(()=>({basePose:'rest',pose:'aim',pivot:[10,10],anchors:['muzzle']})), /Duplicate rigid attachment anchor/);
reject(s => {s.rigidAttachments=[{basePose:'rest',pose:'aim',pivot:[10,10]}];s.idleZones=[{kind:'cloth',x:.5,y:.5,rx:.1,ry:.1}];}, /legacy displacement/);
const rigidSpec={...spec,rigidAttachments:[{basePose:'rest',pose:'aim',pivot:[32,32],dx:4,dy:3,degrees:4,delay:.8}]};
const rigidManifest=build(rigidSpec).manifest,rigidClip=customClipFromManifest(rigidManifest,{});
assert.equal(rigidClip.sequences[0].frames[0].mesh.positions.length,16,'Runtime retains body and attached prop as two complete quads');
assert.equal(rigidClip.sequences[0].frames[0].mesh.indices.length,12);
const rear=build({...rigidSpec,rigidAttachments:rigidSpec.rigidAttachments.map(p=>({...p,behind:true}))}).manifest;
assert.deepEqual(rear.sequences.standby.quads[0].g[0],rigidManifest.sequences.standby.quads[0].g[1],'Rear attachments render before the intact body');
const anchorSpec=structuredClone(rigidSpec);anchorSpec.rigidAttachments[0].anchors=['muzzle'];anchorSpec.sequences.standby.drawings[0].hold=5;
const movingAnchors=build(anchorSpec).manifest.sequences.standby.quads;
assert.notDeepEqual(movingAnchors[0].anchors.muzzle,movingAnchors[1].anchors.muzzle,'Attachment-bound launch anchor tracks motion');
assert.deepEqual(movingAnchors[0].anchors.foot,movingAnchors[1].anchors.foot,'Unattached floor anchor remains fixed');
assert.deepEqual([...rigidClip.sequences[0].frames[0].mesh.positions.slice(0,8)],[...rigidClip.sequences[0].frames[1].mesh.positions.slice(0,8)],'No deformation of body geometry during prop hover');
assert.deepEqual(build(spec).atlasBytes, atlasBytes, 'Identical sources produce deterministic output');
console.log('Pose import: distinct textures, fixed scale/feet, review hashes, transparent margin, event timing, runtime conversion and memory budget passed');
const originalFetch=globalThis.fetch,requested=[];
try{
 globalThis.fetch=async url=>{
  requested.push(url);
  return {ok:true,json:async()=>({...m,sha256:'old-release'}),blob:async()=>new Blob([atlasBytes])};
 };
 await assert.rejects(loadCustomClip('/elf-anim/test',undefined,m.sha256),/版本不一致/,'Mixed-release files must be rejected before decoding');
 assert.equal(requested.length,2);
 assert.ok(requested.every(url=>url.endsWith('?v='+m.sha256)),'Manifest and atlas must request the same release');
}finally{globalThis.fetch=originalFetch;}
console.log('Custom asset release mismatch rejected; manifest and atlas share a cache version');
