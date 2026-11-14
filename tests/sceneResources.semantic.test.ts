// 頁面背景／音樂設定（2026-11-07）：舊存檔逐頁合併預設；星蝕回廊（大廳與戰鬥）專屬背景音樂；控制中心頁面鍵。
import assert from 'node:assert/strict';
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
const { getSceneResources, DEFAULT_SCENE_RESOURCES } = await import('../src/utils/resourceManager');
const { controlScene } = await import('../src/shell/bridge');
const { parseMusicSource } = await import('../src/utils/musicSource');
const { bilibiliEmbedUrl } = await import('../src/components/useMusicPlayer');
// 一、星蝕回廊專屬 BGM
for (const key of ['interstellar_exploration', 'eclipse_battle']) {
  const src = parseMusicSource(DEFAULT_SCENE_RESOURCES[key].bgm);
  assert.deepEqual(src, { type: 'bilibili', id: 'BV1QM836hEBB', page: 1 }, key);
}
// 二、舊存檔只有舊頁面：新頁面與預設音樂補上；已存的自訂值保留（含刻意清空）
store.set('seer_scene_resources', JSON.stringify({ start: { bg: 'my.jpg', bgm: 'abcdefghijk', name: '首頁' }, battle: { bg: '', bgm: '', name: '戰鬥' } }));
const r = getSceneResources();
assert.equal(r.start.bg, 'my.jpg'); assert.equal(r.start.bgm, 'abcdefghijk');
assert.equal(r.battle.bgm, '', '使用者清空的音樂不被預設蓋回');
assert.equal(r.interstellar_exploration.bgm, 'BV1QM836hEBB', '舊存檔也有星蝕回廊音樂');
for (const key of Object.keys(DEFAULT_SCENE_RESOURCES)) assert.ok(r[key], `補上 ${key}`);
// 三、控制中心頁面鍵：星蝕回廊戰鬥獨立
assert.equal(controlScene({ showEncyclopedia: false, view: 'battle', specialMode: 'interstellar' } as any), 'eclipse_battle');
assert.equal(controlScene({ showEncyclopedia: false, view: 'battle', specialMode: undefined } as any), 'battle');
assert.equal(controlScene({ showEncyclopedia: true, view: 'start', specialMode: undefined } as any), 'encyclopedia');
// 四、B站嵌入：低畫質、關彈幕
assert.match(bilibiliEmbedUrl('BV1QM836hEBB', 1, false), /high_quality=0/);
assert.match(bilibiliEmbedUrl('BV1QM836hEBB', 1, false), /danmaku=0/);
// 五、全部頁面背景／主題偏好：保存後重開仍在；清除即移除
const { themeParams, saveThemeParams } = await import('../src/utils/themePrefs');
saveThemeParams({ bg: 'https://example.com/wall.jpg', theme: 'day', unknown: 'x' } as any);
assert.equal(themeParams().get('bg'), 'https://example.com/wall.jpg'); assert.equal(themeParams().get('theme'), 'day');
assert.equal(themeParams().get('unknown'), null, '只保存外觀欄位');
saveThemeParams({ bg: null }); assert.equal(themeParams().get('bg'), null);
console.log('頁面背景／音樂設定：舊存檔合併、星蝕回廊專屬音樂、控制中心頁面鍵、B站低畫質 通過');
