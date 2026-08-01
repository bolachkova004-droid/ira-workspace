import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
export default class AppErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error: error instanceof Error ? error.message : 'Неизвестная ошибка запуска' };
    }
    componentDidCatch(error, info) {
        console.error('[Ira Workspace] Render error', error, info);
    }
    render() {
        if (this.state.error) {
            return _jsx("main", { className: "fatal-screen", children: _jsxs("div", { className: "fatal-card", children: [_jsx("div", { className: "fatal-logo", children: "IW" }), _jsx("p", { className: "eyebrow", children: "Ira Workspace" }), _jsx("h1", { children: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435" }), _jsx("p", { children: "\u041E\u0431\u043D\u043E\u0432\u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443. \u0415\u0441\u043B\u0438 \u044D\u043A\u0440\u0430\u043D \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u0441\u043D\u043E\u0432\u0430, \u043E\u0442\u043A\u0440\u043E\u0439 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043F\u043E \u0441\u0441\u044B\u043B\u043A\u0435 \u0438\u0437 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u043F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u044E GitHub Pages." }), _jsx("button", { className: "primary", onClick: () => location.reload(), children: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C" }), _jsxs("details", { children: [_jsx("summary", { children: "\u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F" }), _jsx("code", { children: this.state.error })] })] }) });
        }
        return this.props.children;
    }
}
