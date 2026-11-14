import assert from 'node:assert/strict';
import {finishPetPreparation} from '../src/battle/petAnimation/preparationScheduler';
import {preparePetGeometry,sharePetGeometry} from '../src/battle/petAnimation/preparedGeometry';
import {preparePetFx,preparePetFxAsync} from '../src/battle/petFxPolicy';
import {mountPetPlayer,warmPetTextures,PET_UPLOAD_TILE_SIZE} from '../src/battle/petAnimation/playerMount';
const abort=new AbortController();let visits=0;
function* work(){for(let i=0;i<100;i++){visits++;yield;}return 9;}
const pending=finishPetPreparation(work(),abort.signal,-1);setTimeout(()=>abort.abort(),0);await assert.rejects(pending);assert.ok(visits<100,'取消後不繼續掃全部影格');
const mesh={positions:Float32Array.from([0,0,10,0,10,20,0,20]),uvs:Float32Array.from([0,0,1,0,1,1,0,1]),mulColors:new Float32Array(16),addColors:new Float32Array(16),indices:Uint16Array.from([0,1,2,0,2,3]),subMeshes:[]};
const clip:any={atlasWidth:8192,atlasHeight:8192,frameRate:30,atlas:{width:8192,height:8192},sequences:[{name:'standby',frames:[{labels:[],mesh}]},{name:'attack',frames:[{labels:['action_hit'],mesh}]}]};
const g=await preparePetGeometry(clip);assert.deepEqual(g.rest,{left:0,right:10,top:0,bottom:20});assert.equal(await preparePetGeometry(clip),g);const other={...clip};sharePetGeometry(clip,other);assert.equal(await preparePetGeometry(other),g);
const sync=preparePetFx(structuredClone(clip)),asyncResult=await preparePetFxAsync(clip);assert.deepEqual(asyncResult,sync,'分批處理保留完整影格與原有底片策略');assert.equal(asyncResult.clip.sequences[1].frames[0].mesh,mesh);
let start!:()=>void,entered!:()=>void;const opened=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>start=r);const options:any[]=[];
const first:any={mount:async(_h:any,_c:any,o:any)=>{options.push(o);entered();await gate;}};
let secondMounted=false;const second:any={mount:async()=>{secondMounted=true;}};const a=mountPetPlayer(first,{} as HTMLElement,clip);await opened;const bAbort=new AbortController(),b=mountPetPlayer(second,{} as HTMLElement,clip,bAbort.signal);const rejected=assert.rejects(b);bAbort.abort();start();await a;await rejected;assert.equal(secondMounted,false);assert.equal(options[0].maxTextureSize,PET_UPLOAD_TILE_SIZE);
let pulse=false;setTimeout(()=>pulse=true,0);const uploaded:number[]=[];await warmPetTextures({app:{renderer:{texture:{initSource:(s:number)=>uploaded.push(s)}}},atlasLayout:{tiles:[{texture:{source:1}},{texture:{source:2}}]}});assert.deepEqual(uploaded,[1,2]);assert.equal(pulse,true,'材質上傳前交還主執行緒');
const during=new AbortController();let uploads=0;await assert.rejects(warmPetTextures({app:{renderer:{texture:{initSource:()=>{uploads++;during.abort();}}}},atlasLayout:{tiles:[{texture:{source:1}},{texture:{source:2}}]}},during.signal));assert.equal(uploads,1);
console.log('取消逐格準備、共用幾何、底片等價、掛載排隊取消及分批上傳通過');
