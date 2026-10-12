import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock,createKitBlockParser,defineCustomBlocks } from '../src/components/BlocklyBuilder';
import { validateKit } from '../src/effects/kitValidation';
import { createHarness } from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,run:()=>Promise<void>)=>{await run();checks++;console.log(`✓ ${name}`);};
const rule=(trig='round_end')=>({raw:'每層體力調整減少最大體力25%，不是傷害',trig,parsed:true,body:[{acts:[{op:'hp_adjust',p:{side:'self',ratio:.25,base:'最大體力',direction:'subtract',perStack:true},label:'每層體力調整'}]}]});
const mark=(o:any={})=>({op:'mark_program',p:{id:'test:soul-pain',name:'測試魂殤',displayChar:'殤',description:'持有者每層在回合末體力調整減少最大體力25%',side:'opp',mode:'add',count:1,maxCount:4,scope:'elf',persistsOffField:false,unit:'道',rules:[rule()],...o}});
try {
  defineCustomBlocks();
  await check('可編輯巢狀印記程式真正Blockly序列化，不依賴精靈名稱／handler',async()=>{
    const kit=h.kitSkill('來源甲',[mark()]).kit;validateKit(kit);
    const ws=new Blockly.Workspace(),back=new Blockly.Workspace();
    try {for(const e of kit){const b=buildEntryBlock(ws as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');assert.deepEqual(createKitBlockParser('skill')(b,e.node,e.order),e);}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),back);
      const block=back.getTopBlocks(false)[0],entry=JSON.parse(block.data!).entry;
      assert.deepEqual(createKitBlockParser('skill')(block,entry.node,entry.order),entry);
    }finally{ws.dispose();back.dispose();}
  });
  await check('未知節點／死鍵／遞迴印記／脫離印記的計時器／不存在異常均拒絕',async()=>{
    for(const patch of [{scope:undefined},{persistsOffField:undefined},{rules:[rule('fatal')]},{rules:[{...rule(),body:[{acts:[mark()]}]}]},
      {rules:[{...rule(),body:[{acts:[{op:'timed',p:{turns:3,trig:'round_end',body:rule().body},label:''}]}]}]},
      {rules:[{...rule(),body:[{acts:[{op:'status',p:{side:'self',status:'不存在的異常',turns:3},label:''}]}]}]},
      {rules:[{...rule(),body:[{acts:[{op:'hp_adjust',p:{...rule().body[0].acts[0].p,ignoredFlag:true},label:''}]}]}]},
    ])assert.throws(()=>validateKit(h.kitSkill('錯誤',[mark(patch)]).kit));
    assert.throws(()=>validateKit(h.kitSkill('沒有印記上下文',rule().body[0].acts).kit));
  });
  await check('印記查詢及執行忽略其他持有者；相同ID陣營／單隻到期各自移除',async()=>{
    const {evalCond,runHolderMarks}=await h.server.ssrLoadModule('/src/blocks/runtime.ts');
    let marks:any[]=[{id:'same',name:'同名',count:1,ownerBattleId:'B',effects:{blockProgram:[rule()]}},{id:'same',name:'同名',count:1,ownerBattleId:'A',effects:{blockProgram:[rule()],blkTurns:1}},{id:'same',name:'同名',count:1,scope:'team',effects:{blockProgram:[rule()],blkTurns:2}}];
    const self:any={id:'A',battleId:'A',currentHp:1000,maxHp:1000},target={id:'E',battleId:'E',maxHp:1000};let changes=0;
    const ctx:any={actor:'p1',targetSide:'p2',self,target,activeP1:self,activeP2:target,getMarks:()=>marks,adjustHp:(_s:any,n:number)=>{changes+=n;},setMark:(m:any)=>{marks=marks.map(x=>x.id===m.id&&(x.ownerBattleId||null)===(m.ownerBattleId||null)?m:x);},clearMark:(id:string,_side:string,owner:string|null)=>{marks=marks.filter(m=>m.id!==id||(m.ownerBattleId||null)!==owner);},addLog:()=>{},getPlayerState:()=>0,getOpponentState:()=>0};
    assert.equal(evalCond({...ctx,getMarks:()=>[marks[0]]},{c:'has_mark',p:{side:'self',name:'同名'}},{}),false);
    runHolderMarks(ctx,['round_end'],{},true);assert.equal(changes,-500);assert.deepEqual(marks.map(m=>m.ownerBattleId||'team'),['B','team']);
    runHolderMarks(ctx,['round_end'],{},true);assert.equal(changes,-750);assert.deepEqual(marks.map(m=>m.ownerBattleId||'team'),['B']);
  });
  for(const side of ['p1','p2'] as const) {
    await check(`${side} 原來源不存在仍照持有者程式結算；護盾護罩不能擋體力調整`,async()=>{
      const [r]=await h.play(side,{self:h.unit('自訂',10000,[h.kitSkill('完全改名',[mark()])]),opp:h.unit('E',4000,[h.wait()],{extra:{shield:1000,barrier:1000}})});
      assert.equal(r.opp.currentHp,3000);assert.equal(r.opp.shield,1000);assert.equal(r.opp.barrier,1000);
      const marks=r.state[`${side==='p1'?'p2':'p1'}Marks`];assert.equal(marks[0].count,1);assert.equal(marks[0].ownerBattleId,'E');assert.equal(marks[0].effects.blkDef,undefined);
    });
    await check(`${side} 層數累加上限4，設定不累加，期限含當回合且不多扣一次`,async()=>{
      const add=h.kitSkill('加',[mark({count:3,rules:[{...rule(),body:[{acts:[{op:'hp_adjust',p:{side:'self',delta:-10,perStack:true},label:''}]}]}]})]);
      const set=h.kitSkill('設',[mark({mode:'set',count:2,turns:2,rules:[{...rule(),body:[{acts:[{op:'hp_adjust',p:{side:'self',delta:-10,perStack:true},label:''}]}]}]})]);
      const hist=await h.play(side,{self:h.unit('S',10000,[add,set,h.wait()]),opp:h.unit('E',10000,[h.wait()]),turns:(_e,t)=>[t<=2?0:t===3?1:2,0]},5);
      assert.deepEqual(hist.map(r=>r.opp.currentHp),[9970,9930,9910,9890,9890]);
      assert.equal(hist[1].state[`${side==='p1'?'p2':'p1'}Marks`][0].count,4);assert.equal(hist[3].state[`${side==='p1'?'p2':'p1'}Marks`].length,0);
    });
    await check(`${side} 下場消失；明確陣營級才由下一隻承受`,async()=>{
      for(const scope of ['elf','team']) {
        const kit=h.kitSkill('附加',[mark({scope,persistsOffField:scope==='team'})]);
        const hist=await h.play(side,{self:h.unit('S',10000,[kit,h.wait()]),opp:h.unit('E',4000,[h.wait()]),oppBench:[h.unit('N',8000,[h.wait()])],turns:(_e,t)=>[t===1?0:1,t===1?0:{switch:1}]},2);
        assert.equal(hist[1].opp.id,'N');assert.equal(hist[1].opp.currentHp,scope==='elf'?8000:6000);
        assert.equal(hist[1].state[`${side==='p1'?'p2':'p1'}Marks`].length,scope==='elf'?0:1);
      }
    });
  }
  console.log(`持有者印記程式 ${checks} 項後台驗證通過`);
}finally{await h.close();}
