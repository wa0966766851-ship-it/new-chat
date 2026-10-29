import { descriptionStructure } from './src/utils/descriptionStructure.ts';
import { CORRUPTED_REY_SOUL_TEXT } from './src/data/corruptedReyDescriptions.ts';
const src = CORRUPTED_REY_SOUL_TEXT['7070'];
const tree = descriptionStructure(src);
console.log('nodes 數量:', tree.nodes.length);
function dump(nodes:any[], d=0){
  for(const n of nodes){
    console.log('  '.repeat(d)+`[${n.kind}] ${(n.text||'').slice(0,60)}`);
    if(n.children?.length) dump(n.children, d+1);
  }
}
dump(tree.nodes);
