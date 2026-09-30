# 賽爾對戰模擬器 Seer Battle Simulator

React + Vite + Express + Electron 寫的賽爾號對戰模擬器：組隊、對戰結算、魂印 Registry、Blockly 技能編輯、圖鑑 Codex、打包成桌面版。

遠端：https://github.com/wa0966766851-ship-it/new-chat.git（分支 main）
版本：1.0.0（見 version.ts，單一版本來源）

## 快速開始

需求：Node 20+、npm。

```bash
npm install
cp .env.example .env   # 填 GEMINI_API_KEY 才有 AI 生成精靈
npm run dev            # tsx server.ts，前後端同源 http://localhost:3000
npm run lint           # tsc --noEmit
npm test               # 完整測試（含 scopes / loading / data / ui）
npm run build          # vite build + esbuild server -> dist/
npm start              # node dist/server.cjs
```

沒有 GEMINI_API_KEY 時 /api/generate-elf 等會回 503，前端改走本地解析，不會炸場。

## 指令一覽

| 指令 | 用途 |
|---|---|
| npm run dev / start | 開發 / 生產啟動 |
| npm test | 全部測試 |
| npm run test:scopes | 體力與作用域語意測試 |
| npm run test:loading | codex / profile 延遲載入測試 |
| npm run test:data | packed 資料一致性檢查 |
| npm run test:ui | UI 基礎測試 |
| npm run audit:bundle | 打包體積稽核（build 後跑） |
| npm run data:pack / data:skills | 產生 packed JSON / 技能索引 |
| npm run package:portable / package:zip | 可攜包 |
| npm run build:exe | 產生 exe（--bump 升版） |
| npm run package:electron | electron-builder nsis+portable |

## 專案結構

```
index.html -> src/main.tsx -> src/App.tsx（view: start/custom/battle/destiny/interstellar/test）
server.ts            # Express + Vite 中介 + Gemini API + /seer 圖資代理
src/components/      # BattleScreen（調度）、StartScreen、ElfEditor、Encyclopedia 等
src/battle/          # timers、marks、survivalRules、contextBuilders、stateScopes（作用域）
src/effects/         # 各精靈 Registry（handler），描述物已搬到 src/data/elfProfiles/
src/data/            # defaultElves、codex、blockLibrary、packed 生成檔、elfProfiles
src/blocks/          # Blockly 自訂積木
src/utils/           # elfStats（能力邊界）、statCalculator、extraElf 等
electron/            # main.cjs + preload.cjs 桌面殼
scripts/ / tools/    # 打包、稽核、分享工具
tests/               # battle.units、blocks.semantic、scopes、loading 等
```

架構約定（見 AGENTS.md）：新魂印走 Registry Pattern，禁止再往 BattleScreen 硬塞；自然語言先拆 Trigger/Condition/Target/Action 再掛 BattleContext。

## 本次三包說明

1. fix(hp/scopes)：能力正規邊界 + 個人/陣營分離
   - 拔掉 suitsAndEyewears 的 hp || 100 兜底，改走 utils/elfStats.normalizeElfStats
   - 新增 battle/stateScopes.switchBattleSide，正常切換與死亡強制換人共用
   - Mark 預設 scope:elf，只有 fear_seed/flower、demon_grudge、scarlett_holy_light 為 team
   - Timer 預設個人持有，lockSwitch 類才留陣營；updateElf 找不到身分不再退回在場者
2. perf(data)：codex 延遲解析 + packed 生成 + elfProfiles 搬移，handler 不變
3. feat(ui)：統一面板、錯誤邊界、咤克斯立繪、編輯器拆分

## 注意事項

- dist/、node_modules/、.env 不進版控；packed JSON 是生成檔，改源頭後要重跑 data:pack
- LF/CRLF 警告無害；送版前跑過 lint + test + build 全綠再 push
- 舊自訂精靈缺面板時讀取走寬容版（保留原文可進編輯器修），新增/存檔走嚴格版（缺資料直接報錯不偽造數值）
