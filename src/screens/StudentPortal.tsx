import {useEffect,useMemo,useState} from 'react'
import {BookOpen,CalendarDays,CheckCircle2,Clock3,CreditCard,ExternalLink,MessageCircle,RefreshCw,Sparkles} from 'lucide-react'
import {useParams} from 'react-router-dom'
import Modal from '../components/Modal'
import Monster from '../components/Monster'
import {loadStudentSnapshot,studentAction} from '../cloud'
import type {Homework,Lesson,Material,Payment,RescheduleRequest,Student} from '../types'

type Props={
  students:Student[]
  lessons:Lesson[]
  payments:Payment[]
  homeworks:Homework[]
  materials:Material[]
  updateHomework:(x:Homework)=>void
  requestReschedule:(x:Omit<RescheduleRequest,'id'|'status'|'createdAt'>)=>void
}

const formatDate=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'long'})

export default function StudentPortal({students,lessons,payments,homeworks,materials,updateHomework,requestReschedule}:Props){
  const {token}=useParams()
  const localStudent=students.find(item=>item.accessToken===token)
  const [remote,setRemote]=useState<{student:Student;lessons:Lesson[];payments:Payment[];homeworks:Homework[];materials:Material[]}|null>(null)
  const [cloudLoading,setCloudLoading]=useState(true)
  const [moveLesson,setMoveLesson]=useState<Lesson|null>(null)
  const [sent,setSent]=useState(false)
  useEffect(()=>{let active=true;if(!token){setCloudLoading(false);return};loadStudentSnapshot(token).then(data=>{if(active&&data?.student)setRemote(data)}).catch(()=>{}).finally(()=>{if(active)setCloudLoading(false)});return()=>{active=false}},[token])
  const student=remote?.student||localStudent
  const today=new Date().toISOString().slice(0,10)
  const sourceLessons=remote?.lessons||lessons
  const sourcePayments=remote?.payments||payments
  const sourceHomeworks=remote?.homeworks||homeworks
  const sourceMaterials=remote?.materials||materials
  const studentLessons=useMemo(()=>student?sourceLessons.filter(item=>item.studentId===student.id&&item.date>=today&&item.status!=='Отменён').sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)):[],[student,sourceLessons,today])
  const studentPayments=student?sourcePayments.filter(item=>item.studentId===student.id).sort((a,b)=>b.dueDate.localeCompare(a.dueDate)):[]
  const studentHomeworks=student?sourceHomeworks.filter(item=>item.studentId===student.id).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)):[]
  const studentMaterials=student?sourceMaterials.filter(item=>item.studentId===student.id):[]
  const next=studentLessons[0]
  const calendarBase=next?new Date(`${next.date}T12:00:00`):new Date()
  const monthDays=useMemo(()=>{const first=new Date(calendarBase.getFullYear(),calendarBase.getMonth(),1);const offset=(first.getDay()+6)%7;const start=new Date(first);start.setDate(first.getDate()-offset);return Array.from({length:42},(_,index)=>{const value=new Date(start);value.setDate(start.getDate()+index);return value})},[calendarBase.getFullYear(),calendarBase.getMonth()])

  if(cloudLoading&&!localStudent)return <main className="student-shell"><section className="student-error paper-sheet"><Monster/><h1>Открываю кабинет…</h1><p>Загружаю расписание и домашнее.</p></section></main>
  if(!student)return <main className="student-shell"><section className="student-error paper-sheet"><Monster/><h1>Ссылка больше не действует</h1><p>Попросите преподавателя прислать новую ссылку на личный кабинет.</p></section></main>

  return <main className="student-shell">
    <header className="student-top paper-sheet">
      <div><p className="eyebrow">Ira Workspace · student</p><h1>Привет, {student.name.split(' ')[0]}!</h1><p className="muted">Здесь расписание, домашнее и оплаты — без лишних чатов и потерянных сообщений.</p></div>
      <Monster small/>
    </header>

    {next&&<section className="next-lesson-card notebook-card">
      <div className="paper-tab">Ближайший урок</div>
      <div className="next-lesson-main">
        <div className="date-badge"><strong>{new Date(`${next.date}T12:00:00`).getDate()}</strong><span>{new Date(`${next.date}T12:00:00`).toLocaleDateString('ru-RU',{month:'short'})}</span></div>
        <div className="grow"><span className="kicker">{formatDate(next.date)} · {next.time}</span><h2>{next.topic}</h2><p>{next.duration} минут · {next.status}</p></div>
      </div>
      <div className="student-actions">
        {next.meetingLink&&<a className="primary" href={next.meetingLink} target="_blank" rel="noreferrer"><ExternalLink size={17}/>Подключиться</a>}
        <button className="secondary" onClick={()=>{setMoveLesson(next);setSent(false)}}><RefreshCw size={17}/>Попросить перенос</button>
      </div>
    </section>}

    <div className="student-grid-layout">
      <section className="paper-sheet ruled-paper">
        <div className="section-head"><div><span className="kicker">Расписание</span><h2>Мои уроки</h2></div><CalendarDays/></div>
        <div className="student-mini-calendar"><header><strong>{calendarBase.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}</strong></header><div className="student-weekdays">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=><span key={day}>{day}</span>)}</div><div className="student-month-grid">{monthDays.map(day=>{const key=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;const dayLessons=studentLessons.filter(item=>item.date===key);return <span className={`${day.getMonth()!==calendarBase.getMonth()?'outside ':''}${dayLessons.length?'has-lesson':''}`} key={key} title={dayLessons.map(item=>`${item.time} ${item.topic}`).join(', ')}>{day.getDate()}{dayLessons.length>0&&<i/>}</span>})}</div></div><div className="student-list">{studentLessons.map(item=><article key={item.id}><div className="student-list-icon"><Clock3/></div><div className="grow"><strong>{formatDate(item.date)} в {item.time}</strong><span>{item.topic}</span>{item.status==='Перенесён'&&<small>Перенесён с {item.previousDate} {item.previousTime}</small>}</div><span className={`status ${item.paid?'ok':'warn'}`}>{item.paid?'Оплачено':'К оплате'}</span></article>)}{!studentLessons.length&&<p className="empty-line">Пока нет запланированных уроков.</p>}</div>
      </section>

      <section className="paper-sheet">
        <div className="section-head"><div><span className="kicker">Оплата</span><h2>Мой пакет</h2></div><CreditCard/></div>
        <div className="package-progress"><div><span>Использовано</span><strong>{student.packageUsed} из {student.packageTotal}</strong></div><div className="progress-line"><i style={{width:`${Math.min(100,student.packageUsed/student.packageTotal*100)}%`}}/></div></div>
        <div className="student-list compact">{studentPayments.slice(0,3).map(item=><article key={item.id}><div className="grow"><strong>{item.amount.toLocaleString('ru-RU')} ₽</strong><span>до {formatDate(item.dueDate)}</span></div><span className={`status ${item.status==='Оплачено'?'ok':item.status==='Просрочено'?'danger':'warn'}`}>{item.status}</span></article>)}</div>
      </section>

      <section className="paper-sheet ruled-paper">
        <div className="section-head"><div><span className="kicker">Практика</span><h2>Домашнее</h2></div><BookOpen/></div>
        <div className="homework-stack">{studentHomeworks.map(item=><article className={item.status==='Выполнено'?'done':''} key={item.id}><button className="homework-check" onClick={async()=>{const status=item.status==='Выполнено'?'Назначено':'Выполнено';if(remote&&token){await studentAction(token,'homework_status',{homeworkId:item.id,status});setRemote({...remote,homeworks:remote.homeworks.map(homework=>homework.id===item.id?{...homework,status}:homework)})}else updateHomework({...item,status})}}><CheckCircle2/></button><div className="grow"><strong>{item.title}</strong><p>{item.description}</p><small>до {formatDate(item.dueDate)}</small></div></article>)}{!studentHomeworks.length&&<p className="empty-line">Новых заданий пока нет.</p>}</div>
      </section>

      <section className="paper-sheet">
        <div className="section-head"><div><span className="kicker">Библиотека</span><h2>Материалы</h2></div><Sparkles/></div>
        <div className="student-list compact">{studentMaterials.map(item=><a href={item.url} target="_blank" rel="noreferrer" key={item.id}><div className="student-list-icon"><BookOpen/></div><div className="grow"><strong>{item.title}</strong><span>{item.kind}</span></div><ExternalLink size={17}/></a>)}</div>
        <a className="student-contact" href={`https://t.me/${student.telegram.replace('@','')}`} target="_blank" rel="noreferrer"><MessageCircle/>Написать преподавателю</a>
      </section>
    </div>

    {moveLesson&&<Modal title="Запросить перенос" onClose={()=>setMoveLesson(null)}>{sent?<div className="request-success"><CheckCircle2/><h2>Запрос отправлен</h2><p>Ира увидит его в рабочем кабинете и подтвердит новое время.</p><button className="primary wide" onClick={()=>setMoveLesson(null)}>Готово</button></div>:<form className="form" onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget);const payload={studentId:student.id,lessonId:moveLesson.id,requestedDate:String(form.get('date')),requestedTime:String(form.get('time')),comment:String(form.get('comment'))};if(remote&&token)await studentAction(token,'request_reschedule',payload);else requestReschedule(payload);setSent(true)}}><p className="muted">Текущий урок: {formatDate(moveLesson.date)} в {moveLesson.time}</p><div className="form-row"><label>Желаемая дата<input required name="date" type="date" min={today}/></label><label>Желаемое время<input required name="time" type="time"/></label></div><label>Комментарий<textarea name="comment" rows={3} placeholder="Например: могу после 18:00"/></label><button className="primary wide">Отправить запрос</button></form>}</Modal>}
  </main>
}
