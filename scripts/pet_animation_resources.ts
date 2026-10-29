import {createPetAnimationCache,PET_BUNDLES} from '../server/petAnimationCache';
const cache=createPetAnimationCache({remote:process.argv.includes('--offline')?false:undefined});
if(process.argv.includes('--prepare'))await Promise.all((Object.keys(PET_BUNDLES) as (keyof typeof PET_BUNDLES)[]).map(key=>cache.acquire(key)));
const ready=Object.fromEntries(await Promise.all((Object.keys(PET_BUNDLES) as (keyof typeof PET_BUNDLES)[]).map(async key=>[key,!!await cache.cached(key)])));
console.log(JSON.stringify({directory:cache.directory,remote:cache.remote,ready,...await cache.status()},null,2));
