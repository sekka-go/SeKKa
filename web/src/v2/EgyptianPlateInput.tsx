import {useRef,useState} from 'react';
import type {ClipboardEvent,KeyboardEvent} from 'react';
import {MAX_PLATE_DIGITS,MAX_PLATE_LETTERS,parseEgyptianPlate,editPlateSlot,pastePlate} from './plateSegments';
import type {PlateSegment} from './plateSegments';

/** Fixed 3 letters / 4 digits. Only left-to-right, gapless *input order*
 * is permitted, regardless of the display's Arabic direction. */
export default function EgyptianPlateInput({value,onChange,disabled=false,invalid=false,
 onTouched,language}:{value:string;onChange:(value:string)=>void;disabled?:boolean;
 invalid?:boolean;onTouched?:()=>void;language:'ar'|'en'}) {
 const t=(ar:string,en:string)=>language==='en'?en:ar;
 const {letters,digits}=parseEgyptianPlate(value);
 const [pasteError,setPasteError]=useState(false);
 const fields=useRef<Record<string,HTMLInputElement|null>>({});
 const slotId=(kind:PlateSegment,index:number)=>'captain-plate-'+kind+'-'+index;
 const focus=(kind:PlateSegment,index:number)=>{
  const input=fields.current[slotId(kind,index)];
  if(input&&!input.disabled){input.focus();input.select();}
 };
 const advance=(kind:PlateSegment,index:number,count:number)=>{
  if(kind==='letter'&&index+count<MAX_PLATE_LETTERS)focus('letter',index+count);
  else if(kind==='letter')focus('digit',0);
  else if(index+count<MAX_PLATE_DIGITS)focus('digit',index+count);
 };
 const change=(kind:PlateSegment,index:number,raw:string)=>{
  const next=editPlateSlot(value,kind,index,raw);
  if(next!==value){setPasteError(false);onChange(next);}
  if(raw){
   const count=Math.min([...raw].length,kind==='letter'?MAX_PLATE_LETTERS:MAX_PLATE_DIGITS);
   // React commits the new value before moving to an enabled next input.
   requestAnimationFrame(()=>advance(kind,index,count));
  }
 };
 const paste=(event:ClipboardEvent<HTMLInputElement>,kind:PlateSegment,index:number)=>{
  const raw=event.clipboardData.getData('text');
  event.preventDefault();
  const next=pastePlate(value,raw,kind,index);
  if(next!==value){
   onChange(next);setPasteError(false);
   const result=parseEgyptianPlate(next);
   requestAnimationFrame(()=>focus('digit',Math.min(result.digits.length,MAX_PLATE_DIGITS-1)));
  }else setPasteError(true);
 };
 const onKey=(event:KeyboardEvent<HTMLInputElement>,kind:PlateSegment,index:number)=>{
  if(event.key==='Backspace'&&!(kind==='letter'?letters:digits)[index]){
   event.preventDefault();
   if(index>0)focus(kind,index-1);
   else if(kind==='digit')focus('letter',letters.length>=MAX_PLATE_LETTERS?MAX_PLATE_LETTERS-1:Math.max(0,letters.length-1));
  }
 };
 const inputs=(kind:PlateSegment)=>{
  const count=kind==='letter'?MAX_PLATE_LETTERS:MAX_PLATE_DIGITS;
  const group=kind==='letter'?letters:digits;
  return Array.from({length:count},(_,index)=>{
   const locked=disabled||index>group.length||(kind==='digit'&&letters.length<2);
   return <input key={slotId(kind,index)} id={slotId(kind,index)}
    ref={node=>{fields.current[slotId(kind,index)]=node;}}
    type="text" inputMode={kind==='digit'?'numeric':'text'} maxLength={1}
    dir={kind==='digit'?'ltr':'rtl'} autoComplete="off" autoCapitalize="off" spellCheck={false}
    value={group[index]||''} disabled={locked}
    aria-label={kind==='letter'?t('حرف اللوحة '+(index+1),'Plate letter '+(index+1)):
     t('رقم اللوحة '+(index+1),'Plate digit '+(index+1))}
    aria-invalid={invalid} aria-describedby={invalid?'captain-plate-error':undefined}
    onChange={event=>change(kind,index,event.target.value)}
    onPaste={event=>paste(event,kind,index)}
    onKeyDown={event=>onKey(event,kind,index)}/>;
  });
 };
 return <fieldset id="captain-plate" className="c-plate-fields" disabled={disabled}
  aria-label={t('لوحة العربية','License plate')} aria-invalid={invalid}
  onBlur={event=>{
   if(!event.currentTarget.contains(event.relatedTarget as Node|null))onTouched?.();
  }}>
  <legend>{t('لوحة العربية','License plate')}</legend>
  <p className="c-form-hint">{t(
   'ابدأ من أول مربع في كل صف واملا الخانات بالترتيب، وسيب غير المستخدم في الآخر فقط.',
   'Start at the first box of each row and fill consecutive boxes. Leave unused boxes only at the end.'
  )}</p>
  <div className="c-plate-segments" dir="rtl">
   <div className="c-plate-segment" role="group" aria-label={t('حروف اللوحة','Plate letters')}>
    <strong>{t('الحروف (حرفين أو ٣)','Letters (2 or 3)')}</strong>
    <div className="c-plate-boxes" dir="rtl">{inputs('letter')}</div>
   </div>
   <div className="c-plate-segment" role="group" aria-label={t('أرقام اللوحة','Plate digits')}>
    <strong>{t('الأرقام (٣ أو ٤)','Digits (3 or 4)')}</strong>
    <div className="c-plate-boxes" dir="ltr">{inputs('digit')}</div>
   </div>
  </div>
  <p className="c-form-hint">{t(
   'لازم حرفين و٤ أرقام، أو ٣ حروف و٣ أو ٤ أرقام. المربع التالي بيفتح بعد ملء السابق.',
   'Use 2 letters + 4 digits, or 3 letters + 3/4 digits. Each next box unlocks when the previous one is filled.'
  )}</p>
  {pasteError&&<p className="c-field-error" role="alert">{t(
   'النص الملصوق مش لوحة مكتملة وصحيحة. ابدأ من أول مربع.',
   'The pasted text is not a valid complete plate. Start at the first box.'
  )}</p>}
 </fieldset>;
}
