import {Bot,Cloud,Copy,Database,Download,Moon,RefreshCcw,Sun,Upload} from 'lucide-react'
import {useState} from 'react'
import PageHeader from '../components/PageHeader'
import {getRuntimeConfig} from '../cloud'

export default function Settings({dark,setDark,cloudState='local',exportData,importData,reset}:{dark:boolean;setDark:(x:boolean)=>void;cloudState?:'local'|'loading'|'connected'|'error';exportData:()=>string;importData:(x:string)=>void;reset:()=>void}){
  const [copied,setCopied]=useState(false)
  const runtime=getRuntimeConfig()
  const supabaseUrl=runtime.supabaseUrl
  const botUsername=runtime.botUsername
  const appUrl=runtime.appUrl
  const connected=cloudState==='connected'
  const cloudLabel=cloudState==='connected'?'Синхронизация включена':cloudState==='loading'?'Подключаю…':cloudState==='error'?'Ошибка подключения':supabaseUrl?'Откройте внутри Telegram':'Ожидает URL проекта'
  const download=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([exportData()],{type:'application/json'}));a.download='ira-workspace-v6-backup.json';a.click()}
  const upload=(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{importData(String(reader.result));alert('Данные импортированы')}catch{alert('Не удалось прочитать файл')}};reader.readAsText(file)}
  return <section className="screen">
    <PageHeader eyebrow="Workspace setup" title="Настройки" subtitle="Дизайн, Telegram, облачная база и резервные копии."/>
    <div className="settings-list">
      <section className="paper-sheet setting-row"><div>{dark?<Moon/>:<Sun/>}<span><strong>Тема приложения</strong><small>{'Фирменная тёмная · Расмус'}</small></span></div><span className="cloud-chip connected">Активна</span></section>

      <section className="paper-sheet"><span className="kicker">Интеграции</span><h2>Готовность системы</h2><p className="muted">Интерфейс уже работает локально. Для реальных оповещений и общего доступа нужно один раз добавить переменные Supabase и Telegram.</p><div className="integration-status"><article><Database/><strong>Supabase</strong><small>{cloudLabel}</small></article><article><Bot/><strong>@{botUsername}</strong><small>Бот настроен</small></article><article><Cloud/><strong>GitHub Pages</strong><small>Приложение опубликовано</small></article></div><div className="copy-field"><input readOnly value={appUrl}/><button className="secondary" onClick={async()=>{await navigator.clipboard.writeText(appUrl);setCopied(true);setTimeout(()=>setCopied(false),1200)}}><Copy size={17}/>{copied?'Скопировано':'Адрес приложения'}</button></div><p className="muted">Точные шаги лежат в файлах <b>SUPABASE_SETUP.md</b> и <b>TELEGRAM_BOT_SETUP.md</b> внутри проекта.</p></section>

      <section className="paper-sheet"><span className="kicker">Резервная копия</span><h2>Твои данные остаются у тебя</h2><p className="muted">До подключения облака данные сохраняются на текущем устройстве. Скачай копию перед крупными изменениями.</p><div className="button-row"><button className="secondary" onClick={download}><Download size={18}/>Экспорт</button><label className="secondary file"><Upload size={18}/>Импорт<input type="file" accept="application/json" onChange={upload}/></label></div></section>

      <section className="paper-sheet danger-zone"><span className="kicker">Опасная зона</span><h2>Вернуть демонстрационные данные</h2><p className="muted">Удалит локальные изменения только на этом устройстве.</p><button className="danger-btn" onClick={()=>confirm('Сбросить все локальные данные?')&&reset()}><RefreshCcw size={18}/>Сбросить</button></section>
    </div>
  </section>
}
