import {gzip, Gunzip, strFromU8, strToU8} from 'fflate';

export const MAX_CONFIG_BYTES=4*1024*1024;
export const MAX_CONFIG_TEXT=6*1024*1024;
const plain='SCFG1.',encrypted='SCFGE1.';
const aad=new TextEncoder().encode('seer-player-config/v1');
const bytes=(v:Uint8Array)=>Uint8Array.from(v).buffer;
function b64(v:Uint8Array){let s='';for(let i=0;i<v.length;i+=8192)s+=String.fromCharCode(...v.subarray(i,i+8192));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function unb64(s:string){if(!/^[A-Za-z0-9_-]+$/.test(s))throw Error('配置碼含有不合法字元');const v=atob(s.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(v,c=>c.charCodeAt(0));}
const digest=async(v:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(v))),x=>x.toString(16).padStart(2,'0')).join('');
async function passwordKey(password:string,salt:Uint8Array){
 if(password.length>1024)throw Error('密碼過長');
 const raw=await crypto.subtle.importKey('raw',bytes(strToU8(password)),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:bytes(salt),iterations:210000},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encodeConfiguration(value:unknown,password=''):Promise<string>{
 if(!globalThis.crypto?.subtle)throw Error('請使用桌面版、localhost或HTTPS產生配置碼');
 const raw=strToU8(JSON.stringify(value));if(raw.length>MAX_CONFIG_BYTES)throw Error('配置超過4 MB，請減少內嵌圖片或分開分享精靈圖紙');
 const zipped=await new Promise<Uint8Array>((resolve,reject)=>gzip(raw,{level:6},(error,data)=>error?reject(error):resolve(data)));
 if(!password)return plain+b64(zipped)+'.'+await digest(zipped);
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:bytes(iv),additionalData:bytes(aad)},await passwordKey(password,salt),bytes(zipped)));
 const joined=new Uint8Array(28+ciphertext.length);joined.set(salt);joined.set(iv,16);joined.set(ciphertext,28);return encrypted+b64(joined);
}
function boundedInflate(input:Uint8Array):string{
 const chunks:Uint8Array[]=[];let size=0;
 const stream=new Gunzip((chunk)=>{size+=chunk.length;if(size>MAX_CONFIG_BYTES)throw Error('配置解壓後超過4 MB');chunks.push(chunk);});
 for(let i=0;i<input.length;i+=1024)stream.push(input.subarray(i,i+1024),i+1024>=input.length);
 const out=new Uint8Array(size);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return strFromU8(out);
}
export function parseConfigJson(text:string):any{
 if(strToU8(text).length>MAX_CONFIG_BYTES)throw Error('配置超過4 MB');
 const value=JSON.parse(text,(key,v)=>{if(['__proto__','prototype','constructor'].includes(key))throw Error('配置含有不允許的原型欄位');return v;});
 let count=0;const visit=(v:any,depth:number)=>{if(++count>350000||depth>64)throw Error('配置過深或項目過多');if(typeof v==='number'&&!Number.isFinite(v))throw Error('配置含有非有限數值');if(v&&typeof v==='object')for(const child of Object.values(v))visit(child,depth+1);};visit(value,0);return value;
}
export async function decodeConfiguration(input:string,password=''):Promise<any>{
 const text=input.trim();if(!text||text.length>MAX_CONFIG_TEXT)throw Error('請輸入有效配置碼或4 MB以內的存檔');
 if(text.startsWith('{'))return parseConfigJson(text);
 let zipped:Uint8Array;
 if(text.startsWith(plain)){
  const parts=text.slice(plain.length).split('.');if(parts.length!==2||!/^[a-f0-9]{64}$/.test(parts[1]))throw Error('配置碼格式不完整');
  zipped=unb64(parts[0]);if(await digest(zipped)!==parts[1])throw Error('配置碼校驗失敗，可能複製不完整或內容已變動');
 }else if(text.startsWith(encrypted)){
  if(!password)throw Error('此配置已加密，請輸入密碼');
  const data=unb64(text.slice(encrypted.length));if(data.length<44)throw Error('加密配置不完整');
  try{zipped=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(data.subarray(16,28)),additionalData:bytes(aad)},await passwordKey(password,data.subarray(0,16)),bytes(data.subarray(28))));}
  catch{throw Error('密碼不正確或加密配置已損壞');}
 }else throw Error('不支援這個配置碼版本；請更新程式或使用原本的JSON備份');
 try{return parseConfigJson(boundedInflate(zipped));}catch(e){throw Error('無法讀取配置：'+(e instanceof Error?e.message:String(e)));}
}
