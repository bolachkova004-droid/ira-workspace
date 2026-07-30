import {CalendarDays,House,Settings,Users,Workflow,Sparkles} from 'lucide-react';import {NavLink} from 'react-router-dom'
const items=[['/','Главная',House],['/students','Ученики',Users],['/leads','Заявки',Workflow],['/calendar','Календарь',CalendarDays],['/ecosystem','Касания',Sparkles],['/settings','Настройки',Settings]] as const
export default function BottomNav(){return <nav className="bottom-nav">{items.map(([to,label,Icon])=><NavLink key={to} to={to} end={to==='/' } className={({isActive})=>isActive?'nav-link active':'nav-link'}><Icon size={21}/><span>{label}</span></NavLink>)}</nav>}
