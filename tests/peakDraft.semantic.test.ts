import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createHarness} from './helpers/migrationHarness';
const dom=new JSDOM('',{url:'http://localhost'});Object.assign(globalThis,{window:dom.window,localStorage:dom.window.localStorage});
const h=await createHarness();
try{
 const {peakCandidates,initialPeakSelection,enterPeakPick,togglePeakCard,launchPeakDraft,peakId,readPeakRules}=await h.server.ssrLoadModule('/src/shell/peakDraft.ts');
 const library=Array.from({length:16},(_,i)=>h.unit(`elf${i}`,1000,[h.wait()],{extra:{baseStats:{hp:100+i,atk:100,def:100,spatk:100,spdef:100,speed:100}}}));
 const saved={team:library.slice(0,4),starterId:library[1].battleId};
 for(const side of ['p1','p2'])localStorage.setItem(`seer_last_used_${side}_team`,JSON.stringify(saved));
 const calls:any[]=[];const bridge:any={allElvesCombined:library,battleMode:'PVE',battleFormat:'peak_6v6',handleStartBattle:(...args:any[])=>calls.push(args)};
 const teams=peakCandidates(bridge);assert.equal(teams.p1.length,12);assert.equal(teams.p2.length,12);assert.deepEqual(teams.p1.slice(0,4).map(peakId),library.slice(0,4).map(peakId));
 for(const count of [3,6])for(const ai of [false,true]){
  let draft=initialPeakSelection(teams,3,ai);assert.equal(draft.banned.p1.length,ai?3:0);
  for(const elf of teams.p2.slice(0,3))draft=togglePeakCard(draft,'p2',peakId(elf),3);
  assert.deepEqual(togglePeakCard(draft,'p2',peakId(teams.p2[4]),3).banned.p2,draft.banned.p2,'禁用上限');
  if(!ai)for(const elf of teams.p1.slice(0,3))draft=togglePeakCard(draft,'p1',peakId(elf),3);
  const selected=enterPeakPick(draft,teams,count,ai);for(const side of ['p1','p2']){assert.equal(selected.picked[side].length,count);assert.ok(selected.picked[side].every((id:string)=>!selected.banned[side].includes(id)));}
  assert.deepEqual(togglePeakCard(selected,'p1',selected.banned.p1[0],count),selected,'被禁不能選用');
  bridge.battleMode=ai?'PVE':'PVP';bridge.battleFormat=count===3?'peak_3v3':'peak_6v6';
  const launched=launchPeakDraft(bridge,teams,selected,count);assert.equal(launched.p1.length,count);assert.equal(launched.p2.length,count);const call=calls.at(-1);assert.equal(call[3],selected.starters.p1);assert.equal(call[4],selected.starters.p2);assert.equal(call[11],bridge.battleFormat);
  for(const side of ['p1','p2'])assert.ok(launched[side].every((e:any)=>!selected.banned[side].includes(peakId(e))&&!e.isExtra));
  const fewer=togglePeakCard(selected,'p1',selected.starters.p1,count);assert.notEqual(fewer.starters.p1,selected.starters.p1);assert.throws(()=>launchPeakDraft(bridge,teams,fewer,count));
  assert.deepEqual(JSON.parse(localStorage.getItem('seer_last_used_p1_team')!),saved,'選禁不得覆寫原背包');
 }
 assert.equal(readPeakRules('peak_3v3').pick,3);localStorage.setItem('seer_peak_draft_rules_v1',JSON.stringify({peak_6v6:{ban:0,pick:4}}));assert.deepEqual(readPeakRules('peak_6v6'),{ban:0,pick:4});
 const zero=enterPeakPick(initialPeakSelection(teams,0,true),teams,4,true);assert.equal(zero.picked.p1.length,4);assert.equal(zero.picked.p2.length,4);
 console.log('原生巔峰：候選補齊、原位、PVE/PVP禁選、3/6出戰、首發、非法選擇阻止、原背包保留、零禁用規則與正式開戰傳參通過');
}finally{await h.close();dom.window.close();}
