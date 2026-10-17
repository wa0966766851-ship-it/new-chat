import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {EffectTiming}=await h.server.ssrLoadModule('/src/effects/types.ts');
const blockedName='正式抵擋測試',immuneName='正式免疫測試',nativeBlockName='既有倍率抵擋測試';
const {handleBaphometSoulMark}=await h.server.ssrLoadModule('/src/effects/elves/baphomet/registry.ts');
h.S[nativeBlockName]=(ctx:any,event:any,data:any)=>{if(event===EffectTiming.ON_ENTRANCE)ctx.setPlayerState('suffocating',true);return handleBaphometSoulMark(ctx,event,data);};
h.S[blockedName]=(_:any,event:any,data:any)=>{const comp=data?.damageComp||data;if(event===EffectTiming.BEFORE_DAMAGE&&comp?.isIncoming&&comp.damageCategory==='percent'){comp.damageBlocks||=new Map();comp.damageBlocks.set('fixture',()=>{});}};
h.S[immuneName]=(_:any,event:any,data:any)=>{const comp=data?.damageComp||data;if(event===EffectTiming.BEFORE_DAMAGE&&comp?.isIncoming&&comp.damageCategory==='percent')comp.multiplier=0;};
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const modifier=(op:string,p:any)=>{const setup=['damage_cap_turns','flat_reduction_uses','absorb_now'].includes(op);return {name:'傷害設定',description:'測試用',effectMode:'kit',kit:[{codeId:'effect_sequence',node:setup?'on_entered':'before_damage',source:'mechanic',role:'innate',order:0,
  params:{clause:{raw:'正式傷害設定',trig:setup?'entrance':p.dir==='out_reduce'?'outgoing':'incoming',parsed:true,body:[{acts:[{op,p,label:op}]}]}}}]};};
const sample=()=>({...h.wait(),name:'原因分支',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'on_skill_use',source:'skill',role:'attached',order:0,
  params:{clause:{raw:'百分比免疫才轉真傷',trig:'use',parsed:true,body:[
    {acts:[{op:'dmg',p:{flat:90,type:'百分比'},label:'百分比'}]},
    {cond:[{c:'last_damage_immune',p:{},label:'前次傷害被受方免疫'}],acts:[{op:'dmg_from_last',p:{basis:'requested_damage',ratio:1,type:'真實'},label:'轉真實快照'}],elseActs:[{op:'heal_equal',p:{},label:'恢復等量'}]},
  ]}}}]});
