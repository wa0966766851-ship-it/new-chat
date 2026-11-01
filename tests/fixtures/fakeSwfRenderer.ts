/** 測試替身：不碰 WebGL。記錄每個播放器的掛載／序列／變換，供 PetActionSprite 整合測試檢查。 */
export const instances:any[]=[];
export class SwfPlayer{
 parent!:HTMLElement;clip:any;destroyed=false;calls:any[]=[];transforms:any[]=[];playing=true;advanced=0;draws=0;current='';listeners=new Set<any>();onFrame:any;
 async mount(parent:HTMLElement,clip:any,options:any){this.parent=parent;this.clip=clip;this.options=options;instances.push(this);const c=parent.ownerDocument.createElement('canvas');c.dataset.fake='1';parent.appendChild(c);}
 options:any;
 setOnFrameChange(cb:any){this.onFrame=cb;}
 getSequences(){return this.clip.sequences.map((s:any)=>({name:s.name,duration:s.frames.length/this.clip.frameRate,markers:[]}));}
 playSequence(name:string,options?:any){this.current=name;this.calls.push(['play',name,!!options?.loop]);return {} as any;}
 subscribe(l:any){this.listeners.add(l);return()=>this.listeners.delete(l);}
 setFixedTransform(position:any,scale:any){this.transforms.push({position,scale});}
 advance(dt:number){this.advanced+=dt;}draw(){this.draws++;}
 play(){this.playing=true;}pause(){this.playing=false;}
 destroy(){this.destroyed=true;this.parent?.querySelectorAll('canvas').forEach(c=>c.remove());}
 emit(event:any){for(const l of this.listeners)l(event);}
}
