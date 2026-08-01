import {CalendarDays,House,LayoutDashboard,MoreHorizontal,Users} from 'lucide-react'
import {NavLink} from 'react-router-dom'
import {haptic} from '../telegram'

const items=[
  ['/', 'Главная', House],
  ['/students', 'Ученики', Users],
  ['/calendar', 'Календарь', CalendarDays],
  ['/content', 'Контент', LayoutDashboard],
  ['/more', 'Ещё', MoreHorizontal]
] as const

export default function BottomNav(){
  return <nav className="bottom-nav" aria-label="Основная навигация">
    {items.map(([to,label,Icon])=><NavLink key={to} to={to} end={to==='/' } onClick={()=>haptic()} className={({isActive})=>isActive?'nav-link active':'nav-link'}><Icon size={21}/><span>{label}</span></NavLink>)}
  </nav>
}
