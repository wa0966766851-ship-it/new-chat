import assert from 'node:assert/strict';
import {verifiedWebArtifact,REQUIRED_WEB_STEPS} from '../scripts/verified_web_run.mjs';
const repository='owner/repo',sha='a'.repeat(40);
const fixture=()=>({run:{status:'completed',conclusion:'failure',event:'workflow_dispatch',path:'.github/workflows/build-web-package.yml',head_repository:{full_name:repository},head_sha:sha},
  jobs:[{name:'build',steps:[...REQUIRED_WEB_STEPS.map(name=>({name,conclusion:'success'})),{name:'Publish verified package to original protected site',conclusion:'failure'}]}],
  artifacts:[{id:123,name:`seer-web-${sha}`,expired:false,digest:`sha256:${'b'.repeat(64)}`}]});
const check=x=>verifiedWebArtifact(x.run,x.jobs,x.artifacts,repository);
assert.equal(check(fixture()).commit,sha);
let rejected=0;
for(const name of REQUIRED_WEB_STEPS){const x=fixture();x.jobs[0].steps.find(s=>s.name===name).conclusion='skipped';assert.throws(()=>check(x));rejected++;}
for(const mutate of [
  x=>x.run.status='in_progress',x=>x.run.conclusion='success',x=>x.run.event='pull_request',
  x=>x.run.path='.github/workflows/other.yml',x=>x.run.head_repository.full_name='fork/repo',x=>x.run.head_sha='bad',
  x=>x.jobs=[],x=>x.jobs.push(structuredClone(x.jobs[0])),
  x=>x.jobs[0].steps.push({name:'Other failure',conclusion:'failure'}),
  x=>x.jobs[0].steps.at(-1).name='Run npm test',x=>x.artifacts[0].expired=true,
  x=>x.artifacts[0].name=`seer-web-${'c'.repeat(40)}`,x=>x.artifacts=[],
  x=>x.artifacts.push(structuredClone(x.artifacts[0])),x=>x.artifacts[0].digest='bad',x=>delete x.artifacts[0].expired,
]){const x=fixture();mutate(x);assert.throws(()=>check(x));rejected++;}
console.log(`已驗證成品重試：合法成果及${rejected}項缺檢查／來源不符／過期／其他失敗拒絕通過。`);
