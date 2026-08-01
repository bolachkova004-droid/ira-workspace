import {BarChart3,Bell,ChevronRight,Settings,Sparkles,Workflow} from 'lucide-react'
import {Link} from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import type {Notification} from '../types'

type Props={stats:{activeLeads:number;conversion:number};touchpoints:{active:boolean}[];notifications:Notification[]}

const items=[
  {to:'/reminders',title:'Оповещения',text:'Уроки, оплаты, переносы и домашние задания',icon:Bell},
  {to:'/leads',title:'Заявки',text:'Воронка от первого сообщения до оплаты',icon:Workflow},
  {to:'/ecosystem',title:'Касания',text:'Игры, ссылки, продукты и площадки',icon:Sparkles},
  {to:'/analytics',title:'Аналитика',text:'Ученики, доход, долги и конверсия',icon:BarChart3},
  {to:'/settings',title:'Настройки',text:'Интеграции, тема и резервная копия',icon:Settings}
]

export default function More({stats,touchpoints,notifications}:Props){
  return <section className="screen">
    <PageHeader eyebrow="Разделы" title="Ещё" subtitle="Всё, что помогает управлять преподаванием как системой."/>
    <div className="more-stats">
      <article><span>Оповещения в очереди</span><strong>{notifications.filter(x=>x.status==='Запланировано').length}</strong></article>
      <article><span>Заявки в работе</span><strong>{stats.activeLeads}</strong></article>
      <article><span>Активные касания</span><strong>{touchpoints.filter(x=>x.active).length}</strong></article>
    </div>
    <div className="more-grid">{items.map(({to,title,text,icon:Icon})=><Link className="more-card paper-sheet" to={to} key={to}><span className="more-icon"><Icon/></span><span className="grow"><strong>{title}</strong><small>{text}</small></span><ChevronRight size={20}/></Link>)}</div>
  </section>
}
