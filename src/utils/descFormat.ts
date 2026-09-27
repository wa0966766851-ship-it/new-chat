// 技能／魂印描述顯示：一條效果一行（僅影響顯示，不改原文）
const MARKER = /^\s*(■|◆|◇|🎯|>|＞)/;

function splitOutsideBrackets(line: string, seps: string[]): string[] {
  const out: string[] = [];
  let depth = 0, buf = "";
  for (const ch of line) {
    if ("（(「【『[".includes(ch)) depth++;
    else if ("）)」】』]".includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && seps.includes(ch)) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export function effectLines(desc?: string): string[] {
  if (!desc) return [];
  const lines: string[] = [];
  for (const raw of desc.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    // 已依使用者格式標記的行（■固有、🎯附加、◇攜帶、> 延伸）保持原樣
    if (MARKER.test(line)) { lines.push(line); continue; }
    splitOutsideBrackets(line, ["；", ";", "。"]).forEach(l => lines.push(l));
  }
  return lines;
}

export function formatEffectText(desc?: string): string {
  return effectLines(desc).join("\n");
}
