export type GoogleTokenResult={ok:true;token:string}|{ok:false;revoked:boolean};
export async function googleAccessToken(refreshToken:string,fetcher:typeof fetch=fetch):Promise<GoogleTokenResult>{
  const clientId=process.env.GOOGLE_CLIENT_ID,clientSecret=process.env.GOOGLE_CLIENT_SECRET;
  if(!clientId||!clientSecret)return {ok:false,revoked:false};
  let response:Response;
  try{response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'}),signal:AbortSignal.timeout(10000)});}catch{return {ok:false,revoked:false};}
  const body=await response.json().catch(()=>({})) as {access_token?:unknown;error?:unknown};
  if(response.ok&&typeof body.access_token==='string'&&body.access_token)return {ok:true,token:body.access_token};
  return {ok:false,revoked:response.status===400&&body.error==='invalid_grant'};
}
export async function searchConsoleSites(token:string,fetcher:typeof fetch=fetch){
  let response:Response;try{response=await fetcher('https://www.googleapis.com/webmasters/v3/sites',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});}catch{throw new Error('google_unavailable');}
  if(!response.ok)throw new Error(response.status===401?'google_unauthorized':'google_unavailable');
  const body=await response.json().catch(()=>null) as {siteEntry?:unknown}|null;if(!body||!Array.isArray(body.siteEntry)&&body.siteEntry!==undefined)throw new Error('google_malformed');
  return (body.siteEntry||[]).map(entry=>{
    if(!entry||typeof entry!=='object'||typeof (entry as {siteUrl?:unknown}).siteUrl!=='string')throw new Error('google_malformed');return (entry as {siteUrl:string}).siteUrl;
  });
}
export async function readSearchConsoleSettings(req:Request){
  const length=Number(req.headers.get('content-length')||0);if(length>2048)throw new Error('invalid_input');const text=await req.text();if(Buffer.byteLength(text)>2048)throw new Error('invalid_input');
  const value=JSON.parse(text) as unknown;if(!value||typeof value!=='object')throw new Error('invalid_input');const siteUrl=(value as {siteUrl?:unknown}).siteUrl;if(typeof siteUrl!=='string'||siteUrl.length>500||!siteUrl.trim())throw new Error('invalid_input');return siteUrl.trim();
}
