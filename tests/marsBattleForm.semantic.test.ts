import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try {
 const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const {battleFormAsset,battleFormAssets,settledFormAsset}=await h.server.ssrLoadModule('/src/battle/battleFormPresentation.ts');
 const original=DEFAULT_ELVES.find((e:any)=>e.id==='5016');
 assert.deepEqual(battleFormAssets(original),['marthus','marthusDestroy']);
 assert.deepEqual(battleFormAssets({...original,path:'/my-drawing.png'}),[]);
 const unchanged=JSON.stringify(original);
 assert.equal(battleFormAsset(original,{mechCombo:'極速'}),'marthus');
 assert.equal(battleFormAsset(original,{mechCombo:'毀滅'}),'marthusDestroy');
 assert.equal(battleFormAsset({...original,path:'/my-drawing.png'},{mechCombo:'毀滅'}),null,'自繪外觀不能偷套機甲');
 assert.equal(battleFormAsset({...original,skinId:'unregistered'},{mechCombo:'毀滅'}),null);
 assert.equal(settledFormAsset('marthus','marthusDestroy','cp'),'marthus','第五收招前保留舊播放器');
 assert.equal(settledFormAsset('marthus','marthusDestroy','standby'),'marthusDestroy');
 assert.equal(JSON.stringify(original),unchanged,'外觀選擇不能改寫資料');
 for(const side of ['p1','p2'] as const){
  // 保留正式魂印；隔離第五的其他技能效果，以驗證真正的積木觸發點。
  const self=h.unit('5016',100000,[{...h.wait(),name:'第五測試',isFifthSkill:true,charge:99},{...h.wait(),charge:99}],{speed:300,extra:{name:original.name,soulMark:structuredClone(original.soulMark)}});
  const opp=h.unit('target',1000000,[h.healSkill(1000000)]);
  const rounds=await h.play(side,{self,opp,turns:(_e:any,t:number)=>[t===1||t===4?1:0,0]},4);
  assert.deepEqual(rounds.map(r=>r.state[`${side}RegistryState`].mechCombo),['極速','毀滅','極速','極速'],`${side} 普通→第五→第五→普通`);
  assert.deepEqual(rounds.map(r=>battleFormAsset(original,r.state[`${side}RegistryState`])),['marthus','marthusDestroy','marthus','marthus']);
 }
 console.log('馬爾修斯 P1/P2 第五雙向切換、普通技不切換、外觀隔離通過');
} finally {await h.close();}
