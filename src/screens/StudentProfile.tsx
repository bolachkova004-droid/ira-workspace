import {ArrowLeft,BookOpen,ExternalLink,MessageCircle,Pencil,Plus,Save,Trash2} from 'lucide-react'
import {useState} from 'react'
import {Link,useNavigate,useParams} from 'react-router-dom'
import Modal from '../components/Modal'
import Monster from '../components/Monster'
import type {Homework,Lesson,Material,Payment,Student} from '../types'

type Props={
  students:Student[];lessons:Lesson[];materials:Material[];payments:Payment[];homeworks:Homework[]
  updateStudent:(x:Student)=>void;deleteStudent:(id:string)=>void
  addMaterial:(x:Omit<Material,'id'>)=>void;deleteMaterial:(id:string)=>void
  updateHomework:(x:Homework)=>void
}

const prettyDate=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})

export default function StudentProfile({students,lessons,materials,payments,homeworks,updateStudent,deleteStudent,addMaterial,deleteMaterial,updateHomework}:Props){
  const {id}=useParams();const nav=useNavigate();const student=students.find(x=>x.id===id)
  const [edit,setEdit]=useState(false);const [materialModal,setMaterialModal]=useState(false)
  if(!student)return <section className="screen"><p>Ученик не найден.</p></section>
  const history=lessons.filter(item=>item.studentId===student.id).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time))
  const studentHomeworks=homeworks.filter(item=>item.studentId===student.id).sort((a,b)=>b.dueDate.localeCompare(a.dueDate))
  const studentPayments=payments.filter(item=>item.studentId===student.id).sort((a,b)=>b.dueDate.localeCompare(a.dueDate))
  const progress=Math.min(100,Math.round(student.packageUsed/Math.max(1,student.packageTotal)*100))
  const streak=Math.min(12,Math.max(1,history.filter(item=>item.status==='Проведён').length+2))
  const mistakeTags=student.challenges.split(/[,.;]/).map(x=>x.trim()).filter(Boolean).slice(0,3)
  const interestTags=student.interests.split(/[,.;]/).map(x=>x.trim()).filter(Boolean).slice(0,5)
  const unpaid=studentPayments.find(item=>item.status!=='Оплачено')
  const save=(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=new FormData(event.currentTarget);updateStudent({...student,name:String(form.get('name')),level:String(form.get('level')),goal:String(form.get('goal')),rate:Number(form.get('rate')),balance:Number(form.get('balance')),telegram:String(form.get('telegram')),interests:String(form.get('interests')),strengths:String(form.get('strengths')),challenges:String(form.get('challenges')),note:String(form.get('note')),packageTotal:Number(form.get('packageTotal')),packageUsed:Number(form.get('packageUsed'))});setEdit(false)}

  return <section className="screen rasmus-student">
    <header className="inner-topbar"><Link className="top-icon plain" to="/students"><ArrowLeft/></Link><strong>Ученик</strong><button className="top-icon plain" onClick={()=>setEdit(true)}><Pencil/></button></header>

    <section className="student-concept-head">
      <div className="student-avatar">{student.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
      <div><h1>{student.name}</h1><p>{history.filter(x=>x.status==='Проведён').length} занятий · {student.telegram||'Telegram не привязан'}</p></div>
    </section>

    <section className="student-goal"><span>🎯</span><div><b>Цель</b><p>{student.goal}</p></div></section>
    <div className="student-tags"><span className="active">{student.status}</span><span>Уровень {student.level}</span></div>

    <section className="student-block">
      <p className="eyebrow">Прогресс и цели</p>
      <div className="progress-label"><span>{student.level} → следующий уровень</span><b>{progress}%</b></div>
      <div className="student-progress"><i style={{width:`${progress}%`}}/></div>
      <div className="mistake-tags">{mistakeTags.map(tag=><span key={tag}>{tag}</span>)}{!mistakeTags.length&&<span>Добавь зоны роста</span>}</div>
    </section>

    <section className="student-block">
      <p className="eyebrow">Дисциплина и деньги</p>
      <div className="student-money-grid"><article><span>Стрик посещений</span><strong>🔥 {streak}</strong></article><article className="money"><span>К оплате</span><strong>{(unpaid?.amount||Math.abs(Math.min(0,student.balance))).toLocaleString('ru-RU')} ₽</strong></article></div>
      <div className="homework-concept-list">{studentHomeworks.slice(0,4).map(item=><button key={item.id} onClick={()=>updateHomework({...item,status:item.status==='Выполнено'?'Назначено':'Выполнено'})}><span><strong>{item.title}</strong><small>к {prettyDate(item.dueDate)}</small></span><b className={item.status==='Выполнено'?'done':item.status==='Просрочено'?'late':'wait'}>{item.status}</b></button>)}{!studentHomeworks.length&&<p className="empty-light">Домашних заданий пока нет.</p>}</div>
      <div className="rasmus-aside"><Monster small/><p><b>Расмус:</b> {studentHomeworks.some(x=>x.status==='Просрочено')?'с посещениями всё хорошо, но одну домашку пора вернуть в фокус.':'ученик держит хороший темп — можно чуть поднять сложность.'}</p></div>
    </section>

    <section className="student-block">
      <p className="eyebrow">Личное</p>
      <div className="interest-tags">{interestTags.map((tag,index)=><span key={tag}>{['🏎️','🎧','🍳','📚','✈️'][index%5]} {tag}</span>)}</div>
      <div className="personal-row"><span>Сильные стороны</span><b>{student.strengths||'Не заполнено'}</b></div>
      <div className="personal-row"><span>Часовой пояс</span><b>{student.timezone}</b></div>
    </section>

    <section className="student-note">{student.note||'Добавь важную заметку об ученике.'}</section>

    <section className="student-materials">
      <div className="section-heading"><div><p className="eyebrow">Материалы</p><h2>Библиотека ученика</h2></div><button className="top-icon plain" onClick={()=>setMaterialModal(true)}><Plus/></button></div>
      <div className="material-concept-list">{materials.filter(x=>x.studentId===student.id).map(item=><article key={item.id}><BookOpen/><span><strong>{item.title}</strong><small>{item.kind}</small></span><a href={item.url} target="_blank" rel="noreferrer"><ExternalLink/></a><button onClick={()=>deleteMaterial(item.id)}><Trash2/></button></article>)}</div>
    </section>

    <div className="student-quick-actions"><a className="primary" href={`https://t.me/${student.telegram.replace('@','')}`} target="_blank" rel="noreferrer"><MessageCircle/>Написать в Telegram</a><Link className="secondary" to="/calendar">Перенести урок</Link></div>

    {edit&&<Modal title="Редактировать ученика" onClose={()=>setEdit(false)}><form className="form" onSubmit={save}><label>Имя<input name="name" defaultValue={student.name}/></label><div className="form-row"><label>Уровень<input name="level" defaultValue={student.level}/></label><label>Стоимость<input name="rate" type="number" defaultValue={student.rate}/></label></div><label>Цель<input name="goal" defaultValue={student.goal}/></label><div className="form-row"><label>Баланс<input name="balance" type="number" defaultValue={student.balance}/></label><label>Telegram<input name="telegram" defaultValue={student.telegram}/></label></div><div className="form-row"><label>Использовано<input name="packageUsed" type="number" defaultValue={student.packageUsed}/></label><label>Всего в пакете<input name="packageTotal" type="number" defaultValue={student.packageTotal}/></label></div><label>Интересы<input name="interests" defaultValue={student.interests}/></label><label>Сильные стороны<input name="strengths" defaultValue={student.strengths}/></label><label>Сложности<input name="challenges" defaultValue={student.challenges}/></label><label>Заметка<textarea name="note" defaultValue={student.note}/></label><div className="modal-actions"><button type="button" className="danger-btn" onClick={()=>{if(confirm('Удалить ученика?')){deleteStudent(student.id);nav('/students')}}}><Trash2/>Удалить</button><button className="primary"><Save/>Сохранить</button></div></form></Modal>}

    {materialModal&&<Modal title="Новый материал" onClose={()=>setMaterialModal(false)}><form className="form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);addMaterial({studentId:student.id,title:String(form.get('title')),kind:String(form.get('kind')) as Material['kind'],url:String(form.get('url'))});setMaterialModal(false)}}><label>Название<input name="title" required/></label><label>Тип<select name="kind"><option>Статья</option><option>Видео</option><option>Рабочий лист</option><option>Ссылка</option></select></label><label>Ссылка<input name="url" defaultValue="https://"/></label><button className="primary wide">Добавить</button></form></Modal>}
  </section>
}
