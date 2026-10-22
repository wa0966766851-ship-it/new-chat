import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try{
  const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {createBattleEngine}=await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const {validateKit}=await server.ssrLoadModule('/src/effects/kitValidation.ts');
  const canonical=DEFAULT_ELVES.find((e:any)=>e.id==='arena_14');
  const wait={name:'等待',category:'屬性',type:'普通',power:0,pp:99,maxPp:99,isSureHit:true,description:''};
  const unit=(id:string)=>({id,battleId:id,name:id,type:'普通',level:100,baseStats:{hp:100,atk:100,spatk:100,def:100,spdef:100,speed:100},calculatedStats:{hp:1000,atk:400,spatk:193,def:300,spdef:301,speed:100},currentHp:1000,maxHp:1000,statStages:{},skills:[structuredClone(wait)]});
  let checks=0;
  for(const side of ['p1','p2'])for(const cfg of [{good:6,bad:0,ratio:.15},{good:4,bad:1,ratio:.15},{good:1,bad:2,ratio:.15},{good:2,bad:0,ratio:.2}]){
    const self={...unit('holder'),id:'arena_14',name:canonical.name,soulMark:structuredClone(canonical.soulMark)};
    const op=self.soulMark.kit[0].params.clause.body[0].acts.find((a:any)=>a.op==='stat_points_add_gap');
    assert.ok(op,'正式封裝必須載入新能力加算積木');op.p.ratio=cfg.ratio;
    self.soulMark=JSON.parse(JSON.stringify(self.soulMark));validateKit(self.soulMark.kit);
    const bench=Array.from({length:cfg.good+cfg.bad},(_,i)=>({...unit('ally'+i),trait:i<cfg.good?undefined:{name:'低機率',description:'30%令對手麻痺'}}));
    const other=unit('enemy'),team=[self,...bench],engine=createBattleEngine({initialP1Team:side==='p1'?team:[other],initialP2Team:side==='p2'?team:[other],p1StarterId:side==='p1'?'holder':'enemy',p2StarterId:side==='p2'?'holder':'enemy',preparedTeams:true,battleMode:'PVP',isFast:()=>true});
    const errors:any[]=[];const error=console.error;console.error=(...a:any[])=>{errors.push(a);error(...a);};
    try{
      engine.mount();engine.start();await engine.idle();
      const gain=Math.floor(207*cfg.ratio*Math.max(0,cfg.good-cfg.bad));
      for(let turn=0;turn<3;turn++){
        const s=engine.getState(),actual=s[side];
        for(const k of ['hp','def','spdef','speed'])assert.equal(actual.calculatedStats[k],self.calculatedStats[k as keyof typeof self.calculatedStats]+gain,`${side}/${k} 真正面板加算，且不能每回合重複`);
        assert.equal(actual.maxHp,1000+gain);assert.equal(actual.currentHp,1000+gain);
        assert.equal(actual.calculatedStats.atk,400);assert.equal(actual.calculatedStats.spatk,193);
        engine.onSkillSelect('p1',s.p1.skills[0]);engine.onSkillSelect('p2',s.p2.skills[0]);await engine.idle();
      }
      assert.equal(errors.length,0);checks++;console.log(`✓ ${side} 淨層數${cfg.good-cfg.bad} 比例${cfg.ratio} 四能力各+${gain}，連續3回合不疊加`);
    }finally{engine.unmount();console.error=error;}
  }
  for(const side of ['p1','p2']){
    const holder={...unit('bench-holder'),id:'arena_14',name:canonical.name,soulMark:structuredClone(canonical.soulMark)};
    const lead=unit('lead'),enemy=unit('enemy'),team=[lead,holder];
    const engine=createBattleEngine({initialP1Team:side==='p1'?team:[enemy],initialP2Team:side==='p2'?team:[enemy],p1StarterId:side==='p1'?'lead':'enemy',p2StarterId:side==='p2'?'lead':'enemy',preparedTeams:true,battleMode:'PVP',isFast:()=>true});
    try{
      engine.mount();engine.start();await engine.idle();
      const state=engine.getState(),saved=state[side+'Team'].find((e:any)=>e.battleId==='bench-holder');
      assert.equal(saved.calculatedStats.def,331,'場下持有者一層英雄之耀，防禦+31');
      assert.equal(saved.maxHp,1031);assert.equal(saved.currentHp,1031);
      assert.equal(state[side].calculatedStats.def,300,'不得加算到在場隊友');
      assert.equal(state[side].maxHp,1000);
      checks++;console.log(`✓ ${side} 場下持有者能力加算，未污染在場隊友`);
    }finally{engine.unmount();}
  }
  // 舊戰局的平衡雙攻刻印：只重現舊配置，不代表倉庫的新刻印或完整裝備。
  for(const side of ['p1','p2']){
    const self={...unit('equipped-holder'),id:'arena_14',name:canonical.name,baseStats:structuredClone(canonical.baseStats),soulMark:structuredClone(canonical.soulMark),
      inscriptions:Array.from({length:3},(_,i)=>({id:`default_max_insc_${i+1}`,name:`刻印${i}`,stats:{hp:150,atk:75,spatk:75,def:60,spdef:60,speed:45}}))};
    const team=[self,...Array.from({length:5},(_,i)=>unit('equipped-ally'+i))],enemy=unit('enemy');
    const engine=createBattleEngine({initialP1Team:side==='p1'?team:[enemy],initialP2Team:side==='p2'?team:[enemy],p1StarterId:side==='p1'?'equipped-holder':'enemy',p2StarterId:side==='p2'?'equipped-holder':'enemy',p1Suit:side==='p1'?'eternal_starlight':undefined,p2Suit:side==='p2'?'eternal_starlight':undefined,battleMode:'PVP',isFast:()=>true});
    try{
      engine.mount();engine.start();await engine.idle();
      const actual=engine.getState()[side];
      assert.deepEqual(actual.calculatedStats,{hp:1229,atk:674,spatk:445,def:654,spdef:654,speed:638});
      assert.equal(actual.maxHp,1229);assert.equal(actual.currentHp,1229);
      checks++;console.log(`✓ ${side} 正式開局配裝：雙攻674/445，5層各+171，體力1229／雙防654／速度638`);
    }finally{engine.unmount();}
  }
  // 現行倉庫：三顆攻+150／特攻+0，星光永恆、漫遊者AH、超能兄弟。
  for(const side of ['p1','p2'])for(const prepared of [false,true]){
    const self={...unit('current-holder'),id:'arena_14',name:canonical.name,baseStats:structuredClone(canonical.baseStats),soulMark:structuredClone(canonical.soulMark),
      inscriptions:Array.from({length:3},(_,i)=>({id:`default_max_insc_${i+1}`,name:`刻印${i}`,stats:{hp:150,atk:150,spatk:0,def:60,spdef:60,speed:45}}))};
    const raw=[self,...Array.from({length:5},(_,i)=>unit('current-ally'+i))],enemy=unit('enemy');
    const {applyEquipmentToTeam}=await server.ssrLoadModule('/src/data/suitsAndEyewears.ts');
    const team=prepared?applyEquipmentToTeam(raw,'eternal_starlight','roamer_ah',undefined,'chaoneng_xiongdi'):raw;
    const engine=createBattleEngine({initialP1Team:side==='p1'?team:[enemy],initialP2Team:side==='p2'?team:[enemy],p1StarterId:side==='p1'?'current-holder':'enemy',p2StarterId:side==='p2'?'current-holder':'enemy',
      p1Suit:side==='p1'?'eternal_starlight':undefined,p2Suit:side==='p2'?'eternal_starlight':undefined,p1Eyewear:side==='p1'?'roamer_ah':undefined,p2Eyewear:side==='p2'?'roamer_ah':undefined,
      p1Title:side==='p1'?'chaoneng_xiongdi':undefined,p2Title:side==='p2'?'chaoneng_xiongdi':undefined,preparedTeams:prepared,battleMode:'PVP',isFast:()=>true});
    try{
      // 明列硬值，不能拿同一計算函式當斷言；prepared 路徑不能重複套裝備。
      assert.deepEqual(engine.getState()[side].calculatedStats,{hp:1225,atk:991,spatk:261,def:483,spdef:483,speed:500});
      engine.mount();engine.start();await engine.idle();
      const actual=engine.getState()[side];
      assert.deepEqual(actual.calculatedStats,{hp:1772,atk:991,spatk:261,def:1030,spdef:1030,speed:1047});
      assert.equal(actual.maxHp,1772);assert.equal(actual.currentHp,1772);
      assert.equal(self.inscriptions[0].stats.atk,150,'保留來源配裝');
      checks++;console.log(`✓ ${side} prepared=${prepared} 完整現行配裝：雙攻991/261、5層+547、體力1772`);
    }finally{engine.unmount();}
  }
  const bad=structuredClone(canonical.soulMark.kit);bad[0].params.clause.body[0].acts.find((a:any)=>a.op==='stat_points_add_gap').p.stats2=['atk','atk'];
  assert.throws(()=>validateKit(bad));console.log(`${checks} P1/P2能力值情境與參數合約通過`);
}finally{await server.close();}
