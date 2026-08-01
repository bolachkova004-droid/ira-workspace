import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CalendarDays, House, LayoutDashboard, MoreHorizontal, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { haptic } from '../telegram.js';
const items = [
    ['/', 'Главная', House],
    ['/students', 'Ученики', Users],
    ['/calendar', 'Календарь', CalendarDays],
    ['/content', 'Контент', LayoutDashboard],
    ['/more', 'Ещё', MoreHorizontal]
];
export default function BottomNav() {
    return _jsx("nav", { className: "bottom-nav", "aria-label": "\u041E\u0441\u043D\u043E\u0432\u043D\u0430\u044F \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F", children: items.map(([to, label, Icon]) => _jsxs(NavLink, { to: to, end: to === '/', onClick: () => haptic(), className: ({ isActive }) => isActive ? 'nav-link active' : 'nav-link', children: [_jsx(Icon, { size: 21 }), _jsx("span", { children: label })] }, to)) });
}
