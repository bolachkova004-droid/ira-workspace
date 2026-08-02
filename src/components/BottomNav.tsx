import {CalendarDays,House,LayoutDashboard,Users} from 'lucide-react'
import {NavLink} from 'react-router-dom'
import {haptic} from '../telegram'
import {RasmusMark} from './Monster'

const items=[
  ['/', 'Главная', House],
  ['/students', 'Ученики', Users],
  ['/calendar', 'Календарь', CalendarDays],
  ['/content', 'Контент', LayoutDashboard]
] as const

export default function BottomNav(){
  return <nav className="bottom-nav" aria-label="Основная навигация">
    {items.map(([to,label,Icon])=><NavLink key={to} to={to} end={to==='/' } onClick={()=>haptic()} className={({isActive})=>isActive?'nav-link active':'nav-link'}><Icon/><span>{label}</span></NavLink>)}
    <NavLink to="/reminders" onClick={()=>haptic()} className={({isActive})=>isActive?'nav-link rasmus-nav active':'nav-link rasmus-nav'}>{({isActive})=><><RasmusMark active={isActive}/><span>Расмус</span></>}</NavLink>
  </nav>
}
