import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
const {createRoot}=await import('react-dom/client');
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
let root=createRoot(document.getElementById('root')!);let closed=0;
try{
 const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const {ElfSpotlight}=await server.ssrLoadModule('/src/components/ElfSpotlight.tsx');
 const elves=DEFAULT_ELVES.filter((e:any)=>['5021','wiki_4937'].includes(e.id));
 const render=async(data=elves)=>act(async()=>{root.render(<ElfSpotlight elves={data} onClose={()=>closed++}/>);});
 const click=async(text:string)=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes(text)||b.getAttribute('aria-label')===text);assert.ok(b,text);await act(async()=>b!.click());};
 localStorage.setItem('unrelated','preserve');await render();
 assert.equal(document.querySelectorAll('.spot-identity').length,1);
 assert.ok(document.querySelector('.spot-name h2')?.textContent?.includes('次元龍'));
 for(const s of elves.find((e:any)=>e.id==='5021').skills)assert.ok(document.querySelector('.spot-skills')?.textContent?.includes(s.description));
 assert.equal(document.querySelector('output')?.textContent,'100%');
 await click('A＋');assert.equal(document.querySelector('output')?.textContent,'110%');
 assert.equal((document.querySelector('.elf-spotlight') as HTMLElement).style.getPropertyValue('--spot-text-scale'),'1.1');
 for(let n=0;n<8;n++)await click('A＋');assert.equal(document.querySelector('output')?.textContent,'160%');
 assert.equal((document.querySelector('[aria-label="放大介紹文字"]') as HTMLButtonElement).disabled,true);
 assert.equal(localStorage.getItem('seer_spotlight_text_size'),'160');
 await click('重設字級');
 await click('替換展示精靈');assert.equal(document.activeElement,document.querySelector('.spot-picker input'));
 const search=document.querySelector<HTMLInputElement>('.spot-picker input[aria-label="搜尋精靈"]')!;
 const enterQuery=async(value:string)=>act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(search,value);search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
 await enterQuery('skill:'+elves.find((e:any)=>e.id==='wiki_4937').skills[0].name);
 assert.equal(document.querySelectorAll('.spot-choices>button').length,1,'替換選單也能搜尋技能');
 await enterQuery('找不到的名稱');assert.equal(document.querySelectorAll('.spot-choices>button').length,0);
 await click('清除搜尋');assert.equal(document.querySelectorAll('.spot-choices>button').length,elves.length);
 await click('星光·雷納多');assert.equal(document.querySelector('.spot-picker'),null);assert.equal(localStorage.getItem('seer_featured_elf'),'wiki_4937');
 assert.ok(document.querySelector('.spot-name h2')?.textContent?.includes('星光·雷納多'));
 const changed=structuredClone(elves);changed.find((e:any)=>e.id==='wiki_4937').skills[0].description='已同步的新技能全文';await render(changed);assert.ok(document.querySelector('.spot-skills')?.textContent?.includes('已同步的新技能全文'));
 await act(async()=>root.unmount());root=createRoot(document.getElementById('root')!);await render();assert.ok(document.querySelector('.spot-name h2')?.textContent?.includes('星光·雷納多'));
 await click('替換展示精靈');await act(async()=>document.activeElement!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(closed,0);assert.equal(document.querySelector('.spot-picker'),null);
 await act(async()=>document.querySelector('.elf-spotlight')!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(closed,1);
 await render([]);assert.ok(document.body.textContent?.includes('目前沒有精靈資料'));assert.equal(localStorage.getItem('unrelated'),'preserve');
 const {ElfReadOnlyProfile}=await server.ssrLoadModule('/src/components/ElfReadOnlyProfile.tsx');
 const remembered=localStorage.getItem('seer_featured_elf');
 await act(async()=>root.render(<ElfReadOnlyProfile elf={elves.find((e:any)=>e.id==='5021')} onClose={()=>closed++}/>));
 await click('完整介紹');
 assert.equal(document.querySelector('.elf-spotlight')?.getAttribute('aria-label'),'精靈介紹');
 assert.ok(document.querySelector('.spot-name h2')?.textContent?.includes('次元龍'));
 assert.ok(!document.querySelector('.elf-spotlight')?.textContent?.includes('替換展示精靈'));
 assert.ok(document.querySelector('.spot-skill-meta [aria-label^="PP "]'));
 assert.ok(document.querySelector('.spot-skill-meta svg'));
 await act(async()=>document.querySelector('.elf-spotlight')!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 assert.equal(document.querySelector('.elf-spotlight'),null);
 assert.ok(document.querySelector('[data-testid="elf-readonly-profile"]'));
 assert.equal(localStorage.getItem('seer_featured_elf'),remembered);
 assert.equal(closed,1);
 const {DEFAULT_ELVES:allElves}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const jiuqing=structuredClone(allElves.find((e:any)=>e.id==='5036'));
 // 舊儲存資料即使混入備選，也不能把介紹頁擠成九招；原資料與技能池保持完整。
 jiuqing.skills=[...jiuqing.skills,...jiuqing.skillPool.filter((s:any)=>!jiuqing.skills.some((m:any)=>m.name===s.name))];
 await act(async()=>root.render(<ElfSpotlight elves={[jiuqing]} selectedElf={jiuqing} onClose={()=>closed++}/>));
 assert.equal(document.querySelectorAll('.spot-skill').length,5);
 assert.deepEqual([...document.querySelectorAll('.spot-skill h3')].map(e=>e.textContent),['清璨星辰落','生塵眷盼','如日方升','遂心快意','蒼靈銜樂']);
 assert.equal(jiuqing.skillPool.length,9);assert.equal(jiuqing.skills.length,9);
 const classified=structuredClone(jiuqing);
 classified.isAlienElf=true;
 classified.soulMark={...classified.soulMark,name:'本體被動',description:'本體被動原文'};
 classified.trait={name:'可調配置甲',description:'甲的配置效果'};
 classified.alienTraits={
  gen2Trait:{name:'二代測試',description:'二代原文'},
  exclusiveTrait:{name:'專屬測試',description:'專屬原文'},
  alienTrait:{name:'異能測試',description:'異能原文'},
  generalTrait:{name:'可調配置乙',description:'乙的配置效果'}
 };
 const {effectDefinitionEntries}=await server.ssrLoadModule('/src/battle/effectSources.ts');
 const {getElfTraitEntries}=await server.ssrLoadModule('/src/components/ElfTraitCards.tsx');
 assert.deepEqual(effectDefinitionEntries(classified).map((e:any)=>e.kind),['專屬特性','通用特性','二代特質','專屬特質','異能','通用特性']);
 assert.equal(effectDefinitionEntries(classified).filter((e:any)=>e.configurable).length,2,'戰鬥完整效果來源仍包含兩種舊配置欄位');
 assert.equal(getElfTraitEntries(classified).length,6,'配置/戰鬥檢視仍可查通用特性');
 await act(async()=>root.render(<ElfSpotlight elves={[classified]} selectedElf={classified} onClose={()=>closed++}/>));
 assert.equal(document.querySelector('.spot-traits h2')?.textContent,'魂印');
 assert.deepEqual([...document.querySelectorAll('.spot-prose small')].map(e=>e.textContent),['專屬特性','二代特質','專屬特質','異能']);
 assert.ok(document.querySelector('.spot-identity')?.textContent?.includes('異能精靈'),'異能精靈是身分標記');
 for(const text of ['可調配置甲','可調配置乙','通用特性','異能特質','異能特性'])assert.ok(!document.querySelector('.spot-traits')?.textContent?.includes(text),text);
 assert.deepEqual(classified.alienTraits.generalTrait,{name:'可調配置乙',description:'乙的配置效果'},'僅篩選展示，不改動配置');
 console.log('單隻完整展示、替換持久化、資料更新、重開、空清單、焦點與Escape通過');
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
process.exit(0);

