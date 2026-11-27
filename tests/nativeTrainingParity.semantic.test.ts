import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {swapBattlePreferences} from '../src/shell/swapBattlePreferences';
import {buildInscriptionDraft,emptyInscription} from '../src/training/inscriptionDraft';
const h=await createHarness();
try{
 const {normalizeElfStats}=await h.server.ssrLoadModule('/src/utils/elfStats.ts');
 const {INSCRIPTION_GEMS,gemDescription,gemHas}=await h.server.ssrLoadModule('/src/training/gems.ts');
 assert.equal(gemHas({inscriptions:[{gem:{id:'__proto__',skillName:'等待'}}]},h.wait(),543),false,'無效識別碼不得讀入物件原型');
 const original={id:'original',name:'原刻印',stats:{hp:17,atk:19,def:23,spatk:29,spdef:31,speed:37},gem:{id:'1800265',skillName:'測試'},skinId:'40001',skinIcon:'/seer/countermark/40001.png'};
 const copy=structuredClone(original),changed=buildInscriptionDraft(original,{...original,skinId:'40002'});
 assert.deepEqual(changed.stats,original.stats);assert.deepEqual(changed.gem,original.gem);assert.equal(changed.id,original.id);assert.equal(changed.skinIcon,'/seer/countermark/40002.png');assert.deepEqual(original,copy);
 const restored=buildInscriptionDraft(changed,{...changed,skinId:undefined});assert.equal(restored.skinIcon,undefined);assert.deepEqual(restored.stats,original.stats);
 const base=h.unit('empty-inscriptions',1000,[h.wait()]);
 const defaults=normalizeElfStats({...base,inscriptions:undefined}),unloaded=normalizeElfStats({...base,inscriptions:[0,1,2].map(emptyInscription)});
 assert.equal(defaults.maxHp-unloaded.maxHp,450,'明確卸下不能被舊存檔預設填回');assert.equal(defaults.calculatedStats.atk-unloaded.calculatedStats.atk,225);
 assert.ok(unloaded.inscriptions.every((i:any)=>!i.gem&&!i.skinId&&Object.values(i.stats).every(n=>n===0)));
 assert.ok(INSCRIPTION_GEMS.every((g:any)=>!/[伤冻烧级护复术灵体叠击转]/.test(g.name+g.effects.map((e:any)=>e.description).join(''))));
 assert.equal(gemDescription('1800215').includes('100%'),true,'繁體化後恢復PP的機率描述仍為100%');
 assert.equal(gemDescription('1800265'),'附加50點真實傷害');
 const map=new Map<string,string>([['seer_last_used_p1_team','roster1'],['seer_last_used_p2_team','roster2'],['seer_p1_flame','green'],['seer_p2_flame','purple'],['seer_p1_annual_bonus','0'],['seer_p2_annual_bonus','1'],['seer_custom_elves','private'],['seer_p1_backpack_presets','preset1']]);
 const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
 const before=new Map(map);swapBattlePreferences(storage);assert.equal(map.get('seer_last_used_p1_team'),'roster2');assert.equal(map.get('seer_p1_flame'),'purple');assert.equal(map.get('seer_p1_annual_bonus'),'1');assert.equal(map.get('seer_custom_elves'),'private');assert.equal(map.get('seer_p1_backpack_presets'),'preset1');swapBattlePreferences(storage);assert.deepEqual(map,before);
 let writes=0;assert.throws(()=>swapBattlePreferences({...storage,setItem:(k,v)=>{if(++writes===3)throw Error('quota');map.set(k,v);}}));assert.deepEqual(map,before,'對調中斷要恢復原配置');
 console.log('新版培養：繁體名稱／機率描述、純外觀不改數值、卸下實際歸零、雙方配置對調與失敗回復通過');
}finally{await h.close();}
