// 診斷工具：讀取正式資料與 headless 引擎；不改寫精靈或打包資料。
import { createHarness } from '../tests/helpers/migrationHarness';
import { writeFileSync } from 'node:fs';
const h = await createHarness();
const rows: any[] = [];
const check = (side: string, name: string, expected: unknown, observed: unknown) => rows.push({side, name, expected, observed, matches: JSON.stringify(expected) === JSON.stringify(observed)});
try {
  const {DEFAULT_ELVES} = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const elf = DEFAULT_ELVES.find((e: any) => e.id === '5036');
  const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
  check('data', '主技能數／技能池數', [5,9], [elf.skills.length, elf.skillPool.length]);
  check('data', '戰鬥顯示順序', ['清璨星辰落','生塵眷盼','如日方升','遂心快意','蒼靈銜樂'], [elf.skills[4], ...elf.skills.slice(0,4)].map((s: any)=>s.name));
  for (const side of ['p1','p2'] as const) {
    // 分離公式傷害，只量正式附加傷害；連續三次應為 25%、35%、45%。
    const fifth = structuredClone(h.find('5036','清璨星辰落'));
    fifth.category = '屬性'; fifth.power = 0; fifth.kit = fifth.kit.filter((e: any)=>e.order===4);
    const damage = await h.play(side,{self:h.unit('S',10000,[fifth],{speed:200}),opp:h.unit('E',100000,[h.wait()])},3);
    check(side,'第五附加傷害成長', [2550,3570,4590], damage.map((r,i)=> (i?damage[i-1].opp.currentHp:100000)-r.opp.currentHp));
    const speed = structuredClone(h.find('5036','生塵眷盼'));
    speed.category='屬性'; speed.power=0; speed.kit=speed.kit.filter((e:any)=>e.order===1||e.order===2);
    const [cleared] = await h.play(side,{self:h.unit('S',10000,[speed],{speed:200}),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:1}})});
    const timers=cleared.state[`${side==='p1'?'p2':'p1'}Timers`]||[];
    check(side,'原本有強化且消除成功，不應同時禁療',false,timers.some((t:any)=>t.name.includes('恢復效果-100%')));
    const defend=structuredClone(h.find('5036','如日方升'));
    defend.kit=defend.kit.filter((e:any)=>e.order===2);
    h.S.E=(ctx:any,event:any)=>{if(event===T.ON_ENTRANCE)ctx.setPlayerState('immuneStatusTurns',99);};
    const heals=await h.play(side,{self:h.unit('S',5000,[defend,h.wait()],{maxHp:10000,speed:200}),opp:h.unit('E',10000,[{...h.wait(),category:'物理',power:0},h.wait()]),turns:(_e,t)=>[t===1?0:1,t===1?0:1]},2);
    delete h.S.E;
    check(side,'疲憊附加失敗補償恢復量／百分比傷害量',[3333,3333],[heals[1].self.currentHp-heals[0].self.currentHp,heals[0].opp.currentHp-heals[1].opp.currentHp]);
    const combo=structuredClone(h.find('5036','永世相約'));combo.pp=1;combo.maxPp=9;combo.isSureHit=true;
    const [hits]=await h.play(side,{self:h.unit('S',10000,[combo],{speed:200}),opp:h.unit('E',100000,[h.wait()])});
    check(side,'連擊不可依PP降為2次',false,hits.logs.some((s:string)=>s.includes('連擊 2 次')));
    const kill=structuredClone(h.find('5036','蒼靈銜樂'));
    kill.category='屬性';kill.power=0;kill.isSureHit=true;kill.kit=kill.kit.filter((e:any)=>e.customText.includes('附加自身最大體力30%'));
    const [low]=await h.play(side,{self:h.unit('S',3000,[kill],{maxHp:10000,speed:200}),opp:h.unit('E',100000,[h.wait()])});
    check(side,'低體力百分比傷害與恢復只翻倍一次',[6000,6000],[100000-low.opp.currentHp,low.self.currentHp-3000]);
    const [soul] = await h.play(side,{self:h.unit('5036',10000,[h.wait()],{speed:200,extra:{name:'九青',soulMark:structuredClone(elf.soulMark)}}),opp:h.unit('E',10000,[h.wait()])});
    check(side,'雙方已出手不應獲得均未出手的三項強化',{},soul.self.statStages);
    check(side,'自身先出手獲得降能力免疫',true,(soul.state[`${side}RegistryState`]?.immuneStatDownTurns||0)>0);
    check(side,'召喚固定能力額外精靈', ['旭','清'],soul.state[`${side}Team`].filter((e:any)=>e.isExtra).map((e:any)=>e.name));
    const attack={...h.wait(),name:'測試普通攻擊',category:'物理',power:10};
    const ownBuff=await h.play(side,{self:h.unit('5036',100000,[h.turnEffectSkill(),attack],{speed:200,extra:{name:'九青',soulMark:structuredClone(elf.soulMark)}}),opp:h.unit('E',100000,[h.wait()]),turns:(_e,t)=>[t===1?0:1,0]},2);
    const ownIds=ownBuff[0].state[`${side}Timers`].filter((t:any)=>t.kind==='turn_effect').map((t:any)=>t.id);
    check(side,'清存活時自身攻擊不應消除自身回合效果',true,ownIds.length>0 && ownIds.every((id:string)=>ownBuff[1].state[`${side}Timers`].some((t:any)=>t.id===id)));
    const other=side==='p1'?'p2':'p1';
    const oppBuff=await h.play(side,{self:h.unit('5036',100000,[h.wait()],{speed:200,extra:{name:'九青',soulMark:structuredClone(elf.soulMark)}}),opp:h.unit('E',100000,[h.turnEffectSkill(),attack]),turns:(_e,t)=>[0,t===1?0:1]},2);
    const oppIds=oppBuff[0].state[`${other}Timers`].filter((t:any)=>t.kind==='turn_effect').map((t:any)=>t.id);
    check(side,'清存活時對手攻擊應消除對手回合效果',true,oppIds.length>0 && oppIds.every((id:string)=>!oppBuff[1].state[`${other}Timers`].some((t:any)=>t.id===id)));
    const survive=h.kitSkill('測試致死存活',[{op:'survive_turns',p:{turns:2}}]);
    const lethal=h.kitSkill('測試致死傷害',[{op:'dmg',p:{flat:200000,type:'真實'}}]);
    const alive=await h.play(side,{self:h.unit('5036',100000,[survive,h.wait()],{speed:200,extra:{name:'九青',soulMark:structuredClone(elf.soulMark)}}),opp:h.unit('E',100000,[h.wait(),lethal]),turns:(_e,t)=>[t===1?0:1,t===1?0:1]},2);
    check(side,'九青抵擋致死仍存活時，額外精靈不得連動死亡',[true,2],[alive[1].self.currentHp>0,alive[1].state[`${side}Team`].filter((e:any)=>e.isExtra&&e.currentHp>0).length]);
  }
  const json=JSON.stringify(rows,null,2)+'\n';
  const outIndex=process.argv.indexOf('--out');
  if(outIndex>=0 && process.argv[outIndex+1])writeFileSync(process.argv[outIndex+1],json,'utf8');
  console.log(json);
} finally { await h.close(); }
// 預設只列觀察結果；CI 或修復驗收加 --check，有不符項目即回傳失敗。
process.exit(process.argv.includes('--check')&&rows.some(r=>!r.matches)?1:0);
