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
  }
};

export type SceneResourceMap = Record<string, { bg: string; bgm: string; name: string }>;

export function getSceneResources(): SceneResourceMap {
  try {
    const saved = localStorage.getItem('seer_scene_resources');
    if (saved) {
      return JSON.parse(saved);
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
