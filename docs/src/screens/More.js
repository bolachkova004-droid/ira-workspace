import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BarChart3, Bell, ChevronRight, Settings, Sparkles, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader.js';
const items = [
    { to: '/reminders', title: 'Оповещения', text: 'Уроки, оплаты, переносы и домашние задания', icon: Bell },
    { to: '/leads', title: 'Заявки', text: 'Воронка от первого сообщения до оплаты', icon: Workflow },
    { to: '/ecosystem', title: 'Касания', text: 'Игры, ссылки, продукты и площадки', icon: Sparkles },
    { to: '/analytics', title: 'Аналитика', text: 'Ученики, доход, долги и конверсия', icon: BarChart3 },
    { to: '/settings', title: 'Настройки', text: 'Интеграции, тема и резервная копия', icon: Settings }
];
export default function More({ stats, touchpoints, notifications }) {
    return _jsxs("section", { className: "screen", children: [_jsx(PageHeader, { eyebrow: "\u0420\u0430\u0437\u0434\u0435\u043B\u044B", title: "\u0415\u0449\u0451", subtitle: "\u0412\u0441\u0451, \u0447\u0442\u043E \u043F\u043E\u043C\u043E\u0433\u0430\u0435\u0442 \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u043F\u0440\u0435\u043F\u043E\u0434\u0430\u0432\u0430\u043D\u0438\u0435\u043C \u043A\u0430\u043A \u0441\u0438\u0441\u0442\u0435\u043C\u043E\u0439." }), _jsxs("div", { className: "more-stats", children: [_jsxs("article", { children: [_jsx("span", { children: "\u041E\u043F\u043E\u0432\u0435\u0449\u0435\u043D\u0438\u044F \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u0438" }), _jsx("strong", { children: notifications.filter(x => x.status === 'Запланировано').length })] }), _jsxs("article", { children: [_jsx("span", { children: "\u0417\u0430\u044F\u0432\u043A\u0438 \u0432 \u0440\u0430\u0431\u043E\u0442\u0435" }), _jsx("strong", { children: stats.activeLeads })] }), _jsxs("article", { children: [_jsx("span", { children: "\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0435 \u043A\u0430\u0441\u0430\u043D\u0438\u044F" }), _jsx("strong", { children: touchpoints.filter(x => x.active).length })] })] }), _jsx("div", { className: "more-grid", children: items.map(({ to, title, text, icon: Icon }) => _jsxs(Link, { className: "more-card paper-sheet", to: to, children: [_jsx("span", { className: "more-icon", children: _jsx(Icon, {}) }), _jsxs("span", { className: "grow", children: [_jsx("strong", { children: title }), _jsx("small", { children: text })] }), _jsx(ChevronRight, { size: 20 })] }, to)) })] });
}
