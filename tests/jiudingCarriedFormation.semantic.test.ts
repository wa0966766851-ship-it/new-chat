import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {MIGRATED_DIXIN_SOUL_KIT:def}=await h.server.ssrLoadModule('/src/data/migratedDixinSoulKit.ts');
const {MIGRATED_DIXIN_SKILL_KITS:rows}=await h.server.ssrLoadModule('/src/data/migratedDixinSkillKits.ts');
const row=rows.find((r:any)=>r.name==='九鼎震八荒');
const skill={...h.find('5017',row.name),kit:row.kit};
const soul={name:'改名天陣魂印',description:def.description,effectMode:'kit',kit:def.kit.filter((e:any)=>e.order===4)};
const a=(op:string,p:any)=>({op,p,label:op});
const mark=a('resource_mark_add',{id:'bahuang_mark',amount:9,side:'self',scope:'elf',name:'八荒',displayChar:'荒',unit:'層',description:'正式資源',persistsOffField:true});
const seed=(lock=0)=>({name:'測試初始化',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'on_entered',source:'mechanic',order:0,
  params:{clause:{raw:'初始化',trig:'entrance',parsed:true,body:[{acts:[mark,...(lock?[a('mark_lock_turns',{id:'bahuang_mark',turns:lock})]:[])]}]}}}]});
const kill=h.kitSkill('其他技能擊敗',[a('dmg',{flat:1000000,type:'真實'})]);
const check=async(name:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${name}`);};
try {
  for(const side of ['p1','p2'] as const) {
    await check(`${side} 未用九鼎即使有天陣，其他技能擊敗也不收九鼎關陣代價`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',9000,[skill,kill],{extra:{soulMark:soul,trait:seed()}}),opp:h.unit('E',1000000,[h.wait()]),oppBench:[h.unit('B',1000000,[h.wait()])],turns:()=>[1,0]});
      assert.equal(r.self.currentHp,9000);assert.ok(r.state[`${side}Timers`].some((t:any)=>t.id==='dixin_formation'));
    });
    await check(`${side} 九鼎成功後改用其他技能擊敗，攜帶監控即刻關陣並執行代價`,async()=>{
      const rs=await h.play(side,{self:h.unit('S',9000,[skill,kill],{extra:{soulMark:soul}}),opp:h.unit('E',1000000,[h.wait()]),oppBench:[h.unit('B',1000000,[h.wait()])],turns:(_,t)=>[t===1?0:1,0]},2);
      assert.equal(rs[0].self.currentHp,9000);assert.ok(rs[0].state[`${side}Timers`].some((t:any)=>t.id==='dixin_formation'));
      assert.equal(rs[1].self.currentHp,1,rs[1].logs.join('\n'));assert.ok(rs[1].self.skills.every((s:any)=>s.pp===0));
      assert.ok(!rs[1].state[`${side}Timers`].some((t:any)=>t.id==='dixin_formation'));
    });
    await check(`${side} 期限已結束的印記鎖不借用歷史旗標關陣`,async()=>{
      const rs=await h.play(side,{self:h.unit('S',9000,[h.wait(),kill,skill],{extra:{soulMark:soul,trait:seed(1)}}),opp:h.unit('E',1000000,[h.wait()]),oppBench:[h.unit('B',1000000,[h.wait()])],turns:(_,t)=>[t===1?0:1,0]},2);
      assert.equal(rs[1].self.currentHp,9000);assert.ok(rs[1].state[`${side}Timers`].some((t:any)=>t.id==='dixin_formation'));
    });
    await check(`${side} 第一次技能無效不消耗一次資格，下一次成功才建立九回合鎖`,async()=>{
      const invalid=h.kitSkill('封一次',[a('invalid_next',{kind:'',uses:1})]);
      const rs=await h.play(side,{self:h.unit('S',9000,[skill],{speed:50,extra:{soulMark:soul}}),opp:h.unit('E',1000000,[invalid,h.wait()],{speed:300}),turns:(_,t)=>[0,t===1?0:1]},2);
      assert.ok(!rs[0].state[`${side}RegistryState`]?.['dixin-jiuding-once:degraded']);
      assert.ok(!rs[0].state[`${side}Timers`].some((t:any)=>t.payload?.block?.markLock));
      assert.equal(rs[1].state[`${side}RegistryState`]?.['dixin-jiuding-once:degraded'],true,rs[1].logs.join('\n'));
      assert.ok(rs[1].state[`${side}Timers`].some((t:any)=>t.payload?.block?.markLock?.id==='bahuang_mark'));
    });
  }
  console.log(`${checks} real P1/P2 jiuding carried formation scenarios passed (not full skill acceptance)`);
} finally {await h.close();}
