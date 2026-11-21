import {selectOperationalMapPlace} from './geoPlace.ts';
import type {MapPlace,PlaceChoice} from './geoPlace.ts';

export const RIDER_DRAFT_KEY='sekka.rider.discoveryDraft.v31';
export type SavedCommute={
 origin:string;destination:string;
 originPlace:PlaceChoice|null;destinationPlace:PlaceChoice|null;
 outbound:string;returnTime:string;period:'weekly'|'monthly';
 direction:'outbound'|'return'|'round_trip';
 /** User's preferred days, Sat=0 through Fri=6. Current backend RPC does not filter these. */
 weekdays?:number[];
 savedAt:string;
};
const starts=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=160;
const clock=(value:unknown)=>typeof value==='string'&&(value===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(value));
export const WEEKDAY_IDS=[0,1,2,3,4,5,6] as const;
export function isWeekdays(value:unknown):value is number[]{
 return Array.isArray(value)&&value.length<=7&&
  value.every(day=>Number.isInteger(day)&&day>=0&&day<=6)&&
  new Set(value).size===value.length;
}
const pointChoice=(raw:unknown):raw is PlaceChoice|null=>{
 if(raw===null)return true;
 if(!raw||typeof raw!=='object')return false;
 const v=raw as Record<string,unknown>;
 if(v.kind==='service')return Boolean(v.area&&typeof v.area==='object'&&
   typeof (v.area as Record<string,unknown>).id==='number'&&
   starts((v.area as Record<string,unknown>).name_ar));
 if(v.kind==='map'){
  if(!v.place||typeof v.place!=='object')return false;
  const p=v.place as Record<string,unknown>;
  return starts(p.id)&&starts(p.name)&&typeof p.latitude==='number'&&typeof p.longitude==='number'
    &&selectOperationalMapPlace(p as MapPlace);
 }
 return false;
};
export function parseSavedCommute(raw:unknown):SavedCommute|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const r=raw as Record<string,unknown>;
 if(!starts(r.origin)||!starts(r.destination)||r.origin===r.destination||
   !clock(r.outbound)||!clock(r.returnTime)||
   !['weekly','monthly'].includes(String(r.period))||
   !['outbound','return','round_trip'].includes(String(r.direction))||
   !pointChoice(r.originPlace??null)||!pointChoice(r.destinationPlace??null)||
   (r.weekdays!==undefined&&!isWeekdays(r.weekdays))||
   typeof r.savedAt!=='string'||!Number.isFinite(Date.parse(r.savedAt)))return null;
 return r as SavedCommute;
}
export function savedCommuteKey(riderId:string):string{
 if(!/^[a-f0-9-]{36}$/i.test(riderId))throw new Error('INVALID_RIDER_ID');
 return 'sekka.rider.recurringCommute.v1.'+riderId;
}
export function readSavedCommute(riderId:string):SavedCommute|null{
 try{return parseSavedCommute(JSON.parse(localStorage.getItem(savedCommuteKey(riderId))||'null'));}
 catch{return null;}
}
export function saveCommute(riderId:string,commute:Omit<SavedCommute,'savedAt'>):boolean{
 try{
  const item={...commute,savedAt:new Date().toISOString()};
  if(!parseSavedCommute(item))return false;
  localStorage.setItem(savedCommuteKey(riderId),JSON.stringify(item));
  return true;
 }catch{return false;}
}
/** Unsubmitted home edits are scoped to both this browser tab and the Google user.
 * We explicitly validate partial values: incomplete searches are legitimate drafts.
 */
export type EditableCommute=Omit<SavedCommute,'savedAt'>;
export function parseHomeDraft(raw:unknown):EditableCommute|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const d=raw as Record<string,unknown>;
 const partial=(x:unknown)=>typeof x==='string'&&x.length<=160;
 if(!partial(d.origin)||!partial(d.destination)||
  !pointChoice(d.originPlace??null)||!pointChoice(d.destinationPlace??null)||
  !clock(d.outbound)||!clock(d.returnTime)||
  !['weekly','monthly'].includes(String(d.period))||
  !['outbound','return','round_trip'].includes(String(d.direction))||
  !isWeekdays(d.weekdays??[]))return null;
 return {origin:d.origin as string,destination:d.destination as string,
  originPlace:(d.originPlace??null) as PlaceChoice|null,
  destinationPlace:(d.destinationPlace??null) as PlaceChoice|null,
  outbound:d.outbound as string,returnTime:d.returnTime as string,
  period:d.period as 'weekly'|'monthly',
  direction:d.direction as 'outbound'|'return'|'round_trip',
  weekdays:[...((d.weekdays??[]) as number[])]};
}
export function riderHomeDraftKey(riderId:string){
 savedCommuteKey(riderId); // refuse untrusted account IDs
 return 'sekka.rider.homeDraft.v1.'+riderId;
}
export function readHomeDraft(riderId:string):EditableCommute|null{
 try{return parseHomeDraft(JSON.parse(sessionStorage.getItem(riderHomeDraftKey(riderId))||'null'));}
 catch{return null;}
}
export function saveHomeDraft(riderId:string,draft:EditableCommute):boolean{
 try{
  const validated=parseHomeDraft(draft);
  if(!validated)return false;
  sessionStorage.setItem(riderHomeDraftKey(riderId),JSON.stringify(validated));
  return true;
 }catch{return false;}
}
export function clearHomeDraft(riderId:string){
 try{sessionStorage.removeItem(riderHomeDraftKey(riderId));}catch{/* Optional storage */ }
}
export function restoreCommuteDraft(commute:SavedCommute):boolean{
 try{
  if(!parseSavedCommute(commute))return false;
  const draft={origin:commute.origin,destination:commute.destination,
   originPlace:commute.originPlace,destinationPlace:commute.destinationPlace,
   outbound:commute.outbound,returnTime:commute.returnTime,
   period:commute.period,filterDirection:commute.direction,
   weekdays:commute.weekdays??[],
   searched:true,appliedFilters:false,categories:[],filterPrice:'',onlyAvailable:false};
  sessionStorage.setItem(RIDER_DRAFT_KEY,JSON.stringify(draft));
  return true;
 }catch{return false;}
}
