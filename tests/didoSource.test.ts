import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import source from '../src/data/didoSource.json';
import {DIDO_SEED} from '../src/data/dido';
import {skillDescriptionText} from '../src/utils/skillDescription';
const unmark=(s:string)=>s.replace(/^[>■🎯\s]+/gmu,'').replace(/\s/g,'');
assert.equal(unmark(DIDO_SEED.soulMark!.description!),unmark(source.soul));
assert.ok(DIDO_SEED.soulMark!.description!.includes('>> 則次元之琴'));
assert.ok(DIDO_SEED.groupIds?.includes('artisan-elf'));
for(const original of source.skills){
 const skill=DIDO_SEED.skillPool!.find(s=>s.name===original.name)!;
 assert.ok(skill,original.name);
 assert.equal(unmark(skill.description!),unmark(original.text),original.name+' 原句與標點不得改寫');
 for(const c of original.clauses)assert.ok(skill.kit!.some(e=>e.customText?.includes(c)),original.name+' 積木原文不得另行概括');
 assert.equal((skillDescriptionText(skill).match(/■ 必中/g)||[]).length,1,'必中不重複');
}
// Optional local cross-check; the app itself never needs this external folder.
if(process.env.VERIFY_DIDO_SOURCE==='1'){
 const raw=readFileSync(source.sourcePath,'utf8').replace(/\r/g,'');
 assert.ok(raw.includes(source.soul));
 for(const skill of source.skills)assert.ok(raw.includes(skill.text));
}
console.log('Dido source wording, hierarchy, effect labels and artisan tag passed');

