import { DEFAULT_ELVES } from './src/data/defaultElves.ts';
for(const n of ['魔化.雷伊','墜霆.雷伊']){
  const e:any = DEFAULT_ELVES.find((x:any)=>x.name===n);
  const all = e.soulMark.kit.map((k:any)=>k.customText||'').join('\n');
  console.log('====== '+n+' ======');
  console.log('kit 條數:', e.soulMark.kit.length);
  console.log('含「繳械:弱化類異常」:', all.includes('繳械:弱化類異常'));
  console.log('含「麻痺:控制類異常」:', all.includes('麻痺:控制類異常'));
  console.log('含「先制+1/先制+2...繳械」:', /先制\+[12]且使用技能後100%令對手繳械/.test(all));
  if(n==='墜霆.雷伊') console.log('含「入魔：附屬類異常」:', all.includes('入魔：附屬類異常'));
  // description 也檢查
  console.log('description 含繳械定義:', e.soulMark.description.includes('繳械:弱化類異常'));
  console.log('');
}
