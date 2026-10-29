import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export function assertBuildChild(root, target, parent = 'build') {
 const base=path.resolve(root,parent), resolved=path.resolve(target), rel=path.relative(base,resolved);
 if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('建置清理路徑越界：'+resolved);
 for(let ancestor=base;;ancestor=path.dirname(ancestor)){
  if(fs.existsSync(ancestor)&&fs.lstatSync(ancestor).isSymbolicLink())throw Error('建置路徑不可為連結：'+ancestor);
  if(ancestor===path.dirname(ancestor))break;
 }
 for(let cur=base;;){if(fs.existsSync(cur)&&fs.lstatSync(cur).isSymbolicLink())throw Error('建置路徑不可為連結：'+cur);if(cur===resolved)break;const next=path.relative(cur,resolved).split(path.sep)[0];cur=path.join(cur,next);}
 return resolved;
}
export function createBuildWorkspace(root, kind) {
 if(!/^[a-z-]+$/.test(kind))throw Error('無效建置用途');
 const parent=path.join(root,'build','.work');assertBuildChild(root,parent);fs.mkdirSync(parent,{recursive:true});
 const dir=fs.mkdtempSync(path.join(parent,kind+'-'));
 fs.writeFileSync(path.join(dir,'.build-workspace.json'),JSON.stringify({root:path.resolve(root),kind,id:randomUUID(),createdAt:new Date().toISOString()}));
 return dir;
}
export function removeBuildWorkspace(root, dir) {
 const target=assertBuildChild(root,dir);const marker=JSON.parse(fs.readFileSync(path.join(target,'.build-workspace.json'),'utf8'));
 if(marker.root!==path.resolve(root))throw Error('暫存目錄擁有者不符');
 // 不跟隨任何子連結。rm只移除目錄項目；根與祖先皆已核對。
 fs.rmSync(target,{recursive:true,force:true,maxRetries:3,retryDelay:250});
}
