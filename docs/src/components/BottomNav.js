import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { CalendarDays, House, LayoutDashboard, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { haptic } from '../telegram.js';
import { RasmusMark } from './Monster.js';
const items = [
    ['/', 'Главная', House],
    ['/students', 'Ученики', Users],
    ['/calendar', 'Календарь', CalendarDays],
    ['/content', 'Контент', LayoutDashboard]
];
export default function BottomNav() {
    return _jsxs("nav", { className: "bottom-nav", "aria-label": "\u041E\u0441\u043D\u043E\u0432\u043D\u0430\u044F \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F", children: [items.map(([to, label, Icon]) => _jsxs(NavLink, { to: to, end: to === '/', onClick: () => haptic(), className: ({ isActive }) => isActive ? 'nav-link active' : 'nav-link', children: [_jsx(Icon, {}), _jsx("span", { children: label })] }, to)), _jsx(NavLink, { to: "/reminders", onClick: () => haptic(), className: ({ isActive }) => isActive ? 'nav-link rasmus-nav active' : 'nav-link rasmus-nav', children: ({ isActive }) => _jsxs(_Fragment, { children: [_jsx(RasmusMark, { active: isActive }), _jsx("span", { children: "\u0420\u0430\u0441\u043C\u0443\u0441" })] }) })] });
}
