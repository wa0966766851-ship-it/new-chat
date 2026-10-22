// 只解讀 Git 歷史中的字面量，不執行舊版專案程式。
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const revision='0e340a43e48bd05ebbe144a2c4237b522c0c66e8';
const file='src/data/defaultElves.ts';
const source=ts.createSourceFile(file,execFileSync('git',['show',`${revision}:${file}`],{encoding:'utf8'}),ts.ScriptTarget.Latest,true);
function literal(n){
  if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))return n.text;
  if(ts.isNumericLiteral(n))return Number(n.text);
  if(n.kind===ts.SyntaxKind.TrueKeyword)return true;
  if(n.kind===ts.SyntaxKind.FalseKeyword)return false;
  if(ts.isPrefixUnaryExpression(n)&&n.operator===ts.SyntaxKind.MinusToken)return -literal(n.operand);
  if(ts.isArrayLiteralExpression(n))return n.elements.map(literal);
  if(ts.isObjectLiteralExpression(n))return Object.fromEntries(n.properties.map(p=>{if(!ts.isPropertyAssignment(p))throw Error('non-literal');return [p.name.text,literal(p.initializer)];}));
  throw Error('non-literal');
}
const definitions=[];
function visit(n){
  if(ts.isObjectLiteralExpression(n)){
    const get=k=>n.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.text===k)?.initializer;
    if(get('id')&&get('name')&&get('kit')&&get('soulMark'))try{
      const kit=literal(get('kit')).filter(e=>e.source!=='skill');
      const soul=get('soulMark').properties.find(p=>p.name.text==='name');
      if(kit.length&&soul)definitions.push({elfId:String(literal(get('id'))),elfName:literal(get('name')),soulName:literal(soul.initializer),kit});
    }catch{/* 動態內容不認領。 */}
  }
  ts.forEachChild(n,visit);
}
visit(source);
writeFileSync('src/data/legacySoulKitFingerprints.json',JSON.stringify({revision,file,definitions},null,2)+'\n');
console.log(`歷史魂印積木指紋 ${definitions.length} 份`);
