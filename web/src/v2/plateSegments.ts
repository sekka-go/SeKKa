import {canonicalEgyptianPlate,normalizeNumerals} from './captainValidation';

export type PlateSegment='letter'|'digit';
export const MAX_PLATE_LETTERS=3;
export const MAX_PLATE_DIGITS=4;

/** The API still receives ONE canonical plate; the UI uses fixed slots. */
export function parseEgyptianPlate(value:string){
 const clean=canonicalEgyptianPlate(value);
 return {
  letters:[...(clean.match(/[ء-ي]/gu)||[])].slice(0,MAX_PLATE_LETTERS),
  digits:[...(normalizeNumerals(clean).match(/[0-9]/g)||[])].slice(0,MAX_PLATE_DIGITS)
 };
}

export function cleanPlateChars(raw:string,kind:PlateSegment):string[]{
 const normalized=normalizeNumerals(raw);
 return [...normalized].filter(char=>kind==='letter'?/^[ء-ي]$/u.test(char):/^[0-9]$/.test(char));
}

export function combinePlate(letters:string[],digits:string[]):string{
 return letters.join('')+digits.join('');
}

export function isCompletePlate(letters:string[],digits:string[]):boolean{
 return (letters.length===2&&digits.length===4)||
  (letters.length===3&&(digits.length===3||digits.length===4));
}

/**
 * A user can only edit an existing slot or append at the first unused slot.
 * Removing an earlier character truncates the rest of that row, preventing
 * holes when editing/replacing characters. Digit entry requires two letters.
 */
export function editPlateSlot(value:string,kind:PlateSegment,index:number,raw:string):string{
 const {letters,digits}=parseEgyptianPlate(value);
 const group=kind==='letter'?letters:digits;
 const limit=kind==='letter'?MAX_PLATE_LETTERS:MAX_PLATE_DIGITS;
 if(index<0||index>=limit||index>group.length||(kind==='digit'&&letters.length<2))return combinePlate(letters,digits);
 const next=[...group];
 if(raw==='')next.splice(index);
 else{
  const incoming=cleanPlateChars(raw,kind);
  if(!incoming.length)return combinePlate(letters,digits);
  for(let i=0;i<incoming.length&&index+i<limit;i++){
   next[index+i]=incoming[i];
  }
 }
 return kind==='letter'?combinePlate(next,next.length>=2?digits:[]):combinePlate(letters,next);
}

/** Paste an entire valid plate, regardless of which slot is focused. */
export function pastePlate(value:string,raw:string,kind:PlateSegment,index:number):string{
 const chars=cleanPlateChars(raw,'letter'),nums=cleanPlateChars(raw,'digit');
 if(chars.length&&nums.length){
  if(isCompletePlate(chars,nums))return combinePlate(chars,nums);
  return value;
 }
 return editPlateSlot(value,kind,index,raw);
}
