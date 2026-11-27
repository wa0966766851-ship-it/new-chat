import assert from 'node:assert/strict';
import {gzipSync,strToU8} from 'fflate';
import {createHarness} from './helpers/migrationHarness';
import {captureConfiguration,prepareConfiguration,type ConfigCatalog} from '../src/playerConfig/model';
import {encodeConfiguration,decodeConfiguration,MAX_CONFIG_BYTES} from '../src/playerConfig/codec';
import {applyConfiguration,undoConfiguration,type RollbackStore,type ConfigRollback} from '../src/playerConfig/transaction';
class MemoryStorage {
 data=new Map<string,string>();failAt=0;writes=0;
 getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){if(this.failAt&&++this.writes===this.failAt)throw Error('QuotaExceeded');this.data.set(k,v);}removeItem(k:string){this.data.delete(k);}
}
const memoryBackup=()=>{let saved:ConfigRollback|undefined;return {get:async()=>saved,put:async(value:ConfigRollback|undefined)=>{saved=value;}} satisfies RollbackStore;};
const h=await createHarness();let checks=0;
try{
 const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const {normalizeElfStats}=await h.server.ssrLoadModule('/src/utils/elfStats.ts');
 const {validateKit}=await h.server.ssrLoadModule('/src/effects/kitValidation.ts');
 const {ELF_ID_MAPPING}=await h.server.ssrLoadModule('/src/data/elfRegistry.ts');
 const {prepareSavedBattleRoster}=await h.server.ssrLoadModule('/src/data/prepareSavedBattleRoster.ts');
 const catalog:ConfigCatalog={elves:DEFAULT_ELVES,aliases:ELF_ID_MAPPING,normalize:normalizeElfStats,validateKit};
 const {loadConfigCatalog}=await h.server.ssrLoadModule('/src/playerConfig/model.ts');
 const liveCatalog:ConfigCatalog=await loadConfigCatalog();
 assert.ok(liveCatalog.equipment?.suit.future_armor);assert.ok(liveCatalog.skins?.['5053']);
 const liveStorage=new MemoryStorage();const livePlan=prepareConfiguration({kind:'seer-player-config',schemaVersion:99,appVersion:'99',entries:{seer_p1_suit:'future_armor',seer_default_elves_overrides:JSON.stringify({'5053':{level:73,skinId:'future-unavailable-skin'}})}},liveStorage,liveCatalog,'1');
 assert.equal(livePlan.writes.seer_p1_suit,'future_armor');assert.equal(JSON.parse(livePlan.writes.seer_default_elves_overrides)['5053'].level,73);assert.ok(livePlan.warnings.some(w=>w.includes('皮膚')));checks++;
 const base=structuredClone(DEFAULT_ELVES.find((e:any)=>e.id==='5053'));
 const selected=[base.skillPool.find((s:any)=>s.name==='王.黎明前奏'),...base.skills.slice(1)];
 const training={id:base.id,level:75,skinId:'shared-skin',ivs:{hp:31,atk:30,def:29,spatk:28,spdef:27,speed:26},evs:{hp:255,atk:255,def:0,spatk:0,spdef:0,speed:0},skills:selected,groupIds:['artisan-elf']};
 const custom={...base,id:'custom_share',name:'自製配置精靈',isCustom:true,path:'data:image/png;base64,AA==',level:55,customCode:'',secret:'private-secret'};
 const source=new MemoryStorage();source.setItem('seer_default_elves_overrides',JSON.stringify({'5053':training}));source.setItem('seer_custom_elves',JSON.stringify([custom]));
 source.setItem('seer_last_used_p1_team',JSON.stringify({team:[{...base,battleId:'p1-main'},{...custom,battleId:'p1-custom'}],starterId:'p1-custom'}));
 source.setItem('seer_last_used_p2_team',JSON.stringify({team:[{...base,battleId:'p2-main'}],starterId:'p2-main'}));
 source.setItem('seer_p1_backpack_presets',JSON.stringify({myPreset:{team:[base],starterId:base.id}}));
 source.setItem('seer_p1_suit','future_armor');source.setItem('seer_p2_title','shier_ruchu');source.setItem('seer_p1_annual_bonus','1');
 source.setItem('seer_turn_timer_v1',JSON.stringify({mode:'ordered',seconds:30}));source.setItem('seer_roguelike_progress','RUN-SECRET');source.setItem('seer_ai_api_key','TOP-SECRET');source.setItem('seer_online_device_token','DEVICE-SECRET');source.setItem('seer_desktop_save_revision','PRIVATE-REVISION');
 const doc=captureConfiguration(source,'雙方配置','1.0');assert.ok(!JSON.stringify(doc).includes('SECRET'));assert.ok(!JSON.stringify(doc).includes('private-secret'));assert.ok(!('seer_turn_timer_v1'in doc.entries));checks++;
 const plain=await encodeConfiguration(doc);assert.deepEqual(await decodeConfiguration(plain),doc);assert.ok(plain.startsWith('SCFG1.'));checks++;
 const encrypted=await encodeConfiguration(doc,'測試密碼');assert.ok(encrypted.startsWith('SCFGE1.'));assert.deepEqual(await decodeConfiguration(encrypted,'測試密碼'),doc);await assert.rejects(()=>decodeConfiguration(encrypted,'錯誤密碼'),/密碼不正確/);await assert.rejects(()=>decodeConfiguration(encrypted),/請輸入密碼/);checks++;
 await assert.rejects(()=>decodeConfiguration(plain.slice(0,-1)+(plain.endsWith('0')?'1':'0')),/校驗失敗/);await assert.rejects(()=>decodeConfiguration('SCFG2.unknown'),/不支援/);checks++;
 const target=new MemoryStorage();target.setItem('seer_custom_elves',JSON.stringify([{...base,id:'custom_keep',name:'原本精靈',isCustom:true}]));target.setItem('seer_default_elves_overrides',JSON.stringify({'5012':{id:'5012',weight:99},'5053':{id:'5053',level:20}}));target.setItem('seer_p1_suit','old-suit');target.setItem('seer_roguelike_progress','MY-INDEPENDENT-RUN');target.setItem('seer_ai_api_key','OWN-KEY');target.setItem('seer_online_device_token','OWN-DEVICE');target.setItem('seer_deleted_elves',JSON.stringify(['5053','5012']));
 const before=[...target.data];const plan=prepareConfiguration(doc,target,catalog,'2.0');assert.deepEqual([...target.data],before,'預覽不能改存檔');assert.equal(plan.teams[0].starter,'自製配置精靈');assert.ok(plan.warnings.some(w=>w.includes('版本')));checks++;
 const rollback=memoryBackup();await applyConfiguration(plan,target,rollback);
 const overrides=JSON.parse(target.getItem('seer_default_elves_overrides')!);assert.equal(overrides['5053'].level,75);assert.deepEqual(overrides['5053'].ivs,training.ivs);assert.equal(overrides['5012'].weight,99);assert.ok(JSON.parse(target.getItem('seer_custom_elves')!).some((e:any)=>e.id==='custom_keep'));assert.deepEqual(JSON.parse(target.getItem('seer_deleted_elves')!),['5012']);
 assert.equal(target.getItem('seer_roguelike_progress'),'MY-INDEPENDENT-RUN');assert.equal(target.getItem('seer_ai_api_key'),'OWN-KEY');assert.equal(target.getItem('seer_online_device_token'),'OWN-DEVICE');assert.equal(target.getItem('seer_p1_suit'),'future_armor');checks++;
 const warehouse=DEFAULT_ELVES.map((e:any)=>overrides[e.id]?normalizeElfStats({...e,...overrides[e.id]}):e).concat(JSON.parse(target.getItem('seer_custom_elves')!));
 for(const side of ['p1','p2']){
  const record=JSON.parse(target.getItem(`seer_last_used_${side}_team`)!);
  const team=prepareSavedBattleRoster(record.team,warehouse,false,side);
  assert.equal(team[0].level,75);assert.equal(team[0].skinId,'shared-skin');assert.deepEqual(team[0].ivs,training.ivs);assert.equal(team[0].skills[0].name,'王.黎明前奏');assert.equal(team[0].skills[0].kit.find((e:any)=>e.role==='carried').params.clause.trig,'round_start');assert.ok(team[0].calculatedStats.atk>0);checks++;
 }
 await undoConfiguration(target,rollback);assert.deepEqual([...target.data].sort(),before.sort(),'復原必須完整回到套用前，包含原本不存在的項目');checks++;
 const old={schemaVersion:1,storage:{seer_last_used_p1_team:JSON.stringify({team:[{...base,level:66,ivs:training.ivs,skills:selected}],starterId:base.id}),seer_ai_api_key:'DO-NOT-IMPORT'}};
 const oldPlan=prepareConfiguration(old,new MemoryStorage(),catalog,'current');assert.equal(JSON.parse(oldPlan.writes.seer_default_elves_overrides)['5053'].level,66);assert.ok(!('seer_ai_api_key'in oldPlan.writes));assert.ok(oldPlan.warnings.length);checks++;
 const future={...doc,schemaVersion:99};const futurePlan=prepareConfiguration(future,target,catalog,'1');assert.ok(futurePlan.writes.seer_p1_suit);assert.ok(futurePlan.warnings.some(w=>w.includes('來源配置格式')));assert.throws(()=>prepareConfiguration({...doc,entries:{seer_default_elves_overrides:JSON.stringify({'not-installed':{id:'not-installed'}})}},target,catalog,'1'),/沒有可帶入的相容內容/);checks++;
 await assert.rejects(()=>decodeConfiguration('{"kind":"seer-player-config","schemaVersion":1,"entries":{"__proto__":{}}}'),/原型/);assert.throws(()=>captureConfiguration({getItem:k=>k==='seer_custom_elves'?JSON.stringify([{...custom,customCode:'throw new Error("not executed")'}]):null},'x','1'),/自訂程式碼/);checks++;
 const stalePlan=prepareConfiguration(doc,target,catalog,'1');target.setItem('seer_p1_suit','new-local');await assert.rejects(()=>applyConfiguration(stalePlan,target,memoryBackup()),/配置已改變/);assert.equal(target.getItem('seer_p1_suit'),'new-local');checks++;
 const quota=new MemoryStorage();quota.setItem('seer_p1_suit','keep');const quotaPlan=prepareConfiguration(doc,quota,catalog,'1');const quotaBefore=[...quota.data];quota.failAt=3;await assert.rejects(()=>applyConfiguration(quotaPlan,quota,memoryBackup()),/已恢復原配置/);assert.deepEqual([...quota.data],quotaBefore);checks++;
 const refused=new MemoryStorage(),refusedPlan=prepareConfiguration(doc,refused,catalog,'1');await assert.rejects(()=>applyConfiguration(refusedPlan,refused,{get:async()=>undefined,put:async()=>{throw Error('restore unavailable');}}));assert.equal(refused.data.size,0);checks++;
 const optional=captureConfiguration(source,'含設定','1',true);assert.ok('seer_turn_timer_v1'in optional.entries);assert.ok(!('seer_turn_timer_v1'in prepareConfiguration(optional,new MemoryStorage(),catalog,'1',false).writes));assert.ok('seer_turn_timer_v1'in prepareConfiguration(optional,new MemoryStorage(),catalog,'1',true).writes);checks++;
 const badSkill={...base.skills[0],effectMode:'kit',kit:[{codeId:'not_supported_on_old_version',params:{},node:'on_skill_use',order:0}]};
 const mixed={...doc,appVersion:'99.0.0',schemaVersion:2,requiredFeatures:[...doc.requiredFeatures,'future-v9'],entries:{seer_default_elves_overrides:JSON.stringify({'5053':{id:'5053',level:70,weight:-1,futureOnlyField:123,skills:[badSkill]},'future-elf':{id:'future-elf'}}),seer_p1_suit:'future_armor'}};
 const mixedPlan=prepareConfiguration(mixed,target,catalog,'1.0.0');const partial=JSON.parse(mixedPlan.writes.seer_default_elves_overrides)['5053'];assert.equal(partial.level,70);assert.equal(partial.weight,undefined);assert.equal(partial.futureOnlyField,undefined);assert.equal(mixedPlan.writes.seer_p1_suit,'future_armor');assert.ok(mixedPlan.warnings.some(w=>w.includes('future-elf')));assert.ok(mixedPlan.warnings.some(w=>w.includes('技能')));checks++;
 const equipmentCatalog={...catalog,equipment:{suit:{future_armor:{name:'未來套裝'}}}};
 const loadoutPlan=prepareConfiguration({...doc,entries:{seer_p1_suit:'not-installed',seer_p2_suit:'future_armor'}},target,equipmentCatalog,'1');assert.ok(!('seer_p1_suit'in loadoutPlan.writes));assert.equal(loadoutPlan.writes.seer_p2_suit,'future_armor');checks++;
 // A compact gzip bomb must fail during bounded streaming decompression.
 const zipped=gzipSync(strToU8(' '.repeat(MAX_CONFIG_BYTES+1)));const encoded=Buffer.from(zipped).toString('base64url');const hash=Buffer.from(await crypto.subtle.digest('SHA-256',Uint8Array.from(zipped).buffer)).toString('hex');await assert.rejects(()=>decodeConfiguration(`SCFG1.${encoded}.${hash}`),/解壓後超過/);checks++;
 console.log(`配置分享：${checks}組編解碼、加密、舊檔、雙方正式載入、隱私排除、衝突與失敗回復檢查通過`);
}finally{await h.close();}
