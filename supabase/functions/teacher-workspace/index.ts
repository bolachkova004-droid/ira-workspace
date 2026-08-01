import {createClient} from 'npm:@supabase/supabase-js@2'

const cors={
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET,PUT,OPTIONS',
  'access-control-allow-headers':'content-type,x-telegram-init-data',
  'content-type':'application/json'
}

type TelegramUser={id:number;first_name?:string;last_name?:string;username?:string}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(!['GET','PUT'].includes(request.method))return json({error:'Method not allowed'},405)

  const initData=request.headers.get('x-telegram-init-data')||''
  const user=await validateInitData(initData,Deno.env.get('TELEGRAM_BOT_TOKEN')||'')
  if(!user)return json({error:'Invalid Telegram authorization'},401)

  const allowed=Deno.env.get('TEACHER_TELEGRAM_ID')
  if(allowed&&String(user.id)!==allowed)return json({error:'This Telegram account is not allowed'},403)

  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
  if(request.method==='GET'){
    const {data,error}=await supabase.from('workspace_snapshots').select('data,updated_at').eq('teacher_telegram_id',user.id).maybeSingle()
    if(error)return json({error:error.message},500)
    if(!data)return json({data:null},200)
    return json({data:data.data,updatedAt:data.updated_at})
  }

  const body=await request.json().catch(()=>null) as {data?:unknown}|null
  if(!body||typeof body.data!=='object'||body.data===null)return json({error:'Invalid snapshot'},400)
  const encoded=new TextEncoder().encode(JSON.stringify(body.data))
  if(encoded.byteLength>2_500_000)return json({error:'Snapshot is too large'},413)
  const {error}=await supabase.from('workspace_snapshots').upsert({teacher_telegram_id:user.id,data:body.data,updated_at:new Date().toISOString()},{onConflict:'teacher_telegram_id'})
  if(error)return json({error:error.message},500)
  return json({ok:true})
})

function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:cors})}

async function validateInitData(raw:string,botToken:string):Promise<TelegramUser|null>{
  if(!raw||!botToken)return null
  const params=new URLSearchParams(raw)
  const receivedHash=params.get('hash')
  const authDate=Number(params.get('auth_date')||0)
  if(!receivedHash||!authDate||Math.abs(Date.now()/1000-authDate)>86400)return null
  params.delete('hash')
  const dataCheck=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}=${value}`).join('\n')
  const encoder=new TextEncoder()
  const secret=await hmac(encoder.encode('WebAppData'),encoder.encode(botToken))
  const signature=await hmac(secret,encoder.encode(dataCheck))
  if(!safeEqual(toHex(signature),receivedHash))return null
  try{return JSON.parse(params.get('user')||'null') as TelegramUser|null}catch{return null}
}

async function hmac(keyData:Uint8Array,data:Uint8Array){
  const key=await crypto.subtle.importKey('raw',keyData,{name:'HMAC',hash:'SHA-256'},false,['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,data))
}
function toHex(bytes:Uint8Array){return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('')}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0}
