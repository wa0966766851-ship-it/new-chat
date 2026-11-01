export let clip:any=null;
export const setFakeClip=(value:any)=>{clip=value;};
export const acquirePetClip=()=>({clip:Promise.resolve(clip),release(){}});
