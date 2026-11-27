import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {defineCustomBlocks,buildEntryBlock,createKitBlockParser} from '../src/components/BlocklyBuilder';
import {DARK_BLAKE_SOUL_KIT} from '../src/data/darkBlakeSoulKit';
import {DARK_BLAKE_SKILLS} from '../src/data/darkBlakeSkills';
import {MIGRATED_FINAL_BELIENTE_SOUL_KIT} from '../src/data/migratedFinalOdinDeluBelienteKits';
defineCustomBlocks();let count=0;
for(const entry of [...DARK_BLAKE_SOUL_KIT,...DARK_BLAKE_SKILLS.flatMap(s=>s.kit||[]),...MIGRATED_FINAL_BELIENTE_SOUL_KIT.kit]){
 const w=new Blockly.Workspace(),r=new Blockly.Workspace();
 try{const b=buildEntryBlock(w as any,entry)!;assert.ok(b,entry.customText);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
  assert.deepEqual(createKitBlockParser(entry.source==='soulmark'?'soulmark':'skill')(r.getTopBlocks(false)[0],entry.node,entry.order),entry,entry.customText);count++;
 }finally{w.dispose();r.dispose();}
}
console.log(`布萊克與星執者 ${count} 條積木保存重載通過`);
