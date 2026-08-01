import {BarChart3,ChevronRight,Settings,Sparkles,Workflow} from 'lucide-react'
import {Link} from 'react-router-dom'
import PageHeader from '../components/PageHeader'

type Props={stats:{activeLeads:number;conversion:number};touchpoints:{active:boolean}[]}

const items=[
  {to:'/leads',title:'Заявки',text:'Воронка от первого сообщения до оплаты',icon:Workflow},
  {to:'/ecosystem',title:'Касания',text:'Игры, ссылки, продукты и площадки',icon:Sparkles},
  {to:'/analytics',title:'Аналитика',text:'Ученики, доход, долги и конверсия',icon:BarChart3},
  {to:'/settings',title:'Настройки',text:'Тема, резервная копия и данные',icon:Settings}
]

export default function More({stats,touchpoints}:Props){
  return <section className="screen">
    <PageHeader title="Ещё" subtitle="Управление бизнесом и настройками Ira Workspace"/>
    <div className="more-stats">
      <article><span>Заявки в работе</span><strong>{stats.activeLeads}</strong></article>
      <article><span>Конверсия</span><strong>{stats.conversion}%</strong></article>
      <article><span>Активные касания</span><strong>{touchpoints.filter(x=>x.active).length}</strong></article>
    </div>
    <div className="more-grid">
      {items.map(({to,title,text,icon:Icon})=><Link className="more-card" to={to} key={to}><span className="more-icon"><Icon/></span><span className="grow"><strong>{title}</strong><small>{text}</small></span><ChevronRight size={20}/></Link>)}
    </div>
  </section>
}
