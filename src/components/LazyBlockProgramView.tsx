import type { Elf, Skill } from "../types";
import { BlockProgramView } from "./BlockProgramView";
import { getSkillProgram, getSoulProgram, skillMode } from "../blocks/registry";
import { hasSkillHandler, getSoulMarkRegistry } from "../effects/battleEventRegistry";

/** 首頁切到積木詳情才載入解析器及戰鬥登記表。 */
export default function LazyBlockProgramView(props: { elf: Elf } | { skill: Skill }) {
  if ("elf" in props) {
    return <BlockProgramView program={getSoulProgram(props.elf)} source={getSoulMarkRegistry()[props.elf.name] ? "執行：專屬程式" : "執行：積木"} />;
  }
  const mode = skillMode(props.skill.name, hasSkillHandler(props.skill.name));
  return <BlockProgramView program={getSkillProgram(props.skill)} source={mode === "handler" ? "執行：專屬程式" : mode === "blocks" ? "執行：積木" : "執行：專屬程式＋積木"} />;
}
