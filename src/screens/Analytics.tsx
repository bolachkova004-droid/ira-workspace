import {useState} from 'react'
import Monster from '../components/Monster'
import type {Lead,Lesson,Student,Touchpoint} from '../types'

type Props={stats:{activeStudents:number;activeLeads:number;todayLessons:number;revenue:number;debt:number;conversion:number};students:Student[];leads:Lead[];lessons:Lesson[];touchpoints:Touchpoint[]}

export default function Analytics({stats,students,leads,lessons,touchpoints}:Props){
  const [period,setPeriod]=useState<7|30|90>(30)
  const totalClicks=touchpoints.reduce((sum,item)=>sum+item.clicks,0)
  const totalLeads=touchpoints.reduce((sum,item)=>sum+item.leads,0)
  const conversion=totalClicks?Math.round(totalLeads/totalClicks*1000)/10:stats.conversion
  const sorted=[...touchpoints].sort((a,b)=>b.clicks-a.clicks)
  const top=sorted[0]
  const funnelStart=Math.max(1,top?.clicks||totalClicks)
  const middle=Math.round(funnelStart*.63)
  const finished=Math.round(funnelStart*.46)
  const applications=Math.max(top?.leads||totalLeads,Math.round(funnelStart*.18))
  return <section className="screen rasmus-analytics">
    <header className="inner-topbar"><span/><strong>Аналитика</strong><span/></header>
    <div className="period-switch">{([7,30,90] as const).map(item=><button className={period===item?'active':''} onClick={()=>setPeriod(item)} key={item}>{item} дней</button>)}</div>

    <section className="rasmus-section"><div className="section-heading"><div><p className="eyebrow">Общая картина</p><h2>За {period} дней</h2></div></div><div className="analytics-concept-grid"><article><i/><span>Переходы по ссылкам</span><strong>{totalClicks}</strong><small className="up">▲ 18% к периоду</small></article><article className="green"><i/><span>Заявки</span><strong>{totalLeads||stats.activeLeads}</strong><small className="up">▲ {Math.max(1,totalLeads)}</small></article><article className="green"><i/><span>Проведено уроков</span><strong>{lessons.filter(x=>x.status==='Проведён').length}</strong><small className="up">активных учеников {students.filter(x=>x.status==='Активный').length}</small></article><article><i/><span>Конверсия в заявку</span><strong>{conversion}%</strong><small className={conversion>=8?'up':'down'}>{conversion>=8?'▲':'▼'} к цели 8%</small></article></div></section>

    <section className="rasmus-section"><div className="section-heading"><div><p className="eyebrow">По ссылкам</p><h2>Что тащит трафик</h2></div></div><div className="traffic-list">{sorted.map(item=><article key={item.id}><span className="traffic-icon">{item.kind==='Игра'?'🕵️':item.kind==='Соцсеть'?'🔗':item.kind==='Продукт'?'📦':'🪞'}</span><div className="grow"><strong>{item.title}</strong><small>{item.kind.toLowerCase()} · {item.leads} заявок</small></div><div><strong>{item.clicks}</strong><small className={item.active?'up':'down'}>{item.active?'▲ активно':'пауза'}</small></div></article>)}</div></section>

    <section className="rasmus-section"><div className="section-heading"><div><p className="eyebrow">Воронка</p><h2>{top?.title||'Главное касание'}</h2></div></div><div className="funnel-concept">{[
      ['Начали',funnelStart,100],['Дошли до середины',middle,63],['Закончили полностью',finished,46],['Оставили заявку',applications,Math.round(applications/funnelStart*100)]
    ].map(([label,count,width],index)=><div key={String(label)}><header><strong>{label}</strong><span>{count} · {width}%</span></header><i><b className={index===3?'drop':''} style={{width:`${width}%`}}/></i></div>)}</div></section>

    <section className="rasmus-aside"><Monster small mood="thinking"/><p><b>Расмус:</b> {top?`${top.title} даёт больше всего переходов. Смотри, на каком этапе люди перестают двигаться дальше.`:'добавь ссылки и игры в раздел «Касания», чтобы увидеть настоящую воронку.'}</p></section>
  </section>
}
