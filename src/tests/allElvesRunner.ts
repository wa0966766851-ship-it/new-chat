import { DEFAULT_ELVES } from "../data/defaultElves";

export function getAllTestableElves() {
  return DEFAULT_ELVES.map(elf => ({
    name: elf.name,
    skillCount: elf.skills.length,
  }));
}

export function generateSkillCyclingScript(skillCount: number, turns: number = 10): number[] {
  const script: number[] = [];
  if (skillCount <= 0) return script;
  for (let i = 0; i < turns; i++) {
    script.push(i % skillCount);   // Cycle through skill indices sequentially
  }
  return script;
}
