import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock, createKitBlockParser, defineCustomBlocks } from '../src/components/BlocklyBuilder';
import { collectEffectPresets, collectEffectPresetsAsync, defaultEffectKit, instantiateEffectPreset } from '../src/effects/effectPresets';
import { normalizeBlockAtom } from '../src/effects/blockParams';
import { DEFAULT_ELVES } from '../src/data/defaultElvesLoaded';
import { distillEffect } from '../src/effects/distillEffect';
import type { KitEntry } from '../src/effects/effectSystem.schema';

let count = 0;
function check(name: string, run: () => void) { run();count++;console.log(`✓ ${name}`); }
defineCustomBlocks();
const entry = (codeId: string, params: Record<string, any>): KitEntry => ({ codeId,params,node:'on_skill_use',source:'skill',role:'attached',order:0,customText:'保留原句' });
function roundTrip(original: KitEntry, edit?: (block: Blockly.Block) => void) {
  const ws = new Blockly.Workspace(); const b = buildEntryBlock(ws as any, original)!;
  assert.ok(b); const saved = Blockly.serialization.workspaces.save(ws); const restored = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(saved,restored); const block=restored.getBlockById(b.id)!;
  edit?.(block); const output=createKitBlockParser('skill')(block,original.node)!;
  ws.dispose();restored.dispose();return output;
}
check('防禦-1真實欄位不是攻擊+1；公開存檔重載與原句保留',()=>{
  const source=entry('stat_change',{target:'opponent',def:-1});
  const result=roundTrip(source,b=>{assert.equal(b.getFieldValue('STAT_NAME'),'def');assert.equal(Number(b.getFieldValue('STAGES')),-1);});
  assert.deepEqual(result,source);
  const changed=roundTrip(source,b=>b.setFieldValue('2','STAGES'));
  assert.equal(changed.params.def,undefined);assert.equal(normalizeBlockAtom('stat_change',changed.params).params.value,2);
});
check('清提升與清下降正確顯示；換成另一種不留舊type覆蓋',()=>{
  for(const [type,field] of [['buff','boost'],['debuff','drop']]) {
    assert.deepEqual(roundTrip(entry('clear_stat',{type}),b=>assert.equal(b.getFieldValue('STAT_TYPE'),field)).params,{type});
  }
  const changed=roundTrip(entry('clear_stat',{type:'buff'}),b=>b.setFieldValue('drop','STAT_TYPE'));
  assert.equal(normalizeBlockAtom('clear_stat',changed.params).params.type,'debuff');
});
check('多維不同數值不可被單一攻擊預設值冒充；完整資料保留',()=>{
  const original=entry('stat_change',{atk:2,def:-1,speed:3});
  assert.deepEqual(roundTrip(original,b=>assert.equal(b.type,'native_effect_reference')),original);
});
check('PP增加/補滿/歸零各有明確欄位；互換不殘留舊op',()=>{
  for(const [op,mode] of [['add','recover'],['recover','full'],['zero','zero']]) {
    assert.deepEqual(roundTrip(entry('pp_op',{target:'self',op,amount:7}),b=>assert.equal(b.getFieldValue('MODE'),mode)).params,{target:'self',op,amount:7});
  }
  const changed=roundTrip(entry('pp_op',{op:'add',amount:7}),b=>b.setFieldValue('full','MODE'));
  assert.equal(normalizeBlockAtom('pp_op',changed.params).params.op,'recover');
  assert.equal(normalizeBlockAtom('pp_op',{mode:'zero'}).params.op,'zero');
});
check('百分比只改目標不丟比例；改數字/類型才清除舊別名',()=>{
  const original=entry('extra_damage',{target:'opponent',dmgType:'percent',ratio:0.125});
  const target=roundTrip(original,b=>{assert.equal(Number(b.getFieldValue('AMOUNT')),12.5);b.setFieldValue('self','TARGET');});
  assert.equal(target.params.ratio,0.125);assert.equal(target.params.target,'self');
  const changed=roundTrip(original,b=>b.setFieldValue(30,'AMOUNT'));
  assert.equal(normalizeBlockAtom('extra_damage',changed.params).params.ratio,0.3);
  const fixed=roundTrip(original,b=>b.setFieldValue('fixed','DAMAGE_TYPE'));
  assert.equal(fixed.params.ratio,undefined);assert.equal(fixed.params.dmgType,undefined);assert.equal(fixed.params.damageType,'fixed');
});
check('條件容器切换條件不殘留相反限制；子積木修改確實存回',()=>{
  const original=entry('condition_gate',{hp_below:0.5,innerItems:[{atom:'heal',params:{amount:20}}]});
  const result=roundTrip(original,b=>{b.setFieldValue('hp_above','COND_TYPE');b.getInputTargetBlock('INNER_STACK')!.setFieldValue(35,'AMOUNT');});
  assert.equal(result.params.hp_below,undefined);assert.equal(result.params.hp_above,0.5);assert.equal(result.params.innerItems[0].params.amount,35);
});
check('查看預設草稿不改原效果；未知分支阻止完整套用',()=>{
  const source={name:'原文',description:'🎯 恢復自身37點體力',effectMode:'registry' as const};const before=JSON.stringify(source);
  const draft=defaultEffectKit(source,'skill');assert.equal(draft.complete,true);assert.equal(draft.kit[0].codeId,'effect_sequence');assert.equal(draft.kit[0].params.clause.body[0].acts[0].p.amount,37);assert.equal(JSON.stringify(source),before);
  const unknown=defaultEffectKit({...source,description:'恢復自身37點體力\n空夢令宇宙折疊'},'skill');assert.equal(unknown.complete,false);assert.ok(unknown.issues.length);
  assert.equal(defaultEffectKit({...source,effectMode:'kit',kit:[]},'skill').kit.length,0,'明確空手動積木不可偷偷改回文字執行');
});
check('條件12.5%不四捨五入；否定條件與超出畫布期限保持原機制',()=>{
  const fractional=entry('condition_gate',{hp_below:0.125,innerItems:[{atom:'heal',params:{amount:20}}]});
  const output=roundTrip(fractional,b=>{assert.equal(Number(b.getFieldValue('COND_VAL')),12.5);b.getInputTargetBlock('INNER_STACK')!.setFieldValue(35,'AMOUNT');});
  assert.equal(output.params.hp_below,0.125);assert.equal(output.params.innerItems[0].params.amount,35);
  for(const original of [entry('condition_gate',{has_shield:false,innerItems:[{atom:'heal',params:{amount:20}}]}),entry('turn_effect_apply',{duration:20,applyMode:'gate',wrapItems:[{atom:'damage_reduce',params:{percent:50,damageTypes:['non_true']}}]})]) {
    assert.deepEqual(roundTrip(original,b=>assert.equal(b.type,'native_effect_reference')),original);
  }
});
check('清回合/固定護盾/增加PP/補滿PP一律煉成連鎖，不把99點當全部',()=>{
  for(const [text,op,p] of [
    ['🎯 消除對手回合類效果','clear_turn',{side:'opp'}],
    ['🎯 獲得400點護盾','shield',{flat:400}],
    ['🎯 恢復自身所有技能7點PP值','pp_op',{side:'self',mode:'add',amount:7}],
    ['🎯 恢復自身所有PP值','pp_op',{side:'self',mode:'recover'}],
  ] as const) {const result=distillEffect({name:'測試',description:text},'skill');assert.equal(result.complete,true,text);assert.equal(result.kit.length,1,text);
    assert.equal(result.kit[0].codeId,'effect_sequence',text);const a=result.kit[0].params.clause.body[0].acts[0];assert.equal(a.op,op,text);assert.deepEqual(a.p,p,text);}
  const ninetyNine=distillEffect({name:'99點',description:'恢復自身所有技能99點PP值'},'skill');
  const a=ninetyNine.kit[0].params.clause.body[0].acts[0];
  assert.deepEqual(a.p,{side:'self',mode:'add',amount:99});assert.ok(!a.label.includes('全部'),a.label);
});
const before=JSON.stringify(DEFAULT_ELVES);
const start=performance.now();const presets=collectEffectPresets(DEFAULT_ELVES);const elapsed=performance.now()-start;
const asyncPresets=await collectEffectPresetsAsync(DEFAULT_ELVES);
check('分批索引與完整索引逐項一致，不漏技能池／多項專屬特質',()=>assert.deepEqual(asyncPresets,presets));
check('全部定義可追蹤，套用只含效果且深複製；不依名稱借用舊handler',()=>{
  assert.equal(JSON.stringify(DEFAULT_ELVES),before);assert.ok(presets.length>=369);
  for(const preset of presets.filter(p=>p.complete)) {const copy=instantiateEffectPreset(preset,preset.kind);assert.deepEqual(copy.kit,preset.kit);assert.notEqual(copy.kit,preset.kit);assert.equal(copy.effectMode,'kit');assert.deepEqual(Object.keys(copy).sort(),['description','effectMode','kit']);}
  const blocked=presets.find(p=>!p.complete)!;assert.throws(()=>instantiateEffectPreset(blocked,blocked.kind));
  const skill=presets.find(p=>p.kind==='skill'&&p.complete)!;assert.throws(()=>instantiateEffectPreset(skill,'soul'));
  const copy=instantiateEffectPreset(skill,'skill');copy.kit![0].params.testOnly=99;assert.equal(skill.kit[0].params.testOnly,undefined);
});
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try {
  const {runConnectedKit}=await server.ssrLoadModule('/src/effects/connectedEffects.ts');
  const shadow=presets.find(p=>p.elfId==='5005'&&p.definition.name==='雙重暗影')!;
  const copied={name:'自訂新技能',...instantiateEffectPreset(shadow,'skill')};
  for(const actor of ['p1','p2']) for(const sealed of [false,true]) check(`複製內建雙重暗影到自訂技能：${actor}/${sealed?'附加失效':'正常'}僅一次降防與害怕`,()=>{
    const targetSide=actor==='p1'?'p2':'p1';const self:any={isAdditionalInvalid:sealed};const target:any={statStages:{def:2}};const calls:any[]=[];
    const ctx:any={actor,targetSide,self,target,activeP1:actor==='p1'?self:target,activeP2:actor==='p2'?self:target,
      getPlayerState:()=>0,addLog:()=>{},applyStatChange:(side:string,changes:any)=>{calls.push(['stat',side,changes]);},
      applyStatusWithImmunityCheck:(side:string,status:string,turns:number)=>{calls.push(['status',side,status,turns]);return {success:true};}};
    runConnectedKit('on_hit',copied,ctx);assert.equal(calls.length,0);
    runConnectedKit('on_skill_use',copied,ctx);
    assert.deepEqual(calls,sealed?[]:[['stat',targetSide,{def:-1}],['status',targetSide,'害怕',3]]);
  });
  for(const actor of ['p1','p2']) check(`PP補滿走目前精靈上限：${actor}不依缺失maxPp`,()=>{
    const elf:any={id:'custom',skills:[{name:'測試',pp:1,maxPp:20},{name:'第五',pp:0,maxPp:0}],maxHp:1000};
    const ctx:any={actor,self:elf,activeP1:elf,activeP2:elf,addLog:()=>{},updateElf:(side:string,p:any)=>{assert.equal(side,actor);Object.assign(elf,p);}};
    runConnectedKit('on_skill_use',{name:'補PP',kit:[entry('pp_op',{target:'self',op:'recover'})]},ctx);
    assert.equal(elf.skills[0].pp,20);assert.equal(elf.skills[1].pp,0);
  });
} finally {await server.close();}
console.log(`預設積木／複製／公開畫布存檔／正式執行入口 ${count} 項通過。索引 ${presets.length} 筆，可套用 ${presets.filter(p=>p.complete).length}，本機建索引 ${elapsed.toFixed(1)}ms（非低階手機量測）。`);
