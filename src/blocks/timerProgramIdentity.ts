/** 精確而非機率性雜湊：不同程式不共用計時器；顯示標籤不參與身分。
 * 無程式的舊閘門維持原ID。相同來源的相同程式仍刷新，而非每次施放疊加。
 */
export function timerProgramIdentity(payload:Record<string,any>):string {
  const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'
    ?Object.fromEntries(Object.keys(v).filter(k=>!['label','raw','marker'].includes(k)).sort().map(k=>[k,canonical(v[k])])):v;
  if(Array.isArray(payload.body))return `|program=${JSON.stringify(canonical(payload.body))}`;
  if(payload.kind && ['dmgIn','dmgOut','dmgOutMult','dmgOutReduce'].some(k=>payload[k]!==undefined))return `|gate=${JSON.stringify(canonical(payload))}`;
  return '';
}
