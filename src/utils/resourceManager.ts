import { useEffect, useState } from 'react';

export const DEFAULT_SCENE_RESOURCES: Record<string, { bg: string; bgm: string; name: string }> = {
  start: {
    bg: "https://scientieic-american-media.s3.ap-northeast-1.amazonaws.com/posts/2026/02/29e4d8b0-928c-413d-ae25-04dd3752e49d.jpg",
    bgm: "wJ8onQryXRY",
    name: "首頁星際殿堂",
  },
  destiny_wheel: {
    bg: "https://scientieic-american-media.s3.ap-northeast-1.amazonaws.com/posts/2026/02/29e4d8b0-928c-413d-ae25-04dd3752e49d.jpg",
    bgm: "BV1uh411Y73e", // Bilibili
    name: "命運之輪殿堂",
  },
  encyclopedia: {
    bg: "https://scientieic-american-media.s3.ap-northeast-1.amazonaws.com/posts/2026/02/29e4d8b0-928c-413d-ae25-04dd3752e49d.jpg",
    bgm: "", 
    name: "戰鬥百科資料庫",
  },
  battle: {
    bg: "https://img.bizhiciyuan.com/item/69bab6ceb96fa53fd04c681d/6fd594e8ad7aa05d95b12a22cf32a634.jpg",
    bgm: "RjYnSIzR9Bo",
    name: "精靈實戰決鬥場",
  },
  custom: {
    bg: "",
    bgm: "",
    name: "精靈培育自訂實驗室",
  },
  test_runner: {
    bg: "https://scientieic-american-media.s3.ap-northeast-1.amazonaws.com/posts/2026/02/29e4d8b0-928c-413d-ae25-04dd3752e49d.jpg",
    bgm: "",
    name: "自動測試環境",
  },
  // 2026-11-07：補齊可設定的頁面；星蝕回廊（大廳與戰鬥）專屬背景音樂。
  bag: { bg: "", bgm: "", name: "背包與出戰設定" },
  updates: { bg: "", bgm: "", name: "更新與精靈" },
  interstellar_exploration: { bg: "", bgm: "BV1QM836hEBB", name: "星蝕回廊" },
  eclipse_battle: { bg: "", bgm: "BV1QM836hEBB", name: "星蝕回廊・戰鬥" },
};

export type SceneResourceMap = Record<string, { bg: string; bgm: string; name: string }>;

export function getSceneResources(): SceneResourceMap {
  try {
    const saved = localStorage.getItem('seer_scene_resources');
    if (saved) {
      // 舊存檔只有當時的頁面：逐頁合併預設，之後新增的頁面（含預設音樂）才會出現；已存的自訂值優先。
      const parsed = JSON.parse(saved) || {};
      const merged: SceneResourceMap = {};
      for (const key of new Set([...Object.keys(DEFAULT_SCENE_RESOURCES), ...Object.keys(parsed)]))
        merged[key] = { ...(DEFAULT_SCENE_RESOURCES[key] || { bg: '', bgm: '', name: key }), ...(parsed[key] || {}) };
      return merged;
    }
  } catch {}
  return DEFAULT_SCENE_RESOURCES;
}

export function saveSceneResources(resources: SceneResourceMap) {
  localStorage.setItem('seer_scene_resources', JSON.stringify(resources));
  window.dispatchEvent(new Event('resource-update'));
}

export function useSceneResources() {
  const [resources, setResources] = useState<SceneResourceMap>(getSceneResources());

  useEffect(() => {
    const handleUpdate = () => {
      setResources(getSceneResources());
    };
    window.addEventListener('resource-update', handleUpdate);
    return () => window.removeEventListener('resource-update', handleUpdate);
  }, []);

  return resources;
}
