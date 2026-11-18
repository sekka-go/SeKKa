import {canonicalEgyptianPlate,normalizeNumerals} from './captainValidation';

export type PlateFormat='cairo'|'giza'|'other';
export const plateFormats:Record<PlateFormat,{letters:number;digits:number}>={
 cairo:{letters:3,digits:3},
 giza:{letters:2,digits:4},
 other:{letters:3,digits:4}
};

/** Parse a saved canonical plate without losing Arabic characters or leading zeroes. */
export function parseEgyptianPlate(value:string){
 const clean=canonicalEgyptianPlate(value);
 const letters=[...(clean.match(/[ء-ي]/gu)||[])];
 const digits=[...(normalizeNumerals(clean).match(/[0-9]/g)||[])];
 const format:PlateFormat=letters.length===2&&digits.length===4?'giza'
  :letters.length===3&&digits.length===4?'other':'cairo';
 return {format,letters,digits};
}

export function cleanPlateChars(raw:string,kind:'letter'|'digit'):string[]{
 const normalized=normalizeNumerals(raw);
 return [...normalized].filter(char=>kind==='letter'?/^[ء-ي]$/u.test(char):/^[0-9]$/.test(char));
}

export function combinePlate(letters:string[],digits:string[]):string{
 return letters.join('')+digits.join('');
}
