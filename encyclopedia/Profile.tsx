import {useState} from 'react';
import {readSpotlightTextSize,saveSpotlightTextSize} from '../src/utils/spotlightPreferences';
import type {Elf} from '../src/types';
import {RichDescription} from '../src/components/RichDescription';
import {EffectDescription} from '../src/components/EffectDescription';
import type {AtlasType} from './model';
export default function Profile({elf,elves,types}:{elf:Elf;elves:Elf[];types:AtlasType[]}){
 const [textSize,setTextSize]=useState(readSpotlightTextSize);
 const traits=(!elf.isCustom&&(elf as any).atlasTraits)||[elf.soulMark,elf.trait].filter(Boolean);
 const type=types.find(t=>t.name===elf.type),body=elf.path||(elf.seerId?'/seer/body/'+elf.seerId+'.png':'');
 const skills=[...elf.skills.filter(s=>!s.isFifthSkill),...elf.skills.filter(s=>s.isFifthSkill)];
 return <section className="elf-spotlight" style={{'--spot-text-scale':textSize/100,'--spot-tone':type?.color||'#83a9c4'} as any} aria-label="精靈介紹">
 <header className="spot-top"><div><span className="spot-eyebrow">SEER / FIELD ARCHIVE</span><h1>精靈介紹</h1></div><div className="spot-actions"><label>文字大小 <input aria-label="介紹文字大小" type="range" min="80" max="160" step="10" value={textSize} onChange={e=>setTextSize(saveSpotlightTextSize(Number(e.target.value)))}/><output>{textSize}%</output></label></div></header>
 <main className="spot-grid"><aside className="spot-identity"><span className="spot-index">精靈檔案 / {elf.id}</span><div className="spot-art"><div className="spot-orbit"/>{body?<img className="spot-body" src={body} alt={elf.name} onError={e=>{e.currentTarget.style.visibility='hidden';e.currentTarget.parentElement!.setAttribute('data-image-error','圖片無法載入，請編輯圖片來源');}}/>:<span>尚未加入立繪</span>}</div><div className="spot-name">{type?.icon&&<img src={type.icon} width="26" height="26" alt=""/>}<span>{elf.type}</span><h2>{elf.name}</h2></div><div className="spot-stats"><h3>種族能力 <b>{Object.values(elf.baseStats).reduce((a,b)=>a+b,0)}</b></h3><div>{([['hp','體力'],['atk','攻擊'],['def','防禦'],['spatk','特攻'],['spdef','特防'],['speed','速度']] as const).map(([k,label])=><div key={k}><span>{label}</span><strong>{elf.baseStats[k]}</strong><i style={{width:Math.min(100,elf.baseStats[k]/2)+'%'}}/></div>)}</div></div></aside>
 <section className="spot-panel spot-traits"><header><span>01 / ORIGIN</span><h2>魂印與特性</h2></header><div className="spot-prose">{traits.map((t:any,i:number)=><article key={i}><h3>{t!.name||'專屬特性'}</h3><RichDescription text={t!.description} fallback="尚無描述"/></article>)}</div></section>
 <section className="spot-panel spot-skills"><header><span>02 / ARSENAL</span><h2>技能全覽 <small>{skills.length} 招</small></h2></header><div className="spot-skill-list">{skills.map((s,i)=><article className="spot-skill" key={i}><header><span className="spot-skill-index">{String(i+1).padStart(2,'0')}</span><h3>{s.name}{s.isFifthSkill?' · 第五技能':''}</h3><span className="spot-skill-meta">{s.category==='屬性'?'屬性技能':s.type+' · '+s.category} · 威力{s.power} · PP {s.pp}/{s.maxPp??s.pp} · 命中率{s.accuracy??100}%</span></header><EffectDescription skill={s}/></article>)}</div></section></main></section>;
}
