import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import AppErrorBoundary from './components/AppErrorBoundary.js';

import { initTelegram } from './telegram.js';
initTelegram();
const root = document.getElementById('root');
if (!root)
    throw new Error('Не найден корневой элемент приложения');
root.removeAttribute('data-booting');
createRoot(root).render(_jsx(StrictMode, { children: _jsx(AppErrorBoundary, { children: _jsx(App, {}) }) }));
