import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 CANONICAL_SCREEN_COUNT,
 CANONICAL_SCREEN_IDS,
 VISUAL_VARIANTS,
 createCaptureMetadata,
 findStagingPreview,
 originalGalleryPath,
 requireCommitSha,
 screenId,
 screenStateCategory,
 verifyDeployment,
} from './visual-evidence-provenance.mjs';

const expectedSha='a'.repeat(40);
const deployedSha='b'.repeat(40);
const previewUrl='https://preview123.sekka-staging-web.pages.dev';
const successfulCheck=(sha=expectedSha,summary=`<table><tr><td><strong>Preview URL:</strong></td><td><a href='${previewUrl}'>${previewUrl}</a></td></tr></table>`)=>({
 name:'Cloudflare Pages: sekka-staging-web',
 head_sha:sha,
 status:'completed',
 conclusion:'success',
 started_at:'2026-11-17T00:00:00Z',
 output:{summary},
});
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});

test('permits capture only when the expected and deployed full SHAs match',async()=>{
 const deployment=await verifyDeployment({
  baseUrl:previewUrl,
  expectedSha,
  fetchImpl:async url=>{
   assert.equal(url,`${previewUrl}/build-info.json`);
   return response({sourceCommitSha:expectedSha,previewUrl,branch:'feature/audit'});
  },
 });
 assert.equal(deployment.sourceCommitSha,expectedSha);
 assert.equal(deployment.deployedCommitSha,expectedSha);
});

test('rejects a deployed SHA that differs from the intended workflow SHA',async()=>{
 await assert.rejects(verifyDeployment({
  baseUrl:previewUrl,
  expectedSha,
  fetchImpl:async()=>response({sourceCommitSha:deployedSha,previewUrl}),
 }),/STALE_DEPLOYMENT/);
});

test('fails with an actionable diagnostic when deployment SHA is absent or invalid',async()=>{
 await assert.rejects(verifyDeployment({
  baseUrl:previewUrl,
  expectedSha,
  fetchImpl:async()=>response({previewUrl}),
 }),/DEPLOYMENT_SHA_UNVERIFIABLE/);
 await assert.rejects(verifyDeployment({
  baseUrl:previewUrl,
  expectedSha:'unknown',
  fetchImpl:async()=>response({sourceCommitSha:expectedSha,previewUrl}),
 }),/Expected source commit SHA must be a full 40-character Git commit SHA/);
});

test('fails rather than following an unavailable preview or redirect',async()=>{
 await assert.rejects(verifyDeployment({
  baseUrl:previewUrl,
  expectedSha,
  fetchImpl:async()=>{throw new TypeError('fetch failed');},
 }),/CLOUDFLARE_PREVIEW_UNAVAILABLE/);
 await assert.rejects(verifyDeployment({
  baseUrl:previewUrl,
  expectedSha,
  fetchImpl:async()=>response({},503),
 }),/CLOUDFLARE_PREVIEW_UNAVAILABLE: build metadata request returned HTTP 503/);
});

test('resolves only the successful Cloudflare Staging preview for the exact source SHA',()=>{
 assert.deepEqual(findStagingPreview([successfulCheck()],expectedSha),{
  status:'ready',previewUrl,sourceCommitSha:expectedSha,
 });
 assert.deepEqual(findStagingPreview([],expectedSha),{status:'pending'});
 assert.throws(()=>findStagingPreview([{
  ...successfulCheck(),conclusion:'failure',
 }],expectedSha),/CLOUDFLARE_STAGING_DEPLOYMENT_FAILED/);
 assert.throws(()=>findStagingPreview([successfulCheck(expectedSha,'success without a published preview')],expectedSha),
  /CLOUDFLARE_PREVIEW_UNAVAILABLE/);
});

