import { Elf, Skill } from "../types";
import { DEFAULT_ELVES } from "./defaultElves";

// 這裡將存放從 Encyclopedia 抽離的統一數據
export const GLOBAL_ELVES: Elf[] = DEFAULT_ELVES;
export const GLOBAL_SKILLS: Skill[] = DEFAULT_ELVES.flatMap(e => e.skills || []);

// 獲取精靈的輔助函數
export const getElfData = (id: string | number) => GLOBAL_ELVES.find(e => String(e.id) === String(id));
export const getSkillData = (name: string) => GLOBAL_SKILLS.find(s => s.name === name);
