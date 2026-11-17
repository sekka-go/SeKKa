export const STAGING_CHECK_NAME = 'Cloudflare Pages: sekka-staging-web';
export const CANONICAL_SCREEN_COUNT = 73;
export const CANONICAL_SCREEN_IDS = Object.freeze(
 Array.from({length:CANONICAL_SCREEN_COUNT},(_,index)=>`S${String(index+1).padStart(3,'0')}`),
);
export const VISUAL_VARIANTS = Object.freeze(
 [360,390].flatMap(width=>['ar','en'].flatMap(language=>['light','dark'].map(theme=>{
  const height=width===360?800:844;
  return{width,height,language,theme,key:`${width}x${height}-${language}-${theme}`};
 }))),
);
const SHA_PATTERN = /^[0-9a-f]{40}$/i;

export function screenId(number) {
 if(!Number.isInteger(number)||number<1||number>CANONICAL_SCREEN_COUNT)
  throw new Error(`Screen number must be between 1 and ${CANONICAL_SCREEN_COUNT}`);
 return CANONICAL_SCREEN_IDS[number-1];
}

export function originalGalleryPath(number) {
 return'/dev/screens?screen='+number+(number<=7?'&inspect=1':'&preview='+(
  number<=14?'phase2':number<=21?'phase3':number<=34?'phase4':number<=41?'phase5':number<=49?'phase6':number<=61?'phase7':'phase8'
 ));
}

export function requireCommitSha(value, label) {
 if(typeof value!=='string'||!SHA_PATTERN.test(value))
  throw new Error(`${label} must be a full 40-character Git commit SHA`);
 return value.toLowerCase();
}

function requirePreviewUrl(value) {
 let url;
 try{url=new URL(value);}catch{
  throw new Error('CLOUDFLARE_PREVIEW_UNAVAILABLE: Staging preview URL is missing or invalid');
 }
 if(url.protocol!=='https:'||!url.hostname.endsWith('.sekka-staging-web.pages.dev')||
    url.username||url.password||url.search||url.hash||url.pathname!=='/')
  throw new Error('CLOUDFLARE_PREVIEW_UNAVAILABLE: expected an HTTPS sekka-staging-web Pages preview URL');
 return url.origin;
}

export function findStagingPreview(checkRuns, expectedSha) {
 const sha=requireCommitSha(expectedSha,'Expected source commit SHA');
 const matching=checkRuns
  .filter(run=>run.name===STAGING_CHECK_NAME&&run.head_sha?.toLowerCase()===sha)
  .sort((a,b)=>Date.parse(b.started_at||b.created_at||0)-Date.parse(a.started_at||a.created_at||0));
 if(!matching.length)return{status:'pending'};

 const check=matching[0];
 if(check.status!=='completed')return{status:'pending'};
 if(check.conclusion!=='success')
  throw new Error(`CLOUDFLARE_STAGING_DEPLOYMENT_FAILED: ${STAGING_CHECK_NAME} concluded ${check.conclusion||'without a conclusion'} for ${sha}`);

 const summary=check.output?.summary||'';
 const previewMatch=summary.match(/Preview URL:[\s\S]*?<a href=['"]([^'"]+)['"]/i);
 if(!previewMatch)
  throw new Error(`CLOUDFLARE_PREVIEW_UNAVAILABLE: successful Staging check for ${sha} did not publish its preview URL`);
 return{status:'ready',previewUrl:requirePreviewUrl(previewMatch[1]),sourceCommitSha:sha};
}

export function screenStateCategory(state) {
 if(state==='comparable_guest')return'public_guest_comparable';
 if(state==='feature_postponed')return'deferred_functionality';
 if(['auth_required','booking_required','route_required','captain_approval_required','admin_session_required'].includes(state))
  return'authenticated_state_required';
 return'non_equivalent_guest_fallback';
}

export function createCaptureMetadata({
 sourceCommitSha,deployedCommitSha,previewUrl,capturedAt,screenId,language,theme,viewport,state,
}) {
 const sourceSha=requireCommitSha(sourceCommitSha,'Source commit SHA');
 const deployedSha=requireCommitSha(deployedCommitSha,'Deployed commit SHA');
 const verifiedPreviewUrl=requirePreviewUrl(previewUrl);
 return{
  sourceCommitSha:sourceSha,
  deployedCommitSha:deployedSha,
  cloudflarePreviewUrl:verifiedPreviewUrl,
  capturedAt,
  screenId,
  language,
  theme,
  viewport:{width:viewport.width,height:viewport.height},
  originalVsIntegrated:{
   original:{screenType:'approved_original_gallery'},
   integrated:{screenType:'real_production_facing_application',state,category:screenStateCategory(state)},
  },
  comparabilityStatus:state==='comparable_guest'?'comparable_guest_candidate':'non_comparable',
  errorStatus:'none',
 };
}

export async function verifyDeployment({baseUrl,expectedSha,fetchImpl=fetch}) {
 const sourceCommitSha=requireCommitSha(expectedSha,'Expected source commit SHA');
 const previewUrl=requirePreviewUrl(baseUrl);
 let response;
 try{
  response=await fetchImpl(`${previewUrl}/build-info.json`,{
   redirect:'error',
   signal:AbortSignal.timeout(15000),
   headers:{accept:'application/json'},
  });
 }catch(error){
  throw new Error(`CLOUDFLARE_PREVIEW_UNAVAILABLE: could not read build metadata from ${previewUrl}: ${String(error)}`);
 }
 if(!response.ok)
  throw new Error(`CLOUDFLARE_PREVIEW_UNAVAILABLE: build metadata request returned HTTP ${response.status} at ${previewUrl}`);

 let metadata;
 try{metadata=await response.json();}catch(error){
  throw new Error(`DEPLOYMENT_SHA_UNVERIFIABLE: ${previewUrl}/build-info.json was not valid JSON: ${String(error)}`);
 }
 let deployedCommitSha;
 try{deployedCommitSha=requireCommitSha(metadata?.sourceCommitSha,'Deployed source commit SHA');}catch(error){
  throw new Error(`DEPLOYMENT_SHA_UNVERIFIABLE: ${String(error)} at ${previewUrl}`);
 }
 if(deployedCommitSha!==sourceCommitSha)
  throw new Error(`STALE_DEPLOYMENT: expected ${sourceCommitSha}, but ${previewUrl} reports ${deployedCommitSha}`);
 let metadataPreviewUrl;
 try{metadataPreviewUrl=requirePreviewUrl(metadata?.previewUrl);}catch(error){
  throw new Error(`DEPLOYMENT_URL_UNVERIFIABLE: build metadata does not identify this Cloudflare Staging preview: ${String(error)}`);
 }
 if(metadataPreviewUrl!==previewUrl)
  throw new Error(`DEPLOYMENT_URL_MISMATCH: requested ${previewUrl}, deployed metadata reports ${metadataPreviewUrl}`);

 return{sourceCommitSha,deployedCommitSha,previewUrl,branch:metadata.branch||null};
}
