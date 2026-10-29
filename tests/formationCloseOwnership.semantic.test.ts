import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {ownsActiveFormation,linksFormation} from '../src/effects/formationTimerOwnership';

const timer={id:'editable_formation',remaining:9,ownerBattleId:'S'};
assert.equal(ownsActiveFormation(timer,timer.id,'S'),true);
for(const patch of [{remaining:0},{pendingActivation:true},{ownerBattleId:'other'},{id:'different'}])
  assert.equal(ownsActiveFormation({...timer,...patch},timer.id,'S'),false);
const linked={payload:{linkedSourceTimerId:timer.id,linkedSourceSide:'p1',linkedSourceBattleId:'S'}};
assert.equal(linksFormation(linked,timer.id,'p1','S'),true);
assert.equal(linksFormation(linked,timer.id,'p2','S'),false);
assert.equal(linksFormation(linked,timer.id,'p1','other'),false);

const h=await createHarness();let checks=0;
try {
  for(const side of ['p1','p2'] as const)for(const active of [false,true]) {
    const close=h.kitSkill('改名關閉',[{op:'close_formation',p:{formationId:timer.id,lockTurns:1}}]);
    const trait=active?{name:'改名陣形',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'on_entered',source:'mechanic',order:0,
      params:{clause:{raw:'登場開啟測試陣形',trig:'entrance',parsed:true,body:[{acts:[{op:'open_formation',p:{formationId:timer.id,turns:9},label:'開啟'}]}]}}}]}:undefined;
    const [r]=await h.play(side,{self:h.unit('S',5000,[close,h.wait()],{extra:{trait}}),opp:h.unit('E',5000,[h.wait()])});
    assert.equal(r.self.currentHp,active?1:5000,r.logs.join('\n'));
    assert.equal(r.self.skills[0].pp,active?0:98);
    assert.equal(r.self.skills[1].pp,active?0:99);
    assert.equal(r.state[`${side}Timers`].some((t:any)=>t.id===timer.id&&t.remaining>0),false);
    assert.equal(r.logs.some((s:string)=>s.includes('陣形關閉懲罰')),active);
    checks++;console.log(`✓ ${side} ${active?'有':'無'}有效陣形的關閉代價`);
  }
  console.log(`${checks} real-engine formation close scenarios passed; ownership, pending and linked-source checks passed`);
} finally {await h.close();}
