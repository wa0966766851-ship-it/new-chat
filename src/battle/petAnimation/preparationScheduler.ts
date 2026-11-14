/** 在工作片段之間交還主執行緒；不改影格、材質或播放時間。 */
export const yieldPetTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
export async function finishPetPreparation<T>(steps:Generator<void,T>,signal?:AbortSignal,budgetMs=4):Promise<T>{
 let deadline=performance.now()+budgetMs;
 while(true){signal?.throwIfAborted();const step=steps.next();if(step.done)return step.value;
  if(performance.now()>=deadline){await yieldPetTask();deadline=performance.now()+budgetMs;}
 }
}
