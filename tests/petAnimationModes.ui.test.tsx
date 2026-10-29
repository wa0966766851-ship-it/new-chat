import assert from 'node:assert/strict';
import React,{act,useState} from 'react';
import {JSDOM} from 'jsdom';
import {GlobalAnimationMode,ElfAnimationModePicker} from '../src/components/AnimationModeSettings';
import {DEFAULT_BATTLE_ANIMATION,readAnimationSettings,writeAnimationSettings} from '../src/battle/animationSettings';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!);
const elf:any={id:'7070',name:'魔化.雷伊'};
function View(){const [settings,setSettings]=useState(readAnimationSettings);return <><GlobalAnimationMode settings={settings} onChange={s=>{setSettings(s);writeAnimationSettings(s);}}/><ElfAnimationModePicker elf={elf}/></>;}
try{writeAnimationSettings({...DEFAULT_BATTLE_ANIMATION,damage:false});await act(async()=>root.render(<View/>));
const globalSelect=document.querySelector<HTMLSelectElement>('[aria-label="全域播放模式"]')!;
await act(async()=>{globalSelect.value='actions';globalSelect.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});assert.equal(readAnimationSettings().mode,'actions');assert.equal(readAnimationSettings().damage,false);
const own=document.querySelector<HTMLSelectElement>('[aria-label="這隻精靈的播放模式"]')!;
await act(async()=>{own.value='static';own.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});assert.equal(readAnimationSettings().elfModes?.['7070:魔化.雷伊'],'static');
await act(async()=>root.unmount());const next=createRoot(document.getElementById('root')!);await act(async()=>next.render(<ElfAnimationModePicker elf={elf}/>));assert.equal(document.querySelector<HTMLSelectElement>('select')?.value,'static','重新掛載保存逐隻偏好');
await act(async()=>{const select=document.querySelector<HTMLSelectElement>('select')!;select.value='inherit';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});assert.equal(readAnimationSettings().elfModes?.['7070:魔化.雷伊'],undefined);await act(async()=>next.unmount());
console.log('全域／逐隻模式選單、個別開關保留、保存重載與恢復跟隨全域通過');
}finally{dom.window.close();}
