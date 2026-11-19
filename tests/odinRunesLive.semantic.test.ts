import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
let n=0;const ok=(s:string)=>{n++;console.log('✓ '+s);};
const chk=(cond:boolean,msg:string)=>{assert.ok(cond,msg);ok(msg);};
try{
  const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const noRes={damageResist:{crit:0,fixed:0,percent:0},statusResist:{allImmune:false,selectedStatuses:[],slots:[]}};
    const odinWith=(skills:any[]=[h.wait()],hp?:number,speed?:number)=>{const o=structuredClone(DEFAULT_ELVES.find((e:any)=>String(e.id)==='5019'));o.battleId='odin';o.resistances=noRes;o.skills=skills;if(hp)o.currentHp=hp;if(speed){o.calculatedStats.speed=speed;}return o;};
  const opp=(skills:any[],o:any={})=>({...h.unit('E',o.hp??5000,skills,{speed:o.speed??50,maxHp:o.maxHp??5000,extra:o.extra}),resistances:noRes});
  const run=async(side:'p1'|'p2',self:any,o:any,pick:[number,number],turns=1)=>(await h.play(side,{self,opp:o,turns:()=>pick},turns)).at(-1);
  const odinMax=odinWith().maxHp, heal=Math.floor(odinMax/3);
  for(const side of ['p1','p2'] as const){
    let k=0;const W=()=>({...h.wait(),name:'等'+(k++)});const W5=()=>[W(),W(),W(),W(),W()];
    // ᚨ
    const poison=h.kitSkill('毒',[{op:'status',p:{side:'opp',status:'中毒',turns:3,chance:100}}]);
    let a=await run(side,odinWith(W5()),opp([poison,poison,poison,poison,poison]),[0,0]);
    let b=await run(side,odinWith(W5()),opp([poison,poison,poison,poison,poison]),[1,0]);
    chk(!h.statuses(a.self).includes('中毒')&&h.statuses(b.self).includes('中毒'),`${side} ᚨ 選第1招激活後免疫；未激活時照常中毒`);
    // ᛉ
    const up=h.kitSkill('強化',[{op:'stat',p:{side:'self',stats:['攻擊'],v:2}}]);
    a=await run(side,odinWith(W5()),opp([up,up,up,up,up]),[1,1]);
    b=await run(side,odinWith(W5()),opp([up,up,up,up,up]),[0,1]);
    chk((a.opp.statStages.atk||0)===0&&(b.opp.statStages.atk||0)===2,`${side} ᛉ 激活後對手能力提升失效；未激活不影響 (${a.opp.statStages.atk},${b.opp.statStages.atk})`);
    // ᚱᚷ
    const miss=()=>({...h.kitSkill('零命中',[{op:'dmg',p:{flat:37,type:'真實'}}]),accuracy:0,isSureHit:false,category:'物理',power:0});
    a=await run(side,odinWith([W(),W(),miss(),W(),W()]),opp(W5(),{hp:5000}),[2,2]);
    b=await run(side,odinWith([miss(),W(),W(),W(),W()]),opp(W5(),{hp:5000}),[0,2]);
    chk(5000-a.opp.currentHp===37&&5000-b.opp.currentHp===0,`${side} ᚱᚷ 激活後必中；未激活照常落空 (${5000-a.opp.currentHp},${5000-b.opp.currentHp})`);
    // ᛇ
    const pp=(p:number)=>({...W(),name:'同步'+p,pp:p,maxPp:p});
    a=await run(side,odinWith([W(),W(),W(),pp(5),W()]),opp([W(),W(),W(),pp(9),W()]),[3,2]);
    b=await run(side,odinWith([W(),W(),W(),pp(5),W()]),opp([W(),W(),W(),pp(9),W()]),[0,2]);
    chk(a.opp.skills[3].maxPp===5&&5000-a.opp.currentHp===400&&b.opp.skills[3].maxPp===9,`${side} ᛇ 激活同步PP並轉400真傷；未激活不動 (${a.opp.skills[3].maxPp},${5000-a.opp.currentHp})`);
    // ᛖ
    const fast=()=>({...W(),priority:4});
    a=await run(side,odinWith([W(),W(),W(),W(),{...W(),priority:2}],undefined,10),opp([fast(),fast(),fast(),fast(),fast()],{speed:9999}),[4,2]);
    b=await run(side,odinWith([{...W(),priority:2},W(),W(),W(),W()],undefined,10),opp([fast(),fast(),fast(),fast(),fast()],{speed:9999}),[0,2]);
    const first=(r:any)=>r.logs.filter((l:string)=>l.includes('使用了'))[0]||'';
    chk(first(a).includes('奧丁')&&first(b).includes('【E】'),`${side} ᛖ 激活後對手先制壓到+1；未激活對手先手`);
    // ᛈ
    const hit=h.kitSkill('二槽真傷',[{op:'dmg',p:{flat:123,type:'真實'}}]);
    a=await run(side,odinWith(W5(),200),opp([W(),hit,W(),W(),W()]),[1,0]);
    b=await run(side,odinWith(W5(),200),opp([W(),hit,W(),W(),W()]),[1,2]);
    chk(a.self.currentHp===200-123+heal&&b.self.currentHp===200+heal,`${side} ᛈ 對手選第1招改用與奧丁同位序技能 (${a.self.currentHp},${b.self.currentHp})`);
    // ᛁ
    const fx=h.kitSkill('固傷',[{op:'dmg',p:{flat:100,type:'固定'}}]);
    a=await run(side,odinWith(W5(),200),opp([W(),fx,W(),fx,W()]),[0,1]);
    b=await run(side,odinWith(W5(),200),opp([W(),fx,W(),fx,W()]),[0,3]);
    chk(a.self.currentHp===200-50+heal&&b.self.currentHp===200-100+heal,`${side} ᛁ 對手激活後非真傷減半；他槽不減 (${200+heal-a.self.currentHp},${200+heal-b.self.currentHp})`);
    // ᚾ
    a=await run(side,odinWith(W5()),opp(W5()),[0,3]);
    b=await run(side,odinWith(W5()),opp(W5()),[0,2]);
    chk(a.opp.calculatedStats.atk===240&&b.opp.calculatedStats.atk===300,`${side} ᚾ 對手激活後能力-20% (${a.opp.calculatedStats.atk},${b.opp.calculatedStats.atk})`);
    // ᛃ
    a=await run(side,odinWith(W5()),opp(W5()),[0,4]);
    b=await run(side,odinWith(W5()),opp(W5()),[0,2]);
    chk(5000-a.opp.currentHp===2000&&5000-b.opp.currentHp===0,`${side} ᛃ 對手激活後奧丁出招吸取40% (${5000-a.opp.currentHp},${5000-b.opp.currentHp})`);
    // ᚦᚺ
    a=await run(side,odinWith(W5()),opp(W5(),{extra:{shield:300,barrier:200}}),[0,2]);
    b=await run(side,odinWith(W5()),opp(W5(),{extra:{shield:300,barrier:200}}),[0,1]);
    chk(b.opp.currentHp-a.opp.currentHp>0,`${side} ᚦᚺ 對手激活後回合末依護盾護罩受真傷 (${b.opp.currentHp-a.opp.currentHp})`);
  }
  // 激活回饋：日誌與徽章狀態；狂信信仰對象
  for(const side of ['p1','p2'] as const){
    let k=0;const W=()=>({...h.wait(),name:'回饋'+(k++)});
    const hist=await h.play(side,{self:odinWith([W(),W(),W(),W(),W()]),opp:opp([W(),W(),W(),W(),W()]),turns:()=>[0,1]},1);
    const r=hist[0];
    chk(r.logs.some((l:string)=>l.includes('激活 ᚨ'))&&r.logs.some((l:string)=>l.includes('激活 ᛁ')),`${side} 激活時寫入日誌（己方與對方符文）`);
    chk(r.self.skills[0].specialBadge.color==='text-amber-200'&&r.self.skills[1].specialBadge.color==='text-slate-400',`${side} 徽章：激活亮色、未激活灰階`);
    chk(r.self.skills[0].specialBadge.description.startsWith('激活後直到下場前持有者免疫所有異常狀態'),`${side} 符文說明取原文`);
    const real=structuredClone(DEFAULT_ELVES.find((e:any)=>String(e.id)==='5019'));real.battleId='odin';real.resistances=noRes;
    const foe=opp([h.kitSkill('打',[{op:'dmg',p:{flat:10,type:'真實'}}])],{hp:500000,maxHp:500000});
    const fh=await h.play(side,{self:real,opp:foe,selfBench:[h.unit('B',5000,[h.wait()])],turns:(_e:any,t:number)=>[t===1?2:0,0]},4);
    chk(fh[0].opp.faithTarget==='眾神之父·奧丁'&&h.statuses(fh[0].opp).includes('狂信'),`${side} 狂信：信仰對象為奧丁`);
    const acted=(r:any)=>r.logs.filter((l:string)=>l.includes('【E】使用了')).length;
    chk(acted(fh[2])===0,`${side} 狂信期間（3回合）對手無法行動`);
    chk(fh[3].opp.faithTarget===undefined&&!!fh[3].opp.portableBattleMarks?.tiwaz_rune&&acted(fh[3])===1,`${side} 狂信結束的回合結束時消除信仰對象並附加ᛏ，之後可行動`);
  }
  console.log(`奧丁符文實戰 ${n} 項通過`);
}finally{await h.close();}
process.exit(0);
