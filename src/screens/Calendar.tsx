import {Bell,CalendarPlus,ChevronLeft,ChevronRight,Copy,ExternalLink,Link2,MoveRight,Trash2,Wifi} from 'lucide-react'
import {useMemo,useState} from 'react'
import {Link} from 'react-router-dom'
import Modal from '../components/Modal'
import Monster from '../components/Monster'
import type {Lesson,Notification,Student} from '../types'

type Props={lessons:Lesson[];students:Student[];addLesson:(x:Omit<Lesson,'id'>)=>void;rescheduleLesson:(id:string,date:string,time:string,notify?:boolean)=>void;cancelLesson:(id:string,notify?:boolean)=>void;getStudentAccessUrl:(studentId:string)=>string;getStudentBotLink:(studentId:string)=>string;queueNotification:(x:Omit<Notification,'id'|'createdAt'|'status'>)=>void}
const iso=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const fromIso=(value:string)=>new Date(`${value}T12:00:00`)
const startOfWeek=(date:Date)=>{const value=new Date(date);value.setDate(value.getDate()-((value.getDay()+6)%7));return value}
const addDays=(date:Date,days:number)=>{const value=new Date(date);value.setDate(value.getDate()+days);return value}
const minutes=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m}
const overlaps=(a:Lesson,b:Lesson)=>a.date===b.date&&a.id!==b.id&&minutes(a.time)<minutes(b.time)+b.duration&&minutes(b.time)<minutes(a.time)+a.duration&&a.status!=='Отменён'&&b.status!=='Отменён'

