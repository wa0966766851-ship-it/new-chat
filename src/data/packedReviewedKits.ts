import {gunzipSync,strFromU8} from 'fflate';
import {unpackJson,type PackedJson} from './packedJson';
/** 版本1為直接JSON，版本2沿用字典格式後gzip；還原後的定義完全相同。 */
export function unpackReviewedKits<T>(data:{schemaVersion:number;gzip:string}):T{
  if(![1,2].includes(data.schemaVersion))throw new Error('積木資料版本不相容');
  const value=JSON.parse(strFromU8(gunzipSync(Uint8Array.from(atob(data.gzip),c=>c.charCodeAt(0)))));
  return data.schemaVersion===1?value:unpackJson<T>(value as PackedJson);
}
