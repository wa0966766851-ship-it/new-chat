import React,{lazy,Suspense} from 'react';
import type {ShellBridge} from '../bridge';
import '../art/aegisWorkshop.css';
const Editor=lazy(()=>import('../../components/ElfEditor'));
/** One authoring controller and validation pipeline, with a native Aegis workspace. */
export function AegisElfWorkshop({b}:{b:ShellBridge}){
 const back=()=>{b.setEditingElf(null);b.setEditorTab(undefined);b.setView('bag');};
 return <Suspense fallback={<p className="p-6 text-cyan-200">載入精靈工作坊…</p>}><Editor key={(b.editingElf?.id||'new')+(b.editorTab||'')} presentation="aegis" initialElf={b.editingElf||undefined} initialTab={b.editorTab} onBack={back} onSaveElf={elf=>{b.updateElf(elf);back();}}/></Suspense>;
}
