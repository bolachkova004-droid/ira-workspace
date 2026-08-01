import {CalendarPlus,Clock3} from 'lucide-react'
import {useMemo,useState} from 'react'
import {Link} from 'react-router-dom'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import {haptic} from '../telegram'
import type {Lesson,Student} from '../types'

const toLocalDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const addDays=(date:Date,days:number)=>{const result=new Date(date);result.setDate(result.getDate()+days);return result}
const lessonWord=(count:number)=>count%10===1&&count%100!==11?'урок':count%10>=2&&count%10<=4&&!(count%100>=12&&count%100<=14)?'урока':'уроков'

export default function Calendar({lessons,students,addLesson}:{lessons:Lesson[];students:Student[];addLesson:(x:Omit<Lesson,'id'>)=>void}){
  const today=useMemo(()=>new Date(),[])
  const days=useMemo(()=>Array.from({length:14},(_,index)=>addDays(today,index)),[today])
  const [open,setOpen]=useState(false)
  const [selected,setSelected]=useState(toLocalDate(today))
  const dayLessons=lessons.filter(l=>l.date===selected).sort((a,b)=>a.time.localeCompare(b.time))
  const selectedDate=new Date(`${selected}T12:00:00`)

  return <section className="screen">
    <PageHeader title="Календарь" subtitle="Расписание, оплаты и подготовка к урокам" action={<button type="button" className="primary" onClick={()=>setOpen(true)}><CalendarPlus size={18}/>Урок</button>}/>
    <div className="date-strip">{days.map(date=>{const value=toLocalDate(date);return <button type="button" onClick={()=>{setSelected(value);haptic()}} className={selected===value?'active':''} key={value}><span>{date.toLocaleDateString('ru-RU',{weekday:'short'}).replace('.','').toUpperCase()}</span><strong>{date.getDate()}</strong><small>{date.toLocaleDateString('ru-RU',{month:'short'}).replace('.','')}</small></button>})}</div>
    <section className="panel"><div className="section-head"><div><span className="kicker">Выбранный день</span><h2>{selectedDate.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</h2></div><span className="muted">{dayLessons.length} {lessonWord(dayLessons.length)}</span></div><div className="calendar-list">{dayLessons.map(l=><Link to={`/lesson/${l.id}`} key={l.id} className="calendar-event"><div className="event-time"><Clock3 size={17}/><strong>{l.time}</strong><small>{l.duration} мин</small></div><div className="event-main"><strong>{l.student}</strong><span>{l.topic}</span></div><span className={l.paid?'status ok':'status warn'}>{l.paid?'Оплачено':'Не оплачено'}</span></Link>)}{!dayLessons.length&&<p className="empty-line">В этот день уроков нет.</p>}</div></section>
    {open&&<Modal title="Новый урок" onClose={()=>setOpen(false)}><form className="form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);const studentId=String(form.get('studentId'));const student=students.find(item=>item.id===studentId);addLesson({studentId:studentId||undefined,student:student?.name||'Пробное занятие',date:String(form.get('date')),time:String(form.get('time')),duration:Number(form.get('duration')),topic:String(form.get('topic')),status:'Запланирован',paid:false,homework:'',plan:'',notes:'',errors:'',mood:'Спокойное'});setOpen(false);haptic('success')}}><label>Ученик<select name="studentId"><option value="">Пробное занятие</option>{students.map(student=><option value={student.id} key={student.id}>{student.name}</option>)}</select></label><div className="form-row"><label>Дата<input name="date" type="date" defaultValue={selected} required/></label><label>Время<input name="time" type="time" defaultValue="10:00" required/></label></div><div className="form-row"><label>Длительность<input name="duration" type="number" min="15" step="5" defaultValue="60" required/></label><label>Тема<input name="topic" required/></label></div><button className="primary wide">Запланировать</button></form></Modal>}
  </section>
}
