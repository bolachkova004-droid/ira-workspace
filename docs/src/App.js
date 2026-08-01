import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav.js';
import TelegramBridge from './components/TelegramBridge.js';
import { useWorkspace } from './store/useWorkspace.js';
import Home from './screens/Home.js';
import Students from './screens/Students.js';
import StudentProfile from './screens/StudentProfile.js';
import Leads from './screens/Leads.js';
import Calendar from './screens/Calendar.js';
import LessonRoom from './screens/LessonRoom.js';
import Analytics from './screens/Analytics.js';
import Settings from './screens/Settings.js';
import Ecosystem from './screens/Ecosystem.js';
import Content from './screens/Content.js';
import More from './screens/More.js';
import Reminders from './screens/Reminders.js';
import StudentPortal from './screens/StudentPortal.js';
function WorkspaceRoutes() {
    const workspace = useWorkspace();
    const location = useLocation();
    const studentMode = location.pathname.startsWith('/student/');
    return _jsxs(_Fragment, { children: [_jsx(TelegramBridge, {}), _jsxs("main", { className: studentMode ? 'student-app-root' : 'app-shell', children: [_jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Home, { ...workspace }) }), _jsx(Route, { path: "/students", element: _jsx(Students, { ...workspace }) }), _jsx(Route, { path: "/students/:id", element: _jsx(StudentProfile, { ...workspace }) }), _jsx(Route, { path: "/student/:token", element: _jsx(StudentPortal, { ...workspace }) }), _jsx(Route, { path: "/leads", element: _jsx(Leads, { ...workspace }) }), _jsx(Route, { path: "/calendar", element: _jsx(Calendar, { ...workspace }) }), _jsx(Route, { path: "/lesson/:id", element: _jsx(LessonRoom, { ...workspace }) }), _jsx(Route, { path: "/reminders", element: _jsx(Reminders, { ...workspace }) }), _jsx(Route, { path: "/ecosystem", element: _jsx(Ecosystem, { ...workspace }) }), _jsx(Route, { path: "/content", element: _jsx(Content, { ...workspace }) }), _jsx(Route, { path: "/analytics", element: _jsx(Analytics, { ...workspace }) }), _jsx(Route, { path: "/settings", element: _jsx(Settings, { ...workspace }) }), _jsx(Route, { path: "/more", element: _jsx(More, { ...workspace }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }), !studentMode && _jsx(BottomNav, {})] })] });
}
export default function App() { return _jsx(HashRouter, { children: _jsx(WorkspaceRoutes, {}) }); }
