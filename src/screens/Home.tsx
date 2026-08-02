import {ArrowRight,Bell,Check,Plus} from 'lucide-react'
import {Link} from 'react-router-dom'
import Monster from '../components/Monster'
import type {Lesson,Notification,Payment,Student,Task} from '../types'

type Props={
  students:Student[]
  lessons:Lesson[]
  tasks:Task[]
  payments:Payment[]
  notifications:Notification[]
  stats:{activeStudents:number;activeLeads:number;todayLessons:number;revenue:number;debt:number;conversion:number}
  insights:string[]
  addTask:(s:string)=>void
  toggleTask:(id:string)=>void
}

const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

export default function Home({students,lessons,tasks,payments,notifications,stats,insights,addTask,toggleTask}:Props){
  const now=new Date()
  const today=lessons.filter(item=>item.date===localDate(now)&&item.status!=='Отменён').sort((a,b)=>a.time.localeCompare(b.time))
  const overdue=payments.filter(item=>item.status==='Просрочено')
  const lowPackage=students.filter(item=>item.status==='Активный'&&item.packageTotal-item.packageUsed<=1)
  const primaryStudent=overdue[0]?students.find(item=>item.id===overdue[0].studentId):lowPackage[0]
  const primaryAmount=overdue[0]?.amount||Math.max(0,Math.abs(primaryStudent?.balance||0))
  const add=()=>{const value=prompt('Новая задача');if(value?.trim())addTask(value.trim())}
  const activeTasks=tasks.filter(item=>!item.done).slice(0,4)

  return <section className="screen rasmus-home">
    <header className="rasmus-topbar">
      <div className="rasmus-brand"><span className="brand-cat"><Monster small/></span><span>Панель</span></div>
      <Link className="top-icon" to="/reminders" aria-label="Напоминания"><Bell/><i>{notifications.filter(x=>x.status==='Запланировано').length}</i></Link>
    </header>

    <section className="rasmus-hero">
      <p className="eyebrow">Расмус докладывает</p>
      <div className="rasmus-report">
        <Monster/>
        <div className="speech-bubble">
          {primaryStudent?<><b>{primaryStudent.name.split(' ')[0]} {overdue.length?'ждёт напоминание об оплате.':'на последнем занятии пакета.'}</b> {primaryAmount?`Сумма — ${primaryAmount.toLocaleString('ru-RU')} ₽.`:'Лучше предложить продлить пакет заранее.'}</>:<><b>Сегодня всё спокойно.</b> Можно сосредоточиться на уроках и контенте.</>}
        </div>
      </div>
      <div className="report-chips">
        {primaryAmount>0&&<Link to="/reminders" className="report-chip money"><i/> {primaryAmount.toLocaleString('ru-RU')} ₽ к оплате</Link>}
        <Link to="/leads" className="report-chip lead"><i/> {stats.activeLeads} заявки в работе</Link>
        {lowPackage[0]&&<Link to={`/students/${lowPackage[0].id}`} className="report-chip"><i/> {lowPackage[0].packageTotal-lowPackage[0].packageUsed} занятие в пакете</Link>}
      </div>
    </section>

    <section className="rasmus-section">
      <div className="section-heading"><div><p className="eyebrow">Сегодня</p><h2>Коротко</h2></div></div>
      <div className="rasmus-stat-grid">
        <article><i/><span>Уроки сегодня</span><strong>{today.length}</strong></article>
        <article><i/><span>Активные ученики</span><strong>{stats.activeStudents}</strong></article>
        <article><i/><span>Заявки в работе</span><strong>{stats.activeLeads}</strong></article>
        <article className="money"><i/><span>К оплате</span><strong>{stats.debt.toLocaleString('ru-RU')} ₽</strong></article>
      </div>
    </section>

    <section className="rasmus-section">
      <div className="section-heading"><div><p className="eyebrow">Расписание</p><h2>Сегодня</h2></div><Link to="/calendar">Все уроки <ArrowRight/></Link></div>
      <div className="rasmus-timeline">
        {today.map((lesson,index)=><Link to={`/lesson/${lesson.id}`} className="rasmus-timeline-row" key={lesson.id}>
          <time>{lesson.time}</time><span className="timeline-track"><i/><b className={index===today.length-1?'last':''}/></span>
          <span className="timeline-person"><strong>{lesson.student}</strong><small>{lesson.topic}</small></span>
          <span className="level-pill">{students.find(x=>x.id===lesson.studentId)?.level||'Пробный'}</span>
        </Link>)}
        {!today.length&&<div className="empty-dark">Сегодня уроков нет.</div>}
      </div>
    </section>

    <section className="rasmus-section compact-section">
      <div className="section-heading"><div><p className="eyebrow">Фокус</p><h2>На сегодня</h2></div><button className="top-icon plain" onClick={add}><Plus/></button></div>
      <div className="dark-task-list">{activeTasks.map(item=><button key={item.id} onClick={()=>toggleTask(item.id)}><span className="dark-check">{item.done&&<Check/>}</span><span><strong>{item.title}</strong><small>{item.category} · {item.due}</small></span></button>)}{!activeTasks.length&&<p className="empty-dark">Список чист. Расмус одобряет.</p>}</div>
    </section>
  </section>
}
