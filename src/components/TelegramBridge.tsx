import {useEffect} from 'react'
import {useLocation,useNavigate} from 'react-router-dom'
import {getTelegramApp,safeTelegramCall} from '../telegram'

const rootRoutes = new Set(['/','/students','/calendar','/content','/more'])

export default function TelegramBridge(){
  const location=useLocation()
  const navigate=useNavigate()

  useEffect(()=>{
    const button=getTelegramApp()?.BackButton
    if(!button)return
    const goBack=()=>navigate(-1)

    if(rootRoutes.has(location.pathname))safeTelegramCall(()=>button.hide())
    else{
      safeTelegramCall(()=>button.show())
      safeTelegramCall(()=>button.onClick(goBack))
    }

    return()=>safeTelegramCall(()=>button.offClick(goBack))
  },[location.pathname,navigate])

  return null
}
