import {Check,Clock3,Edit3,Plus,Send,Trash2,X} from 'lucide-react'
import {useEffect,useState} from 'react'
import Modal from '../components/Modal'
import Monster from '../components/Monster'
import type {Notification,NotificationKind,Student} from '../types'

type Props={students:Student[];notifications:Notification[];queueNotification:(x:Omit<Notification,'id'|'createdAt'|'status'>)=>void;cancelNotification:(id:string)=>void;approveNotification:(id:string)=>void}
type Mode='auto'|'review'|'off'
type Scenario={id:string;icon:string;name:string;description:string;kind:NotificationKind;mode:Mode}

const defaults:Scenario[]=[
  {id:'payment',icon:'💸',name:'Оплата',description:'за 1 занятие до конца пакета',kind:'package_low',mode:'review'},
  {id:'homework',icon:'📝',name:'Домашка',description:'за день до занятия, если не сделана',kind:'homework_reminder',mode:'auto'},
  {id:'lesson',icon:'⏰',name:'Скоро урок',description:'за 1 час до начала',kind:'lesson_2h',mode:'auto'},
  {id:'lead',icon:'👋',name:'Заявка молчит',description:'нет ответа 2 дня после сообщения',kind:'custom',mode:'review'}
]

export default function Reminders({students,notifications,queueNotification,cancelNotification,approveNotification}:Props){
  const [open,setOpen]=useState(false)
  const [editing,setEditing]=useState<Notification|null>(null)
  const [scenarios,setScenarios]=useState<Scenario[]>(()=>{try{return JSON.parse(localStorage.getItem('ira.rasmus.scenarios')||'null')||defaults}catch{return defaults}})
  useEffect(()=>{localStorage.setItem('ira.rasmus.scenarios',JSON.stringify(scenarios))},[scenarios])
  const pending=notifications.filter(item=>item.status==='Запланировано'&&item.deliveryMode==='На проверку').sort((a,b)=>a.sendAt.localeCompare(b.sendAt))
  const sent=notifications.filter(item=>item.status==='Отправлено').length
  const setMode=(id:string,mode:Mode)=>setScenarios(items=>items.map(item=>item.id===id?{...item,mode}:item))

  return <section className="screen rasmus-reminders">
    <header className="inner-topbar"><span/><strong>Напоминания</strong><button className="top-icon plain" onClick={()=>setOpen(true)}><Plus/></button></header>

    <section className="reminder-intro"><Monster small/><p><b>Расмус:</b> рутину беру на себя. Но там, где дело в деньгах или в живом человеке, лучше спрошу тебя перед отправкой.</p></section>

    <section className="rasmus-section">
      <div className="section-heading"><div><p className="eyebrow">Типы напоминаний</p><h2>Настрой под себя</h2></div></div>
      <div className="scenario-list">{scenarios.map(item=><article key={item.id}><div className="scenario-name"><span>{item.icon}</span><div><strong>{item.name}</strong><small>{item.description}</small></div></div><div className="mode-switch"><button className={item.mode==='auto'?'active auto':''} onClick={()=>setMode(item.id,'auto')}>Авто</button><button className={item.mode==='review'?'active review':''} onClick={()=>setMode(item.id,'review')}>На проверку</button><button className={item.mode==='off'?'active off':''} onClick={()=>setMode(item.id,'off')}>Выкл</button></div></article>)}</div>
    </section>

    <section className="rasmus-section">
      <div className="section-heading"><div><p className="eyebrow">Ждут тебя</p><h2>На проверку · {pending.length}</h2></div></div>
      <div className="review-queue">{pending.map(item=>{const student=students.find(x=>x.id===item.studentId);return <article key={item.id}><header><span className="queue-avatar">{student?.name.split(' ').map(x=>x[0]).slice(0,2).join('')||'УЧ'}</span><strong>{student?.name||'Ученик'} · {item.title.toLowerCase()}</strong><time><Clock3/>{new Date(item.sendAt).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></header><p>«{item.message}»</p><footer><button className="queue-send" onClick={()=>approveNotification(item.id)}><Send/>Отправить</button><button className="queue-edit" onClick={()=>setEditing(item)}><Edit3/>Изменить</button><button className="queue-x" onClick={()=>cancelNotification(item.id)}><X/></button></footer></article>})}{!pending.length&&<div className="empty-dark">Очередь пуста — всё отправлено.</div>}</div>
    </section>

    <div className="reminder-footstats"><article><strong>{sent}</strong><span>отправлено всего</span></article><article><strong>{pending.length}</strong><span>ждут проверки</span></article><article><strong>~{Math.max(5,sent*4)}м</strong><span>сэкономлено</span></article></div>

    {(open||editing)&&<Modal title={editing?'Изменить сообщение':'Новое сообщение'} onClose={()=>{setOpen(false);setEditing(null)}}><form className="form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);if(editing){cancelNotification(editing.id)}queueNotification({studentId:String(form.get('studentId')),kind:String(form.get('kind')) as NotificationKind,sendAt:new Date(String(form.get('sendAt'))).toISOString(),deliveryMode:'На проверку',title:String(form.get('title')),message:String(form.get('message'))});setOpen(false);setEditing(null)}}><label>Ученик<select name="studentId" defaultValue={editing?.studentId} required>{students.filter(x=>x.status==='Активный').map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label>Сценарий<select name="kind" defaultValue={editing?.kind||'custom'}>{scenarios.map(x=><option value={x.kind} key={x.id}>{x.name}</option>)}</select></label><label>Когда отправить<input type="datetime-local" name="sendAt" required defaultValue={editing?editing.sendAt.slice(0,16):new Date(Date.now()+3600000).toISOString().slice(0,16)}/></label><label>Заголовок<input name="title" required defaultValue={editing?.title||'Напоминание от Иры'}/></label><label>Текст<textarea name="message" rows={5} required defaultValue={editing?.message}/></label><button className="primary wide"><Check/>Сохранить в очередь</button></form></Modal>}
  </section>
}
