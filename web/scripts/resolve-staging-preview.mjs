import {appendFile} from 'node:fs/promises';
import {findStagingPreview,requireCommitSha} from './visual-evidence-provenance.mjs';

const sourceCommitSha=requireCommitSha(process.env.AUDIT_SOURCE_SHA,'AUDIT_SOURCE_SHA');
const repository=process.env.GITHUB_REPOSITORY;
const token=process.env.GH_TOKEN;
if(!repository||!token)throw new Error('GITHUB_REPOSITORY and GH_TOKEN are required to resolve the Staging check for this commit');

const endpoint=`https://api.github.com/repos/${repository}/commits/${sourceCommitSha}/check-runs?per_page=100`;
for(let attempt=1;attempt<=60;attempt++){
 const response=await fetch(endpoint,{
  headers:{
   accept:'application/vnd.github+json',
   authorization:`Bearer ${token}`,
   'x-github-api-version':'2022-11-28',
  },
  signal:AbortSignal.timeout(15000),
 });
 if(!response.ok)throw new Error(`GITHUB_CHECKS_UNAVAILABLE: GitHub returned HTTP ${response.status} while resolving Cloudflare Staging for ${sourceCommitSha}`);
 const result=findStagingPreview((await response.json()).check_runs||[],sourceCommitSha);
 if(result.status==='ready'){
  await appendFile(process.env.GITHUB_OUTPUT,`preview_url=${result.previewUrl}\n`);
  process.stdout.write(`Resolved Staging preview for ${sourceCommitSha}: ${result.previewUrl}\n`);
  process.exit(0);
 }
 process.stdout.write(`Waiting for ${process.env.AUDIT_SOURCE_SHA} Cloudflare Staging check (${attempt}/60)\n`);
 await new Promise(resolve=>setTimeout(resolve,15000));
}
throw new Error(`CLOUDFLARE_PREVIEW_UNAVAILABLE: no successful ${'Cloudflare Pages: sekka-staging-web'} check appeared for ${sourceCommitSha} within 15 minutes`);
