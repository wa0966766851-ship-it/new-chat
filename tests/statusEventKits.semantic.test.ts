import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {removedStatusEvents} from '../src/battle/statusTransitionEvents';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const a=(op:string,p:any={})=>({op,p,label:op});
const entry=(node:string,trig:string,acts:any[],status?:string,cond:any[]=[]):any=>({codeId:'effect_sequence',node,source:'soulmark',order:0,params:{clause:{raw:trig,trig,parsed:true,body:[{cond:[...(status?[{c:'event_status',p:{statuses:[status]},label:status}]:[]),...cond],acts}]}}});
const soul=(...kit:any[])=>({name:'可編輯異常反應',effectMode:'kit',kit});
const effects=(status:string,duration:number)=>({effects:[{id:status,name:status,duration}],battleStatuses:{[status]:duration}});
const check=async(name:string,fn:()=>Promise<void>|void)=>{await fn();checks++;console.log(`✓ ${name}`);};
try {
  await check('四個正式異常節點可於真實Blockly保存重載；扣減阻止禁止放到其他節點',()=>{
    defineCustomBlocks();const kit=[entry('on_status_ended','status_end',[a('heal_flat',{amount:17})],'凍傷'),entry('on_status_received','status_received',[a('heal_flat',{amount:17})],'凍傷'),entry('on_status_immunized','status_immune',[a('heal_flat',{amount:17})],'凍傷'),entry('before_status_tick','status_tick',[a('stop_status_tick')],'凍傷')];
    validateKit(kit);const ws=new Blockly.Workspace(),copy=new Blockly.Workspace();
    try {kit.forEach(e=>assert.ok(buildEntryBlock(ws as any,e)));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),copy);
      assert.deepEqual(copy.getTopBlocks(false).map(b=>{const e=JSON.parse(b.data!).entry;return createKitBlockParser('soulmark')(b,e.node,e.order);}),kit);
    }finally{ws.dispose();copy.dispose();}
    assert.throws(()=>validateKit([entry('on_status_received','status_received',[a('stop_status_tick')])]),/扣減前/);
  });
  await check('解除差異比較不把縮短期限／歷史別名重寫算成解除',()=>{
    const before=h.unit('S',100,[h.wait()],{extra:effects('frozen',3)});
    assert.deepEqual(removedStatusEvents(before,{...before,...effects('石化',2)}),[]);
    assert.deepEqual(removedStatusEvents(before,{...before,effects:[],battleStatuses:{}}),[{status:'石化',duration:3,reason:'removed'}]);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 譜尼整份聖魂印使用真正Kit，滿血和滿PP不溢出；自訂改名仍免疫並回復`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
      const native=DEFAULT_ELVES.find((e:any)=>String(e.id)==='300').soulMark;assert.equal(native.effectMode,'kit');validateKit(native.kit);
      const changeName={...native,name:'移植免疫再生'};
      const apply=h.kitSkill('附加',[a('status',{side:'opp',status:'凍傷',turns:3})]);
      const hist=await h.play(side,{self:h.unit('S',1000,[{...h.wait(),name:'補充目標',pp:0}, {...h.wait(),name:'正常等待',pp:99}],{maxHp:2000,extra:{soulMark:changeName}}),opp:h.unit('E',100000,[apply]),turns:()=>[1,0]},3);
      assert.equal(hist[2].turn,4,'正式完成三回合，不以選招卡住當免疫通過');
      assert.deepEqual(hist.map(r=>r.self.currentHp),[1500,2000,2000],JSON.stringify(hist[2].logs));assert.deepEqual(hist[2].self.skills.map((s:any)=>s.pp),[3,99]);assert.deepEqual(h.statuses(hist[2].self),[]);
    });
    await check(`${side} 附加成功與免疫各只通知一次，反彈不冒充免疫`,async()=>{
      const apply=h.kitSkill('附加凍傷',[a('status',{side:'opp',status:'凍傷',turns:3})]);
      for(const mode of ['received','immune','reflect']){
        const kit=[entry('on_status_received','status_received',[a('heal_flat',{amount:17})],'凍傷'),entry('on_status_immunized','status_immune',[a('heal_flat',{amount:29})],'凍傷')];
        if(mode==='immune')kit.push(entry('before_status_apply','before_status',[a('status_guard',{cls:''})]));
        if(mode==='reflect')kit.push(entry('on_entered','entrance',[a('immune_status_count',{count:1,reflect:true})]));
        const [r]=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:2000,extra:{soulMark:soul(...kit)}}),opp:h.unit('E',100000,[apply])});
        assert.equal(r.self.currentHp,mode==='received'?767:mode==='immune'?1029:1000);assert.equal(h.statuses(r.self).includes('凍傷'),mode==='received');
        if(mode==='reflect')assert.ok(h.statuses(r.opp).includes('凍傷'));
      }
    });
    await check(`${side} 治癒通知在解除寫回之後，不能讀到舊異常；BOSS特性不因治癒消失`,async()=>{
      const cure=h.kitSkill('治癒',[a('cure_status',{side:'self'})]);
      const reaction=entry('on_status_ended','status_end',[a('heal_flat',{amount:17})],'凍傷',[{c:'has_status',p:{side:'self',status:'凍傷',neg:true},label:'已解除'}]);
      const [r]=await h.play(side,{self:h.unit('S',1000,[cure],{speed:200,maxHp:2000,extra:{...effects('凍傷',3),soulMark:soul(reaction)}}),opp:h.unit('E',100000,[h.wait()])});
      assert.equal(r.self.currentHp,1017);assert.deepEqual(h.statuses(r.self),[]);
      const [boss]=await h.play(side,{self:h.unit('S',1000,[cure],{maxHp:2000,extra:{...effects('神話',999),soulMark:soul(entry('on_status_ended','status_end',[a('heal_flat',{amount:17})],'神話'))}}),opp:h.unit('E',100000,[h.wait()])});
      assert.ok(h.statuses(boss.self).includes('神話'));assert.equal(boss.self.currentHp,1000);
    });
    await check(`${side} 自然衍化後解除反應讀到凍傷；冰封只通知一次`,async()=>{
      const reaction=entry('on_status_ended','status_end',[a('heal_flat',{amount:17})],'冰封',[{c:'has_status',p:{side:'self',status:'凍傷'},label:'已衍化'}]);
      const hist=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:2000,extra:{...effects('冰封',1),soulMark:soul(reaction)}}),opp:h.unit('E',100000,[h.wait()])},2);
      assert.equal(hist[0].self.currentHp,1017);assert.ok(h.statuses(hist[0].self).includes('凍傷'));assert.equal(hist[1].self.currentHp,767,'凍傷下回合正常扣250，不重複恢復');
    });
    await check(`${side} 指定異常不扣減，不把所有異常改999；另項仍自然結束`,async()=>{
      const kit=soul(entry('before_status_tick','status_tick',[a('stop_status_tick')],'失明'),entry('on_status_ended','status_end',[a('heal_flat',{amount:17})],'衰弱'));
      const extra={effects:[{id:'失明',name:'失明',duration:2},{id:'衰弱',name:'衰弱',duration:1}],battleStatuses:{失明:2,衰弱:1},soulMark:kit};
      const hist=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:2000,extra}),opp:h.unit('E',100000,[h.wait()])},2);
      assert.equal(hist[1].self.battleStatuses.失明,2);assert.equal(hist[0].self.battleStatuses.衰弱,undefined);assert.equal(hist[1].self.currentHp,1017);
    });
    await check(`${side} 手動转化同時分流解除和附加，不清BOSS特性`,async()=>{
      const convert=h.kitSkill('轉化',[a('convert_status',{side:'self',status:'燒傷',turns:3})]);
      const extra={...effects('凍傷',3),soulMark:soul(entry('on_status_ended','status_end',[a('heal_flat',{amount:17})],'凍傷'),entry('on_status_received','status_received',[a('heal_flat',{amount:29})],'燒傷'))};
      const [r]=await h.play(side,{self:h.unit('S',1000,[convert],{speed:200,maxHp:2000,extra}),opp:h.unit('E',100000,[h.wait()])});
      assert.equal(r.self.currentHp,796,'兩反應恢復46後燒傷正常扣250');assert.deepEqual(h.statuses(r.self),['燒傷']);
    });
    await check(`${side} 下場清除不誤當解除事件；場下指定解除只恢復持有者`,async()=>{
      const reaction=soul(entry('on_status_ended','status_end',[a('heal_flat',{amount:17})],'凍傷'));
      const hist=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:2000,extra:{...effects('凍傷',3),soulMark:reaction}}),selfBench:[h.unit('N',1000,[h.wait()])],opp:h.unit('E',100000,[h.wait()]),turns:()=>[{switch:1},0]});
      assert.equal(hist[0].state[`${side}Team`][0].currentHp,1000);
      h.S['場下治癒來源']=(ctx:any,event:any)=>{if(event!=='BEFORE_SKILL')return;ctx.updateAnyElf(side,'B',{effects:[],battleStatuses:{}});};
      try {const [r]=await h.play(side,{self:h.unit('S',1000,[h.wait()]),selfBench:[h.unit('B',1000,[h.wait()],{maxHp:2000,extra:{...effects('凍傷',3),soulMark:reaction}})],opp:h.unit('場下治癒來源',100000,[h.wait()])});
        assert.equal(r.self.currentHp,1000);assert.equal(r.state[`${side}Team`][1].currentHp,1017);
      }finally{delete h.S['場下治癒來源'];}
    });
  }
  console.log(`${checks} 異常事件積木後台情境通過；非全精靈正確率`);
}finally{await h.close();}
