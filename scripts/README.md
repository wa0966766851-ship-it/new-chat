# 維護腳本分類

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