test('retains the 73 canonical screen titles and original-gallery routes',async()=>{
 const source=await readFile(new URL('../src/v2/screenMap.ts',import.meta.url),'utf8');
 const canonical=source.match(/export const canonicalTitles = \[([\s\S]*?)\] as const;/)?.[1];
 assert.ok(canonical,'canonicalTitles must remain in the approved screen map');
 const titles=[...canonical.matchAll(/"([^"]*)"/g)].map(match=>match[1]);
 assert.equal(CANONICAL_SCREEN_COUNT,73);
 assert.equal(titles.length,CANONICAL_SCREEN_COUNT);
 assert.deepEqual(CANONICAL_SCREEN_IDS,Array.from({length:73},(_,index)=>`S${String(index+1).padStart(3,'0')}`));
 for(let screen=1;screen<=CANONICAL_SCREEN_COUNT;screen++){
  assert.equal(screenId(screen),CANONICAL_SCREEN_IDS[screen-1]);
  const expectedSuffix=screen<=7?'&inspect=1':`&preview=${screen<=14?'phase2':screen<=21?'phase3':screen<=34?'phase4':screen<=41?'phase5':screen<=49?'phase6':screen<=61?'phase7':'phase8'}`;
  assert.equal(originalGalleryPath(screen),`/dev/screens?screen=${screen}${expectedSuffix}`);
 }
 assert.throws(()=>screenId(74),/between 1 and 73/);
});

test('retains all language/theme variants and classifies non-accepted screen states',()=>{
 assert.equal(VISUAL_VARIANTS.length,8);
 assert.deepEqual([...new Set(VISUAL_VARIANTS.map(variant=>variant.language))].sort(),['ar','en']);
 assert.deepEqual([...new Set(VISUAL_VARIANTS.map(variant=>variant.theme))].sort(),['dark','light']);
 assert.deepEqual([...new Set(VISUAL_VARIANTS.map(variant=>variant.width))].sort(),[360,390]);
 assert.ok(VISUAL_VARIANTS.every(variant=>variant.height===(variant.width===360?800:844)));
 assert.equal(screenStateCategory('comparable_guest'),'public_guest_comparable');
 assert.equal(screenStateCategory('admin_session_required'),'authenticated_state_required');
 assert.equal(screenStateCategory('feature_postponed'),'deferred_functionality');
 assert.equal(screenStateCategory('no_integrated_equivalent'),'non_equivalent_guest_fallback');
});

test('labels captured gallery and production screenshots with full provenance and comparability',()=>{
 const metadata=createCaptureMetadata({
  sourceCommitSha:expectedSha,
  deployedCommitSha:expectedSha,
  previewUrl,
  capturedAt:'2026-11-17T00:00:00.000Z',
  screenId:'S064',
  language:'ar',
  theme:'dark',
  viewport:{width:390,height:844},
  state:'admin_session_required',
 });
 assert.equal(metadata.sourceCommitSha,expectedSha);
 assert.equal(metadata.deployedCommitSha,expectedSha);
 assert.equal(metadata.cloudflarePreviewUrl,previewUrl);
 assert.equal(metadata.screenId,'S064');
 assert.equal(metadata.language,'ar');
 assert.equal(metadata.theme,'dark');
 assert.deepEqual(metadata.viewport,{width:390,height:844});
 assert.equal(metadata.originalVsIntegrated.original.screenType,'approved_original_gallery');
 assert.equal(metadata.originalVsIntegrated.integrated.screenType,'real_production_facing_application');
 assert.equal(metadata.originalVsIntegrated.integrated.category,'authenticated_state_required');
 assert.equal(metadata.comparabilityStatus,'non_comparable');
 assert.equal(metadata.errorStatus,'none');
});

test('rejects partial, abbreviated, or non-hex commit identifiers',()=>{
 assert.equal(requireCommitSha(expectedSha,'Expected SHA'),expectedSha);
 assert.throws(()=>requireCommitSha(expectedSha.slice(0,7),'Expected SHA'),/full 40-character/);
 assert.throws(()=>requireCommitSha('g'.repeat(40),'Expected SHA'),/full 40-character/);
});

test('visual collector honors strict CSP without weakening style-src',async()=>{
 const source=await readFile(new URL('./collect-visual-audit.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/page\.addStyleTag\(/);
 assert.match(source,/splash\.style\.display='none'/);
 assert.match(source,/SCREENSHOT_SPLASH_COULD_NOT_BE_HIDDEN/);
 assert.match(source,/page\.locator\('main'\)\.first\(\)\.waitFor/);
});
