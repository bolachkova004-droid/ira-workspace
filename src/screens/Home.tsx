import {ArrowRight,Bell,BookOpen,Check,Clock3,CreditCard,Plus,Sparkles} from 'lucide-react'
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
  const todayKey=localDate(now)
  const today=lessons.filter(item=>item.date===todayKey&&item.status!=='Отменён').sort((a,b)=>a.time.localeCompare(b.time))
  const next=today.find(item=>item.time>=now.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}))||today[0]
  const overdue=payments.filter(item=>item.status==='Просрочено')
  const activeTasks=tasks.filter(item=>!item.done)
  const add=()=>{const title=prompt('Что добавить в план?');if(title?.trim())addTask(title.trim())}

  return <section className="screen home-planner">
    <header className="planner-hero">
      <div className="planner-greeting"><p className="eyebrow">{now.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</p><h1>Мой рабочий день</h1><p className="muted">Спокойный план уроков, оплат и задач — без ощущения бесконечной CRM.</p></div>
      <div className="planner-mascot"><Monster/><span className="mascot-note">{insights[0]||'Сегодня всё идёт по плану ✨'}</span></div>
    </header>

    <div className="planner-dashboard">
      <section className="today-page paper-sheet ruled-paper">
        <div className="paper-tab">Сегодня</div>
        <div className="section-head"><div><span className="kicker">Расписание</span><h2>{today.length?`${today.length} урока на сегодня`:'Свободный день'}</h2></div><Link className="text-link" to="/calendar">Календарь <ArrowRight size={16}/></Link></div>
        <div className="planner-timeline">{today.map(item=><Link to={`/lesson/${item.id}`} key={item.id}><time>{item.time}</time><span className="timeline-pin"/><div className="grow"><strong>{item.student}</strong><span>{item.topic}</span></div><span className={item.paid?'status ok':'status warn'}>{item.paid?'Оплачено':'К оплате'}</span></Link>)}{!today.length&&<div className="empty-planner"><BookOpen/><p>Можно заняться контентом, материалами или просто выдохнуть.</p></div>}</div>
      </section>

      <aside className="planner-side">
        <section className="next-card notebook-card">
          <span className="kicker">Следующий урок</span>
          {next?<><div className="next-time"><Clock3/><strong>{next.time}</strong></div><h2>{next.student}</h2><p>{next.topic}</p><Link className="primary wide" to={`/lesson/${next.id}`}>Открыть подготовку</Link></>:<><h2>На сегодня всё</h2><p className="muted">Ближайшие уроки можно посмотреть в календаре.</p></>}
        </section>
        <section className="mini-stats-grid">
          <article className="paper-sheet"><span>Ученики</span><strong>{stats.activeStudents}</strong></article>
          <article className="paper-sheet"><span>К оплате</span><strong>{stats.debt.toLocaleString('ru-RU')} ₽</strong></article>
          <article className="paper-sheet"><span>Заявки</span><strong>{stats.activeLeads}</strong></article>
          <article className="paper-sheet"><span>Напоминания</span><strong>{notifications.filter(x=>x.status==='Запланировано').length}</strong></article>
        </section>
      </aside>
    </div>

    <div className="planner-bottom">
      <section className="paper-sheet task-paper">
        <div className="section-head"><div><span className="kicker">Daily notes</span><h2>План на день</h2></div><button className="icon-btn" onClick={add}><Plus/></button></div>
        <div className="task-list">{activeTasks.slice(0,6).map(item=><button key={item.id} className="task" onClick={()=>toggleTask(item.id)}><span className="check">{item.done&&<Check size={15}/>}</span><span><strong>{item.title}</strong><small>{item.category} · {item.due}</small></span></button>)}</div>
      </section>
      <section className="paper-sheet attention-paper">
        <div className="section-head"><div><span className="kicker">Иви заметила</span><h2>Требует внимания</h2></div><Sparkles/></div>
        <div className="attention-notes">
          {overdue.map(item=>{const student=students.find(x=>x.id===item.studentId);return <Link to="/reminders" key={item.id}><CreditCard/><span><strong>{student?.name}</strong><small>Просрочено {item.amount.toLocaleString('ru-RU')} ₽</small></span><ArrowRight/></Link>})}
          {notifications.filter(x=>x.status==='Запланировано').slice(0,2).map(item=>{const student=students.find(x=>x.id===item.studentId);return <Link to="/reminders" key={item.id}><Bell/><span><strong>{item.title}</strong><small>{student?.name}</small></span><ArrowRight/></Link>})}
          {!overdue.length&&!notifications.some(x=>x.status==='Запланировано')&&<p className="empty-line">Ничего срочного. Можно работать по плану.</p>}
        </div>
      </section>
    </div>
  </section>
}
