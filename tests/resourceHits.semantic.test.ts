import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 const {MIGRATED_ARENA16_DRAGON_HEALING_SOUL_KIT:source}=await h.server.ssrLoadModule('/src/data/migratedArena16DragonHealingSoulKit.ts');
 const {MIGRATED_ARENA16_AIDA_SKILL_KIT:aida}=await h.server.ssrLoadModule('/src/data/migratedArena16AidaKit.ts');
 const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
 const {getTypeMatchup}=await h.server.ssrLoadModule('/src/utils/statCalculator.ts');
 defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
 try{const entries=[...source.kit,...aida[0].kit];for(const e of entries){assert.equal(kitEntryIssue(e),null);assert.ok(buildEntryBlock(w as any,e));}Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser(old.source)(b,old.node,old.order);}),entries);}finally{w.dispose();r.dispose();}
 const dragons=['dragonGold','dragonMystic','dragonRed','dragonAzure'];
 const mark=(id:string,n=1)=>({op:'resource_mark_add',p:{id,name:id,displayChar:'印',unit:'層',side:'self',scope:'elf',persistsOffField:false,amount:n,maxCount:99,description:'測試實際資源'}});
 for(const side of ['p1','p2'] as const)for(const scenario of [{n:0,stacks:2,bonus:false,max:false},{n:1,stacks:2,bonus:false,max:false},{n:2,stacks:3,bonus:true,max:false},{n:4,stacks:2,bonus:true,max:true}]){
  const hits:any[]=[];h.S['印記受方']=(_c:any,event:string,data:any)=>{if(event==='BEFORE_DAMAGE'&&data?.damageComp?.isIncoming)hits.push({...data.damageComp});};
  const {n,stacks,bonus,max}=scenario;
  const acts=[...dragons.slice(0,n).map(id=>mark(id)),mark('arena.dragonSoulMark',stacks),...(max?[mark('trueDragon')]:[])];
  const cast=h.kitSkill('實際資源建立',acts);
  if(bonus)cast.kit.push(...structuredClone(aida[0].kit.filter((e:any)=>e.order===1)));
  const own=h.unit('印記持有者',10000,[cast],{speed:300,extra:{soulMark:{...source,effectMode:'kit',kit:structuredClone(source.kit.filter((e:any)=>e.order===14))}}});
  const [out]=await h.play(side,{self:own,opp:h.unit('印記受方',100000,[h.wait()],{type:'機械',speed:100})});
  const base=150+(bonus?n*50:0),each=Math.floor(base*(max?4:getTypeMatchup('龍','機械')));
  assert.equal(hits.length,n*stacks,'層數乘甦醒龍數，逐次真正結算');
  assert.ok(hits.every(c=>c.skillType==='龍'&&c.damageCategory==='skill_attribute'&&c.base===each),'真龍倍率仍保留龍系與非真實傷害分類');
  assert.equal(out.opp.currentHp,100000-each*n*stacks,'每段實際扣血；最高克制不能再次吃抵抗倍率');
 }
 // 正式額外使用每次也觸發印記；不是原使用一次後只補主傷害。
 for(const side of ['p1','p2'] as const){
  const hits:number[]=[];h.S['重播印記受方']=(_c:any,event:string,data:any)=>{if(event==='BEFORE_DAMAGE'&&data?.damageComp?.isIncoming)hits.push(data.damageComp.base);};
  const grant=h.kitSkill('建立重播印記',[...dragons.map(id=>mark(id)),mark('arena.dragonSoulMark',2),mark('dragonSoulSource'),mark('trueDragon')]);
  const own=h.unit('重播印記持有者',10000,[grant,h.wait()],{speed:300,extra:{soulMark:{...source,effectMode:'kit',kit:structuredClone(source.kit.filter((e:any)=>[5,14].includes(e.order)))}}});
  const history=await h.play(side,{self:own,opp:h.unit('重播印記受方',200000,[h.wait()]),turns:(_e:any,t:number)=>[t-1,0]},2);
  assert.equal(history[0].opp.currentHp,188800,'首次建立後8段各1400');
  assert.equal(history[1].opp.currentHp,132800,'下次普通使用加四次重播，共40段各1400');
  assert.equal(hits.length,48);assert.ok(hits.every(x=>x===1400));
 }
 // 同樣總基值600，兩段300須各受單次上限200，不能合成一段600。
 for(const side of ['p1','p2'] as const){
  h.S['逐段上限受方']=(_c:any,event:string,data:any)=>{if(event==='BEFORE_DAMAGE'&&data?.damageComp?.isIncoming)data.damageComp.limit=200;};
  const own=h.unit('逐段上限持有者',10000,[h.kitSkill('建立兩段',[mark('dragonGold'),mark('arena.dragonSoulMark',2),mark('trueDragon')])],{speed:300,extra:{soulMark:{...source,effectMode:'kit',kit:structuredClone(source.kit.filter((e:any)=>e.order===14))}}});
  const [out]=await h.play(side,{self:own,opp:h.unit('逐段上限受方',10000,[h.wait()])});
  assert.equal(out.opp.currentHp,9600,'兩段各自套傷害上限200');
 }
 console.log('龍魂印記：P1/P2零龍不攻擊、層數乘龍數、真實龍魂之源增值、最高克制保留龍系、每段上限及Blockly深比較通過');
}finally{await h.close();}
