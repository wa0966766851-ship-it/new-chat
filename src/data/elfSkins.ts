import type {Elf} from '../types';
import type {PetAnimationAssetId} from '../battle/petAnimationAssets';

export interface ElfSkin {
 id:string; name:string; elfId:string; elfName:string; body:string;
 /** 有專用頭像時直接使用；否則從本皮膚立繪呈現頭像，不回到另一款外觀。 */
 head?:string;
 /** 動作屬於這款外觀；不得按精靈序號猜官方素材。 */
 animationAssetId?:PetAnimationAssetId;
 portrait?:{scale?:number;origin?:string;position?:string};
}
/** 純外觀資料；不覆寫技能、魂印、種族或實戰數值。 */
export const ORIGINAL_REY_SKIN={id:'rey-original',name:'普通雷伊',body:'/seer/body/70.png',head:'/seer/head/70.png',animationAssetId:'rey70'} as const;
/** 聖靈譜尼可選用原版譜尼外觀；共用300動畫，不改本身戰鬥資料。 */
export const ORIGINAL_PUNI_SKIN={id:'puni-original',name:'原版譜尼',elfId:'5000',elfName:'聖靈譜尼',body:'/seer/body/300.png',head:'/seer/head/300.png',animationAssetId:'puni'} as const;
/**
 * 咤克斯三化身（憤怒／貪婪／恐懼）。原廠是同一模型、同一張近灰階圖集，差別只在影格 addColor；
 * 這裡把三者的立繪與動作都掛在「湮滅之主・咤克斯」底下當皮膚，任何一隻都能直接切換驗收。
 * 恐懼的化身同時是獨立精靈（5025），兩邊共用同一份素材。
 */
const ZHAKESI_BODY='/elf-art/zhakesi_fear_body.png',ZHAKESI_HEAD='/elf-art/zhakesi_fear_head.png';
export const ZHAKESI_AVATAR_SKINS:readonly ElfSkin[]=[
 {id:'zhakesi-fear',name:'恐懼的化身',elfId:'5024',elfName:'湮滅之主・咤克斯',body:ZHAKESI_BODY,head:ZHAKESI_HEAD,animationAssetId:'zhakesi15010'},
 {id:'zhakesi-wrath',name:'憤怒的化身',elfId:'5024',elfName:'湮滅之主・咤克斯',body:ZHAKESI_BODY,head:ZHAKESI_HEAD,animationAssetId:'zhakesi15008'},
 {id:'zhakesi-greed',name:'貪婪的化身',elfId:'5024',elfName:'湮滅之主・咤克斯',body:ZHAKESI_BODY,head:ZHAKESI_HEAD,animationAssetId:'zhakesi15009'},
];
export const ELF_SKINS:readonly ElfSkin[]=[...ZHAKESI_AVATAR_SKINS,ORIGINAL_PUNI_SKIN,{
 id:'rey-thunder-dragon-v1',name:'雷龍之翼',elfId:'5029',elfName:'異境神霆·雷伊',body:'/elf-skins/rey-thunder-dragon-v1.png',portrait:{scale:3,origin:'50% 70%',position:'50% 60%'},
}, ...[{elfId:'5029',elfName:'異境神霆·雷伊'},{elfId:'7070',elfName:'魔化.雷伊'},{elfId:'707070',elfName:'墜霆.雷伊'}].map(owner=>({
 ...owner,...ORIGINAL_REY_SKIN,
}))];
export function availableElfSkins(elf:Pick<Elf,'id'|'name'>){
 const original:ElfSkin={id:'',name:'原始外觀',elfId:String(elf.id),elfName:elf.name,body:''};
 return [original,...ELF_SKINS.filter(s=>String(elf.id)===s.elfId||elf.name===s.elfName)];
}
export function selectedElfSkin(elf:Pick<Elf,'id'|'name'|'skinId'>){
 return availableElfSkins(elf).find(s=>s.id===elf.skinId);
}
