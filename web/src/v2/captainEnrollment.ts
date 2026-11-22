import {client} from './api';

export type CaptainEnrollment = {approval_status:string};

/** Idempotently enroll the authenticated Google user in staging v31.
 * Never grants admin or captain approval; approval remains server-owned.
 */
export async function enrollCaptain():Promise<CaptainEnrollment>{
 if(!client)throw Error('BACKEND_NOT_CONFIGURED');
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)throw Error('AUTH_REQUIRED');
 const {data:profile,error:profileError}=await client.from('v31_profiles')
   .select('user_id,role_preference').eq('user_id',user.id).maybeSingle();
 if(profileError)throw profileError;
 if(!profile){
   const {error}=await client.from('v31_profiles').insert({user_id:user.id,display_name:user.user_metadata?.full_name||user.email||'',role_preference:'captain'});
   if(error&&error.code!=='23505')throw error;
 }else if(profile.role_preference!=='captain'){
   const {error}=await client.from('v31_profiles').update({role_preference:'captain'}).eq('user_id',user.id);
   if(error)throw error;
 }
 const {data:captain,error:captainError}=await client.from('v31_captain_profiles')
   .select('approval_status').eq('user_id',user.id).maybeSingle();
 if(captainError)throw captainError;
 if(captain)return captain;
 const {error:insertError}=await client.from('v31_captain_profiles').insert({user_id:user.id,approval_status:'pending'});
 if(insertError&&insertError.code!=='23505')throw insertError;
 const {data:enrolled,error:readError}=await client.from('v31_captain_profiles')
   .select('approval_status').eq('user_id',user.id).single();
 if(readError||!enrolled)throw Error(readError?.message||'CAPTAIN_ENROLLMENT_NOT_VERIFIED');
 return enrolled;
}
