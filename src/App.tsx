import {HashRouter,Navigate,Route,Routes} from 'react-router-dom'
import BottomNav from './components/BottomNav'
import TelegramBridge from './components/TelegramBridge'
import {useWorkspace} from './store/useWorkspace'
import Home from './screens/Home'
import Students from './screens/Students'
import StudentProfile from './screens/StudentProfile'
import Leads from './screens/Leads'
import Calendar from './screens/Calendar'
import LessonRoom from './screens/LessonRoom'
import Analytics from './screens/Analytics'
import Settings from './screens/Settings'
import Ecosystem from './screens/Ecosystem'
import Content from './screens/Content'
import More from './screens/More'

export default function App(){
  const workspace=useWorkspace()
  return <HashRouter>
    <TelegramBridge/>
    <main className="app-shell">
      <Routes>
        <Route path="/" element={<Home {...workspace}/>}/>
        <Route path="/students" element={<Students {...workspace}/>}/>
        <Route path="/students/:id" element={<StudentProfile {...workspace}/>}/>
        <Route path="/leads" element={<Leads {...workspace}/>}/>
        <Route path="/calendar" element={<Calendar {...workspace}/>}/>
        <Route path="/lesson/:id" element={<LessonRoom {...workspace}/>}/>
        <Route path="/ecosystem" element={<Ecosystem {...workspace}/>}/>
        <Route path="/content" element={<Content {...workspace}/>}/>
        <Route path="/analytics" element={<Analytics {...workspace}/>}/>
        <Route path="/settings" element={<Settings {...workspace}/>}/>
        <Route path="/more" element={<More {...workspace}/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
      <BottomNav/>
    </main>
  </HashRouter>
}
