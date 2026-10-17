import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {applyTypeDamageFloor} from '../src/effects/typeDamageFloor';
import {getTypeMatchup} from '../src/utils/statCalculator';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const p={side:'opp',base:300,list:['電','神秘','神秘.電'],turns:1};
const make=(params:any=p)=>h.kitSkill('克制保底',[{op:'type_damage_floor_turns',p:params}],{category:'物理',power:1,isSureHit:true});
const low=(c:any,e:any,d:any)=>{if(e===T.BEFORE_DAMAGE&&!d?.damageComp?.isIncoming&&d?.damageComp?.damageCategory==='skill_attack'){const x=d.damageComp;x.base=1;x.increasePercent=0;x.decreasePercent=0;x.multiplier=1;}};
const check=async(n:string,f:()=>any)=>{await f();checks++;console.log('✓ '+n);};
try{
 await check('Blockly保存重載、編輯基數/屬性/期限/目標與嚴格合約',()=>{
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{const entry=make().kit[0];validateKit([entry]);const b=buildEntryBlock(w as any,entry)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,entry.node,0),entry);
   const act=r.getAllBlocks(false).find(x=>x.type==='sequence_action')!;act.setFieldValue(JSON.stringify({side:'self',base:70,list:['火'],turns:2}),'PARAMS');const edited=createKitBlockParser('skill')(r.getBlockById(b.id)!,entry.node,0)!;validateKit([edited]);assert.deepEqual((edited.params as any).clause.body[0].acts[0].p,{side:'self',base:70,list:['火'],turns:2});
  }finally{w.dispose();r.dispose();}
  for(const q of [{base:0},{base:Infinity},{list:[]},{list:['不存在']},{list:['火','火']},{turns:0},{turns:1.5},{side:'both'},{code:'任意執行'}])assert.throws(()=>validateKit(make({...p,...q}).kit));
 });
 await check('保底只處理受到技能攻擊；固定/百分比/真實/輸出不改，與較高既有保底取高',()=>{
  for(const cat of ['skill_attack','fixed','percent','true'])for(const incoming of [true,false]){const comp:any={damageCategory:cat,isIncoming:incoming,floor:10};applyTypeDamageFloor({self:{type:'普通'}} as any,comp,p);assert.equal(comp.floor,cat==='skill_attack'&&incoming?300:10);}
  const comp:any={damageCategory:'skill_attack',isIncoming:true,floor:1000};applyTypeDamageFloor({self:{type:'普通'}} as any,comp,p);assert.equal(comp.floor,1000);
  for(const type of ['草','水','地面']){const changing:any={damageCategory:'skill_attack',isIncoming:true};applyTypeDamageFloor({self:{type}} as any,changing,p);assert.equal(changing.floor,300*Math.max(...p.list.map(t=>getTypeMatchup(t,type))));}
 });
 await check('正式異境神霆完整Kit無同名handler且使用通用受方保底',()=>{const s=h.find('5029','異境神霆');h.assertKitOnly(s);assert.deepEqual(s.kit.find((e:any)=>e.order===2).params.clause.body[0].acts[0].p,p);});
 for(const side of ['p1','p2'] as const){
  await check(`${side} 真實主傷害依三種候選克制取最高，並於次回合到期`,async()=>{
   h.S.S=low;try{for(const type of ['普通','水','草','地面','飛行','神秘.電']){const out=await h.play(side,{self:h.unit('S',100000,[make(),{...h.wait(),category:'物理',power:1}],{speed:200}),opp:h.unit('E',100000,[h.wait()],{type}),turns:(_,t)=>[t===1?0:1,0]},2);const floor=Math.floor(300*Math.max(...p.list.map(t=>getTypeMatchup(t,type))));assert.equal(100000-out[0].opp.currentHp,Math.max(1,floor),type);assert.equal(out[0].opp.currentHp-out[1].opp.currentHp,1);}}finally{delete h.S.S;}
  });
  await check(`${side} 自身目標兩回合可編輯且改名執行，第3回合正常`,async()=>{
   h.S.E=low;try{const out=await h.play(side,{self:h.unit('S',100000,[{...make({side:'self',base:70,list:['火'],turns:2}),name:'改寫窗口',category:'屬性',power:0},h.wait()],{speed:200,type:'草'}),opp:h.unit('E',100000,[{...h.wait(),category:'物理',power:1}]),turns:(_,t)=>[t===1?0:1,0]},3);const n=70*getTypeMatchup('火','草');assert.equal(100000-out[0].self.currentHp,n);assert.equal(out[0].self.currentHp-out[1].self.currentHp,n);assert.equal(out[1].self.currentHp-out[2].self.currentHp,1);}finally{delete h.S.E;}
  });
  await check(`${side} 持有者換下場清除窗口，替補與回場不借用`,async()=>{
   h.S.E=low;try{const out=await h.play(side,{self:h.unit('S',100000,[{...make({...p,side:'self',turns:5}),category:'屬性',power:0},h.wait()],{speed:200}),selfBench:[h.unit('B',100000,[h.wait()])],opp:h.unit('E',100000,[{...h.wait(),category:'物理',power:1}]),turns:(_,t)=>[t===1?0:t===2?{switch:1}:t===3?{switch:0}:1,0]},3);assert.equal(out[0].self.currentHp,99700);assert.equal(out[1].self.currentHp,99999);assert.equal(out[2].self.currentHp,99699);}finally{delete h.S.E;}
  });
  await check(`${side} 附加效果封印不建立保底窗口`,async()=>{
   h.S.S=(c:any,e:any,d:any)=>{low(c,e,d);if(e===T.ON_ENTRANCE)c.setPlayerState('allHitEffectNullTurns',99);};try{const [out]=await h.play(side,{self:h.unit('S',100000,[make()],{speed:200}),opp:h.unit('E',100000,[h.wait()])});assert.equal(out.opp.currentHp,99999);}finally{delete h.S.S;}
  });
 }
 console.log(`克制傷害保底 ${checks}項通過；不代表異境神霆全文完成`);
}finally{await h.close();}
process.exit(0);
