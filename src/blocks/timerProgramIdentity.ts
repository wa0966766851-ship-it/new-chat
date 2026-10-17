/** 精確而非機率性雜湊：不同程式不共用計時器；顯示標籤不參與身分。
 * 無程式的舊閘門維持原ID。相同來源的相同程式仍刷新，而非每次施放疊加。
 */
export function timerProgramIdentity(payload:Record<string,any>):string {
  const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'
    ?Object.fromEntries(Object.keys(v).filter(k=>!['label','raw','marker'].includes(k)).sort().map(k=>[k,canonical(v[k])])):v;
  if(Array.isArray(payload.body)){
    // 同一成功分支可有不同到期行為；一次性／到期程式也是計時器身分的一部分。
    const program=payload.once||payload.expireBody!==undefined
      ?{body:payload.body,...(payload.once?{once:true}:{}),...(payload.expireBody!==undefined?{expireBody:payload.expireBody}:{})}:payload.body;
    return `|program=${JSON.stringify(canonical(program))}`;
  }
  if(payload.kind && ['dmgIn','dmgOut','dmgOutMult','dmgOutReduce'].some(k=>payload[k]!==undefined))return `|gate=${JSON.stringify(canonical(payload))}`;
  return '';
}
