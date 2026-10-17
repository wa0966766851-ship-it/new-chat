import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const digest = (text) => createHash('sha256').update(text.toString().replace(/\r\n/g, '\n')).digest('hex');
const sha = (p) => digest(readFileSync(p, 'utf8'));
const today = '2026-10-15';
const mk = (id, elfId, entry, fragment, testFile, anchor, scenario, expected, remaining, inputs) => ({
  id, elfId, entry, fragment, testFile, anchor, lastPassed: `${today}：本session該精靈全套引擎驗收通過；證據由測試實跑對應，仍屬部分情境證據`,
  testSha256: sha(testFile), inputs: inputs.map(p => ({ path: p, sha256: sha(p) })), scenario, expected, remaining,
});
// 依賴指紋（5017/5001 Kit 鏈）
const dixinInputs = ['src/data/migratedDixinSkillKits.ts','src/data/migratedDixinSoulKit.ts','src/blocks/runtime.ts','src/effects/sequenceContract.ts'];
const sobiratInputs = ['src/data/migratedSobiratCageKit.ts','src/data/migratedSobiratSoulKit.ts','src/blocks/runtime.ts','src/effects/sequenceContract.ts'];
const evidence = [
  // ── 5017 鹿台悲歌 ──
  mk('lutai-fullstack','5017','鹿台悲歌','全屬性+1，若當前八荒大於3層則效果翻倍','tests/migrate_dixinSkills.semantic.test.ts','鹿台悲歌：狂暴3回合＋八荒+2＋先制+2計時器＋吸取139×層','P1 帝辛真實種子單回合實戰','狂暴3回合、八荒淨+1（+2後魂印-1）、priorityBoostTurns=2/Value=2 registry 鍵','封附加、神游交叉、八荒0層與9層邊界',dixinInputs),
  // ── 5017 帝怒傾天 ──
  mk('dinu-surehit','5017','帝怒傾天','■ 必中','tests/migrate_dixinSkills.semantic.test.ts','帝怒傾天：八荒≥3 無視減傷＋對手每提升1級威力+30','P1 帝辛實戰一回合','必中命中、技能正常結算','條件先制（自降/對升）邊界、無視減傷的具體乘區驗證',dixinInputs),
  // ── 5017 玄鳥天命 ──
  mk('xuanniao-clear','5017','玄鳥天命','消除對手回合類效果','tests/migrate_dixinSkills.semantic.test.ts','玄鳥天命：八荒層數先制＋消除回合類成功→疲憊','P1 帝辛實戰一回合','八荒+2、消除→疲憊/害怕鏈','mark_priority 逐層先制的精確值、1回合禁療讀取端',dixinInputs),
  // ── 5017 人皇御宇 ──
  mk('yuyu-watchers','5017','人皇御宇','4回合內每回合結束時吸取對手1/3最大體力','tests/migrate_dixinSkills.semantic.test.ts','人皇御宇：臣服3回合或 fallback 星賜＋屬性封印監看','P1 帝辛實戰一回合','臣服附加、兩個監看計時器（opp_status封印+round_end吸取）rem=3','封附加時的固有分支、4回合到期遞減',dixinInputs),
  // ── 5017 九鼎震八荒（全場景）──
  mk('jiuding-nine-lock','5017','九鼎震八荒','使用後附加自身9層八荒，且9回合內自身八荒層數不再減少','tests/migrate_jiuding.semantic.test.ts','八荒層數: 9','P1 帝辛九鼎使用回合','八荒=9、markLock remaining=8','9鎖與魂印-1的並發順序、切換後鎖殘留',dixinInputs),
  mk('jiuding-once-degrade','5017','九鼎震八荒','此技能使用成功後效果每場戰鬥只能生效一次，此後該技能失去必中效果且命中率歸0','tests/migrate_jiuding.semantic.test.ts','第二次使用九鼎應因命中率歸0而未命中','P1 兩回合','第二回合 📜 once 旗標→💨 沒有命中→on_invalid 補償鏈','屬性技能的 degrade 場景、神游免疫交叉',dixinInputs),
  mk('jiuding-select-priority','5017','九鼎震八荒','但選擇該技能時令對方當回合先制-4','tests/migrate_jiuding.semantic.test.ts','X actionPriorityThisTurn (turn2): -4','P1 degrade 回合','X 的 actionPriorityThisTurn=-4','與其他先制修改的疊加順序',dixinInputs),
  mk('jiuding-kill-close','5017','九鼎震八荒','若擊敗對手，會立刻關閉誅魔天陣並觸發關閉懲罰效果','tests/migrate_jiuding.semantic.test.ts','擊殺後天陣應立刻關閉','P1 九鼎擊殺低血對手','close log、formation gone、體力→1、PP全歸0、鎖切換計時器','天陣自然到期關閉（9回合後）',dixinInputs),
  mk('jiuding-invalid-comp','5017','九鼎震八荒','技能無效時，消除對方回合類效果，100%令對方神遊','tests/migrate_jiuding.semantic.test.ts','第二次使用九鼎應因命中率歸0而未命中','P1 Miss 回合','Miss→on_invalid→💫 神游附加','神游被免疫時的 fallback',dixinInputs),
  // ── 5017 荒魂印 ──
  mk('dixin-soul-9formation','5017','荒','當達到9層時觸發誅魔天陣，持續9回合','tests/migrate_dixinSaveReload.semantic.test.ts','九鼎9層應開啟過誅魔天陣（日誌為證）','P1 save/reload 後實戰','誅魔天陣開啟日誌+計時器 9','8層翻倍、伏魔計算翻倍（已列升級項）',dixinInputs),
  mk('dixin-soul-roundflow','5017','荒','對方當回合若使用技能則失去1層八荒','tests/migrate_dixinSkills.semantic.test.ts','玄鳥天命：八荒層數先制＋消除回合類成功→疲憊','P1 多回合','回合結算層數流轉正常','切換+2+墮魔分支的獨立驗收',dixinInputs),
  // ── 5017 畫布保存重載 ──
  mk('dixin-canvas-reload','5017','九鼎震八荒','攜帶此技能且使用成功後效果存在時若擊敗對手','tests/migrate_dixinSaveReload.semantic.test.ts','畫布保存重載不丟參數','五招+魂印 Blockly save→load→parse deepEqual','往返結構全等、P1/P2 實戰無待接通','非 Blockly 編輯器人工操作驗收',dixinInputs),
  // ── 5001 黯索魂噬 ──
  mk('ansuo-clear-chain','5001','黯索魂噬','消除對手回合類效果','tests/migrate_5001.semantic.test.ts','黯索魂噬：兩段消除都成功','P1/P2 雙側六情境','害怕+全屬性-1、失敗不觸發、封附加僅傷害','BOSS/未命中/下場交叉（列於測試 remaining）',sobiratInputs),
  // ── 5001 幽冥噬魂 ──
  mk('yuming-watchers','5001','幽冥噬魂','3回合內自身使用技能則100%令對手害怕','tests/migrate_5001_yuming.semantic.test.ts','fear: true | bind: true | invalid: true','P1 一回合','三監看計時器+免疫反彈5回合+initial當回合害怕','束縛實戰觸發、無效消除的實際命中',sobiratInputs),
  // ── 5001 影之牢籠 ──
  mk('cage-hpset','5001','影之牢籠','消耗自身全部體力','tests/migrate_5001_cage.semantic.test.ts','自身體力應降為1（未受攻擊）','P1 一回合','體力調整至1、scarBonus pending+1、300固傷落地','多次使用疊加、PP耗盡交叉',sobiratInputs),
  mk('cage-survive','5001','影之牢籠','若對手因此被擊敗則自身保留1點體力','tests/migrate_5001_cage.semantic.test.ts','同歸場景：300固傷擊敗低血對手 → 自身保留1點體力','P1 同歸回合','Y 被擊敗、game_over、自身≥1','對手未死時的分支',sobiratInputs),
  // ── 5001 黯魂印 ──
  mk('sobirat-soul-quiet','5001','黯','回合結束若自身未受到技能傷害','tests/migrate_5001_soul.semantic.test.ts','未受技能傷害回合 → scarBonus+1（pending_counter）','P1 安靜回合','pending log+registry 1、舊 handler 退場','PP 吸取 fallback 的實際扣減',sobiratInputs),
  mk('sobirat-soul-fear','5001','黯','自身每次受到技能傷害時','tests/migrate_5001_soul.semantic.test.ts','受技能傷害 → 對手害怕（on_damaged 鏈）','P1 受擊回合','💫 害怕附加','免疫時的 PP 吸取分支',sobiratInputs),
  mk('sobirat-soul-defeat','5001','黯','消除對手回合類效果','tests/migrate_5001_soul.semantic.test.ts','被擊敗 → 消除對手效果＋附加黯痕（DarkScarTurns 鍵＋可見異常）','P1 被擊敗','p2 DarkScarTurns=3、💫黯痕狀態、消除對手效果','3+累計的更多層數、命運攔截並行',sobiratInputs),
];
const out = { schemaVersion: 1,
  note: '交接草稿，尚未登錄正式證據。原句對應與逐句語意仍待獨立審查；lastPassed僅為原作者陳述。不得自動刷新指紋後重新登錄。',
  evidence };
writeFileSync('docs/audits/dixin-sobirat-evidence.json', JSON.stringify(out, null, 2), 'utf8');
console.log('written', evidence.length, 'entries');
