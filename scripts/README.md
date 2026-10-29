# 維護腳本分類

本機封存：`archive_workspace_artifacts.py`先預覽，`--apply`才壓縮、核對並移除已備份來源，`--restore`還原到新的測試目錄，`--apply --resume`接續中斷批次；`archive_historical_releases.py`核對ZIP再去除舊EXE副本，保留目前版與上一版；`index_local_archives.mjs`生成本機復原索引。本次固定批次與保護邊界見[執行報告](../docs/audits/2026-10-29_第三輪封存與瘦身執行.md)，不要盲目重跑已完成批次。

空間研究：`node scripts/audit_workspace_storage.mjs`唯讀盤點，`--hash --budget-mib=64`加上限量內容比對，輸出在`.cleanup-audit/storage-analysis.json`。不刪除檔案。範圍與不完整核對的判讀見[檔案分區指南](../docs/guides/storage-layout.md)。

2026-10-29 新增：`cleanup_development_artifacts.mjs` 預覽指定舊快取與桌面副本；`compress_development_screenshots.py` 無損壓縮開發截圖（兩者加 `--apply` 才寫入）；`index_development_records.mjs` 重建文件日期索引。範圍及保留規則見[整理指南](../docs/guides/project-housekeeping.md)。

保留既有腳本路徑，避免破壞package指令、CI與外部接續工具。從專案根目錄執行，正式指令以`package.json`為準。

| 類別 | 入口 | 用途 |
|---|---|---|
| 積木資料 | `pack_reviewed_kits.ts`、`pack_effect_data.ts`、`gen-handled-skills.ts` | 重建有正式消費端的生成資料 |
| 戰鬥稽核 | `audit_block_migration.ts`、`audit_migration_readiness.ts`、`audit_effect_implementation.ts` | `docs/audits`報告；不能推算全文正確率 |
| 語意回歸 | `check_migration_release.mjs` | 正式引擎測試及結果紀錄 |
| 桌面封裝 | `package_electron.mjs`、`prepare_electron_app.mjs` | 正式成品與中間副本管理 |
| 舊ZIP封裝 | `package_portable.ps1` | 舊版相容流程 |
| 網站套件 | `prepare_web_package.mjs`、`publish_site_package.mjs` | 套件準備與發布分離 |
| 空間維護 | `cleanup_build_artifacts.mjs`、`cleanup_legacy_portable.ps1` | 預設預覽，只清理已界定來源 |
| 共用工具 | `lib/` | 路徑邊界及獨立工作區 |
| 原始資料匯入 | `import_*`、`generate_*`、`build_*codex*`等 | 核對資料來源後使用，不屬於日常打包 |

臨時診斷資料放`build/diagnostics/`，避免新增根目錄散檔。詳見[結構](../docs/PROJECT_STRUCTURE.md)與[桌面指南](../docs/guides/desktop-packaging.md)。
