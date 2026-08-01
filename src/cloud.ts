import {getTelegramApp} from './telegram'

export type CloudState='local'|'loading'|'connected'|'error'

declare global{interface Window{__IRA_CONFIG__?:{SUPABASE_URL?:string;BOT_USERNAME?:string;APP_URL?:string}}}

function env(){
  const vite=(import.meta as ImportMeta & {env?:Record<string,string|undefined>}).env||{}
  const runtime=window.__IRA_CONFIG__||{}
  return {
    supabaseUrl:vite.VITE_SUPABASE_URL||runtime.SUPABASE_URL||'',
    botUsername:vite.VITE_BOT_USERNAME||runtime.BOT_USERNAME||'ira_workspace_bot',
    appUrl:vite.VITE_APP_URL||runtime.APP_URL||`${window.location.origin}${window.location.pathname}`
  }
}
export function getRuntimeConfig(){return env()}
export function getCloudMode(){
  const values=env()
  const url=values.supabaseUrl.replace(/\/$/,'')
  const initData=getTelegramApp()?.initData||''
  return url&&initData?{url,initData}:null
}

export async function loadTeacherSnapshot(){
  const config=getCloudMode();if(!config)return null
  const response=await fetch(`${config.url}/functions/v1/teacher-workspace`,{headers:{'x-telegram-init-data':config.initData}})
  if(response.status===404)return null
  if(!response.ok)throw new Error(await response.text())
  const payload=await response.json()
  return payload?.data??null
}

export async function saveTeacherSnapshot(data:unknown){
  const config=getCloudMode();if(!config)return false
  const response=await fetch(`${config.url}/functions/v1/teacher-workspace`,{method:'PUT',headers:{'content-type':'application/json','x-telegram-init-data':config.initData},body:JSON.stringify({data})})
  if(!response.ok)throw new Error(await response.text())
  return true
}

export async function loadStudentSnapshot(token:string){
  const url=env().supabaseUrl.replace(/\/$/,'');if(!url)return null
  const response=await fetch(`${url}/functions/v1/student-data?token=${encodeURIComponent(token)}`)
  if(!response.ok)throw new Error(await response.text())
  return response.json()
}

export async function studentAction(token:string,action:string,payload:unknown){
  const url=env().supabaseUrl.replace(/\/$/,'');if(!url)return null
  const response=await fetch(`${url}/functions/v1/student-data`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,action,payload})})
  if(!response.ok)throw new Error(await response.text())
  return response.json()
}
