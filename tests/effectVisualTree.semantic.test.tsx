import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { auditEffectVisualization } from '../scripts/lib/effectVisualizationAudit';
import { DEFAULT_ELVES } from '../src/data/defaultElvesLoaded';
import { EffectParameterTree } from '../src/components/EffectParameterTree';
import { effectValueLeaves, replaceEffectValue, type EffectValuePath } from '../src/effects/effectVisualTree';
import { validateKit } from '../src/effects/kitValidation';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock, createKitBlockParser, defineCustomBlocks } from '../src/components/BlocklyBuilder';
import { parseElfBlueprint } from '../src/utils/elfBlueprint';

const report = auditEffectVisualization(DEFAULT_ELVES);
assert.equal(report.summary.definitions,397);
assert.equal(report.summary.allFieldsVisible,true);
assert.equal(report.summary.incompleteDefinitions,0);
assert.ok(report.summary.parameterFields>30000);
assert.equal(report.summary.semanticAccuracy,null);
const unusual = { bodyHigh:[{acts:[{op:'unknown_display_only',p:{amount:0,onExpire:[{cond:[{c:'nested',p:{neg:false}}],elseActs:[{op:'x',p:{ratio:0.25},label:'<script>不執行</script>'}]}]},label:'特殊分支'}]}],empty:[],none:null };
const markup = renderToStaticMarkup(<EffectParameterTree value={unusual}/>);
assert.equal((markup.match(/data-effect-value=/g)||[]).length,effectValueLeaves(unusual).length);
assert.ok(markup.includes('否則執行')&&markup.includes('自然到期時')&&markup.includes('達到門檻時'));
assert.ok(!markup.includes('<script>'));
const prototypeNames=renderToStaticMarkup(<EffectParameterTree value={JSON.parse('{"constructor":"__proto__","prototype":"constructor"}')}/>);
assert.ok(prototypeNames.includes('__proto__')&&prototypeNames.includes('constructor'));
assert.throws(()=>replaceEffectValue({},['__proto__','polluted'],true),/無效/);
assert.throws(()=>replaceEffectValue({p:{}},['p','newField'],1),/無效/);

const source = DEFAULT_ELVES.find(elf=>String(elf.seerId)==='5014'||String(elf.id)==='5014')!;
assert.ok(source?.soulMark?.kit?.length);
const original = structuredClone(source.soulMark.kit!);
const snapshot = JSON.stringify(original);
const path = effectValueLeaves(original).find(leaf=>leaf.path.includes('bodyHigh')&&leaf.path.at(-1)==='ratio')!.path;
assert.ok(path.length>20,'覆蓋舊預覽未展開的深層恢復分支');
let draft = original;
const dom = new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const {createRoot}=await import('react-dom/client');
const root=createRoot(document.getElementById('root')!);
const draw=async(disabled=false)=>act(async()=>root.render(<EffectParameterTree value={draft} disabled={disabled} onChange={(key,value)=>{draft=replaceEffectValue(draft,key,value);}}/>));
const inputFor=(key:EffectValuePath)=>[...document.querySelectorAll<HTMLInputElement>('input')].find(input=>input.getAttribute('aria-label')?.endsWith(JSON.stringify(key)))!;
const edit=async(key:EffectValuePath,value:string)=>{
  const input=inputFor(key);assert.ok(input);
  await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  await draw();
};
try {
  await draw();
  await edit(path,'0');
  assert.equal(effectValueLeaves(draft).find(leaf=>JSON.stringify(leaf.path)===JSON.stringify(path))!.value,0);
  await edit(path,'0.25');validateKit(draft);
  assert.equal(JSON.stringify(original),snapshot,'編輯草稿不改寫正式精靈');
  await draw(true);assert.equal(inputFor(path).disabled,true);
  defineCustomBlocks();
  const ws=new Blockly.Workspace(),restored=new Blockly.Workspace();
  try {
    const index=path[0] as number,entry=draft[index];
    const block=buildEntryBlock(ws as any,entry)!;
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),restored);
    const output=createKitBlockParser(entry.source)(restored.getBlockById(block.id)!,entry.node,entry.order)!;
    assert.deepEqual(output.params,entry.params,'樹狀修改經真正 Blockly 公開存檔重載仍保留');
  } finally {ws.dispose();restored.dispose();}
  const copy=structuredClone(source);copy.soulMark!.kit=draft;
  const imported=parseElfBlueprint(JSON.stringify({schemaVersion:2,manualElf:copy})).elf;
  assert.deepEqual(imported.soulMark!.kit,draft,'完整圖紙重載保留深層修改');
  const invalid=replaceEffectValue(draft,path,-1);
  assert.throws(()=>validateKit(invalid),'可視化不放寬正式執行合約');
} finally {await act(async()=>root.unmount());dom.window.close();}
console.log(`可視化掃描：${report.summary.definitions}份定義／${report.summary.parameterFields}欄位完整呈現；深層DOM改值、0、停用、Blockly與圖紙重載、非法參數拒絕通過。不是戰鬥正確率。`);
