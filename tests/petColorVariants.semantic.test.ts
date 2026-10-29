import assert from 'node:assert/strict';
import {unifyPetColors,DEFAULT_VARIANT,PET_COLOR_VARIANTS,petColorVariant,dominantTint,COMBAT_TINT_VARIANT} from '../src/battle/petColorVariants';

/** 造一個帶逐幀調色的假序列：前 n 格用 a 色，其餘用 b 色。 */
const seq=(name,count,a,b)=>{
 const frames=[];
 for(let i=0;i<count;i++){const c=i<count/2?a:b;
  frames.push({mesh:{mulColors:new Float32Array([c,c,c,1,c,c,c,1]),addColors:new Float32Array([0,c/10,c/10,0])}});}
 return {name,frames};
};
const colorsOf=s=>[...new Set(s.frames.map(f=>[...f.mesh.mulColors].map(v=>v.toFixed(3)).join(',')))];

// 1. 預設：整份動畫只剩一種顏色，而且就是待機（材質原色）那一種。
{
 const standby=seq('standby',4,1,1), attack=seq('attack',8,0.80,0.52), sa=seq('sa',8,0.80,0.52);
 const report=unifyPetColors([standby,attack,sa]);
 for(const s of [standby,attack,sa])assert.equal(colorsOf(s).length,1,`${s.name} 只能有一種顏色`);
 assert.deepEqual(colorsOf(standby),colorsOf(attack),'出招不得換色');
 assert.deepEqual(colorsOf(standby),colorsOf(sa));
 assert.equal(report.attack.mul[0],1,'預設取待機原色');
}

// 2. 具名變體 raw：整隻強制原始材質色（不受原廠逐幀調色影響）。
{
 const attack=seq('attack',8,0.80,0.52);
 unifyPetColors([attack],PET_COLOR_VARIANTS.raw);
 assert.deepEqual(colorsOf(attack),['1.000,1.000,1.000,1.000,1.000,1.000,1.000,1.000']);
}

// 3. 具名變體查表：未登記 → 預設；有登記 → 該變體。將來的形態只需加一列。
{
 assert.equal(petColorVariant('不存在的精靈').id,DEFAULT_VARIANT.id);
 assert.equal(petColorVariant('恐懼的化身·咤克斯').id,'official');
 PET_COLOR_VARIANTS['憤怒的化身·咤克斯']={id:'wrath',label:'憤怒',mul:[1,0.4,0.3,1],add:[0,0,0,0]};
 assert.equal(petColorVariant('憤怒的化身·咤克斯').id,'wrath');
 delete PET_COLOR_VARIANTS['憤怒的化身·咤克斯'];
}

// 4. 代表色＝出現次數最多的那一組；原廠出招配色變體仍可逐段保留。
{
 const attack=seq('attack',10,0.80,0.52);
 const t=dominantTint(attack.frames);
 assert.ok(Math.abs(t.mul[0]-0.8)<1e-6,'取多數那組');
 unifyPetColors([attack],COMBAT_TINT_VARIANT);
 assert.equal(colorsOf(attack).length,1,'原廠配色變體同樣只留一種');
}

// 5. 空序列不炸。
assert.equal(dominantTint([]),null);
assert.deepEqual(unifyPetColors([]),{});

console.log('單一顏色變體、待機原色統一、具名變體與空輸入通過');
