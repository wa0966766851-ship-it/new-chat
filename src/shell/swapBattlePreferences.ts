/** Swap complete records so starter identities remain attached to their roster. */
export function swapBattlePreferences(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>=localStorage){
 const pairs=[['seer_last_used_p1_team','seer_last_used_p2_team'],...['suit','eyewear','title','flame','annual_bonus'].map(slot=>[`seer_p1_${slot}`,`seer_p2_${slot}`])];
 const before=new Map(pairs.flat().map(key=>[key,storage.getItem(key)]));
 const write=(key:string,value:string|null)=>value===null?storage.removeItem(key):storage.setItem(key,value);
 try{for(const [p1,p2] of pairs){write(p1,before.get(p2)!);write(p2,before.get(p1)!);}}
 catch(error){for(const [key,value] of before)try{write(key,value);}catch{}throw error;}
}
