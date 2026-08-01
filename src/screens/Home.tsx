import {ArrowRight,Check,Clock3,Plus,Sparkles} from 'lucide-react'
import {Link} from 'react-router-dom'
import Monster from '../components/Monster'
import {getTelegramUser,haptic} from '../telegram'
import type {Lead,Lesson,Student,Task} from '../types'

type P={students:Student[];leads:Lead[];lessons:Lesson[];tasks:Task[];stats:{activeStudents:number;activeLeads:number;todayLessons:number;revenue:number;debt:number;conversion:number};insights:string[];addTask:(s:string)=>void;toggleTask:(id:string)=>void;deleteTask:(id:string)=>void}

const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const greeting=(hour:number)=>hour<5?'Доброй ночи':hour<12?'Доброе утро':hour<18?'Добрый день':'Добрый вечер'

export default function Home({lessons,tasks,stats,insights,addTask,toggleTask}:P){
  const now=new Date()
  const today=lessons.filter(l=>l.date===localDate(now)&&l.status!=='Отменён').sort((a,b)=>a.time.localeCompare(b.time))
  const firstName=getTelegramUser()?.first_name||'Ира'
  const add=()=>{const title=prompt('Новая задача');if(title?.trim()){addTask(title.trim());haptic('success')}}
  return <section className="screen">
    <header className="hero">
      <div><p className="eyebrow">{now.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</p><h1>{greeting(now.getHours())}, {firstName}</h1><p className="muted">Всё важное на сегодня — в одном месте.</p></div>
      <Monster small/>
    </header>
    <div className="assistant-panel"><Monster/><div><span className="pill"><Sparkles size={14}/> Иви подсказывает</span><h2>{insights[0]||'Сегодня всё спокойно'}</h2>{insights.slice(1).map(x=><p key={x}>{x}</p>)}</div></div>
    <div className="metric-grid"><article><span>Уроки сегодня</span><strong>{stats.todayLessons}</strong></article><article><span>Активные ученики</span><strong>{stats.activeStudents}</strong></article><article><span>Заявки в работе</span><strong>{stats.activeLeads}</strong></article><article><span>К оплате</span><strong>{stats.debt.toLocaleString('ru-RU')} ₽</strong></article></div>
    <div className="two-col">
      <section className="panel"><div className="section-head"><div><span className="kicker">Расписание</span><h2>Сегодня</h2></div><Link className="text-link" to="/calendar">Все уроки <ArrowRight size={16}/></Link></div><div className="timeline">{today.map(l=><Link to={`/lesson/${l.id}`} className="lesson-row" key={l.id}><div className="time"><Clock3 size={16}/>{l.time}</div><div><strong>{l.student}</strong><span>{l.topic}</span></div><span className={l.paid?'status ok':'status warn'}>{l.paid?'Оплачено':'Не оплачено'}</span></Link>)}{!today.length&&<p className="empty-line">На сегодня уроков нет.</p>}</div></section>
      <section className="panel"><div className="section-head"><div><span className="kicker">Фокус</span><h2>Задачи</h2></div><button type="button" className="icon-btn" aria-label="Добавить задачу" onClick={add}><Plus/></button></div><div className="task-list">{tasks.map(t=><button type="button" key={t.id} className={t.done?'task done':'task'} onClick={()=>{toggleTask(t.id);haptic()}}><span className="check">{t.done&&<Check size={15}/>}</span><span><strong>{t.title}</strong><small>{t.category} · {t.due}</small></span></button>)}</div></section>
    </div>
  </section>
}
