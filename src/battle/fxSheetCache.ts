/** Share decoded effects between both sides; release when the last actor leaves. */
export function createFxSheetCache<T>(load:(url:string)=>Promise<T>){
 const entries=new Map<string,{users:number;promise:Promise<T>}>();
 return {acquire(url:string){
  let entry=entries.get(url);
  if(!entry){entry={users:0,promise:Promise.resolve().then(()=>load(url))};entries.set(url,entry);}
  entry.users++;
  let released=false;
  return {ready:entry.promise,release(){
   if(released)return;released=true;
   if(--entry.users===0&&entries.get(url)===entry)entries.delete(url);
  }};
 }};
}
