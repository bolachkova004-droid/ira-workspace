import {HashRouter,Navigate,Route,Routes,useLocation} from 'react-router-dom'
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
import Reminders from './screens/Reminders'
import StudentPortal from './screens/StudentPortal'

function WorkspaceRoutes(){
  const workspace=useWorkspace()
  const location=useLocation()
  const studentMode=location.pathname.startsWith('/student/')
  return <>
    <TelegramBridge/>
    <main className={studentMode?'student-app-root':'app-shell'}>
      <Routes>
        <Route path="/" element={<Home {...workspace}/>}/>
        <Route path="/students" element={<Students {...workspace}/>}/>
        <Route path="/students/:id" element={<StudentProfile {...workspace}/>}/>
        <Route path="/student/:token" element={<StudentPortal {...workspace}/>}/>
        <Route path="/leads" element={<Leads {...workspace}/>}/>
        <Route path="/calendar" element={<Calendar {...workspace}/>}/>
        <Route path="/lesson/:id" element={<LessonRoom {...workspace}/>}/>
        <Route path="/reminders" element={<Reminders {...workspace}/>}/>
        <Route path="/ecosystem" element={<Ecosystem {...workspace}/>}/>
        <Route path="/content" element={<Content {...workspace}/>}/>
        <Route path="/analytics" element={<Analytics {...workspace}/>}/>
        <Route path="/settings" element={<Settings {...workspace}/>}/>
        <Route path="/more" element={<More {...workspace}/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
      {!studentMode&&<BottomNav/>}
    </main>
  </>
}

export default function App(){return <HashRouter><WorkspaceRoutes/></HashRouter>}
