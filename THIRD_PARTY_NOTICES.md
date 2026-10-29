# 第三方授權標示

精靈動作播放（`精靈動作` 模式，`src/battle/petAnimation*.ts`、`src/components/battle/PetActionSprite.tsx`、`server/petAnimations*.ts`）實際使用下列套件。授權以 `package-lock.json` 記載為準。

| 套件 | 版本 | 授權 | 用途 |
| --- | --- | --- | --- |
| `@arkntools/unity-js` | 5.3.0 | **AGPL-3.0** | 解析 Unity 素材包（伺服器端 / 打包時） |
| `@arkntools/unity-js-tools`、`-wasm` | 3.2.0 | MIT | 上項的相依工具 |
| `@arkntools/fmod`、`@arkntools/lame-wasm` | 1.0.4 / 1.0.2 | 套件未標示授權 | `unity-js` 的傳遞相依 |
| `@seer-pet-anim/swf-bundle`、`swf-renderer` | 0.3.2 | MIT | 來自 [seer-pet-viewer](https://github.com/Nattsu39/seer-pet-viewer)（MIT）；解析並以 pixi 播放精靈片段 |
| `@seer-pet-anim/anim-export`、`battle-layout` | 0.3.2 | MIT | 同上專案的匯出與版面工具 |
| `pixi.js` | 8.19.0 | MIT | WebGL 繪製 |

## 注意事項

- **AGPL-3.0**：`@arkntools/unity-js` 為 AGPL-3.0。散佈包含它的 EXE 或網站時，須依 AGPL 提供對應原始碼並保留授權聲明；上線 / 散佈前請確認專案整體授權是否相容，或改以不含該套件的方式提供精靈動作。
- **遊戲素材**：精靈動作所播放的素材屬於其權利人（上海淘米等），本專案不附帶、不散佈，只在使用者本機讀取已取得的素材，**僅限個人使用**。
- 其餘相依套件之授權見 `package-lock.json`。