export default function Calendar({lessons,students,addLesson,rescheduleLesson,cancelLesson,getStudentAccessUrl,getStudentBotLink,queueNotification}:Props){
  const [cursor,setCursor]=useState(new Date())
  const [selected,setSelected]=useState(iso(new Date()))
  const [open,setOpen]=useState(false)
  const [moving,setMoving]=useState<Lesson|null>(null)
  const [sharing,setSharing]=useState<Student|null>(null)
  const [copied,setCopied]=useState<'portal'|'bot'|null>(null)
  const [calendarReady,setCalendarReady]=useState(false)
  const days=useMemo(()=>{const first=new Date(cursor.getFullYear(),cursor.getMonth(),1);const start=startOfWeek(first);return Array.from({length:42},(_,index)=>addDays(start,index))},[cursor])
  const selectedLessons=lessons.filter(item=>item.date===selected&&item.status!=='Отменён').sort((a,b)=>a.time.localeCompare(b.time))
  const conflicts=selectedLessons.filter((item,index)=>selectedLessons.some((other,otherIndex)=>index!==otherIndex&&overlaps(item,other)))
  const monthName=cursor.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})
  const previous=()=>setCursor(value=>new Date(value.getFullYear(),value.getMonth()-1,1))
  const next=()=>setCursor(value=>new Date(value.getFullYear(),value.getMonth()+1,1))
  const selectDay=(day:Date)=>{setSelected(iso(day));setCursor(new Date(day.getFullYear(),day.getMonth(),1))}

  return <section className="screen rasmus-calendar">
    <header className="inner-topbar"><strong>Календарь</strong><button className="top-icon plain" onClick={()=>setOpen(true)}><CalendarPlus/></button></header>

    <button className={`calendar-sync ${calendarReady?'connected':''}`} onClick={()=>setCalendarReady(value=>!value)}><i/><span><b>{calendarReady?'Google Calendar подключён':'Google Calendar готов к подключению'}</b>{calendarReady?'личные события будут учитывать пересечения':'нажми, чтобы включить демонстрационный режим'}</span><em><Wifi/></em></button>

    <div className="calendar-month-head"><h1>{monthName}</h1><div><button className="top-icon plain" onClick={previous}><ChevronLeft/></button><button className="top-icon plain" onClick={next}><ChevronRight/></button></div></div>
    <div className="calendar-weekdays">{['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map(day=><span key={day}>{day}</span>)}</div>
    <div className="calendar-concept-grid">{days.map(day=>{const key=iso(day);const dayLessons=lessons.filter(item=>item.date===key&&item.status!=='Отменён');const hasConflict=dayLessons.some(item=>dayLessons.some(other=>overlaps(item,other)));return <button key={key} className={`${day.getMonth()!==cursor.getMonth()?'out ':''}${key===selected?'selected ':''}${key===iso(new Date())?'today ':''}${hasConflict?'conflict':''}`} onClick={()=>selectDay(day)}><span>{day.getDate()}</span><i>{dayLessons.slice(0,3).map(item=><b className={item.paid?'paid':'lesson'} key={item.id}/>)}</i></button>})}</div>
    <div className="calendar-legend"><span><i className="lesson"/>Уроки</span><span><i className="paid"/>Оплачено</span><span><i className="conflict"/>Пересечение</span></div>

    <section className="selected-day-panel">
      <header><strong>{fromIso(selected).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</strong><span>{fromIso(selected).toLocaleDateString('ru-RU',{weekday:'long'})}</span></header>
      {selectedLessons.map(item=>{const student=students.find(x=>x.id===item.studentId);const conflict=conflicts.some(x=>x.id===item.id);return <article className={conflict?'conflict':''} key={item.id}><time>{item.time}</time><Link to={`/lesson/${item.id}`} className="grow"><strong>{item.student}{conflict&&<span>⚠</span>}</strong><small>{item.topic} · {item.duration} мин</small></Link><span className="level-pill">{student?.level||'Пробный'}</span><div className="calendar-row-actions"><button title="Перенести" onClick={()=>setMoving(item)}><MoveRight/></button>{student&&<button title="Доступ ученика" onClick={()=>setSharing(student)}><Link2/></button>}<button title="Отменить" onClick={()=>confirm('Отменить урок и подготовить уведомление?')&&cancelLesson(item.id,true)}><Trash2/></button></div></article>})}
      {!selectedLessons.length&&<p className="empty-light">В этот день уроков нет.</p>}
    </section>

    {conflicts.length>0&&<section className="conflict-card"><span>⚠️</span><div><p><b>Пересечение:</b> два урока частично накладываются друг на друга.</p><button onClick={()=>setMoving(conflicts[0])}>Перенести один урок</button></div></section>}
    <section className="rasmus-aside calendar-aside"><Monster small mood={conflicts.length?'alert':'happy'}/><p><b>Расмус:</b> {conflicts.length?'я нашёл пересечение. Лучше перенести один слот до отправки напоминаний.':'расписание чистое. Студенческие ссылки и уведомления доступны в карточках уроков.'}</p></section>

    {open&&<Modal title="Новый урок" onClose={()=>setOpen(false)}><form className="form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);const studentId=String(form.get('studentId'));const student=students.find(x=>x.id===studentId);const date=String(form.get('date'));const time=String(form.get('time'));const lesson:Omit<Lesson,'id'>={studentId:studentId||undefined,student:student?.name||'Пробное занятие',date,time,duration:Number(form.get('duration')),topic:String(form.get('topic')),status:'Запланирован',paid:false,homework:'',plan:'',notes:'',errors:'',mood:'Спокойное',meetingLink:String(form.get('meetingLink')),reminder24h:true,reminder2h:true};addLesson(lesson);if(student&&form.get('notify')==='on')queueNotification({studentId:student.id,kind:'lesson_24h',sendAt:new Date(`${date}T${time}:00`).toISOString(),deliveryMode:'Авто',title:'Новый урок',message:`${student.name.split(' ')[0]}, новый урок запланирован на ${fromIso(date).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})} в ${time}.`});setOpen(false)}}><label>Ученик<select name="studentId"><option value="">Пробное занятие</option>{students.filter(x=>x.status==='Активный').map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="form-row"><label>Дата<input name="date" type="date" defaultValue={selected} required/></label><label>Время<input name="time" type="time" defaultValue="10:00" required/></label></div><div className="form-row"><label>Длительность<input name="duration" type="number" defaultValue="60"/></label><label>Тема<input name="topic" required/></label></div><label>Ссылка на урок<input name="meetingLink" placeholder="https://meet.google.com/..."/></label><label className="checkbox"><input name="notify" type="checkbox" defaultChecked/><span><Bell/>Подготовить уведомление ученику</span></label><button className="primary wide">Запланировать</button></form></Modal>}

    {moving&&<Modal title="Перенести урок" onClose={()=>setMoving(null)}><form className="form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);rescheduleLesson(moving.id,String(form.get('date')),String(form.get('time')),form.get('notify')==='on');setMoving(null)}}><p className="muted">{moving.student}: сейчас {fromIso(moving.date).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})} в {moving.time}</p><div className="form-row"><label>Новая дата<input name="date" type="date" defaultValue={moving.date} required/></label><label>Новое время<input name="time" type="time" defaultValue={moving.time} required/></label></div><label className="checkbox"><input name="notify" type="checkbox" defaultChecked/><span><Bell/>Сообщить ученику в Telegram</span></label><button className="primary wide">Перенести урок</button></form></Modal>}

    {sharing&&<Modal title="Доступ ученика" onClose={()=>setSharing(null)}><div className="share-card"><div className="student-avatar">{sharing.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><h2>{sharing.name}</h2><p>Первая ссылка привязывает Telegram и включает уведомления. Вторая открывает только личный кабинет.</p><label>Telegram-бот</label><div className="copy-field"><input readOnly value={getStudentBotLink(sharing.id)}/><button className="primary" onClick={async()=>{await navigator.clipboard.writeText(getStudentBotLink(sharing.id));setCopied('bot')}}><Copy/>{copied==='bot'?'Готово':'Копировать'}</button></div><label>Личный кабинет</label><div className="copy-field"><input readOnly value={getStudentAccessUrl(sharing.id)}/><button className="secondary" onClick={async()=>{await navigator.clipboard.writeText(getStudentAccessUrl(sharing.id));setCopied('portal')}}><Copy/>{copied==='portal'?'Готово':'Копировать'}</button></div><a className="text-link" href={getStudentAccessUrl(sharing.id)} target="_blank" rel="noreferrer"><ExternalLink/>Открыть кабинет</a></div></Modal>}
  </section>
}
