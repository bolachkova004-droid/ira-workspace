import { useEffect, useMemo, useState } from 'react';
import { applyTelegramChrome, getTelegramApp } from '../telegram.js';
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shiftedDate = (days) => { const date = new Date(); date.setDate(date.getDate() + days); return localDate(date); };
const today = localDate();
const createId = () => {
    try {
        return crypto.randomUUID();
    }
    catch {
        return `ira-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
};
const writeStorage = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }
    catch (error) {
        console.warn(`[Ira Workspace] Could not save ${key}`, error);
    }
};
const studentsSeed = [
    { id: 's1', name: 'Анна Смирнова', level: 'B1', goal: 'Уверенно говорить на работе', phone: '+7 900 111-22-33', telegram: '@anna_s', rate: 1800, balance: 3600, status: 'Активный', timezone: 'Москва', interests: 'Кино, работа, путешествия', strengths: 'Хорошо понимает речь на слух', challenges: 'Путает времена в спонтанной речи', note: 'Любит практичные темы и короткие домашние задания.', packageTotal: 12, packageUsed: 8 },
    { id: 's2', name: 'Мария Иванова', level: 'B2', goal: 'Свободнее обсуждать сложные темы', phone: '+7 900 222-33-44', telegram: '@maria_i', rate: 2000, balance: 2000, status: 'Активный', timezone: 'Москва', interests: 'Книги, статьи, психология', strengths: 'Большой словарный запас', challenges: 'Хочет звучать естественнее', note: 'Лучше всего вовлекается через статьи и подкасты.', packageTotal: 8, packageUsed: 5 },
    { id: 's3', name: 'Иван Петров', level: 'A2', goal: 'Систематизировать грамматику', phone: '+7 900 333-44-55', telegram: '@ivan_p', rate: 1700, balance: -1700, status: 'Активный', timezone: 'Москва', interests: 'Технологии, спорт', strengths: 'Регулярно занимается', challenges: 'Боится ошибаться', note: 'Нужны понятные схемы и повторение.', packageTotal: 10, packageUsed: 9 }
];
const leadsSeed = [
    { id: 'l1', name: 'Екатерина', source: 'Threads', contact: '@katya', createdAt: 'Сегодня, 09:21', status: 'Новая', goal: 'Английский для путешествий', note: 'Готова начать в августе' },
    { id: 'l2', name: 'Ольга', source: 'Telegram', contact: '@olga', createdAt: 'Вчера, 18:40', status: 'Пробный урок', goal: 'Перейти с A2 на B1', note: 'Пробный в четверг' },
    { id: 'l3', name: 'Алексей', source: 'Instagram', contact: '@alex', createdAt: 'Недавно', status: 'Связались', goal: 'Английский для работы', note: 'Ждёт варианты времени' }
];
const lessonsSeed = [
    { id: 'e1', studentId: 's1', student: 'Анна Смирнова', date: today, time: '10:00', duration: 60, topic: 'Speaking: work routines', status: 'Запланирован', paid: true, homework: 'Подготовить 5 вопросов коллеге', plan: 'Разминка → статья → ролевой диалог → обратная связь', notes: '', errors: 'Present Perfect vs Past Simple', mood: 'Спокойное' },
    { id: 'e2', studentId: 's2', student: 'Мария Иванова', date: today, time: '12:00', duration: 60, topic: 'Article discussion', status: 'Запланирован', paid: true, homework: 'Прочитать статью и выписать 7 выражений', plan: 'Обсудить заголовок, лексику, аргументы автора', notes: '', errors: 'Natural collocations', mood: 'Отличное' },
    { id: 'e3', student: 'Пробное занятие', date: today, time: '18:00', duration: 45, topic: 'Диагностика', status: 'Запланирован', paid: false, homework: '', plan: 'Цели → speaking → grammar → план на 3 месяца', notes: '', errors: '', mood: 'Спокойное' },
    { id: 'e4', studentId: 's3', student: 'Иван Петров', date: shiftedDate(1), time: '18:00', duration: 60, topic: 'Past Simple vs Present Perfect', status: 'Запланирован', paid: false, homework: 'Упражнения 1–3', plan: 'Повторение правила → контролируемая практика → речь', notes: '', errors: 'Irregular verbs', mood: 'Сложно' },
    { id: 'e5', studentId: 's1', student: 'Анна Смирнова', date: shiftedDate(-4), time: '10:00', duration: 60, topic: 'Meetings and small talk', status: 'Проведён', paid: true, homework: 'Записать голосовое', plan: '', notes: 'Хорошо использовала новую лексику.', errors: 'Articles with jobs', mood: 'Отличное' }
];
const tasksSeed = [
    { id: 't1', title: 'Проверить домашнее Анны', due: 'Сегодня', done: false, category: 'Домашнее' },
    { id: 't2', title: 'Ответить Екатерине', due: 'Сегодня', done: false, category: 'Заявка' },
    { id: 't3', title: 'Напомнить Ивану об оплате', due: 'Сегодня', done: false, category: 'Оплата' }
];
const touchpointsSeed = [
    { id: 'tp1', title: 'English Escape', kind: 'Игра', url: 'https://example.com/english-escape', description: 'Интерактивная игра для разговорной практики и повторения лексики.', clicks: 126, leads: 8, active: true, pinned: true },
    { id: 'tp2', title: 'Telegram-канал', kind: 'Соцсеть', url: 'https://t.me/', description: 'Основной канал с разборами английского, книг и современной лексики.', clicks: 248, leads: 14, active: true, pinned: true },
    { id: 'tp3', title: 'Threads', kind: 'Соцсеть', url: 'https://threads.net/', description: 'Короткие заметки о преподавании, языке и рабочих наблюдениях.', clicks: 181, leads: 11, active: true, pinned: false },
    { id: 'tp4', title: 'Taplink', kind: 'Taplink', url: 'https://taplink.cc/', description: 'Главная страница со ссылками, квизом и записью на занятие.', clicks: 94, leads: 9, active: true, pinned: true },
    { id: 'tp5', title: 'Гайд для взрослых учеников', kind: 'Материал', url: 'https://example.com/guide', description: 'Бесплатный материал после прохождения диагностики.', clicks: 73, leads: 5, active: true, pinned: false }
];
const contentSeed = [
    { id: 'c1', title: 'Почему взрослые знают правила, но не говорят', platform: 'Threads', stage: 'Черновик', deadline: today, tags: ['speaking', 'взрослые'], note: 'Начать с истории ученика и закончить мягким приглашением на диагностику.' },
    { id: 'c2', title: 'Разбор летней лексики из сериала', platform: 'Telegram', stage: 'Идея', deadline: '', tags: ['лексика', 'лето'], note: '5 выражений + маленькое задание в комментариях.' },
    { id: 'c3', title: 'Как проходят мои занятия', platform: 'Instagram', stage: 'Готов', deadline: today, tags: ['уроки', 'обо мне'], note: 'Карусель на 7 слайдов, добавить скриншоты материалов.' },
    { id: 'c4', title: 'Книжный клуб как игра', platform: 'Threads', stage: 'Опубликован', deadline: '', tags: ['книги', 'клуб'], note: '' }
];
const materialsSeed = [
    { id: 'm1', studentId: 's1', title: 'Useful phrases for meetings', kind: 'Рабочий лист', url: '#' },
    { id: 'm2', studentId: 's1', title: 'How to make small talk', kind: 'Статья', url: '#' },
    { id: 'm3', studentId: 's2', title: 'The psychology of habits', kind: 'Статья', url: '#' }
];
function readAny(keys, fallback) {
    for (const key of keys) {
        try {
            const value = localStorage.getItem(key);
            if (value !== null)
                return JSON.parse(value);
        }
        catch { /* use next key */ }
    }
    return fallback;
}
function initialDark() {
    try {
        const saved = localStorage.getItem('ira.v4.dark');
        if (saved !== null)
            return JSON.parse(saved);
    }
    catch { /* use environment */ }
    return getTelegramApp()?.colorScheme === 'dark' || window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
}
export function useWorkspace() {
    const [contentItems, setContentItems] = useState(() => readAny(['ira.v4.content', 'ira.v3.content'], contentSeed));
    const [touchpoints, setTouchpoints] = useState(() => readAny(['ira.v4.touchpoints', 'ira.v3.touchpoints'], touchpointsSeed));
    const [students, setStudents] = useState(() => readAny(['ira.v4.students', 'ira.v2.students'], studentsSeed));
    const [leads, setLeads] = useState(() => readAny(['ira.v4.leads', 'ira.v2.leads'], leadsSeed));
    const [lessons, setLessons] = useState(() => readAny(['ira.v4.lessons', 'ira.v2.lessons'], lessonsSeed));
    const [tasks, setTasks] = useState(() => readAny(['ira.v4.tasks', 'ira.v2.tasks'], tasksSeed));
    const [materials, setMaterials] = useState(() => readAny(['ira.v4.materials', 'ira.v2.materials'], materialsSeed));
    const [dark, setDark] = useState(initialDark);
    useEffect(() => writeStorage('ira.v4.content', contentItems), [contentItems]);
    useEffect(() => writeStorage('ira.v4.touchpoints', touchpoints), [touchpoints]);
    useEffect(() => writeStorage('ira.v4.students', students), [students]);
    useEffect(() => writeStorage('ira.v4.leads', leads), [leads]);
    useEffect(() => writeStorage('ira.v4.lessons', lessons), [lessons]);
    useEffect(() => writeStorage('ira.v4.tasks', tasks), [tasks]);
    useEffect(() => writeStorage('ira.v4.materials', materials), [materials]);
    useEffect(() => { writeStorage('ira.v4.dark', dark); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; applyTelegramChrome(dark); }, [dark]);
    const currentToday = localDate();
    const stats = useMemo(() => ({
        activeStudents: students.filter(student => student.status === 'Активный').length,
        activeLeads: leads.filter(lead => !['Стала ученицей', 'Отказ'].includes(lead.status)).length,
        todayLessons: lessons.filter(lesson => lesson.date === currentToday && lesson.status !== 'Отменён').length,
        revenue: lessons.filter(lesson => lesson.paid && lesson.status === 'Проведён').reduce((total, lesson) => total + (students.find(student => student.id === lesson.studentId)?.rate || 0), 0),
        debt: students.filter(student => student.balance < 0).reduce((total, student) => total + Math.abs(student.balance), 0),
        conversion: leads.length ? Math.round(leads.filter(lead => lead.status === 'Стала ученицей').length / leads.length * 100) : 0
    }), [students, leads, lessons, currentToday]);
    const insights = useMemo(() => {
        const result = [];
        const lowPackage = students.find(student => student.packageTotal - student.packageUsed <= 2 && student.status === 'Активный');
        if (lowPackage)
            result.push(`У ${lowPackage.name.split(' ')[0]} осталось ${lowPackage.packageTotal - lowPackage.packageUsed} занятия в пакете.`);
        const debtStudent = students.find(student => student.balance < 0);
        if (debtStudent)
            result.push(`${debtStudent.name.split(' ')[0]}: нужно напомнить об оплате ${Math.abs(debtStudent.balance).toLocaleString('ru-RU')} ₽.`);
        const freshLead = leads.find(lead => lead.status === 'Новая');
        if (freshLead)
            result.push(`Новая заявка от ${freshLead.name} из ${freshLead.source}.`);
        return result;
    }, [students, leads]);
    return {
        students, leads, lessons, tasks, materials, touchpoints, contentItems, dark, setDark, stats, insights,
        addStudent: (value) => setStudents(items => [{ ...value, id: createId() }, ...items]),
        updateStudent: (value) => setStudents(items => items.map(student => student.id === value.id ? value : student)),
        deleteStudent: (id) => setStudents(items => items.filter(student => student.id !== id)),
        addLead: (value) => setLeads(items => [{ ...value, id: createId(), createdAt: 'Только что', status: 'Новая' }, ...items]),
        updateLeadStatus: (id, status) => setLeads(items => items.map(lead => lead.id === id ? { ...lead, status } : lead)),
        deleteLead: (id) => setLeads(items => items.filter(lead => lead.id !== id)),
        addLesson: (value) => setLessons(items => [...items, { ...value, id: createId() }]),
        updateLesson: (value) => setLessons(items => items.map(lesson => lesson.id === value.id ? value : lesson)),
        deleteLesson: (id) => setLessons(items => items.filter(lesson => lesson.id !== id)),
        addTask: (title) => setTasks(items => [{ id: createId(), title, due: 'Сегодня', done: false, category: 'Другое' }, ...items]),
        toggleTask: (id) => setTasks(items => items.map(task => task.id === id ? { ...task, done: !task.done } : task)),
        deleteTask: (id) => setTasks(items => items.filter(task => task.id !== id)),
        addContentItem: (value) => setContentItems(items => [{ ...value, id: createId() }, ...items]),
        updateContentItem: (value) => setContentItems(items => items.map(item => item.id === value.id ? value : item)),
        deleteContentItem: (id) => setContentItems(items => items.filter(item => item.id !== id)),
        addTouchpoint: (value) => setTouchpoints(items => [{ ...value, id: createId() }, ...items]),
        updateTouchpoint: (value) => setTouchpoints(items => items.map(item => item.id === value.id ? value : item)),
        deleteTouchpoint: (id) => setTouchpoints(items => items.filter(item => item.id !== id)),
        addMaterial: (value) => setMaterials(items => [{ ...value, id: createId() }, ...items]),
        deleteMaterial: (id) => setMaterials(items => items.filter(item => item.id !== id)),
        exportData: () => JSON.stringify({ version: 4, exportedAt: new Date().toISOString(), students, leads, lessons, tasks, materials, touchpoints, contentItems, dark }, null, 2),
        importData: (raw) => { const data = JSON.parse(raw); if (Array.isArray(data.students))
            setStudents(data.students); if (Array.isArray(data.leads))
            setLeads(data.leads); if (Array.isArray(data.lessons))
            setLessons(data.lessons); if (Array.isArray(data.tasks))
            setTasks(data.tasks); if (Array.isArray(data.materials))
            setMaterials(data.materials); if (Array.isArray(data.touchpoints))
            setTouchpoints(data.touchpoints); if (Array.isArray(data.contentItems))
            setContentItems(data.contentItems); if (typeof data.dark === 'boolean')
            setDark(data.dark); },
        reset: () => { Object.keys(localStorage).filter(key => key.startsWith('ira.')).forEach(key => localStorage.removeItem(key)); location.reload(); }
    };
}
