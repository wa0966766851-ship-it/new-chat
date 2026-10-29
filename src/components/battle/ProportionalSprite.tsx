import React from "react";
import { motion } from "motion/react";
import type { Elf } from "../../types";
import { appearanceElf } from "../../battle/illusionPresentation";
import { ElfAvatar } from "../SeerImages";
import { hiddenFromViewer } from "../../battle/viewerPerspective";
import { useBattleViewMode } from "../../battle/viewerMode";
import { placeSprite, spriteHeightRatio, battleSpriteSizeRatio, BATTLE_GROUND_LIFT, type OpaqueBox, type VisibleBox } from "../../battle/spriteMetrics";
import { measureOpaqueBox as measure } from "../../battle/opaqueMeasure";
import { registerVisibleBox, notifyVisibleBoxChanged, subscribeVisibleBox, getVisibleBox, popupAnchor } from "../../battle/visibleBox";
import {animationModeFor,animationSpeed,readAnimationSettings,BATTLE_ANIMATION_EVENT} from '../../battle/animationSettings';
import {petAnimationBinding,isPetDegraded,onPetDegraded,type PetAction} from '../../battle/petAnimationRegistry';
import {battleSpriteProfile} from '../../battle/seerAssets';
import {beginPetFormTransition} from '../../battle/petFormTransitions';
import {battleFormAsset,battleFormAssets,settledFormAsset} from '../../battle/battleFormPresentation';
const PetActionSprite=React.lazy(()=>import('./PetActionSprite').then(m=>({default:m.PetActionSprite})));

/**
 * 把子層（飄字、技能名）放在該側立繪「實際可見框」上：水平置中於可見框、垂直取可見框高度的 fraction 處（自上緣往下）。
 * 位置讀 getVisibleBox（有動畫時為動畫當前包圍框）；resize、換人、載圖、動畫切換時重算；讀不到時沿用 fallbackBottom。
 */
export const AnchoredToVisible: React.FC<{ side: "p1" | "p2"; fraction: number; fallbackBottom: number; className?: string; children?: React.ReactNode; deps?: unknown }> = ({ side, fraction, fallbackBottom, className, children, deps }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const place = React.useCallback(() => {
    const el = ref.current, parent = el?.parentElement; if (!el || !parent) return;
    const box = getVisibleBox(side), pr = parent.getBoundingClientRect();
    if (!box) { el.style.removeProperty("left"); el.style.bottom = `${fallbackBottom}px`; return; }
    const a = popupAnchor(box);
    const y = box.top + (box.bottom - box.top) * fraction;
    el.style.left = `${a.x - pr.left}px`;
    el.style.bottom = `${Math.max(0, pr.bottom - y)}px`;
  }, [side, fraction, fallbackBottom]);
  React.useLayoutEffect(() => { place(); }, [place, deps, children]);
  React.useEffect(() => subscribeVisibleBox(place), [place]);
  return <div ref={ref} className={className} style={{ bottom: fallbackBottom }}>{children}</div>;
};

/**
 * 依身高比例擺放的戰鬥立繪：量測圖片實際不透明區域，讓可見部分高度＝場地高 × 身高比例，腳底貼地、水平置中於錨點。
 * overlay 取得可見高度（px），用來把受擊數字、技能名放在立繪上方。
 */
