/** Android-friendly Captain document preparation, never persisted locally.
 * The original bytes are checked before any authenticated Storage write.
 * For supported large photos, reduce dimensions and encode JPEG; PDFs stay
 * byte-for-byte identical. Supabase receives a Blob with a declared MIME. */
export const MAX_CAPTAIN_DOCUMENT_BYTES=5*1024*1024;
const MAX_IMAGE_INPUT_BYTES=16*1024*1024;
export type PreparedCaptainDocument={body:Blob;contentType:string;extension:'jpg'|'png'|'pdf';originalBytes:number;compressed:boolean};

async function readBytes(file:File):Promise<ArrayBuffer>{
 try{const b=await file.arrayBuffer();if(b.byteLength>0)return b;}
 catch{/* Android file providers may require FileReader instead. */}
 if(typeof FileReader==='undefined')throw Error('FILE_READ_FAILED');
 return await new Promise<ArrayBuffer>((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(Error('FILE_READ_FAILED'));
  reader.onabort=()=>reject(Error('FILE_READ_FAILED'));
  reader.onload=()=>{
   if(reader.result instanceof ArrayBuffer&&reader.result.byteLength>0)resolve(reader.result);
   else reject(Error('FILE_READ_FAILED'));
  };
  try{reader.readAsArrayBuffer(file);}catch{reject(Error('FILE_READ_FAILED'));}
 });
}
function formatOf(bytes:Uint8Array):'jpg'|'png'|'pdf'|'webp'|null{
 const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 const png=bytes.length>=8&&[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((b,i)=>bytes[i]===b);
 const pdf=bytes.length>=5&&[0x25,0x50,0x44,0x46,0x2d].every((b,i)=>bytes[i]===b);
 const webp=bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&
  String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 return jpeg?'jpg':png?'png':pdf?'pdf':webp?'webp':null;
}
async function compressPhoto(blob:Blob):Promise<Blob>{
 if(typeof createImageBitmap!=='function'||typeof document==='undefined')
  throw Error('IMAGE_CONVERSION_UNAVAILABLE');
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(blob);}catch{throw Error('IMAGE_CONVERSION_UNAVAILABLE');}
 try{
  const side=Math.max(bitmap.width,bitmap.height);
  if(!side||!Number.isFinite(side))throw Error('IMAGE_CONVERSION_UNAVAILABLE');
  for(const width of [2000,1600,1280,960]){
   const scale=Math.min(1,width/side);
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));
   canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const context=canvas.getContext('2d');
   if(!context)throw Error('IMAGE_CONVERSION_UNAVAILABLE');
   context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
   context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   for(const quality of [0.85,0.7]){
    const output=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
    if(output&&output.type==='image/jpeg'&&output.size>0&&output.size<=MAX_CAPTAIN_DOCUMENT_BYTES)return output;
   }
  }
  throw Error('FILE_INVALID_SIZE');
 }finally{bitmap.close();}
}
export async function prepareCaptainDocument(file:File):Promise<PreparedCaptainDocument>{
 if(file.size>MAX_IMAGE_INPUT_BYTES)throw Error('FILE_INVALID_SIZE');
 const array=await readBytes(file);
 if(array.byteLength<1||array.byteLength>MAX_IMAGE_INPUT_BYTES)throw Error('FILE_INVALID_SIZE');
 const kind=formatOf(new Uint8Array(array,0,Math.min(array.byteLength,12)));
 if(!kind)throw Error('FILE_INVALID_SIGNATURE');
 const original=new Blob([array],{type:kind==='pdf'?'application/pdf':kind==='png'?'image/png':kind==='webp'?'image/webp':'image/jpeg'});
 if(kind==='pdf'){
  if(original.size>MAX_CAPTAIN_DOCUMENT_BYTES)throw Error('FILE_INVALID_SIZE');
  return {body:original,contentType:'application/pdf',extension:'pdf',originalBytes:original.size,compressed:false};
 }
 if(kind!=='webp'&&original.size<=MAX_CAPTAIN_DOCUMENT_BYTES)
  return {body:original,contentType:original.type,extension:kind,originalBytes:original.size,compressed:false};
 const converted=await compressPhoto(original);
 return {body:converted,contentType:'image/jpeg',extension:'jpg',originalBytes:original.size,compressed:true};
}