try{
  await check('嚴格無參數原因查詢，正式100%受方免疫記錄方向；99%與造成者歸零不混淆',async()=>{
    const {addDamageReduction,multiplyDamageReduction}=await h.server.ssrLoadModule('/src/battle/damageReduction.ts');
    const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
    assert.equal(sequenceIssue(sample().kit[0].params.clause),null);
    const bad=structuredClone(sample().kit[0].params.clause);bad.body[1].cond![0].p={fake:true} as any;assert.ok(sequenceIssue(bad));
    const badBasis=structuredClone(sample().kit[0].params.clause);badBasis.body[1].acts[0].p.basis='fake';assert.ok(sequenceIssue(badBasis));
    for(const [incoming,rate,expected] of [[true,1,true],[false,1,false],[true,.99,false]] as const){
      const c:any={damageCategory:'percent',multiplier:1,decreasePercent:0};addDamageReduction(c,rate,incoming);assert.equal(!!c.incomingDamageImmunity,expected);
      const m:any={damageCategory:'percent',multiplier:1,decreasePercent:0};multiplyDamageReduction(m,1-rate,incoming);assert.equal(!!m.incomingDamageImmunity,expected);
    }
    const same:any={damageCategory:'percent',multiplier:1,decreasePercent:0};addDamageReduction(same,.5,true,'same');addDamageReduction(same,.5,true,'same');assert.equal(same.incomingDamageImmunity,true);
    const different:any={damageCategory:'percent',multiplier:1,decreasePercent:0};addDamageReduction(different,.5,true,'A');addDamageReduction(different,.5,true,'B');assert.equal(!!different.incomingDamageImmunity,false);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 比例吸取保留免疫原因；上限、抵擋、轉恢復不補真傷，恢復仍按結算量`,async()=>{
      for(const mode of ['normal','immune','native','nativeblock','reduced','cap','block','flat','barrier','converted']){
        const draining=sample();const body=draining.kit[0].params.clause.body;
        body[0].acts[0]={op:'drain',p:{ratio:90/100000,true:false},label:'比例吸取'} as any;
        body[1].elseActs=[];
        const trait=mode==='immune'?modifier('dmg_mod',{dir:'in',kind:'百分比',reduce:1}):mode==='reduced'?modifier('dmg_mod',{dir:'in',kind:'百分比',reduce:.5}):
          mode==='cap'?modifier('damage_cap_turns',{side:'self',dir:'in',kind:'百分比',cap:0,turns:2}):mode==='flat'?modifier('flat_reduction_uses',{uses:1,flat:90,kind:'百分比'}):mode==='converted'?modifier('absorb_now',{}):undefined;
        const [r]=await h.play(side,{self:h.unit('S',40000,[draining],{maxHp:50000}),
          opp:h.unit('E',100000,[h.wait()],{maxHp:mode==='converted'?110000:100000,extra:{trait,...(mode==='barrier'?{barrier:1000}:{}),...(['block','native','nativeblock'].includes(mode)?{name:mode==='block'?blockedName:mode==='nativeblock'?nativeBlockName:immuneName,soulMark:{name:'測試',description:''}}:{})}})});
        const nominal=mode==='converted'?99:90;
        const loss=['cap','block','nativeblock','flat','barrier'].includes(mode)?0:mode==='reduced'?45:90;
        assert.equal(r.opp.currentHp,mode==='converted'?100000+nominal:100000-loss,`${mode}\n${r.logs.join('\n')}`);
        assert.equal(r.self.currentHp,40000+(['normal','barrier'].includes(mode)?90:mode==='reduced'?45:0),`${mode}\n${r.logs.join('\n')}`);
      }
    });
    await check(`${side} 固定與真實吸取不沿用上一段百分比免疫結果`,async()=>{
      for(const trueDamage of [false,true]){
        const draining=sample();const body=draining.kit[0].params.clause.body;
        body.splice(1,0,{acts:[{op:'drain',p:{flat:90,true:trueDamage},label:'其他類別吸取'}]} as any);
        body[2].elseActs=[];
        const [r]=await h.play(side,{self:h.unit('S',40000,[draining],{maxHp:50000}),opp:h.unit('E',100000,[h.wait()],{extra:{trait:modifier('dmg_mod',{dir:'in',kind:'百分比',reduce:1})}})});
        assert.equal(r.opp.currentHp,99910,r.logs.join('\n'));assert.equal(r.self.currentHp,40090);
      }
    });
    await check(`${side} 正式受方免疫才轉真實；減傷、上限0、抵擋、滿血與護罩不誤判`,async()=>{
      for(const mode of ['normal','full','immune','native','nativeblock','reduced','cap','block','flat','barrier','outzero','converted']){
        const trait=mode==='immune'?modifier('dmg_mod',{dir:'in',kind:'百分比',reduce:1}):mode==='reduced'?modifier('dmg_mod',{dir:'in',kind:'百分比',reduce:.5}):
          mode==='cap'?modifier('damage_cap_turns',{side:'self',dir:'in',kind:'百分比',cap:0,turns:2}):mode==='flat'?modifier('flat_reduction_uses',{uses:1,flat:90,kind:'百分比'}):mode==='converted'?modifier('absorb_now',{}):undefined;
        const [r]=await h.play(side,{self:h.unit('S',mode==='full'?50000:40000,[sample()],{maxHp:50000,extra:mode==='outzero'?{trait:modifier('dmg_mod',{dir:'out_reduce',kind:'百分比',reduce:1})}:{}}),
          opp:h.unit('E',100000,[h.wait()],{maxHp:mode==='converted'?110000:100000,extra:{trait,...(mode==='barrier'?{barrier:1000}:{}),...(['block','native','nativeblock'].includes(mode)?{name:mode==='block'?blockedName:mode==='nativeblock'?nativeBlockName:immuneName,soulMark:{name:'測試',description:''}}:{})}})});
        const loss=mode==='cap'||mode==='block'||mode==='nativeblock'||mode==='flat'||mode==='barrier'||mode==='outzero'?0:mode==='reduced'?45:90;
        assert.equal(r.opp.currentHp,mode==='converted'?100090:100000-loss,`${mode}\n${r.logs.join('\n')}`);
        assert.equal(r.self.currentHp,mode==='full'?50000:40000+(mode==='normal'||mode==='barrier'?90:mode==='reduced'?45:0),`${mode}\n${r.logs.join('\n')}`);
      }
    });
  }
  console.log(`傷害免疫原因查詢：${checks}項通過`);
}finally{delete h.S[blockedName];delete h.S[immuneName];delete h.S[nativeBlockName];await h.close();}
