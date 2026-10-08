import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, sep, isAbsolute } from 'node:path';

/** 文字證據統一 CRLF/LF；不忽略任何其他內容，且不供二進位發布校驗使用。 */
export const digest = (text: string | Buffer) => createHash('sha256')
  .update(text.toString().replace(/\r\n/g, '\n')).digest('hex');
/** 僅去展示標記和空白；不轉繁簡、不改數值、不把相似效果當相同。 */
export const normalizeSourceText = (text: string) => text
  .replace(/^\s*>+\s*/gm, '').replace(/^\s*#{1,6}\s+/gm, '').replace(/\*\*/g, '')
  .replace(/[\s■◇◆🎯]/gu, ''); // 保留公式的 *、>、<、+ 等運算子。
export const isPresentationOnly = (text: string) => /^\s*[-_=]{3,}\s*$/.test(text) || /^\s*#{1,6}\s/.test(text);

export function clauseIdentity(elfId: string, kind: string, name: string, raw: string, occurrence: number) {
  return `${elfId}:${kind}:${name}:${digest(normalizeSourceText(raw)).slice(0, 12)}:${occurrence}`;
}

export function clauseExecution(route: string, parsed: boolean, index: number, mode?: 'blocks' | number[]) {
  if (route === 'trait-review') return 'trait-review';
  if (route === 'handler' || (route === 'hybrid' && !Array.isArray(mode))) return 'handler-review';
  if (route === 'hybrid' && Array.isArray(mode) && !mode.includes(index)) return 'handler-review';
  if (route === 'blocks' || route === 'hybrid') return parsed ? 'block-runtime' : 'text-fallback-review';
  return 'generic-soul-review';
}

export function findTextSources(root: string, elves: Array<{ id: string; name: string }>) {
  const dir = resolve(root, 'elf_source_files/elf_files');
  const files = readdirSync(dir).filter(file => file.endsWith('.txt')).sort().map(file => {
    const text = readFileSync(resolve(dir, file), 'utf8');
    return { path: `elf_source_files/elf_files/${file}`, text, sha256: digest(text),
      title: normalizeSourceText(text.split(/\r?\n/).find(line => line.trim()) || ''), file };
  });
  return new Map(elves.map(elf => {
    const name = normalizeSourceText(elf.name).replace(/[·・.]/g, '');
    return [elf.id, files.filter(file => file.file.startsWith(`${elf.id}_`) ||
      file.title.replace(/[·・.]/g, '') === name ||
      file.file.replace(/\.txt$/, '').replace(/[·・.]/g, '') === name)];
  }));
}

export type AuditEvidence = {
  id: string; elfId: string; entry: string; fragment: string; testFile: string; anchor: string;
  lastPassed: string; testSha256: string; inputs: Array<{ path: string; sha256: string }>;
  scenario: string; expected: string; remaining: string;
};

function safePath(root: string, path: string) {
  const absolute = resolve(root, path), rel = relative(root, absolute);
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) throw new Error(`稽核路徑越界：${path}`);
  return absolute;
}

/** 測試紀錄是人工對應的部分證據；即使 hash 相同，也不自動宣稱全句已驗收。 */
export function evidenceState(root: string, proof: AuditEvidence): 'partial-evidence' | 'stale-evidence' {
  const file = safePath(root, proof.testFile);
  if (!existsSync(file)) return 'stale-evidence';
  const test = readFileSync(file, 'utf8');
  if (!proof.lastPassed || !proof.inputs.length || !proof.anchor || digest(test) !== proof.testSha256 || !test.includes(proof.anchor)) return 'stale-evidence';
  for (const input of proof.inputs) {
    const path = safePath(root, input.path);
    if (!existsSync(path) || digest(readFileSync(path)) !== input.sha256) return 'stale-evidence';
  }
  return 'partial-evidence';
}
