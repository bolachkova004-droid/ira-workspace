import {useEffect} from 'react'
import {useLocation,useNavigate} from 'react-router-dom'
import {getTelegramApp} from '../telegram'

const rootRoutes = new Set(['/','/students','/calendar','/content','/more'])

export default function TelegramBridge(){
  const location=useLocation()
  const navigate=useNavigate()

  useEffect(()=>{
    const button=getTelegramApp()?.BackButton
    if(!button)return
    const goBack=()=>navigate(-1)
    if(rootRoutes.has(location.pathname))button.hide()
    else{button.show();button.onClick(goBack)}
    return()=>button.offClick(goBack)
  },[location.pathname,navigate])

  return null
}
