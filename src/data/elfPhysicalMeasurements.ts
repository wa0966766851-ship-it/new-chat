import type {Elf} from '../types';
import measurements from './elfPhysicalMeasurements.json';

/** 以已核對的原始外觀對照 SeerAPI 圖鑑；只補缺值，換皮膚不更改數值。 */
export function fillElfPhysicalMeasurements<T extends Pick<Elf,'name'|'height'|'weight'> & {id?:string;isCustom?:boolean;gender?:string}>(elf:T):T {
 if(elf.isCustom||String(elf.id).startsWith('custom_')||elf.name.includes('譜尼'))return elf;
 const source=measurements.find(m=>m.id===String(elf.id)&&m.name===elf.name);
 if(!source)return elf;
 const height=elf.height==null||elf.height===0?source.height:elf.height;
 const weight=elf.weight==null||elf.weight===0?source.weight:elf.weight;
 const sourceGender='gender' in source?source.gender:undefined;
 const gender=elf.gender?.trim()?elf.gender:sourceGender==='无性别'?'無性別':sourceGender;
 return height===elf.height&&weight===elf.weight&&gender===elf.gender?elf:{...elf,height,weight,gender};
}
