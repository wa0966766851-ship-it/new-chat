import type {PeerSeat} from './protocol';

export const PUBLIC_KEY_PATTERN=/^[A-Za-z0-9_-]{87}$/;
export const PROOF_PATTERN=/^[A-Za-z0-9_-]{86}$/;
const encode=(bytes:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=(value:string)=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const payload=(code:string,seat:PeerSeat,version:string)=>new TextEncoder().encode(JSON.stringify(['seer-room-identity',code,seat,version]));

/** A fresh non-exportable private key per room. Never saved or shared with the server. */
export async function createSessionIdentity(){
 if(!globalThis.crypto?.subtle)throw Error('連線身分驗證需要安全的瀏覽器環境');
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 const publicKey=encode(await crypto.subtle.exportKey('raw',keys.publicKey));
 return {publicKey,async prove(code:string,seat:PeerSeat,version:string){
  return encode(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,payload(code,seat,version)));
 }};
}

export async function verifySessionIdentity(publicKey:string,proof:string,code:string,seat:PeerSeat,version:string){
 if(!PUBLIC_KEY_PATTERN.test(publicKey)||!PROOF_PATTERN.test(proof))return false;
 try{
  const key=await crypto.subtle.importKey('raw',decode(publicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,decode(proof),payload(code,seat,version));
 }catch{return false;}
}
