// Physical fifth-skill study. Keep the source drawings and palette unchanged.
import fs from 'node:fs';
const base='docs/custom-anim/drafts/20261106-original-motion';
const spec=JSON.parse(fs.readFileSync(base+'/emperor_dixin.json','utf8'));
// Preserve the 42-frame action, launch 10, hit 14, recovery 30 contract.
// The thrust drawing must be present at contact; cast is reserved for magic/buffs.
spec.sequences.ultimate.drawings=[
 {pose:'ready',hold:3},{pose:'anticipation',hold:7},
 {pose:'melee',hold:20},{pose:'anticipation',hold:4},{pose:'ready',hold:8}
];
spec.presentation.meleeSequences=['attack','ultimate'];
// Reviewed in the aligned 2000x2400 source canvas. The previous shared point
// [1000,999.69] floated above the crouched swordsman instead of following the tip.
const points={ready:[528,2070],anticipation:[507,1087],melee:[148,1872],cast:[1225,1160]};
for(const [pose,muzzle] of Object.entries(points))spec.poses[pose].anchors={muzzle};
fs.writeFileSync(base+'/emperor_dixin/melee-pilot-spec.json',JSON.stringify(spec,null,2)+'\n');
fs.writeFileSync(base+'/emperor_dixin/melee-pilot-review.json',JSON.stringify({
 status:'unaccepted-physical-fifth-pilot',
 skill:'九鼎震八荒',type:'物理',
 palette:'Original black/gold/purple and white hair; no recolor or borrowed character art.',
 preserved:{frames:42,launch:10,hit:14,recover:30},
 anchors:points,
 pending:['P1/P2 approach/contact/return','standing-to-crouch transition needs more drawings','idle remains static','hit reaction remains placeholder']
},null,2)+'\n');
console.log(base+'/emperor_dixin/melee-pilot-spec.json');
