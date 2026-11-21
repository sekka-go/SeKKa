import type {PlaceChoice} from './geoPlace';

export const RIDER_DRAFT_KEY='sekka.rider.discoveryDraft.v31';
export type SavedCommute={
 origin:string;destination:string;
 originPlace:PlaceChoice|null;destinationPlace:PlaceChoice|null;
 outbound:string;returnTime:string;period:'weekly'|'monthly';
 direction:'outbound'|'return'|'round_trip';
 savedAt:string;
};
const starts=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=160;
const clock=(value:unknown)=>typeof value==='string'&&(value===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(value));
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
    &&p.latitude>=-90&&p.latitude<=90&&p.longitude>=-180&&p.longitude<=180;
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
export function restoreCommuteDraft(commute:SavedCommute):boolean{
 try{
  const draft={origin:commute.origin,destination:commute.destination,
   originPlace:commute.originPlace,destinationPlace:commute.destinationPlace,
   outbound:commute.outbound,returnTime:commute.returnTime,
   period:commute.period,filterDirection:commute.direction,
   searched:true,appliedFilters:false,categories:[],filterPrice:'',onlyAvailable:false};
  sessionStorage.setItem(RIDER_DRAFT_KEY,JSON.stringify(draft));
  return true;
 }catch{return false;}
}
