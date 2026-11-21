import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export type ThemePreference = 'system' | 'dark' | 'light';
export type LanguagePreference = 'system' | 'ar' | 'en';
export const resolveLanguage = (p: LanguagePreference, device: string): 'ar'|'en' => p === 'system' ? device.toLowerCase().split('-')[0] === 'en' ? 'en' : 'ar' : p;
export const resolveTheme = (p: ThemePreference, dark: boolean): 'dark'|'light' => p === 'system' ? dark ? 'dark' : 'light' : p;
function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  // OAuth may open in a separate browser context: carry explicit manual preferences in the callback URL.
  const queryKey = key === 'theme_preference' ? 'oauth_theme' : key === 'language_preference' ? 'oauth_language' : '';
  const fromUrl = queryKey ? new URLSearchParams(window.location.search).get(queryKey) : null;
  if (fromUrl && allowed.includes(fromUrl as T)) return fromUrl as T;
  try {const v = localStorage.getItem(key); return allowed.includes(v as T) ? v as T : fallback;} catch {return fallback;}
}
const Context = createContext<null | {theme:'dark'|'light';language:'ar'|'en';themePreference:ThemePreference;languagePreference:LanguagePreference;setThemePreference:(v:ThemePreference)=>void;setLanguagePreference:(v:LanguagePreference)=>void}>(null);
export function PreferencesProvider({children}: {children:ReactNode}) {
  const [themePreference,setThemePreference] = useState<ThemePreference>(()=>read('theme_preference',['system','light','dark'],'system'));
  const [languagePreference,setLanguagePreference] = useState<LanguagePreference>(()=>read('language_preference',['system','ar','en'],'system'));
  const [deviceDark,setDeviceDark] = useState(()=>window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [deviceLanguage,setDeviceLanguage] = useState(()=>navigator.languages?.[0] || navigator.language || 'ar');
  const theme=resolveTheme(themePreference,deviceDark),language=resolveLanguage(languagePreference,deviceLanguage);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)');
    const onTheme=()=>setDeviceDark(media.matches),onLanguage=()=>setDeviceLanguage(navigator.languages?.[0] || navigator.language || 'ar');
    media.addEventListener('change',onTheme);window.addEventListener('languagechange',onLanguage);
    return ()=>{media.removeEventListener('change',onTheme);window.removeEventListener('languagechange',onLanguage);};
  },[]);
  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
    document.documentElement.lang=language;
    document.documentElement.dir=language==='ar'?'rtl':'ltr';
    document.documentElement.style.colorScheme=theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#102A3C':'#078CF4');
    try{localStorage.setItem('theme_preference',themePreference);localStorage.setItem('language_preference',languagePreference);}catch{/* Memory-only when storage unavailable. */}
    // OAuth callback parameters are one-time transport, not permanent preference overrides.
    // Remove them after preferences have been adopted so a later manual change survives reload.
    const url=new URL(window.location.href);
    if(url.searchParams.has('oauth_theme')||url.searchParams.has('oauth_language')){
      url.searchParams.delete('oauth_theme');url.searchParams.delete('oauth_language');
      window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
    }
  },[theme,language,themePreference,languagePreference]);
  return <Context.Provider value={{theme,language,themePreference,languagePreference,setThemePreference,setLanguagePreference}}>{children}</Context.Provider>;
}
export function usePreferences(){const p=useContext(Context);if(!p)throw new Error('PreferencesProvider required');return p;}
export function PreferenceSettings(){
 const p=usePreferences(),en=p.language==='en';
 return <section className="d-box preference-settings"><h2>{en?'Language and appearance':'اللغة والمظهر'}</h2>
 <label>{en?'Appearance':'المظهر'}<select aria-label="theme_preference" value={p.themePreference} onChange={e=>p.setThemePreference(e.target.value as ThemePreference)}><option value="system">{en?'System default':'تلقائي — حسب الجهاز'}</option><option value="light">{en?'Light':'فاتح'}</option><option value="dark">{en?'Dark':'داكن'}</option></select></label>
 <label>{en?'Language':'اللغة'}<select aria-label="language_preference" value={p.languagePreference} onChange={e=>p.setLanguagePreference(e.target.value as LanguagePreference)}><option value="system">{en?'System default':'تلقائي — حسب الجهاز'}</option><option value="ar">العربية</option><option value="en">English</option></select></label></section>;
}
