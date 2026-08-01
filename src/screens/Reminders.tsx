import {Bell,CalendarClock,Check,Clock3,Send,Trash2} from 'lucide-react'
import {useMemo,useState} from 'react'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import type {Notification,NotificationKind,Student} from '../types'

type Props={students:Student[];notifications:Notification[];queueNotification:(x:Omit<Notification,'id'|'createdAt'|'status'>)=>void;cancelNotification:(id:string)=>void;markNotificationSent:(id:string)=>void}
const labels:Record<NotificationKind,string>={lesson_24h:'Урок за 24 часа',lesson_2h:'Урок за 2 часа',lesson_15m:'Урок за 15 минут',lesson_moved:'Перенос урока',lesson_cancelled:'Отмена урока',payment_3d:'Оплата через 3 дня',payment_due:'Оплата сегодня',payment_overdue:'Оплата просрочена',package_low:'Заканчивается пакет',homework_new:'Новое домашнее',homework_reminder:'Напоминание о домашнем',custom:'Своё сообщение'}
const kinds=Object.keys(labels) as NotificationKind[]

export default function Reminders({students,notifications,queueNotification,cancelNotification,markNotificationSent}:Props){
  const [open,setOpen]=useState(false)
  const [filter,setFilter]=useState<'Все'|Notification['status']>('Все')
  const shown=useMemo(()=>notifications.filter(item=>filter==='Все'||item.status===filter).sort((a,b)=>b.sendAt.localeCompare(a.sendAt)),[notifications,filter])
  const pending=notifications.filter(x=>x.status==='Запланировано').length
  return <section className="screen reminders-screen">
    <PageHeader eyebrow="Telegram bot" title="Оповещения" subtitle="Уроки, оплаты, переносы и домашние задания — по расписанию и без ручной рутины." action={<button className="primary" onClick={()=>setOpen(true)}><Send size={18}/>Новое сообщение</button>}/>
    <div className="reminder-summary"><article className="notebook-card"><Bell/><div><strong>{pending}</strong><span>ждут отправки</span></div></article><article className="notebook-card"><Check/><div><strong>{notifications.filter(x=>x.status==='Отправлено').length}</strong><span>отправлено</span></div></article><article className="notebook-card"><CalendarClock/><div><strong>24ч · 2ч · 15м</strong><span>урочные сценарии</span></div></article></div>
    <section className="paper-sheet">
      <div className="reminder-tabs">{(['Все','Запланировано','Отправлено','Ошибка','Отменено'] as const).map(x=><button key={x} className={filter===x?'active':''} onClick={()=>setFilter(x)}>{x}</button>)}</div>
      <div className="notification-list">{shown.map(item=>{const student=students.find(s=>s.id===item.studentId);return <article key={item.id}><div className={`notification-pin status-${item.status}`}/><div className="grow"><div className="row-between"><strong>{item.title}</strong><span className="status">{item.status}</span></div><p>{item.message}</p><small>{student?.name||'Ученик'} · <Clock3 size={13}/>{new Date(item.sendAt).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div>{item.status==='Запланировано'&&<div className="notification-actions"><button className="icon-btn" title="Отметить отправленным" onClick={()=>markNotificationSent(item.id)}><Check size={17}/></button><button className="icon-btn danger" title="Отменить" onClick={()=>cancelNotification(item.id)}><Trash2 size={17}/></button></div>}</article>})}{!shown.length&&<p className="empty-line">Здесь пока ничего нет.</p>}</div>
    </section>
    <section className="paper-note"><strong>Как это заработает автоматически</strong><p>После подключения Supabase и токена бота очередь будет проверяться по расписанию, а сообщения будут уходить студентам в Telegram. Готовые серверные функции уже лежат в проекте.</p></section>
    {open&&<Modal title="Запланировать сообщение" onClose={()=>setOpen(false)}><form className="form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);queueNotification({studentId:String(form.get('studentId')),kind:String(form.get('kind')) as NotificationKind,sendAt:new Date(String(form.get('sendAt'))).toISOString(),title:String(form.get('title')),message:String(form.get('message'))});setOpen(false)}}><label>Ученик<select name="studentId" required>{students.filter(x=>x.status==='Активный').map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label>Сценарий<select name="kind">{kinds.map(x=><option value={x} key={x}>{labels[x]}</option>)}</select></label><label>Когда отправить<input type="datetime-local" name="sendAt" required defaultValue={new Date(Date.now()+3600000).toISOString().slice(0,16)}/></label><label>Заголовок<input name="title" required defaultValue="Напоминание от Иры"/></label><label>Текст<textarea name="message" rows={5} required placeholder="Напишите тёплое и понятное сообщение..."/></label><button className="primary wide">Добавить в очередь</button></form></Modal>}
  </section>
}
