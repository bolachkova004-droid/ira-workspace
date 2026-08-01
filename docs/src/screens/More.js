import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BarChart3, ChevronRight, Settings, Sparkles, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader.js';
const items = [
    { to: '/leads', title: 'Заявки', text: 'Воронка от первого сообщения до оплаты', icon: Workflow },
    { to: '/ecosystem', title: 'Касания', text: 'Игры, ссылки, продукты и площадки', icon: Sparkles },
    { to: '/analytics', title: 'Аналитика', text: 'Ученики, доход, долги и конверсия', icon: BarChart3 },
    { to: '/settings', title: 'Настройки', text: 'Тема, резервная копия и данные', icon: Settings }
];
export default function More({ stats, touchpoints }) {
    return _jsxs("section", { className: "screen", children: [_jsx(PageHeader, { title: "\u0415\u0449\u0451", subtitle: "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0431\u0438\u0437\u043D\u0435\u0441\u043E\u043C \u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u043C\u0438 Ira Workspace" }), _jsxs("div", { className: "more-stats", children: [_jsxs("article", { children: [_jsx("span", { children: "\u0417\u0430\u044F\u0432\u043A\u0438 \u0432 \u0440\u0430\u0431\u043E\u0442\u0435" }), _jsx("strong", { children: stats.activeLeads })] }), _jsxs("article", { children: [_jsx("span", { children: "\u041A\u043E\u043D\u0432\u0435\u0440\u0441\u0438\u044F" }), _jsxs("strong", { children: [stats.conversion, "%"] })] }), _jsxs("article", { children: [_jsx("span", { children: "\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0435 \u043A\u0430\u0441\u0430\u043D\u0438\u044F" }), _jsx("strong", { children: touchpoints.filter(x => x.active).length })] })] }), _jsx("div", { className: "more-grid", children: items.map(({ to, title, text, icon: Icon }) => _jsxs(Link, { className: "more-card", to: to, children: [_jsx("span", { className: "more-icon", children: _jsx(Icon, {}) }), _jsxs("span", { className: "grow", children: [_jsx("strong", { children: title }), _jsx("small", { children: text })] }), _jsx(ChevronRight, { size: 20 })] }, to)) })] });
}
