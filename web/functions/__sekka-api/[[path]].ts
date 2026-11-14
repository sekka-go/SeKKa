// The legacy proxy is deliberately unreachable in the replacement preview.
// Production remains on main until an approved cutover.
export function onRequest() {
 return new Response(JSON.stringify({error:'واجهة الخدمة القديمة غير متاحة في النسخة الجديدة.'}),{status:410,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
