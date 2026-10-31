export class RequestBodyTooLargeError extends Error {
  constructor(){
    super("Request body exceeds the configured limit.");
    this.name = "RequestBodyTooLargeError";
  }
}
export async function readJsonObjectBody(request, maxBytes = 1_000_000) {
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while(true){
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(()=>undefined);
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally{
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks){
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  if (!text) return {};
  const value = JSON.parse(text);
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
