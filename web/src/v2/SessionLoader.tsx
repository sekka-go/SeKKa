import AppSkeleton from './AppSkeleton';
import {usePreferences} from './preferences';
import './session-loader.css';

/** A tiny, non-blocking-feeling verification interstitial.
 * This is visual only; Supabase still owns the actual session verification.
 * Animation is disabled for people who prefer reduced motion.
 */
export default function SessionLoader({slow,onRetry}:{
 slow:boolean;onRetry:()=>void;
}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 return <section className="sekka-account-loading sekka-session-loader" role="status"
   aria-label={t('جارٍ التحقق من الحساب','Verifying your account')} aria-live="polite">
   <div className="sekka-session-loader__content">
    <AppSkeleton kind="session" label={t('بنتأكد من تسجيل دخولك','Checking your sign-in')}/>
   </div>
   {slow&&<div className="sekka-session-loader__slow" role="alert">
    <p>{t('اتأخرنا في التحقق من الدخول. تقدر تحاول تاني من غير ما نغير صفحتك.',
     'Sign-in verification is taking longer than usual. Retry without losing your place.')}</p>
    <button type="button" onClick={onRetry}>{t('إعادة المحاولة','Retry')}</button>
   </div>}
  </section>;
}
