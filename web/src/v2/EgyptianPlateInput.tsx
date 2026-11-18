import {useEffect,useRef,useState} from 'react';
import {combinePlate,cleanPlateChars,parseEgyptianPlate,plateFormats} from './plateSegments';
import type {PlateFormat} from './plateSegments';

export default function EgyptianPlateInput({value,onChange,disabled=false,invalid=false,
 onTouched,language}:{value:string;onChange:(value:string)=>void;disabled?:boolean;
 invalid?:boolean;onTouched?:()=>void;language:'ar'|'en'}) {
 const en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const initial=parseEgyptianPlate(value);
 const [format,setFormat]=useState<PlateFormat>(initial.format);
 const [letters,setLetters]=useState<string[]>(initial.letters);
 const [digits,setDigits]=useState<string[]>(initial.digits);
 const lastEmitted=useRef(value);
 const fields=useRef<Record<string,HTMLInputElement|null>>({});
 useEffect(()=>{
  if(value===lastEmitted.current)return;
  const parsed=parseEgyptianPlate(value);
  setFormat(parsed.format);setLetters(parsed.letters);setDigits(parsed.digits);
  lastEmitted.current=value;
 },[value]);
 const config=plateFormats[format];
 const refId=(kind:'letter'|'digit',index:number)=>'captain-plate-'+kind+'-'+index;
 const focus=(kind:'letter'|'digit',index:number)=>{
  const element=fields.current[refId(kind,index)];
  element?.focus();element?.select();
 };
 const advance=(kind:'letter'|'digit',index:number)=>{
  if(kind==='letter'&&index+1<config.letters)focus('letter',index+1);
  else if(kind==='letter')focus('digit',0);
  else if(index+1<config.digits)focus('digit',index+1);
 };
 const commit=(newLetters:string[],newDigits:string[],nextFormat:PlateFormat=format)=>{
  const trimmedLetters=newLetters.slice(0,plateFormats[nextFormat].letters);
  const trimmedDigits=newDigits.slice(0,plateFormats[nextFormat].digits);
  setLetters(trimmedLetters);setDigits(trimmedDigits);
  const next=combinePlate(trimmedLetters,trimmedDigits);
  lastEmitted.current=next;onChange(next);
 };
 const enter=(kind:'letter'|'digit',index:number,raw:string)=>{
  const incoming=cleanPlateChars(raw,kind);
  const current=kind==='letter'?[...letters]:[...digits];
  if(!raw){current[index]='';}
  else if(!incoming.length)return;
  else incoming.forEach((ch,offset)=>{
   const limit=kind==='letter'?config.letters:config.digits;
   if(index+offset<limit)current[index+offset]=ch;
  });
  if(kind==='letter')commit(current,digits);
  else commit(letters,current);
  if(incoming.length)requestAnimationFrame(()=>advance(kind,Math.min(index+incoming.length-1,(kind==='letter'?config.letters:config.digits)-1)));
 };
 const paste=(event:React.ClipboardEvent<HTMLInputElement>,kind:'letter'|'digit',index:number)=>{
  const raw=event.clipboardData.getData('text');
  const chars=cleanPlateChars(raw,'letter'),nums=cleanPlateChars(raw,'digit');
  if(!chars.length&&!nums.length)return;
  event.preventDefault();
  if(chars.length&&nums.length){
   const detected:PlateFormat=chars.length===2?'giza':nums.length===3?'cairo':'other';
   setFormat(detected);commit(chars,nums,detected);
   requestAnimationFrame(()=>focus('digit',Math.min(nums.length,plateFormats[detected].digits)-1));
  }else enter(kind,index,raw);
 };
 const onKey=(event:React.KeyboardEvent<HTMLInputElement>,kind:'letter'|'digit',index:number)=>{
  if(event.key==='Backspace'&&!(kind==='letter'?letters:digits)[index]){
   event.preventDefault();
   if(kind==='digit'&&index===0)focus('letter',config.letters-1);
   else if(index>0)focus(kind,index-1);
  }else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
   const next=index+(event.key==='ArrowLeft'?1:-1);
   if(next>=0&&next<(kind==='letter'?config.letters:config.digits)){
    event.preventDefault();focus(kind,next);
   }
  }
 };
 const renderBoxes=(kind:'letter'|'digit')=>
  Array.from({length:kind==='letter'?config.letters:config.digits},(_,index)=>(
   <input key={refId(kind,index)} id={refId(kind,index)}
    ref={node=>{fields.current[refId(kind,index)]=node;}}
    type="text" inputMode={kind==='digit'?'numeric':'text'} maxLength={1}
    dir={kind==='digit'?'ltr':'rtl'} autoComplete="off" autoCapitalize="off" spellCheck={false}
    value={(kind==='letter'?letters:digits)[index]||''} disabled={disabled}
    aria-label={kind==='letter'?t('حرف اللوحة '+(index+1),'Plate letter '+(index+1)):
     t('رقم اللوحة '+(index+1),'Plate digit '+(index+1))}
    aria-invalid={invalid} aria-describedby={invalid?'captain-plate-error':undefined}
    onChange={e=>enter(kind,index,e.target.value)}
    onKeyDown={e=>onKey(e,kind,index)}
    onPaste={e=>paste(e,kind,index)}
    onBlur={onTouched}/>
  ));
 return <fieldset id="captain-plate" className="c-plate-fields" disabled={disabled}
  aria-label={t('لوحة العربية','License plate')} aria-invalid={invalid}>
  <legend>{t('لوحة العربية (كل حرف ورقم في مربع)','License plate (one letter or digit per box)')}</legend>
  <label className="c-plate-format-label" htmlFor="captain-plate-format">
   {t('نمط اللوحة حسب المحافظة','Plate layout by governorate')}
   <select id="captain-plate-format" value={format}
    onChange={e=>{
     const next=e.target.value as PlateFormat;
     setFormat(next);commit(letters,digits,next);requestAnimationFrame(()=>focus('letter',0));
    }}>
    <option value="cairo">{t('القاهرة: ٣ حروف + ٣ أرقام','Cairo: 3 letters + 3 digits')}</option>
    <option value="giza">{t('الجيزة: حرفين + ٤ أرقام','Giza: 2 letters + 4 digits')}</option>
    <option value="other">{t('باقي المحافظات: ٣ حروف + ٤ أرقام','Other governorates: 3 letters + 4 digits')}</option>
   </select>
  </label>
  <div className="c-plate-segments" dir="rtl">
   <div className="c-plate-segment" role="group" aria-label={t('حروف اللوحة','Plate letters')}>
    <strong>{t('الحروف','Letters')}</strong>
    <div className="c-plate-boxes" dir="rtl">{renderBoxes('letter')}</div>
   </div>
   <div className="c-plate-segment" role="group" aria-label={t('أرقام اللوحة','Plate digits')}>
    <strong>{t('الأرقام','Digits')}</strong>
    <div className="c-plate-boxes" dir="ltr">{renderBoxes('digit')}</div>
   </div>
  </div>
  <p className="c-form-hint">{t('اكتب حرف أو رقم في كل مربع. المؤشر بينتقل تلقائيًا، وتقدر تلصق اللوحة كاملة.','One character per box. Focus advances automatically; you can also paste a complete plate.')}</p>
 </fieldset>;
}
