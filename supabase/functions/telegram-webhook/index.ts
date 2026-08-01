import {createClient} from 'npm:@supabase/supabase-js@2'

type TelegramUpdate={message?:{chat:{id:number};from?:{id:number;username?:string;first_name?:string};text?:string}}

Deno.serve(async request=>{
  if(request.method!=='POST')return new Response('ok')
  const secret=Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  if(secret&&request.headers.get('x-telegram-bot-api-secret-token')!==secret)return new Response('unauthorized',{status:401})
  const update=await request.json() as TelegramUpdate
  const message=update.message
  if(!message?.chat?.id)return new Response('ok')

  const botToken=Deno.env.get('TELEGRAM_BOT_TOKEN')!
  const appUrl=Deno.env.get('PUBLIC_APP_URL')!
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
  const text=message.text??''
  const startPayload=text.startsWith('/start ')?text.slice(7).trim():''

  if(startPayload.startsWith('access_')){
    const token=startPayload.slice('access_'.length)

    // v5 snapshot mode.
    const {data:rows}=await supabase.from('workspace_snapshots').select('teacher_telegram_id,data')
    for(const row of rows??[]){
      const workspace=row.data as any
      const students=Array.isArray(workspace.students)?workspace.students:[]
      const index=students.findIndex((item:any)=>item.accessToken===token)
      if(index>=0){
        students[index]={...students[index],telegramId:String(message.from?.id||message.chat.id),telegram:message.from?.username?`@${message.from.username}`:students[index].telegram,notificationsEnabled:true}
        workspace.students=students
        await supabase.from('workspace_snapshots').upsert({teacher_telegram_id:row.teacher_telegram_id,data:workspace,updated_at:new Date().toISOString()},{onConflict:'teacher_telegram_id'})
        await send(botToken,message.chat.id,'Готово! Telegram привязан к расписанию. Теперь напоминания об уроках, оплатах и переносах будут приходить сюда.',{
          inline_keyboard:[[{text:'Открыть мой кабинет',web_app:{url:`${appUrl.replace(/\/$/,'')}/#/student/${token}`}}]]
        })
        return new Response('ok')
      }
    }

    // Relational fallback.
    const {data:access}=await supabase.from('student_access_tokens').select('student_id,revoked_at,expires_at').eq('token',token).maybeSingle()
    if(!access||access.revoked_at||(access.expires_at&&new Date(access.expires_at)<new Date())){
      await send(botToken,message.chat.id,'Эта ссылка больше не действует. Попросите преподавателя прислать новую.')
      return new Response('ok')
    }
    await supabase.from('students').update({telegram_id:message.from?.id,telegram_username:message.from?.username||null}).eq('id',access.student_id)
    await send(botToken,message.chat.id,'Готово! Telegram привязан к расписанию. Теперь напоминания будут приходить сюда.',{
      inline_keyboard:[[{text:'Открыть мой кабинет',web_app:{url:`${appUrl.replace(/\/$/,'')}/#/student/${token}`}}]]
    })
    return new Response('ok')
  }

  await send(botToken,message.chat.id,'Ira Workspace — расписание, домашнее и напоминания об уроках. Откройте приложение кнопкой ниже.',{
    keyboard:[[{text:'Открыть Ira Workspace',web_app:{url:appUrl}}]],resize_keyboard:true
  })
  return new Response('ok')
})

async function send(token:string,chatId:number,text:string,replyMarkup?:unknown){
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text,reply_markup:replyMarkup})})
}
