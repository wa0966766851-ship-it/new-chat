import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try{
 const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const over=DEFAULT_ELVES.filter((e:any)=>e.skills.length>5).map((e:any)=>({id:e.id,name:e.name,equipped:e.skills.length,pool:e.skillPool?.length||0,skills:e.skills.map((s:any)=>s.name)}));
 console.log(JSON.stringify({elves:DEFAULT_ELVES.length,overFive:over},null,2));
 if(over.length)process.exitCode=1;
}finally{await server.close();}
