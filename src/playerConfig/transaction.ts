import type {ImportPlan} from './model';
export interface ConfigRollback {createdAt:string;label:string;before:Record<string,string|null>;after:Record<string,string>}
export interface RollbackStore {get():Promise<ConfigRollback|undefined>;put(value:ConfigRollback|undefined):Promise<void>}
const dbName='seer-configuration-restore';
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
 const request=indexedDB.open(dbName,1);request.onupgradeneeded=()=>request.result.createObjectStore('restore');
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('無法建立還原點，未套用配置'));request.onblocked=()=>reject(Error('還原資料庫正被另一視窗使用，請關閉其他視窗後重試'));
});}
export const configRollbackStore:RollbackStore={
 async get(){const db=await database();try{return await new Promise<ConfigRollback|undefined>((resolve,reject)=>{const tx=db.transaction('restore','readonly'),r=tx.objectStore('restore').get('last');tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(Error('無法讀取還原點'));});}finally{db.close();}},
 async put(value){const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('restore','readwrite'),s=tx.objectStore('restore');if(value)s.put(value,'last');else s.delete('last');tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(Error('還原點保存失敗，未套用配置'));});}finally{db.close();}},
};
type ConfigStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
function restore(storage:ConfigStorage,values:Record<string,string|null>){const failed:string[]=[];for(const [key,v] of Object.entries(values))try{v===null?storage.removeItem(key):storage.setItem(key,v);}catch{failed.push(key);}if(failed.length)throw Error('部分資料未能還原，請保留還原點並釋放儲存空間：'+failed.join('、'));}
export async function applyConfiguration(plan:ImportPlan,storage:ConfigStorage,backup:RollbackStore=configRollbackStore){
 for(const [key,value] of Object.entries(plan.before))if(storage.getItem(key)!==value)throw Error('預覽後本機配置已改變，請重新預覽再套用');
 const previous=await backup.get();
 await backup.put({createdAt:new Date().toISOString(),label:plan.label,before:plan.before,after:plan.writes});
 // IndexedDB is asynchronous: recheck after the durable backup finishes too.
 for(const [key,value] of Object.entries(plan.before))if(storage.getItem(key)!==value){await backup.put(previous);throw Error('保存還原點期間配置已改變，請重新預覽');}
 try{for(const [key,value] of Object.entries(plan.writes))storage.setItem(key,value);}
 catch(error){restore(storage,plan.before);await backup.put(previous);throw Error('套用失敗，已恢復原配置：'+(error instanceof Error?error.message:String(error)));}
}
export async function undoConfiguration(storage:ConfigStorage,backup:RollbackStore=configRollbackStore){
 const saved=await backup.get();if(!saved)throw Error('目前沒有可復原的套用紀錄');
 const current=Object.fromEntries(Object.keys(saved.before).map(key=>[key,storage.getItem(key)]));
 try{restore(storage,saved.before);}catch(error){restore(storage,current);throw error;}
 await backup.put(undefined);
}
