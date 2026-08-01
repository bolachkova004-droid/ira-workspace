import {createClient} from 'npm:@supabase/supabase-js@2'

const cors={
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET,POST,OPTIONS',
  'access-control-allow-headers':'authorization, x-client-info, apikey, content-type',
  'content-type':'application/json'
}

type SnapshotRow={teacher_telegram_id:number;data:Record<string,unknown>}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors})
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})

  let token=''
  let action=''
  let payload:any={}
  if(request.method==='GET')token=new URL(request.url).searchParams.get('token')||''
  else if(request.method==='POST'){
    const body=await request.json().catch(()=>null) as {token?:string;action?:string;payload?:unknown}|null
    token=body?.token||'';action=body?.action||'';payload=body?.payload||{}
  }else return json({error:'Method not allowed'},405)
  if(!token)return json({error:'Missing token'},400)

  const snapshot=await findSnapshot(supabase,token)
  if(snapshot){
    const data=snapshot.row.data as any
    const student=snapshot.student
    if(request.method==='GET')return json({
      student,
      lessons:(data.lessons||[]).filter((item:any)=>item.studentId===student.id),
      payments:(data.payments||[]).filter((item:any)=>item.studentId===student.id),
      homeworks:(data.homeworks||[]).filter((item:any)=>item.studentId===student.id),
      materials:(data.materials||[]).filter((item:any)=>item.studentId===student.id)
    })

    if(action==='request_reschedule'){
      const lesson=(data.lessons||[]).find((item:any)=>item.id===payload.lessonId&&item.studentId===student.id)
      if(!lesson)return json({error:'Lesson not found'},404)
      const id=crypto.randomUUID()
      data.rescheduleRequests=[{id,studentId:student.id,lessonId:lesson.id,requestedDate:String(payload.requestedDate||''),requestedTime:String(payload.requestedTime||''),comment:String(payload.comment||''),status:'Новая',createdAt:new Date().toISOString()},...(data.rescheduleRequests||[])]
      data.tasks=[{id:crypto.randomUUID(),title:`Запрос переноса: ${student.name} — ${lesson.date}`,due:'Сегодня',done:false,category:'Урок'},...(data.tasks||[])]
      await saveSnapshot(supabase,snapshot.row.teacher_telegram_id,data)
      return json({ok:true,id})
    }

    if(action==='homework_status'){
      const allowed=new Set(['Назначено','Выполнено','Просрочено'])
      if(!allowed.has(String(payload.status)))return json({error:'Invalid status'},400)
      let changed=false
      data.homeworks=(data.homeworks||[]).map((item:any)=>{if(item.id===payload.homeworkId&&item.studentId===student.id){changed=true;return {...item,status:payload.status}}return item})
      if(!changed)return json({error:'Homework not found'},404)
      await saveSnapshot(supabase,snapshot.row.teacher_telegram_id,data)
      return json({ok:true})
    }
    return json({error:'Unknown action'},400)
  }

  // Relational fallback for a future normalized migration.
  const {data:access}=await supabase.from('student_access_tokens').select('student_id,revoked_at,expires_at').eq('token',token).maybeSingle()
  if(!access||access.revoked_at||(access.expires_at&&new Date(access.expires_at)<new Date()))return json({error:'Invalid access'},401)
  if(request.method==='POST')return json({error:'Action is not available for this access mode'},409)

  const studentId=access.student_id
  const [{data:student},{data:lessons},{data:payments},{data:homeworks},{data:materials}]=await Promise.all([
    supabase.from('students').select('id,name,level,goal,package_total,package_used,balance,telegram_username').eq('id',studentId).single(),
    supabase.from('lessons').select('id,student_id,starts_at,duration_minutes,topic,status,paid,meeting_link,previous_starts_at').eq('student_id',studentId).gte('starts_at',new Date(Date.now()-86400000).toISOString()).order('starts_at'),
    supabase.from('payments').select('id,student_id,amount,due_at,paid_at,status,comment').eq('student_id',studentId).order('due_at',{ascending:false}),
    supabase.from('homeworks').select('id,student_id,title,description,due_at,status').eq('student_id',studentId).order('due_at'),
    supabase.from('materials').select('id,student_id,title,kind,url,description').eq('student_id',studentId).order('created_at',{ascending:false})
  ])
  return json({student,lessons:lessons??[],payments:payments??[],homeworks:homeworks??[],materials:materials??[]})
})

function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:cors})}

async function findSnapshot(supabase:any,token:string):Promise<{row:SnapshotRow;student:any}|null>{
  const {data:rows,error}=await supabase.from('workspace_snapshots').select('teacher_telegram_id,data')
  if(error)throw error
  for(const row of rows??[]){
    const students=Array.isArray(row.data?.students)?row.data.students:[]
    const student=students.find((item:any)=>item.accessToken===token)
    if(student)return {row,student}
  }
  return null
}
async function saveSnapshot(supabase:any,teacherTelegramId:number,data:unknown){
  const {error}=await supabase.from('workspace_snapshots').upsert({teacher_telegram_id:teacherTelegramId,data,updated_at:new Date().toISOString()},{onConflict:'teacher_telegram_id'})
  if(error)throw error
}
