import React from 'react';
/** 測試替身：只回報收到的寬高與 onReady，不載入 pixi／素材。 */
export function PetActionSprite({width,height,onReady,context}:{width:number;height:number;onReady:(v:boolean)=>void;context?:string}){
 React.useEffect(()=>{const test=globalThis as any;if(test.__petTestHoldReady)test.__petTestResolveReady=()=>onReady(true);else onReady(true);return()=>onReady(false);},[]);
 return <div data-fake-pet data-context={context} data-w={width} data-h={height}/>;
}
