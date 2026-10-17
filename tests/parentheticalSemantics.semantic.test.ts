import assert from 'node:assert/strict';
import { distillEffect } from '../src/effects/distillEffect';
import { compileEffectPlan } from '../src/effects/effectConnection';
import { parseSkill } from '../src/blocks/parse';
for(const suffix of ['（最高200點）','(BOSS無效)','（下場後保留）','（內置公式6:18）']){
  const source={name:'保留機制',description:`🎯 恢復自身37點體力${suffix}`};
  const parsed=parseSkill(source.name,source.description);
  assert.equal(parsed.clauses[0].parsed,true,'不改舊路徑剝括號行為');
  const plan=compileEffectPlan({...source,effectMode:'description'},'skill');
  assert.equal(plan.program.clauses[0].raw,source.description);
  assert.equal(plan.program.clauses[0].parsed,false);
  assert.ok(plan.issues.some(i=>i.reason.includes('括號內機制')));
  assert.equal(distillEffect(source,'skill').complete,false,'不能把丟失的括號機制算完成');
  assert.deepEqual(compileEffectPlan({...source,effectMode:'registry'},'skill',true).issues,[],'既有註冊表保持原路徑');
}
assert.equal(distillEffect({name:'原文',description:'🎯 恢復自身37點體力（測試用說明）'},'skill').complete,true);
assert.equal(distillEffect({name:'原文',description:'🎯 恢復自身37點體力'},'skill').complete,true);
const total={name:'總值核對',description:'■ 自身處於能力下降時先制+1（總先制+4）'};
assert.equal(distillEffect({...total,priority:3},'skill').complete,true);
assert.equal(distillEffect({...total,priority:2},'skill').complete,false,'相同原文、不同欄位不能共用快取接受錯誤總值');
assert.equal(distillEffect(total,'skill').complete,false,'缺少欄位值時不猜基礎先制');
console.log('✓ 括號公式／上限／BOSS分支／下場持續不能在煉成時消失；原文與舊路徑保留');
