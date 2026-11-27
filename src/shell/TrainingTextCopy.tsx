import React,{useState} from 'react';
import {Check,Copy} from 'lucide-react';
export function TrainingTextCopy({text,label='複製描述'}:{text:string;label?:string}){
 const [message,setMessage]=useState('');
 const copy=async(event:React.MouseEvent)=>{event.stopPropagation();try{await navigator.clipboard.writeText(text);setMessage('已複製');}catch{setMessage('無法存取剪貼簿，請選取描述文字複製');}};
 return <span className="inline-flex items-center gap-2"><button type="button" className="atr-icon" aria-label={label} title={label} onClick={copy} onKeyDown={e=>e.stopPropagation()}>{message==='已複製'?<Check size={14}/>:<Copy size={14}/>}</button>{message&&<small role="status" className="text-xs text-cyan-200">{message}</small>}</span>;
}
