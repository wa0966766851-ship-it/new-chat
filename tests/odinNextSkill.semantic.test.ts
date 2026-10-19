import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
  const {MIGRATED_5019_TIWAZ_SOUL_KIT:source}=await h.server.ssrLoadModule('/src/data/migrated5019TiwazSoulKit.ts');
  const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  const kit=structuredClone(source.kit.filter((e:any)=>[5,6,7].includes(e.order)));
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{
    for(const e of kit){assert.equal(kitEntryIssue(e),null);assert.ok(buildEntryBlock(w as any,e));}
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    assert.deepEqual(r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('soulmark')(b,old.node,old.order);}),kit);
  }finally{w.dispose();r.dispose();}
  for(const side of ['p1','p2'] as const)for(const consumeWithStatus of [false,true]){
    const seen:any[]=[];
    const snapshots:any[]=[];
    h.S['恢復排序對手']=(_ctx:any,event:string,data:any)=>{
      if(event==='BEFORE_DAMAGE'){const c=data.damageComp;seen.push({target:c.isIncoming?'恢復排序對手':'恢復排序持有者',kind:c.damageCategory,comp:c});}
    };
    const attack=h.kitSkill('正式攻擊',[
      {op:'dmg',p:{flat:100,type:'技能',elem:'普通'}},
      {op:'dmg',p:{flat:100,type:'固定'}},
    ],{category:'物理',power:100});
    const history=await h.play(side,{
      self:h.unit('恢復排序持有者',900,[h.wait(),attack],{maxHp:3000,speed:100,extra:{soulMark:{...source,effectMode:'kit',kit}}}),
      opp:h.unit('恢復排序對手',1500,[h.wait(),{...attack,priority:1}],{maxHp:9000,speed:300}),
      turns:(engine:any,turn:number)=>{
        if(turn>1)snapshots.push(structuredClone(engine.getState()));
        if(turn===2){
          const state=engine.getState(),other=side==='p1'?'p2':'p1';
          // 只測一次回復授予的「下次」，停用後續回合再次授予，保留既有計時器。
          state[side].soulMark.kit=[];
          for(const who of [side,other]){state[who].currentHp=100000;state[who].maxHp=100000;}
        }
        return turn===1||turn===2&&consumeWithStatus?[0,0]:[1,1];
      },
    },3);
    const first=snapshots[0],other=side==='p1'?'p2':'p1';
    assert.equal(first[side].currentHp,1900);
    assert.equal(first[other].currentHp,500,'回血1000附加等量百分比傷害');
    const timers=(who:string)=>first[`${who}Timers`].filter((t:any)=>t.id.startsWith('next_skill_modifiers:'));
    assert.equal(timers(side).length,1,'回復後1900高於對手1500，必須授予自身加成');
    assert.equal(timers(side==='p1'?'p2':'p1').length,1,'回復前900低於1500，必須授予對手減益');
    const hits=seen.filter(v=>v.kind==='skill_attack').map(v=>({...v,boost:v.comp.increasePercent,reduce:v.comp.decreasePercent}));
    if(consumeWithStatus){
      assert.equal(hits.length,2);
      assert.ok(hits.every(v=>v.boost===0&&v.reduce===0),'屬性技能也會消耗下次修正，不保留到後續攻擊');
    }else{
      assert.equal(hits.length,4,'兩回合雙方各一次正式攻擊');
      assert.equal(hits[0].target,'恢復排序對手','下次+2與對手-2使原本慢方先動');
      assert.equal(hits[0].boost,.5);assert.equal(hits[0].reduce,0);
      assert.equal(hits[1].target,'恢復排序持有者');assert.equal(hits[1].reduce,.5);
      assert.equal(hits[2].target,'恢復排序持有者','再下一次恢復對手原先制+1');
      assert.equal(hits[2].reduce,0);assert.equal(hits[3].boost,0);
      const extras=seen.filter(v=>v.kind==='skill_attribute');
      assert.equal(extras.length,4);
      assert.equal(extras[0].comp.increasePercent,.5,'同次使用附加技能傷害仍享有修正');
      assert.equal(extras[1].comp.decreasePercent,.5,'同次使用附加技能傷害也應降低50%');
    }
    assert.ok(seen.filter(v=>v.kind==='fixed').every(v=>v.comp.increasePercent===0&&v.comp.decreasePercent===0),'固定傷害不屬於技能傷害修正');
    for(const who of [side,other])assert.ok(!snapshots[1][`${who}Timers`].some((t:any)=>t.id.startsWith('next_skill_modifiers:')),'使用一次後共同移除先制與傷害修正');
  }
  for(const side of ['p1','p2'] as const)for(const hp of [2000,3000,5000]){
    const [v]=await h.play(side,{
      self:h.unit('滿血判定持有者',3000,[h.wait()],{extra:{soulMark:{...source,effectMode:'kit',kit:structuredClone(kit)}}}),
      opp:h.unit('滿血判定對手',hp,[h.wait()],{maxHp:9000}),
    });
    const other=side==='p1'?'p2':'p1';
    const has=(who:string)=>v.state[`${who}Timers`].some((t:any)=>t.id.startsWith('next_skill_modifiers:'));
    assert.equal(has(side),hp<3000);assert.equal(has(other),hp>3000);
    assert.equal(v.opp.currentHp,hp,'滿血無實際恢復，不附加名目1000百分比傷害');
  }
  console.log('奧丁回復前/後各自判定、下次雙方先制/技能傷害實際讀取與一次消耗、P1/P2及Blockly通過');
}finally{await h.close();}
