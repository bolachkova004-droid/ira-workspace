import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { X } from 'lucide-react';
export default function Modal({ title, onClose, children }) { return _jsx("div", { className: "modal-backdrop", onMouseDown: onClose, children: _jsxs("section", { className: "modal", onMouseDown: e => e.stopPropagation(), children: [_jsxs("header", { children: [_jsx("h2", { children: title }), _jsx("button", { className: "icon-btn", onClick: onClose, children: _jsx(X, {}) })] }), children] }) }); }
