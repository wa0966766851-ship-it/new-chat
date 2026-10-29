import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {markDamageReductionRate} from '../src/battle/markDamageReduction';
import {sequenceActionLabel} from '../src/effects/sequencePresentation';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
const reduction={kind:'攻擊',baseRatio:.25,ratio:.1,perStack:true,cap:.55};
const mark=(o:any={})=>({op:'mark_program',p:{id:'layered:guard',name:'自訂層數減傷',displayChar:'護',description:'基礎25%，每層額外10%，上限55%',
  side:'self',mode:'set',count:1,maxCount:10,scope:'elf',persistsOffField:true,unit:'層',turns:2,rules:[],incomingDamageReduction:{...reduction},...o}});
const trait=(o:any={})=>({name:'自訂印記',description:'自帶規則',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'on_entered',source:'soulmark',role:'innate',order:0,
  params:{clause:{raw:'自帶規則',trig:'entrance',parsed:true,body:[{acts:[mark(o)]}]}}}]});
const hit=()=>({...h.wait(),name:'攻擊',category:'物理',power:100});
try{
  const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
  const setBase=(_ctx:any,e:any,d:any)=>{const c=d?.damageComp||d;if(e===T.BEFORE_DAMAGE&&!c.isIncoming&&c.damageCategory==='skill_attack')c.base=1000;};
  h.S.S=setBase;h.S.E=setBase;
  await check('完整參數合約拒絕NaN、超界、假傷害類型、缺層數旗標、死鍵及空容器',()=>{
    validateKit(h.kitSkill('有效',[mark()]).kit);
    for(const r of [null,[],{}, {...reduction,baseRatio:NaN},{...reduction,cap:1.1},{...reduction,ratio:-1},{...reduction,perStack:false},{...reduction,kind:'真實'},{...reduction,handler:'legacy'}])
      assert.throws(()=>validateKit(h.kitSkill('無效',[mark({incomingDamageReduction:r})]).kit));
    assert.throws(()=>validateKit(h.kitSkill('空容器',[mark({incomingDamageReduction:undefined})]).kit));
    assert.equal(markDamageReductionRate(reduction as any,0),0);assert.equal(markDamageReductionRate(reduction as any,8),.55);
    assert.ok(sequenceActionLabel({...mark(),label:'mark_program'}).includes('最高55%'));
  });
  let edited:any;
  await check('Blockly保存完整印記後改基礎值、逐層值、上限，重載為可執行查詢',()=>{
    defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
    try{
      const e=trait().kit[0],b=buildEntryBlock(w as any,e as any)!;assert.ok(b);
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
      const block=r.getAllBlocks(false).find((x:any)=>x.type==='sequence_action')!;
      const p=JSON.parse(block.getFieldValue('PARAMS'));p.incomingDamageReduction={...reduction,baseRatio:.1,ratio:.2,cap:.4};
      block.setFieldValue(JSON.stringify(p),'PARAMS');
      const saved=Blockly.serialization.workspaces.save(r);w.clear();Blockly.serialization.workspaces.load(saved,w);
      edited=createKitBlockParser('soulmark')(w.getBlockById(b.id)!,e.node,0)!;
      validateKit([edited]);assert.equal(edited.params.clause.body[0].acts[0].p.incomingDamageReduction.cap,.4);
    }finally{w.dispose();r.dispose();}
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 一層35%、二層45%、三層與八層封頂55%，原始攻擊1000實扣650/550/450/450`,async()=>{
      for(const [count,damage] of [[1,650],[2,550],[3,450],[8,450]]){
        const [r]=await h.play(side,{self:h.unit('S',100000,[h.wait()],{extra:{trait:trait({count})}}),opp:h.unit('E',100000,[hit()])});
        assert.equal(r.self.currentHp,100000-damage,r.logs.join('\n'));
      }
    });
    await check(`${side} 兩回合到期即停止，第三回合不殘留常駐減傷`,async()=>{
      const r=await h.play(side,{self:h.unit('S',100000,[h.wait()],{extra:{trait:trait()}}),opp:h.unit('E',100000,[hit()])},3);
      assert.deepEqual(r.map(x=>x.self.currentHp),[99350,98700,97700]);assert.equal(r[2].state[`${side}Marks`].length,0);
    });
    await check(`${side} 同持有者當下加層立即更新35%→45%→55%，不快取首次比例`,async()=>{
      const add=h.kitSkill('增加印記',[mark({mode:'add',turns:5})]);
      const r=await h.play(side,{self:h.unit('S',100000,[h.wait(),add],{speed:200,extra:{trait:trait({turns:5})}}),
        opp:h.unit('E',100000,[hit()]),turns:(_,t)=>[t===1?0:1,0]},3);
      assert.deepEqual(r.map(x=>x.self.currentHp),[99350,98800,98350]);
      assert.equal(r[2].state[`${side}Marks`][0].count,3);
    });
    await check(`${side} 攻擊減傷不攔固定／百分比／X系技能／真實傷害`,async()=>{
      for(const type of ['固定','百分比','技能','真實']){
        const [r]=await h.play(side,{self:h.unit('S',100000,[h.wait()],{extra:{trait:trait({count:8})}}),
          opp:h.unit('E',100000,[h.kitSkill('獨立傷害',[{op:'dmg',p:{flat:1000,type,...(type==='技能'?{elem:'普通'}:{})}}])])});
        assert.equal(r.self.currentHp,99000,`${type}: ${r.logs.join('\n')}`);
      }
    });
    await check(`${side} 個體下場保留不借給隊友，陣營印記則換人後仍減傷`,async()=>{
      for(const scope of ['elf','team']){
        const r=await h.play(side,{self:h.unit('S',100000,[h.wait()],{extra:{trait:trait({count:4,scope,turns:5})}}),
          selfBench:[h.unit('B',100000,[h.wait()])],opp:h.unit('E',100000,[hit()]),turns:(_,t)=>[t===2?{switch:1}:0,0]},2);
        assert.equal(r[1].self.id,'B');assert.equal(r[1].self.currentHp,scope==='elf'?99000:99550,r[1].logs.join('\n'));
      }
    });
    await check(`${side} 下場清除的個體印記確實移除，重載改值上限40%實扣600`,async()=>{
      const r=await h.play(side,{self:h.unit('S',100000,[h.wait()],{extra:{trait:trait({persistsOffField:false,turns:5})}}),
        selfBench:[h.unit('B',100000,[h.wait()])],opp:h.unit('E',100000,[hit()]),turns:(_,t)=>[t===2?{switch:1}:0,0]},2);
      assert.equal(r[1].state[`${side}Marks`].length,0);
      const e=structuredClone(edited);e.params.clause.body[0].acts[0].p.count=4;
      const [changed]=await h.play(side,{self:h.unit('S',100000,[h.wait()],{extra:{trait:{name:'改名',description:'自帶規則',effectMode:'kit',kit:[e]}}}),opp:h.unit('E',100000,[hit()])});
      assert.equal(changed.self.currentHp,99400,changed.logs.join('\n'));
    });
  }
  console.log(`${checks} 印記基礎＋逐層＋上限減傷驗證通過`);
}finally{delete h.S.S;delete h.S.E;await h.close();}
