import assert from 'node:assert/strict';
import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const REQUIRED_WEB_STEPS = ['Run npm ci', 'Run npm run lint', 'Run npm test',
  'Run node --import tsx tests/updates.semantic.test.ts', 'Run npm run build', 'Run npm run audit:bundle',
  'Run node scripts/prepare_web_package.mjs', 'Run node tests/webPackage.semantic.test.mjs', 'Run actions/upload-artifact@v4'];
export function verifiedWebArtifact(run, jobs, artifacts, repository) {
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.event, 'workflow_dispatch');
  assert.equal(run.path, '.github/workflows/build-web-package.yml');
  assert.equal(run.head_repository?.full_name, repository);
  assert.match(run.head_sha, /^[a-f0-9]{40}$/);
  const builds=jobs.filter(j=>j.name==='build'); assert.equal(builds.length,1);
  const steps=builds[0].steps;
  for(const name of REQUIRED_WEB_STEPS) assert.ok(steps.some(s=>s.name===name&&s.conclusion==='success'), `尚未通過：${name}`);
  const failures=steps.filter(s=>s.conclusion==='failure');
  assert.equal(failures.length,1); assert.equal(failures[0].name,'Publish verified package to original protected site');
  const matches=artifacts.filter(a=>a.name===`seer-web-${run.head_sha}`&&a.expired===false);
  assert.equal(matches.length,1); assert.ok(Number.isSafeInteger(matches[0].id)&&matches[0].id>0);
  assert.match(matches[0].digest,/^sha256:[a-f0-9]{64}$/);
  return {commit:run.head_sha,artifact:matches[0]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const id=process.env.RESUME_RUN_ID, repository=process.env.GITHUB_REPOSITORY;
    assert.match(id??'',/^[1-9][0-9]{0,19}$/); assert.match(repository??'',/^[\w.-]+\/[\w.-]+$/);
    const get=async path=>{
      const r=await fetch(`https://api.github.com/repos/${repository}/actions/runs/${id}${path}`,{
        headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
      if(!r.ok)throw Error(`無法核對既有發布成果（${r.status}）`);return r.json();
    };
    const [run,jobs,artifacts]=await Promise.all([get(''),get('/jobs?per_page=100'),get('/artifacts?per_page=100')]);
    const valid=verifiedWebArtifact(run,jobs.jobs,artifacts.artifacts,repository);
    appendFileSync(process.env.GITHUB_OUTPUT,`commit=${valid.commit}\nartifact_name=${valid.artifact.name}\n`);
    console.log(`已核對 ${id}：完整測試與套件校驗通過，僅發布失敗；成品 ${valid.commit}`);
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
