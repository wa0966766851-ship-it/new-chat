import { DEFAULT_ELVES } from "../src/data/defaultElves";

type Finding = {
  id: number | string;
  elf: string;
  location: string;
  text: string;
  status: "implemented" | "partial" | "missing";
  evidence: string;
};

const findings: Finding[] = [];
const actionPattern = /額外行動|再次出手|進行[一二三四五六七八九十0-9]+次行動/;

for (const elf of DEFAULT_ELVES as any[]) {
  const soul = elf.soulMark?.description || "";
  if (actionPattern.test(soul)) {
    const status = elf.name.includes("斯嘉麗") || elf.name.includes("蝕言") ? "implemented" : "partial";
    findings.push({
      id: elf.id,
      elf: elf.name,
      location: "soulMark",
      text: soul.match(actionPattern)?.[0] || "額外行動",
      status,
      evidence: elf.name.includes("斯嘉麗") ? "scarlettRegistry → queueExtraAction → BattleScreen drain" : elf.name.includes("蝕言") ? "traitsEngine → queueExtraAction → skill_extra_action；場下餘波另以真實傷害結算" : "需補專屬執行器"
    });
  }
  for (const skill of [...(elf.skills || []), ...(elf.skillPool || [])] as any[]) {
    const description = skill.description || "";
    if (!actionPattern.test(description)) continue;
    const isSixPetal = elf.name.includes("六刃") && skill.name === "終焉·六花斬";
    findings.push({
      id: elf.id,
      elf: elf.name,
      location: `skill:${skill.name}`,
      text: description.match(actionPattern)?.[0] || "額外行動",
      status: isSixPetal ? "implemented" : "missing",
      evidence: isSixPetal ? "wuxuRegistry → queueExtraAction；依描述在一次額外行動結束時合併結算六次總傷害，不播放六段動畫" : "未找到對應 BattleSkillRegistry/queueExtraAction 執行器"
    });
  }
  for (const [key, trait] of Object.entries(elf.alienTraits || {}) as any[]) {
    const description = trait?.description || "";
    if (!actionPattern.test(description)) continue;
    findings.push({
      id: elf.id,
      elf: elf.name,
      location: `alienTraits:${key}`,
      text: description.match(actionPattern)?.[0] || "額外行動",
      status: elf.name.includes("蝕言") ? "implemented" : "missing",
      evidence: elf.name.includes("蝕言") ? "traitsEngine → queueExtraAction；主體為最佳屬性技能傷害，場下餘波為無屬性真實傷害" : "未找到對應執行器"
    });
  }
}

console.log("額外行動效果盤點");
console.log(`命中描述 ${findings.length} 筆`);
for (const f of findings) {
  console.log(`${f.status.toUpperCase()}\t${f.id}\t${f.elf}\t${f.location}\t${f.text}\t${f.evidence}`);
}
const counts = findings.reduce<Record<string, number>>((a, f) => { a[f.status] = (a[f.status] || 0) + 1; return a; }, {});
console.log(`彙總：已實裝 ${counts.implemented || 0}、部分實裝 ${counts.partial || 0}、未實裝 ${counts.missing || 0}`);
