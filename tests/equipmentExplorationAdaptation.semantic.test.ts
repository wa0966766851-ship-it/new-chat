import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',logLevel:'error'});
try{
 const {DEFAULT_ELVES:pool}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const E=await server.ssrLoadModule('/src/modes/interstellar/v2/engine.ts');
 const {TITLE_CATALOG}=await server.ssrLoadModule('/src/data/titles.ts');
 const {SUIT_CATALOG}=await server.ssrLoadModule('/src/data/suitsAndEyewears.ts');
 const {perkOf}=await server.ssrLoadModule('/src/modes/interstellar/v2/suitPerks.ts');
 const create=(equipId:string,nLevel=0)=>E.createRun({pool,equipType:'title',equipId,seed:42,nLevel,modifiers:[],startingShards:3});
 assert.equal(create('legendary_explorer').shards,6,'新旅程取得3星晶');
 assert.equal(create('legendary_explorer',12).shards,create('',12).shards,'N12起禁用特權');
 assert.equal(E.mods(create('interstellar_pioneer')).eclipsePerMove,E.mods(create('')).eclipsePerMove-1);
 assert.equal(E.mods(create('void_conqueror')).eliteRelicChoice,E.mods(create('')).eliteRelicChoice+1);
 assert.equal(perkOf('title','space_bounty_hunter').eliteBeansMult,1);
 for(const e of [...Object.values(TITLE_CATALOG),...Object.values(SUIT_CATALOG)] as any[]){
  assert.ok(!/升級版/.test(e.description),e.name);
  assert.ok(!/燃料消耗|初始鑽石/.test(e.description),e.name);
 }
 assert.ok(Object.values(SUIT_CATALOG).every((s:any)=>s.description.includes('星蝕迴廊適應')));
 console.log('裝備：稱號舊模式描述、開局星晶、蝕度、夢魘選項、N12停用通過');
}finally{await server.close();}
