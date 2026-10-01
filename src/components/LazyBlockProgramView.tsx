import type { Elf, Skill } from "../types";
import { BlockProgramView } from "./BlockProgramView";
import { describeExecution } from '../blocks/audit';

/** 首頁切到積木詳情才載入解析器及戰鬥登記表。 */
export default function LazyBlockProgramView(props: { elf?: Elf; skill?: Skill; trait?: { name: string; description: string } }) {
  const { program, source } = describeExecution(props);
  return <BlockProgramView program={program} source={source} />;
}
