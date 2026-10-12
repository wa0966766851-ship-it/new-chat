import { Elf, Skill } from "../types";
import { DEFAULT_ELVES, subscribeDefaultElves } from "./defaultElves";

// 這裡將存放從 Encyclopedia 抽離的統一數據
export const GLOBAL_ELVES: Elf[] = DEFAULT_ELVES;
export const GLOBAL_SKILLS: Skill[] = DEFAULT_ELVES.flatMap(e => e.skills || []);
// 匯入精靈延後載入後，技能清單同步補齊（同一個陣列物件）。
subscribeDefaultElves(() => { GLOBAL_SKILLS.splice(0, GLOBAL_SKILLS.length, ...DEFAULT_ELVES.flatMap(e => e.skills || [])); });

// 獲取精靈的輔助函數
export const getElfData = (id: string | number) => GLOBAL_ELVES.find(e => String(e.id) === String(id));
export const getSkillData = (name: string) => GLOBAL_SKILLS.find(s => s.name === name);
