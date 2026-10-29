import type {PackedJson,PackedValue} from '../../src/data/packedJson';
/** 已有可逆字典格式；數字與字串索引以不同標記保存。 */
export function packJson(source:unknown,keyOrder:'alphabetical'|'long-first'='alphabetical'):PackedJson{
  const strings:string[]=[],indexes=new Map<string,number>();
  const index=(text:string)=>{if(!indexes.has(text)){indexes.set(text,strings.length);strings.push(text);}return indexes.get(text)!;};
  function encode(value:any):PackedValue{
    if(typeof value==='string')return index(value);
    if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('資料數值需有限');return [0,value];}
    if(value===null||typeof value==='boolean')return value;
    if(Array.isArray(value))return [1,...value.map(encode)];
    if(!value||typeof value!=='object')throw new Error('資料必須可完整保存為JSON');
    const keys=Object.keys(value).sort();
    if(keyOrder==='long-first')keys.sort((a,b)=>b.length-a.length);
    return [2,...keys.flatMap(key=>[index(key),encode(value[key])])];
  }
  return {strings,root:encode(source)};
}
