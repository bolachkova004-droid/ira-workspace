import {createClient} from 'npm:@supabase/supabase-js@2'

const headers={'content-type':'application/json'}

Deno.serve(async request=>{
  if(request.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers})
  const expected=Deno.env.get('CRON_SECRET')
  if(expected&&request.headers.get('x-cron-secret')!==expected)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers})

  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
  const botToken=Deno.env.get('TELEGRAM_BOT_TOKEN')!
  const results:any[]=[]

  // v5 snapshot mode — the live Mini App synchronizes this document.
  const {data:snapshots,error:snapshotError}=await supabase.from('workspace_snapshots').select('teacher_telegram_id,data')
  if(snapshotError)return new Response(JSON.stringify({error:snapshotError.message}),{status:500,headers})
  for(const row of snapshots??[]){
    const workspace=row.data as any
    const students=Array.isArray(workspace.students)?workspace.students:[]
    const notifications=Array.isArray(workspace.notifications)?workspace.notifications:[]
    let changed=false
    for(const item of notifications){
      if(item.status!=='Запланировано'||item.deliveryMode==='На проверку'||new Date(item.sendAt)>new Date())continue
      const student=students.find((entry:any)=>entry.id===item.studentId)
      if(!student?.telegramId){
        item.status='Ошибка';item.lastError='У ученика не привязан Telegram';changed=true
        results.push({id:item.id,ok:false,error:'missing telegramId'})
        continue
      }
      try{
        await sendTelegram(botToken,student.telegramId,item.title,item.message)
        item.status='Отправлено';item.sentAt=new Date().toISOString();delete item.lastError;changed=true
        results.push({id:item.id,ok:true,mode:'snapshot'})
      }catch(error){
        item.status='Ошибка';item.lastError=error instanceof Error?error.message:String(error);changed=true
        results.push({id:item.id,ok:false,error:item.lastError})
      }
    }
    if(changed){
      const {error}=await supabase.from('workspace_snapshots').upsert({teacher_telegram_id:row.teacher_telegram_id,data:workspace,updated_at:new Date().toISOString()},{onConflict:'teacher_telegram_id'})
      if(error)results.push({teacherTelegramId:row.teacher_telegram_id,ok:false,error:error.message})
    }
  }

  // Relational mode — retained for a future normalized migration.
  const {data:items,error}=await supabase
    .from('notifications')
    .select('id,title,message,attempts,student:students(telegram_id,name)')
    .eq('status','scheduled')
    .eq('delivery_mode','auto')
    .lte('send_at',new Date().toISOString())
    .order('send_at',{ascending:true})
    .limit(100)

  if(!error){
    for(const item of items??[]){
      const student=Array.isArray(item.student)?item.student[0]:item.student
      if(!student?.telegram_id){
        await supabase.from('notifications').update({status:'failed',attempts:(item.attempts??0)+1,last_error:'Student has no telegram_id'}).eq('id',item.id)
        results.push({id:item.id,ok:false,error:'missing telegram_id',mode:'relational'})
        continue
      }
      try{
        await sendTelegram(botToken,student.telegram_id,item.title,item.message)
        await supabase.from('notifications').update({status:'sent',sent_at:new Date().toISOString(),attempts:(item.attempts??0)+1,last_error:null}).eq('id',item.id)
        results.push({id:item.id,ok:true,mode:'relational'})
      }catch(error){
        const message=error instanceof Error?error.message:String(error)
        await supabase.from('notifications').update({status:'failed',attempts:(item.attempts??0)+1,last_error:message}).eq('id',item.id)
        results.push({id:item.id,ok:false,error:message,mode:'relational'})
      }
    }
  }

  return new Response(JSON.stringify({processed:results.length,results}),{headers})
})

async function sendTelegram(token:string,chatId:string|number,title:string,message:string){
  const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({chat_id:chatId,text:`<b>${escapeHtml(title)}</b>\n\n${escapeHtml(message)}`,parse_mode:'HTML'})
  })
  const payload=await response.json()
  if(!response.ok||!payload.ok)throw new Error(payload.description||'Telegram request failed')
}
function escapeHtml(value:string){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
