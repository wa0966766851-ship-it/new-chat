import {definitionSignatures} from '../../src/data/builtinEffectBindings';
import {DEFAULT_ELVES} from '../../src/data/defaultElvesLoaded';
/** 目前內建定義的指紋（歷史表要排除它，因為「現行版」不是舊版）。 */
export async function currentSignatures(ids:string[]){
  return Object.fromEntries(DEFAULT_ELVES.filter(e=>ids.includes(String(e.id))).map(e=>[String(e.id),definitionSignatures(e)]));
}
