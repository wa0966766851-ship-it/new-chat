import React from 'react';
import type {Elf} from '../../types';
import {ElfSpotlight} from '../../components/ElfSpotlight';

/** 背包與倉庫共用正式介紹模板；鎖定選取對象，不顯示新精靈入口文案。 */
export function ElfCardSheet({elf,onClose}:{elf:Elf;onClose:()=>void}){
 return <ElfSpotlight elves={[elf]} selectedElf={elf} onClose={onClose}/>;
}
