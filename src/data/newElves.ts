import type {Elf} from '../types';
import packed from './newElves.packed.json';
import {unpackReviewedKits} from './packedReviewedKits';
/** 原始定義位於 newElfDefinitions.ts；建置時核對無損封裝，首頁不載入建構器。 */
export const NEW_ELF_SEEDS=unpackReviewedKits<Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>[]>(packed);
const seed=(id:string)=>NEW_ELF_SEEDS.find(e=>String(e.id)===id)!;
export const ASTRAL_AESFIA_SEED=seed('5032'),ASTRAL_AESFIG_SEED=seed('5033'),MOGOS_SEED=seed('5034'),JIUQING_SEED=seed('5036');