interface ProportionalSpriteProps {
  elf: Elf; side: "p1" | "p2"; anchorX: number; stageW: number; stageH: number;
  anim: any; dead: boolean; opacity: number;
  appearanceState?:Record<string,unknown>;
  action?:PetAction;actionToken?:unknown;
  canvasW?:number;
  targetX?:number;heightRatio?:number;
  fieldH?:number;
  overlay: (visibleHeight: number) => React.ReactNode;
}
export const ProportionalSprite: React.FC<ProportionalSpriteProps> = ({ elf, side, anchorX, stageW, stageH, anim, dead, opacity, overlay,appearanceState,action='standby',actionToken,canvasW,targetX,heightRatio,fieldH }) => {
  const disguised=!!elf.illusion;
  elf = appearanceElf(elf);
  const requestedAsset=battleFormAsset(elf,disguised?undefined:appearanceState);
  const [form,setForm]=React.useState<{asset:typeof requestedAsset;enter:boolean;finish?:()=>void}>({asset:requestedAsset,enter:false});
  // 隱匿：不可見方只顯示共用鬼影，不載入真實動作模型，也不依真實身高決定大小。
  const concealed = hiddenFromViewer(elf, side, useBattleViewMode());
  const wrap = React.useRef<HTMLDivElement>(null);
  const [m, setM] = React.useState<{ src: string; box: OpaqueBox; mirrored: boolean } | null>(null);
  const [fallback, setFallback] = React.useState(false);
  const [settings,setSettings]=React.useState(readAnimationSettings);
  const [actionReady,setActionReady]=React.useState(false);
  const [degradedTick,setDegradedTick]=React.useState(0);
  React.useEffect(()=>onPetDegraded(()=>setDegradedTick(n=>n+1)),[]);
  React.useEffect(()=>{const refresh=()=>setSettings(readAnimationSettings());window.addEventListener(BATTLE_ANIMATION_EVENT,refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener(BATTLE_ANIMATION_EVENT,refresh);window.removeEventListener('storage',refresh);};},[]);
  const mode=animationModeFor(settings,elf);
  const useActions=!concealed&&mode==='actions'&&settings.skill&&!!form.asset&&!dead&&opacity>0&&!(degradedTick>=0&&isPetDegraded(side,elf));
  const showActions=useActions&&actionReady;
  const preloadIds=battleFormAssets(elf).join('|');
  const [formsReady,setFormsReady]=React.useState(!preloadIds);
  // 同一精靈的型態共用同一個尺寸基準（以基礎型態的待機本體高為分母），避免變身後縮小。
  const [sizeRef,setSizeRef]=React.useState<number|undefined>(undefined);
  React.useEffect(()=>{
    if(!useActions||!preloadIds)return;
    let alive=true;const leases:{release:()=>void}[]=[];setFormsReady(false);
    void import('../../battle/petAnimationLoader').then(async({acquirePetClip})=>{
      if(!alive)return;
      const clips=battleFormAssets(elf).map(id=>{const lease=acquirePetClip(id);leases.push(lease);return lease.clip;});
      const [baseClip]=await Promise.all(clips);if(!alive)return;
      const {nativeRestBounds}=await import('../../battle/petAnimationGeometry');
      const frames=(baseClip as any)?.sequences?.find((s:any)=>s.name==='standby')?.frames||[];
      const box=nativeRestBounds(frames.map((fr:any)=>fr.mesh));
      if(alive&&box&&box.bottom>box.top)setSizeRef(box.bottom-box.top);
      if(alive)setFormsReady(true);
    }).catch(error=>{if(alive)console.warn('[pet-forms] 型態預載未完成，切換時重試',error);});
    return()=>{alive=false;leases.forEach(lease=>lease.release());};
  },[useActions,preloadIds,elf.battleId]);
  // 兩段式切換：先在「目前素材」播它自己的 transform，播完才換外觀 → 極速↔毀滅 雙向都有變身演出。
  React.useEffect(()=>{
    if(settledFormAsset(form.asset,requestedAsset,action)===form.asset)return;
    if(!useActions||!form.asset){setForm({asset:requestedAsset,enter:false});return;}
    const release=beginPetFormTransition(side,elf);
    setForm(prev=>({asset:prev.asset,enter:true,finish:()=>{setForm({asset:requestedAsset,enter:false});release();}}));
  },[requestedAsset,action,form.asset,useActions,side,elf.battleId]);

  // 量測：圖片載入後量一次；圖片來源改變（備援鏈切換）時才重量。不輪詢，避免戰鬥中持續耗用。
  React.useEffect(() => {
    let alive = true;
    const root = wrap.current; if (!root) return;
    const pendingLoads = new Map<HTMLImageElement, EventListener>();
    const check = () => {
      if (!alive) return;
      const img = root.querySelector("img");
      if (!img) { setM(null); setFallback(true); return; }
      const source = img.src;
      // 換圖尚未載入時，不得沿用上一張的可見區域、位置與大小。
      setM(prev => prev && prev.src !== source ? null : prev);
      setFallback(false);
      const done = () => {
        if (!alive || !root.contains(img) || img.src !== source || !img.naturalWidth) return;
        const src = img.currentSrc || img.src;
        const mirrored = /scaleX\(-1\)/.test(img.style.transform || "");
        setFallback(false);
        setM(prev => prev && prev.src === src && prev.mirrored === mirrored ? prev : { src, box: measure(img), mirrored });
      };
      const previous = pendingLoads.get(img);
      if (previous) img.removeEventListener("load", previous);
      pendingLoads.delete(img);
      if (img.complete) done(); else {
        pendingLoads.set(img, done);
        img.addEventListener("load", done, { once: true });
      }
    };
    check();
    const mo = new MutationObserver(records => {
      // 同一網址的P1/P2反轉也需要重量；不因外層動作動畫反覆量圖。
      if (records.some(r => r.type === "childList" || (r.target as Element).tagName === "IMG")) check();
    });
    mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "style"] });
    const t = setTimeout(() => { if (alive && !root.querySelector("img")) setFallback(true); }, 1200);
    return () => {
      alive = false; mo.disconnect(); clearTimeout(t);
      pendingLoads.forEach((handler, img) => img.removeEventListener("load", handler));
    };
  }, [elf.battleId, elf.id, elf.name, elf.path, elf.skinId, side]);

  const profile=concealed?null:battleSpriteProfile(elf.name,m?.src),colossal=profile?.framing==='colossal';
  // 所有立繪（含首領）一律以同一塊場地高度為基準；首領只透過 heightRatio 略高，
  // 不再另外換用更大的場地高度，否則實際高度會變成一般精靈的兩倍、頂端直接穿出畫面。
  const layoutH=stageH;
  const ratio = concealed ? battleSpriteSizeRatio(NaN) : heightRatio??profile?.heightRatio??battleSpriteSizeRatio(Number(elf.height));
  const place = m && layoutH > 0 ? placeSprite(m.box, stageW, layoutH, ratio, 1, m.mirrored, colossal?'colossal':'area') : null;
  // 首領（咤克斯）比場地高：多出來的高度往下沉，頭頂留在場地上緣、腳底被下緣裁掉，
  // 與原廠實戰畫面一致；往上長就會變成「太上去了」。
  const fbSize = Math.min(stageW, stageH * 0.45);
  // 靜態圖缺檔時，原生動畫仍按本體比例擺放，不能繼承佔位頭像的小方框。
  const visible = place ? (m!.box.bottom - m!.box.top) * place.scale : useActions ? layoutH*ratio : fbSize;
  // 下沉量以「可見高度」為準（整張圖高含透明邊，用它會多沉幾個 px，頭頂就跑出場地上緣）。
  const sink = place && colossal ? Math.max(0, visible - stageH) * (profile?.sink ?? 0) : 0;
  const displayAnchor=anchorX+(side==='p1'?-1:1)*visible*(profile?.outward??0);
  const style: React.CSSProperties = place
    ? { position: "absolute", left: place.offsetX, bottom: place.offsetBottom - sink, width: place.width, height: place.height }
    : { position: "absolute", left: -fbSize / 2, bottom: 0, width: fbSize, height: fbSize, opacity: fallback ? 1 : 0 };
  // 驗收用：靜態立繪「不透明區域」相對本精靈外層 div 的幾何（px，y 以場地下緣為 0、往上為正）。
  // 原生動畫的待機框必須落在同一個矩形，切換演出模式時才不會位移或跳大小。
  const opaque = place ? (() => { const box = m!.box, s = place.scale, base = place.offsetBottom - sink;
    const l = mirroredX => place.offsetX + (mirroredX ? box.w - box.right : box.left) * s;
    const r = mirroredX => place.offsetX + (mirroredX ? box.w - box.left : box.right) * s;
    return { left: l(m!.mirrored), right: r(m!.mirrored), bottomY: base + (box.h - box.bottom) * s, topY: base + (box.h - box.top) * s };
  })() : null;

  // 登錄靜態立繪的可見框（DOM 包圍框扣除透明邊）；版面、換圖、載入完成後通知重算。
  React.useEffect(() => {
    if (!m || !place) return;
    const box = m.box, mirrored = m.mirrored;
    return registerVisibleBox(side, 'image', (): VisibleBox | null => {
      const img = wrap.current?.querySelector('img'); if (!img || opacity === 0) return null;
      const r = img.getBoundingClientRect(); if (!r.width || !r.height) return null;
      const sx = r.width / box.w, sy = r.height / box.h;
      const l = mirrored ? box.w - box.right : box.left, rr = mirrored ? box.w - box.left : box.right;
      return { left: r.left + l * sx, right: r.left + rr * sx, top: r.top + box.top * sy, bottom: r.top + box.bottom * sy };
    });
  }, [side, m, place?.width, place?.height, place?.offsetX, anchorX, stageW, stageH, opacity]);
  React.useEffect(() => { notifyVisibleBoxChanged(); }, [action, showActions, dead]);

  return (
    <div className="absolute bottom-0 pointer-events-none" style={{ left: displayAnchor, bottom:colossal?0:stageH*BATTLE_GROUND_LIFT, opacity, zIndex:showActions&&action!=='standby'?25:undefined, display: opacity === 0 ? "none" : undefined }} data-form-assets-ready={formsReady} data-sprite-side={side} data-sprite-ratio={ratio.toFixed(2)} data-sprite-visible={visible.toFixed(1)} data-sprite-opaque={opaque ? `${opaque.left.toFixed(1)},${opaque.right.toFixed(1)},${opaque.bottomY.toFixed(1)},${opaque.topY.toFixed(1)}` : undefined} data-sprite-sink={sink.toFixed(1)}>
      <motion.div ref={wrap} animate={mode==='static'||showActions?{x:0,filter:'brightness(1)'}:anim} transition={{ duration: 0.35/animationSpeed(settings.speed) }} style={{...style,visibility:showActions?'hidden':undefined}}
        className={`${dead ? "opacity-30 grayscale" : ""} will-change-transform`}>
        <ElfAvatar elf={elf} kind="body" battleSide={side} className="w-full h-full object-fill"
          fallbackClassName="w-full h-full rounded-full overflow-hidden ring-2 ring-white/15 flex items-center justify-center text-5xl font-black text-slate-200 bg-black/20" />
      </motion.div>
      {useActions&&<React.Suspense fallback={null}><PetActionSprite assetId={form.asset!} enterTransform={form.enter} onTransitionEnd={form.finish} key={`${form.asset}:${elf.battleId||elf.id}:${elf.skinId||''}:${form.enter?1:0}`} sizeRefHeight={sizeRef} elf={elf} side={side} action={action} actionToken={actionToken} width={stageW*(colossal?3:1)} height={Math.max(1,visible)} viewport={canvasW?{width:canvasW,height:colossal?Math.max(layoutH,visible):stageH,anchorX:displayAnchor,targetX}:undefined} onReady={setActionReady} sink={sink}/></React.Suspense>}
      <div className="absolute left-1/2 -translate-x-1/2 w-40 h-4 rounded-[50%] bg-black/35 blur-md -z-10" style={{ bottom: -6 }} />
      {useActions&&!showActions&&<span role="status" className="absolute bottom-4 left-0 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950/80 px-2 py-1 text-xs text-cyan-200">動作載入中，仍可選擇技能</span>}
      {useActions&&preloadIds&&!formsReady&&<span role="status" className="absolute bottom-10 left-0 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950/80 px-2 py-1 text-xs text-cyan-200">型態素材準備中</span>}
      {overlay(visible)}
    </div>
  );
};
