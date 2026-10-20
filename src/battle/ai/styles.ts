import type { AIStyle, AIRisk } from './types';
/** 決策偏好，不改戰鬥規則；死亡／勝敗不因風格折價。 */
export const AI_STYLES: Record<AIStyle, {label:string;description:string;aggression:number;own:Record<string,number>;enemy:Record<string,number>}> = {
  balanced:{label:'均衡',description:'兼顧輸出、生存與資源，優先整體局面。',aggression:0.6,own:{},enemy:{}},
  aggressive:{label:'強攻',description:'偏向壓低對手體力與進攻強化，減少無必要鋪場。',aggression:0.95,own:{hp:0.9,shield:0.65,barrier:0.65,protection:0.7,stage:1.1},enemy:{hp:1.5,shield:1.25,barrier:1.25}},
  defensive:{label:'穩守',description:'偏向存活、護盾與抵擋，在威脅下先保住戰力。',aggression:0.3,own:{hp:1.4,shield:1.4,barrier:1.4,protection:1.5},enemy:{hp:0.7}},
  disruptive:{label:'干擾',description:'偏向控制、封鎖與削弱對手PP，再建立進攻機會。',aggression:0.45,own:{protection:1.2},enemy:{status:2.4,restriction:2,pp:2,stage:1.2,hp:0.8}},
  sustain:{label:'續航',description:'偏向體力與PP恢復，避免無效回復及浪費藥劑。',aggression:0.4,own:{hp:1.6,pp:1.8,inventory:1.5,stage:0.6,shield:0.8,barrier:0.8},enemy:{hp:0.8}},
  attrition:{label:'磨盤',description:'巀峰拖時：控場到底、防禦最穩，50回合到期以存活數定勝負，不以擊殺為目標。',aggression:0.2,own:{hp:1.6,shield:1.6,barrier:1.6,protection:1.6,inventory:1.2},enemy:{status:3,restriction:2.6,pp:2.2,hp:0.5,shield:0.8,barrier:0.8}},
};
export function metricPreference(style:AIStyle,key:string,own:boolean):number {
  if(key==='death'||key==='terminal')return 1;
  return (own?AI_STYLES[style].own:AI_STYLES[style].enemy)[key]??1;
}
export const AI_RISKS: Record<AIRisk,{label:string;description:string;downside:number;upside:number}> = {
  conservative:{label:'保守',description:'偏重最差回應下的勝算；有穩定進攻機會就進攻。',downside:0.85,upside:0},
  balanced:{label:'標準',description:'兼顧平均收益與不利結果。',downside:0.45,upside:0},
  reckless:{label:'激進',description:'願意押高收益波動；可冒險強攻，也可押高收益防守。',downside:0,upside:0.4},
};
export function riskAdjustedScore(mean:number,worst:number,best:number,risk:AIRisk='balanced'):number {
  const p=AI_RISKS[risk];return mean*(1-p.downside-p.upside)+worst*p.downside+best*p.upside;
}
