import { SOURCE_TEXT } from './src/data/descriptionSources.ts';
const st:any = (SOURCE_TEXT as any)['5036'];
console.log('5036 in SOURCE_TEXT:', !!st);
if(st) console.log('keys:', Object.keys(st));
