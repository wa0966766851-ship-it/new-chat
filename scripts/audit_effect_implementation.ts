import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { digest, normalizeSourceText, isPresentationOnly, clauseIdentity, clauseExecution, findTextSources, evidenceState, type AuditEvidence } from './lib/effectAudit';

const root = resolve('.');
// 使用正式 Vite 註冊入口，包括子目錄 stagedArena；不再另造不完整的 Node 掃描表。
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom',
  plugins: [{ name: 'audit-without-network-listeners', configResolved(config) {
    config.server.hmr = false; config.server.watch = null;
  } }] });
try {
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const { describeExecution, auditProgram } = await server.ssrLoadModule('/src/blocks/audit.ts');
  const { getElfTraitEntries } = await server.ssrLoadModule('/src/components/ElfTraitCards.tsx');
  const { SKILL_MODE, SOUL_MODE } = await server.ssrLoadModule('/src/blocks/specs.ts');
  const { getBattleSkillRegistry, getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const skillsRegistry = getBattleSkillRegistry(), soulsRegistry = getSoulMarkRegistry();
  const handlers = { skill: (name: string) => typeof skillsRegistry[name] === 'function', soul: (name: string) => typeof soulsRegistry[name] === 'function' };
  const evidence: AuditEvidence[] = JSON.parse(readFileSync('docs/audits/semantic-evidence.json', 'utf8')).evidence;
  const sources = findTextSources(root, DEFAULT_ELVES);
  const usedEvidence = new Set<string>();
  const rows = DEFAULT_ELVES.map((elf: any) => {
    const skills = [...(elf.skills || []), ...(elf.skillPool || [])].filter((s, i, all) => all.findIndex(other => other.name === s.name && other.description === s.description) === i);
    const entries = [
      { kind: '魂印', name: elf.soulMark?.name || '無魂印', sourceText: elf.soulMark?.description || '', ...describeExecution({ elf }, handlers) },
      ...getElfTraitEntries(elf).filter((t: any) => t.kind !== '專屬特性／魂印').map((trait: any) => ({ kind: trait.kind, name: trait.name, sourceText: trait.description, ...describeExecution({ trait }, handlers) })),
      ...skills.map(skill => ({ kind: '技能', name: skill.name, sourceText: skill.description || '', ...describeExecution({ skill }, handlers) })),
    ];
    const textSources = sources.get(elf.id) || [];
    return { id: elf.id, name: elf.name, sourceFiles: textSources.map(({ path, sha256 }) => ({ path, sha256 })),
      entries: entries.map(({ program, ...entry }) => {
        const seen = new Map<string, number>();
        const mode = entry.kind === '技能' ? SKILL_MODE[entry.name] : SOUL_MODE[elf.id] ?? SOUL_MODE[elf.name];
        return { ...entry, sourceSha256: digest(entry.sourceText), clauses: auditProgram(program).map((clause: any) => {
          const raw = normalizeSourceText(clause.raw), occurrence = (seen.get(raw) || 0) + 1;
          seen.set(raw, occurrence);
          const proofs = clause.explanation ? [] : evidence.filter(proof => proof.elfId === elf.id && proof.entry === entry.name && raw.includes(normalizeSourceText(proof.fragment)));
          proofs.forEach(proof => usedEvidence.add(proof.id));
          const mappedEvidence = proofs.map(proof => ({ ...proof, state: evidenceState(root, proof) }));
          const matched = textSources.filter(file => raw && normalizeSourceText(file.text).includes(raw)).map(file => file.path);
          return { ...clause, id: clauseIdentity(elf.id, entry.kind, entry.name, clause.raw, occurrence),
            presentationOnly: isPresentationOnly(clause.raw),
            execution: clauseExecution(entry.route, clause.parsed, clause.index, mode),
            textCorrespondence: { state: !textSources.length ? 'no-matching-txt' : matched.length ? 'text-fragment-found' : 'needs-source-review', files: matched },
            semanticVerification: mappedEvidence.some(p => p.state === 'partial-evidence') ? 'partial-evidence' : mappedEvidence.length ? 'stale-evidence' : 'pending',
            evidence: mappedEvidence };
        }) };
      }) };
  });
  assert.equal(new Set(rows.flatMap((row: any) => row.entries.flatMap((entry: any) => entry.clauses.map((c: any) => c.id)))).size,
    rows.reduce((n: number, row: any) => n + row.entries.reduce((m: number, entry: any) => m + entry.clauses.length, 0), 0), '子句 ID 必須唯一');
  const unmapped = evidence.filter(proof => !usedEvidence.has(proof.id)).map(proof => proof.id);
  assert.deepEqual(unmapped, [], '測試證據對應的原句已改動，須人工重新核對，不能自動轉移');
  const records = rows.flatMap((r: any) => r.entries.flatMap((e: any) => e.clauses)).filter((c: any) => !c.explanation);
  const all = records.filter((c: any) => !c.presentationOnly);
  const count = (key: string, value: string | boolean) => all.filter((c: any) => c[key] === value).length;
  const summary = { elves: rows.length, sourceRecords: records.length, presentationOnly: records.length - all.length,
    clauses: all.length, parsed: count('parsed', true), unparsed: count('parsed', false),
    pending: count('semanticVerification', 'pending'), partialEvidence: count('semanticVerification', 'partial-evidence'), staleEvidence: count('semanticVerification', 'stale-evidence'), fullyAccepted: 0 };
  const escapeCell = (text: string) => text.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').replace(/`/g, '\\`');
  const statusLabels = { pending: '待核對', 'partial-evidence': '部分情境證據', 'stale-evidence': '證據過期' };
  const elfDocuments = rows.map((row: any) => {
    assert.match(row.id, /^[a-z0-9_-]+$/i, '精靈稽核檔名只接受安全ID');
    const content = [`# ${row.id} ${row.name}：逐句核對`, '',
      '[回總表](../../全精靈效果實裝核對.md)；原始分詞／參數與穩定子句ID見總表同名JSON。', '',
      '入口存在、解析成功都不是驗收通過；部分證據只涵蓋列出的情境，剩餘分支仍待確認。純標題／分隔行留在JSON，不列作效果。', '',
      `TXT來源：${row.sourceFiles.length ? row.sourceFiles.map((f: any) => `[${f.path}](../../../${f.path})`).join('、') : '未找到ID／名稱精確匹配的TXT，須核對嵌入資料或另補來源。'}`, '',
      ...row.entries.flatMap((entry: any) => [`## ${entry.kind}：${entry.name}`, '', `目前入口：${entry.source}（${entry.route}）。`, '',
        '| 原文 | 解析／執行候選 | 語意登記 | TXT片段 |', '|---|---|---|---|',
        ...entry.clauses.filter((c: any) => !c.explanation && !c.presentationOnly).map((c: any) =>
          `| ${escapeCell(c.raw)} | ${c.parsed ? '已解析' : '未解析'}／${c.execution} | ${statusLabels[c.semanticVerification]}${c.evidence.length ? `：${c.evidence.map((p: any) => p.id).join('、')}` : ''} | ${c.textCorrespondence.state === 'text-fragment-found' ? '原句片段吻合（非語意通過）' : c.textCorrespondence.state === 'no-matching-txt' ? '缺精確TXT來源' : '原句需人工對照'} |`), '',
        ...entry.clauses.flatMap((c: any) => c.evidence.map((proof: any) =>
          `- 證據 ${proof.id}：[${proof.testFile}](../../../${proof.testFile})。情境：${proof.scenario}；預期：${proof.expected}；未驗：${proof.remaining}；斷言錨點：\`${proof.anchor}\`。`)), '']), ''].join('\n').trimEnd() + '\n';
    return { path: `docs/audits/elves/${row.id}.md`, content };
  });
  const markdown = ['# 全精靈效果實裝核對清單', '',
    '範圍：魂印、所有特質、攜帶技能及去重後預備技能。正式 Vite 註冊表決定執行入口（包含 stagedArena）；Proxy 可執行 fallback 不算專屬 handler。', '',
    '解析成功只代表有結構化節點；handler-review 只代表有程式入口。partial-evidence 代表列出的部分情境有測試紀錄，**不代表整句所有條件、作用域、下場與失敗分支已驗收**。本報告不計算戰鬥正確率。', '',
    'TXT 片段吻合只供追溯，不是語意通過；沒有同名 TXT、原句未吻合、未解析及未驗分支均保留。每句有穩定 ID、原文、觸發、條件／行為積木、執行入口、傷害建議及證據。測試／依賴檔案改動會將證據標為 stale-evidence。', '',
    '| ID | 精靈 | 效果組 | 子句 | 已解析 | 未解析 | 部分證據 | 待核對 | 過期證據 |', '|---|---|---:|---:|---:|---:|---:|---:|---:|',
    ...rows.map((r: any) => { const c = r.entries.flatMap((e: any) => e.clauses).filter((c: any) => !c.explanation && !c.presentationOnly); const n = (s: string) => c.filter((x: any) => x.semanticVerification === s).length;
      return `| ${r.id} | [${r.name}](audits/elves/${r.id}.md) | ${r.entries.length} | ${c.length} | ${c.filter((x: any) => x.parsed).length} | ${c.filter((x: any) => !x.parsed).length} | ${n('partial-evidence')} | ${n('pending')} | ${n('stale-evidence')} |`; }), '',
    `精靈 ${summary.elves}；可稽核子句 ${summary.clauses}；已解析 ${summary.parsed}，未解析 ${summary.unparsed}；部分測試證據 ${summary.partialEvidence}，待核對 ${summary.pending}，過期證據 ${summary.staleEvidence}；完整逐句驗收 ${summary.fullyAccepted}。`, '',
    `舊統計 ${summary.sourceRecords} 個拆分紀錄包含 ${summary.presentationOnly} 個純Markdown標題／分隔行；保留原文供追溯，但不再當成待實裝效果。`, '',
    '數字與積木解析報告分母不同：該報告只統計攜帶技能＋魂印，不含全部特質及預備技能。不可混成實裝率。', '',
    '## 已記錄的部分情境', '',
    ...evidence.map(proof => `- ${proof.elfId}／${proof.entry}：${proof.scenario}；預期：${proof.expected}。尚未覆蓋：${proof.remaining}。證據：\`${proof.testFile}\`（${proof.lastPassed}，${evidenceState(root, proof)}）。`), '',
    '更新：`npm run audit:implementation`；一致性驗證：`npm run test:audit`。證據只可在實際測試通過後人工新增；不得由解析／handler 存在自動升級。', ''].join('\n');
  const json = JSON.stringify({ schemaVersion: 2, note: 'parsed ≠ executable route ≠ semantic acceptance', summary, elves: rows }, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    assert.ok(readFileSync('docs/全精靈效果實裝核對.json', 'utf8') === json, '核對 JSON 需重新產生：npm run audit:implementation');
    assert.ok(readFileSync('docs/全精靈效果實裝核對.md', 'utf8') === markdown, '核對 MD 需重新產生：npm run audit:implementation');
    for (const file of elfDocuments) assert.ok(readFileSync(file.path, 'utf8') === file.content, `逐隻核對文件已過期：${file.path}`);
  }
  if (process.argv.includes('--write')) {
    writeFileSync('docs/全精靈效果實裝核對.json', json);
    writeFileSync('docs/全精靈效果實裝核對.md', markdown);
    mkdirSync('docs/audits/elves', { recursive: true });
    for (const file of elfDocuments) writeFileSync(file.path, file.content);
  }
  console.log(markdown);
} finally { await server.close(); }
