import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 const {MIGRATED_ARENA16_DRAGON_HEALING_SOUL_KIT:source}=await h.server.ssrLoadModule('/src/data/migratedArena16DragonHealingSoulKit.ts');
 const awake=h.kitSkill('喚醒測試',[{op:'resource_mark_add',p:{id:'dragonRed',name:'赤龍',displayChar:'赤',unit:'層',side:'self',scope:'elf',persistsOffField:true,amount:1,maxCount:1,description:'測試甦醒'}}]).kit[0];awake.node='on_entered';awake.source='soulmark';awake.params.clause.trig='entrance';
 for(const side of ['p1','p2'] as const)for(const convert of [false,true]){
  let stored=0;const receipt:any[]=[];
  h.S['累計測試受方']=(_c:any,event:string,data:any)=>{if(event==='AFTER_DAMAGE')receipt.push({kind:data.damageType,amount:data.receipt?.settledAmount});};
  const use=h.kitSkill('使用攻擊',convert?[{op:'stored_damage_convert_next',p:{key:'arena.red',type:'真實'}}]:[],{category:'物理',power:100});
  const own=h.unit('累計持有者',5000,[h.wait(),use,{...h.wait(),name:'再次普通攻擊',category:'物理',power:100}],{speed:100,extra:{soulMark:{...source,effectMode:'kit',kit:[awake,...structuredClone(source.kit.filter((e:any)=>[6,8].includes(e.order)))]}}});
  const hist=await h.play(side,{self:own,opp:h.unit('累計測試受方',10000,[h.wait(),{...h.wait(),name:'正式物攻',category:'物理',power:100}],{speed:300}),turns:(e:any,t:number)=>{if(t===2)stored=e.getState()[side+'RegistryState']['damageStore:arena.red'];return [t===1?0:t===2?1:2,t===1?1:0];}},3);
  assert.equal(hist[0].self.currentHp,5000,'正式攻擊確實被抵擋，未扣血');assert.ok(stored>0,'已抵擋的結算量必須真正累計');
  assert.deepEqual(receipt.filter(r=>r.kind===(convert?'true':'fixed')).map(r=>r.amount),[stored],'儲存傷害於攻擊後一次釋放，真實轉換有讀取端且不重複');
  assert.equal(hist[2].state[side+'RegistryState']['damageStore:arena.red'],0);assert.equal(hist[2].state[side+'RegistryState']['damageStore:arena.red:type'],undefined);
 }
 for(const side of ['p1','p2'] as const){
  const reset=structuredClone(source.kit.find((e:any)=>e.order===12));
  const original=h.unit('下場儲存持有者',5000,[h.wait()],{speed:100,extra:{soulMark:{...source,effectMode:'kit',kit:[awake,...structuredClone(source.kit.filter((e:any)=>e.order===6)),reset]}}});
  const hist=await h.play(side,{self:original,selfBench:[h.unit('儲存後備',5000,[h.wait()])],opp:h.unit('儲存攻擊者',10000,[{...h.wait(),category:'物理',power:100}],{speed:300}),turns:(_e:any,t:number)=>t===1?[0,0]:[{switch:1},0]},2);
  assert.ok(hist[0].state[side+'RegistryState']['damageStore:arena.red']>0);
  const bank=hist[1].state[side+'ElfState']['下場儲存持有者'];assert.equal(bank.registry['damageStore:arena.red'],0,'下場清空原持有者的傷害儲存，不得留待再登場釋放');
 }
 console.log('傷害儲存積木：P1/P2正式攻擊抵擋、實際結算累計、攻擊後固定／下一次真實釋放及一次消耗通過');
}finally{await h.close();}
