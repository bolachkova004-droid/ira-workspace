import {Bell,CalendarDays,CalendarPlus,ChevronLeft,ChevronRight,Clock3,Copy,Link2,MoveRight,Trash2} from 'lucide-react'
import {useMemo,useState} from 'react'
import {Link} from 'react-router-dom'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import type {Lesson,Notification,Student} from '../types'

type Props={
  lessons:Lesson[]
  students:Student[]
  addLesson:(x:Omit<Lesson,'id'>)=>void
  rescheduleLesson:(id:string,date:string,time:string,notify?:boolean)=>void
  cancelLesson:(id:string,notify?:boolean)=>void
  getStudentAccessUrl:(studentId:string)=>string
  getStudentBotLink:(studentId:string)=>string
  queueNotification:(x:Omit<Notification,'id'|'createdAt'|'status'>)=>void
}

type View='month'|'week'|'day'
const iso=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const fromIso=(value:string)=>new Date(`${value}T12:00:00`)
const startOfWeek=(date:Date)=>{const d=new Date(date);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d}
const addDays=(date:Date,days:number)=>{const d=new Date(date);d.setDate(d.getDate()+days);return d}
const titleFor=(date:Date)=>date.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})

export default function Calendar({lessons,students,addLesson,rescheduleLesson,cancelLesson,getStudentAccessUrl,getStudentBotLink,queueNotification}:Props){
  const [view,setView]=useState<View>('month')
  const [cursor,setCursor]=useState(new Date())
  const [selected,setSelected]=useState(iso(new Date()))
  const [open,setOpen]=useState(false)
  const [moving,setMoving]=useState<Lesson|null>(null)
  const [sharing,setSharing]=useState<Student|null>(null)
  const [copied,setCopied]=useState<'portal'|'bot'|null>(null)

  const monthDays=useMemo(()=>{
    const first=new Date(cursor.getFullYear(),cursor.getMonth(),1)
    const gridStart=startOfWeek(first)
    return Array.from({length:42},(_,index)=>addDays(gridStart,index))
  },[cursor])
  const weekDays=useMemo(()=>Array.from({length:7},(_,index)=>addDays(startOfWeek(cursor),index)),[cursor])
  const visibleDays=view==='month'?monthDays:view==='week'?weekDays:[fromIso(selected)]
  const selectedLessons=lessons.filter(item=>item.date===selected).sort((a,b)=>a.time.localeCompare(b.time))
  const today=iso(new Date())

  const previous=()=>{const next=new Date(cursor);if(view==='month')next.setMonth(next.getMonth()-1);else next.setDate(next.getDate()-(view==='week'?7:1));setCursor(next);if(view==='day')setSelected(iso(next))}
  const forward=()=>{const next=new Date(cursor);if(view==='month')next.setMonth(next.getMonth()+1);else next.setDate(next.getDate()+(view==='week'?7:1));setCursor(next);if(view==='day')setSelected(iso(next))}
  const chooseDay=(date:Date)=>{setSelected(iso(date));if(view==='day')setCursor(date)}

  return <section className="screen calendar-v5">
    <PageHeader eyebrow="Paper planner" title="Календарь" subtitle="Расписание учителя и личные календари учеников — в одной системе." action={<button className="primary" onClick={()=>setOpen(true)}><CalendarPlus size={18}/>Новый урок</button>}/>

    <div className="calendar-toolbar paper-sheet">
      <div className="calendar-nav"><button className="icon-btn" onClick={previous}><ChevronLeft/></button><button className="calendar-title" onClick={()=>{const now=new Date();setCursor(now);setSelected(iso(now))}}>{view==='day'?fromIso(selected).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):titleFor(cursor)}</button><button className="icon-btn" onClick={forward}><ChevronRight/></button></div>
      <div className="view-switch">{(['month','week','day'] as const).map(item=><button className={view===item?'active':''} key={item} onClick={()=>setView(item)}>{item==='month'?'Месяц':item==='week'?'Неделя':'День'}</button>)}</div>
    </div>

    {view==='month'?<section className="month-paper paper-sheet">
      <div className="weekday-row">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=><span key={day}>{day}</span>)}</div>
      <div className="month-grid">{visibleDays.map(date=>{const dateIso=iso(date);const dayLessons=lessons.filter(item=>item.date===dateIso&&item.status!=='Отменён');const muted=date.getMonth()!==cursor.getMonth();return <button key={dateIso} className={`${selected===dateIso?'selected ':''}${today===dateIso?'today ':''}${muted?'muted-day':''}`} onClick={()=>chooseDay(date)}><span className="day-number">{date.getDate()}</span><div className="day-events">{dayLessons.slice(0,3).map(item=><i className={`event-dot ${item.paid?'paid':'unpaid'}`} key={item.id} title={`${item.time} ${item.student}`}>{item.time}</i>)}{dayLessons.length>3&&<small>+{dayLessons.length-3}</small>}</div></button>})}</div>
    </section>:view==='week'?<section className="week-paper paper-sheet"><div className="week-grid">{weekDays.map(date=>{const dateIso=iso(date);const dayLessons=lessons.filter(item=>item.date===dateIso&&item.status!=='Отменён').sort((a,b)=>a.time.localeCompare(b.time));return <article className={selected===dateIso?'active':''} key={dateIso} onClick={()=>chooseDay(date)}><header><span>{date.toLocaleDateString('ru-RU',{weekday:'short'})}</span><strong>{date.getDate()}</strong></header><div>{dayLessons.map(item=><Link to={`/lesson/${item.id}`} key={item.id}><time>{item.time}</time><span>{item.student}</span></Link>)}{!dayLessons.length&&<small>Свободно</small>}</div></article>})}</div></section>:<section className="day-paper paper-sheet ruled-paper"><div className="day-timeline">{Array.from({length:13},(_,i)=>i+8).map(hour=>{const items=selectedLessons.filter(item=>Number(item.time.slice(0,2))===hour);return <div className="timeline-hour" key={hour}><time>{String(hour).padStart(2,'0')}:00</time><div>{items.map(item=><Link className="timeline-lesson" to={`/lesson/${item.id}`} key={item.id}><strong>{item.student}</strong><span>{item.topic} · {item.duration} мин</span></Link>)}</div></div>})}</div></section>}

    <div className="calendar-lower">
      <section className="paper-sheet selected-day-panel">
        <div className="section-head"><div><span className="kicker">Выбранный день</span><h2>{fromIso(selected).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</h2></div><span className="paper-counter">{selectedLessons.length}</span></div>
        <div className="calendar-list">{selectedLessons.map(item=><article className="calendar-event-v5" key={item.id}><Link className="event-open" to={`/lesson/${item.id}`}><div className="event-time"><Clock3 size={17}/><strong>{item.time}</strong><small>{item.duration} мин</small></div><div className="event-main"><strong>{item.student}</strong><span>{item.topic}</span>{item.status==='Перенесён'&&<small>перенесён с {item.previousDate} {item.previousTime}</small>}</div></Link><div className="event-actions"><span className={item.paid?'status ok':'status warn'}>{item.paid?'Оплачено':'Не оплачено'}</span><button className="icon-btn" title="Перенести" onClick={()=>setMoving(item)}><MoveRight size={17}/></button><button className="icon-btn danger" title="Отменить" onClick={()=>confirm('Отменить урок и создать уведомление ученику?')&&cancelLesson(item.id,true)}><Trash2 size={17}/></button></div></article>)}{!selectedLessons.length&&<button className="empty-column" onClick={()=>setOpen(true)}><CalendarPlus/>Запланировать первый урок</button>}</div>
      </section>

      <aside className="paper-sheet student-access-panel">
        <div className="section-head"><div><span className="kicker">Для учеников</span><h2>Личный календарь</h2></div><Link2/></div>
        <p className="muted">Каждый ученик получает только своё расписание, домашнее и оплаты.</p>
        <div className="access-list">{students.filter(x=>x.status==='Активный').map(student=><button key={student.id} onClick={()=>{setSharing(student);setCopied(null)}}><span className="avatar small">{student.name[0]}</span><span className="grow"><strong>{student.name}</strong><small>{student.telegram||'Telegram не указан'}</small></span><Copy size={16}/></button>)}</div>
      </aside>
    </div>

    {open&&<Modal title="Новый урок" onClose={()=>setOpen(false)}><form className="form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);const studentId=String(form.get('studentId'));const student=students.find(item=>item.id===studentId);const date=String(form.get('date'));const time=String(form.get('time'));const reminder=String(form.get('notify'))==='on';addLesson({studentId:studentId||undefined,student:student?.name||'Пробное занятие',date,time,duration:Number(form.get('duration')),topic:String(form.get('topic')),status:'Запланирован',paid:false,homework:'',plan:'',notes:'',errors:'',mood:'Спокойное',meetingLink:String(form.get('meetingLink')),reminder24h:reminder,reminder2h:reminder});if(reminder&&studentId){const starts=new Date(`${date}T${time}:00`).getTime();const now=Date.now();queueNotification({studentId,kind:'custom',sendAt:new Date().toISOString(),title:'Новый урок',message:`${student?.name.split(' ')[0]}, новый урок запланирован на ${fromIso(date).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})} в ${time}.`});if(starts-now>24*3600000)queueNotification({studentId,kind:'lesson_24h',sendAt:new Date(starts-24*3600000).toISOString(),title:'Урок завтра',message:`${student?.name.split(' ')[0]}, завтра в ${time} у нас английский ✨`});if(starts-now>2*3600000)queueNotification({studentId,kind:'lesson_2h',sendAt:new Date(starts-2*3600000).toISOString(),title:'Урок через 2 часа',message:`${student?.name.split(' ')[0]}, урок начнётся через 2 часа. Ссылка доступна в личном кабинете.`})}setOpen(false)}}><label>Ученик<select name="studentId"><option value="">Пробное занятие</option>{students.filter(x=>x.status==='Активный').map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="form-row"><label>Дата<input name="date" type="date" defaultValue={selected} required/></label><label>Время<input name="time" type="time" defaultValue="10:00" required/></label></div><div className="form-row"><label>Длительность<input name="duration" type="number" defaultValue="60"/></label><label>Тема<input name="topic" required/></label></div><label>Ссылка на урок<input name="meetingLink" placeholder="https://meet.google.com/..."/></label><label className="checkbox"><input name="notify" type="checkbox" defaultChecked/><span><Bell size={18}/>Создать уведомление ученику</span></label><button className="primary wide">Запланировать</button></form></Modal>}

    {moving&&<Modal title="Перенести урок" onClose={()=>setMoving(null)}><form className="form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);rescheduleLesson(moving.id,String(form.get('date')),String(form.get('time')),form.get('notify')==='on');setMoving(null)}}><p className="muted">{moving.student}: сейчас {fromIso(moving.date).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})} в {moving.time}</p><div className="form-row"><label>Новая дата<input name="date" type="date" defaultValue={moving.date} required/></label><label>Новое время<input name="time" type="time" defaultValue={moving.time} required/></label></div><label className="checkbox"><input name="notify" type="checkbox" defaultChecked/><span><Bell size={18}/>Сообщить ученику в Telegram</span></label><button className="primary wide">Перенести урок</button></form></Modal>}

    {sharing&&<Modal title="Доступ ученика" onClose={()=>setSharing(null)}><div className="share-card"><div className="avatar large">{sharing.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><h2>{sharing.name}</h2><p>Отправь эту персональную ссылку ученику. В ней нет данных других учеников.</p><label className="share-label">Привязать Telegram и включить оповещения</label><div className="copy-field"><input readOnly value={getStudentBotLink(sharing.id)}/><button className="primary" onClick={async()=>{await navigator.clipboard.writeText(getStudentBotLink(sharing.id));setCopied('bot')}}><Copy size={17}/>{copied==='bot'?'Скопировано':'Ссылка бота'}</button></div><label className="share-label">Открыть только личный кабинет</label><div className="copy-field"><input readOnly value={getStudentAccessUrl(sharing.id)}/><button className="secondary" onClick={async()=>{await navigator.clipboard.writeText(getStudentAccessUrl(sharing.id));setCopied('portal')}}><Copy size={17}/>{copied==='portal'?'Скопировано':'Кабинет'}</button></div><small>Лучше отправлять первую ссылку: бот сохранит Telegram ID ученика и сможет присылать напоминания.</small></div></Modal>}
  </section>
}
