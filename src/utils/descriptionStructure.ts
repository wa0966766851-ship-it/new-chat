import { DESCRIPTION_LAYOUTS } from '../data/descriptionLayouts';
import { plainDescription } from './descFormat';

export interface DescriptionNode {
  id: string;
  kind: 'section' | 'effect' | 'note';
  text: string;
  sourceLine: number;
  parentId?: string;
  children: DescriptionNode[];
}
export interface DescriptionTree {
  nodes: DescriptionNode[];
  unresolved: { sourceLine: number; text: string }[];
}
export function descriptionFingerprint(source: string): string {
  let hash = 2166136261;
  for (const ch of source.replace(/\r/g, '').trim()) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

/** 顯示結構不是戰鬥Tokens：先保留排版關係，再清理行內Markdown。 */
export function descriptionStructure(source = ''): DescriptionTree {
  const nodes: DescriptionNode[] = [], all: DescriptionNode[] = [];
  const sections: { level: number; node: DescriptionNode }[] = [];
  let parents: DescriptionNode[] = [], fenced = false;
  for (const [index, original] of source.replace(/\r/g, '').split('\n').entries()) {
    const raw = original.trimEnd();
    if (/^\s*```/.test(raw)) { fenced = !fenced; continue; }
    if (!raw.trim() || (!fenced && /^\s*(?:---+|___+|\*\*\*+)\s*$/.test(raw))) continue;
    const heading = !fenced && raw.match(/^\s*(#{1,6})\s+(.+)$/);
    const bracket = !fenced && raw.match(/^\s*【([^】]+)】\s*$/);
    const quote = !fenced && raw.match(/^(\s*)((?:[>＞]\s*)+)(.*)$/);
    const indent = (raw.match(/^\s*/)?.[0] || '').replace(/\t/g, '  ').length;
    const depth = quote ? (quote[2].match(/[>＞]/g)?.length || 0) + Math.floor(quote[1].length / 2) : Math.floor(indent / 2);
    const content = heading ? heading[2] : bracket ? bracket[1] : quote ? quote[3] : raw.trimStart();
    const text = plainDescription(content.replace(/^[-*+•]\s+/, ''));
    if (!text) continue;
    const section = !!(heading || bracket);
    const node: DescriptionNode = {
      id: `line-${index + 1}`, kind: section ? 'section' : /^(?:說明|註[：:]|備註|§)/.test(text) ? 'note' : 'effect',
      text, sourceLine: index + 1, children: [],
    };
    let parent: DescriptionNode | undefined;
    if (section) {
      const level = heading ? heading[1].length : 1;
      while (sections.length && sections.at(-1)!.level >= level) sections.pop();
      parent = sections.at(-1)?.node;
      sections.push({ level, node }); parents = [];
    } else {
      // 層級跳號也只依實際存在的父節點，不憑空製造效果。
      parent = depth > 0 ? parents[Math.min(depth, parents.length) - 1] : undefined;
      parent ||= sections.at(-1)?.node;
      parents = parents.slice(0, depth);
      parents[depth] = node;
    }
    if (parent) { node.parentId = parent.id; parent.children.push(node); } else nodes.push(node);
    all.push(node);
  }
  const related = new Set<string>();
  for (const relation of DESCRIPTION_LAYOUTS[descriptionFingerprint(source)] || []) {
    const candidates = all.filter(n => n.text === relation.text);
    const anchors = all.filter(n => n.text === relation.parentText);
    if (candidates.length !== 1 || anchors.length !== 1) continue;
    const node = candidates[0], parent = anchors[0];
    // 關聯只指向原文較早的節點，杜絕循環與吞掉後文。
    if (parent.sourceLine >= node.sourceLine) continue;
    const siblings = node.parentId ? all.find(n => n.id === node.parentId)!.children : nodes;
    siblings.splice(siblings.indexOf(node), 1);
    node.parentId = parent.id; node.kind = relation.role; parent.children.push(node);
    parent.children.sort((a, b) => a.sourceLine - b.sourceLine);
    related.add(node.id);
  }
  return { nodes, unresolved: all.filter(n => n.kind === 'effect' && !related.has(n.id) &&
    /^(?:觸發成功|每減少|並開始觸發|上述|前述)/.test(n.text) &&
    (!n.parentId || all.find(p => p.id === n.parentId)?.kind === 'section'))
    .map(n => ({ sourceLine: n.sourceLine, text: n.text })) };
}
