import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEFAULT_ELVES,loadImportedElves} from '../src/data/defaultElves';
import {skillDescriptionText,hasInnateSureHit} from '../src/utils/skillDescription';
import {EffectDescription} from '../src/components/EffectDescription';
import {descriptionStructure} from '../src/utils/descriptionStructure';
import {projectIllusionSkill} from '../src/battle/illusionSkillProjection';
import {skillBannerBottom,skillBannerType} from '../src/battle/skillBanner';
const base:any={name:'測試',type:'火',category:'物理',power:100,pp:5,description:'',effectType:'none',effectDetail:''};
const entry=(text:string,role:string)=>({codeId:'effect_sequence',role,customText:text,params:{}});
const skill={...base,isSureHit:true,accuracy:95,description:'必中\n無視傷害限制\n攜帶時生效\n使用技能時：\n> 消除回合效果\n>> 消除成功後恢復體力',kit:[entry('無視傷害限制','innate'),entry('攜帶時生效','carried')]};
const before=structuredClone(skill),text=skillDescriptionText(skill);
assert.match(text,/■ 無視傷害限制/);assert.match(text,/◇ 攜帶時生效/);assert.match(text,/🎯 使用技能時/);
assert.deepEqual(skill,before);
const tree=descriptionStructure(text);assert.equal(tree.nodes[3].children[0].children[0].text,'消除成功後恢復體力');
const html=renderToStaticMarkup(<EffectDescription skill={skill}/>);
for(const role of ['固有','攜帶','附加'])assert.ok(html.includes(`data-effect-role="${role}"`));
assert.equal((text.match(/■ 必中/g)||[]).length,1);
assert.equal(skillDescriptionText({...base,description:'必中（95%）'}),'■ 必中\n■ 命中率95%');
assert.equal(hasInnateSureHit({...base,description:'命中率100%'}),false);
assert.equal(hasInnateSureHit({...base,description:'對手能力下降時必中'}),false);
assert.equal(skillDescriptionText({...base,description:'對手能力下降時必中'}),'🎯 對手能力下降時必中');
assert.match(renderToStaticMarkup(<EffectDescription skill={{...base,description:'**恢復**自身體力'}}/>),/<strong[^>]*>恢復<\/strong>/);
const successTree=descriptionStructure(skillDescriptionText({...base,description:'消除對手回合效果，消除成功則恢復體力'}));
assert.equal(successTree.nodes[0].children[0].text,'消除成功則恢復體力');
assert.equal(skillDescriptionText({...base,description:'必中\n■ 必中\n🎯 恢復體力'}),'■ 必中\n🎯 恢復體力');
const target={...base,name:'轉化',description:'■ 必中\n🎯 攻擊後恢復',isSureHit:true};
const projected=projectIllusionSkill({...base,description:'■ 必中\n🎯 原附加',isSureHit:true},target,0);
assert.equal(projected.description,target.description);assert.equal(projected.isSureHit,true);
assert.equal((skillDescriptionText(projected).match(/■ 必中/g)||[]).length,1);
const conditional=projectIllusionSkill({...base,description:'■ 必中',isSureHit:true},{...base,description:'對手中毒時必中'},0);
assert.ok(conditional.description.startsWith('■ 必中\n'));assert.match(conditional.description,/對手中毒時必中/);
assert.ok(skillBannerBottom(400,500)>=200);assert.equal(skillBannerBottom(9000,300),190);
for(const category of ['物理','特殊','屬性'] as const){
 const expected=category==='屬性'?'無屬性':'水';
 assert.equal(skillBannerType('轉化',{skillName:'轉化',skillType:expected},null,[{...base,name:'轉化',type:'火'}],false),expected);
 assert.equal(skillBannerType('轉化',null,null,[{...base,name:'轉化',type:'水',category}],false),expected);
 assert.equal(skillBannerType('轉化',{skillName:'轉化',skillType:expected},null,[],true),undefined);
}
await loadImportedElves();let skills=0,unmarked=0,carried=0;
for(const elf of DEFAULT_ELVES)for(const skill of [...elf.skills,...(elf.skillPool||[])]){
 const copy=structuredClone(skill);const output=skillDescriptionText(skill);
 assert.deepEqual(skill,copy,'全名單投影不得改原文或積木');
 for(const line of output.split('\n'))if(line.trim()&&!/^\s*(?:[■◆◇🎯>＞#]|【|---)/u.test(line)){unmarked++;throw Error(`${elf.name}/${skill.name}: ${line}`);}
 if(output.includes('◇'))carried++;skills++;
}
console.log(`✓ ${DEFAULT_ELVES.length}隻／${skills}份技能描述標記，未標記${unmarked}，攜帶${carried}；階層、必中／命中率、幻化去重、動畫屬性與位置通過`);
