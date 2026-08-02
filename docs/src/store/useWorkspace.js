import { useEffect, useMemo, useRef, useState } from 'react';
import { applyTelegramChrome, getTelegramApp } from '../telegram.js';
import { getCloudMode, loadTeacherSnapshot, saveTeacherSnapshot } from '../cloud.js';
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shiftedDate = (days) => { const date = new Date(); date.setDate(date.getDate() + days); return localDate(date); };
const isoAt = (date, time = '09:00') => new Date(`${date}T${time}:00`).toISOString();
const today = localDate();
const createId = () => { try {
    return crypto.randomUUID();
}
catch {
    return `ira-${Date.now()}-${Math.random().toString(36).slice(2)}`;
} };
const createToken = () => `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const writeStorage = (key, value) => { try {
    localStorage.setItem(key, JSON.stringify(value));
}
catch (error) {
    console.warn(`[Ira Workspace] Could not save ${key}`, error);
} };
const studentsSeed = [
    { id: 's1', name: 'Анна Смирнова', level: 'B1', goal: 'Уверенно говорить на работе', phone: '+7 900 111-22-33', telegram: '@anna_s', telegramId: '', rate: 1800, balance: 3600, status: 'Активный', timezone: 'Москва', interests: 'Кино, работа, путешествия', strengths: 'Хорошо понимает речь на слух', challenges: 'Путает времена в спонтанной речи', note: 'Любит практичные темы и короткие домашние задания.', packageTotal: 12, packageUsed: 8, accessToken: 'anna-demo-access', nextPaymentDate: shiftedDate(5), notificationsEnabled: true },
    { id: 's2', name: 'Мария Иванова', level: 'B2', goal: 'Свободнее обсуждать сложные темы', phone: '+7 900 222-33-44', telegram: '@maria_i', telegramId: '', rate: 2000, balance: 2000, status: 'Активный', timezone: 'Москва', interests: 'Книги, статьи, психология', strengths: 'Большой словарный запас', challenges: 'Хочет звучать естественнее', note: 'Лучше всего вовлекается через статьи и подкасты.', packageTotal: 8, packageUsed: 5, accessToken: 'maria-demo-access', nextPaymentDate: shiftedDate(8), notificationsEnabled: true },
    { id: 's3', name: 'Иван Петров', level: 'A2', goal: 'Систематизировать грамматику', phone: '+7 900 333-44-55', telegram: '@ivan_p', telegramId: '', rate: 1700, balance: -1700, status: 'Активный', timezone: 'Москва', interests: 'Технологии, спорт', strengths: 'Регулярно занимается', challenges: 'Боится ошибаться', note: 'Нужны понятные схемы и повторение.', packageTotal: 10, packageUsed: 9, accessToken: 'ivan-demo-access', nextPaymentDate: shiftedDate(-1), notificationsEnabled: true }
];
const leadsSeed = [
    { id: 'l1', name: 'Екатерина', source: 'Threads', contact: '@katya', createdAt: 'Сегодня, 09:21', status: 'Новая', goal: 'Английский для путешествий', note: 'Готова начать в августе' },
    { id: 'l2', name: 'Ольга', source: 'Telegram', contact: '@olga', createdAt: 'Вчера, 18:40', status: 'Пробный урок', goal: 'Перейти с A2 на B1', note: 'Пробный в четверг' },
    { id: 'l3', name: 'Алексей', source: 'Instagram', contact: '@alex', createdAt: 'Недавно', status: 'Связались', goal: 'Английский для работы', note: 'Ждёт варианты времени' }
];
const lessonsSeed = [
    { id: 'e1', studentId: 's1', student: 'Анна Смирнова', date: today, time: '10:00', duration: 60, topic: 'Speaking: work routines', status: 'Запланирован', paid: true, homework: 'Подготовить 5 вопросов коллеге', plan: 'Разминка → статья → ролевой диалог → обратная связь', notes: '', errors: 'Present Perfect vs Past Simple', mood: 'Спокойное', meetingLink: 'https://meet.google.com/', reminder24h: true, reminder2h: true },
    { id: 'e2', studentId: 's2', student: 'Мария Иванова', date: today, time: '12:00', duration: 60, topic: 'Article discussion', status: 'Запланирован', paid: true, homework: 'Прочитать статью и выписать 7 выражений', plan: 'Обсудить заголовок, лексику, аргументы автора', notes: '', errors: 'Natural collocations', mood: 'Отличное', meetingLink: 'https://zoom.us/', reminder24h: true, reminder2h: true },
    { id: 'e3', student: 'Пробное занятие', date: today, time: '18:00', duration: 45, topic: 'Диагностика', status: 'Запланирован', paid: false, homework: '', plan: 'Цели → speaking → grammar → план на 3 месяца', notes: '', errors: '', mood: 'Спокойное', meetingLink: '' },
    { id: 'e4', studentId: 's3', student: 'Иван Петров', date: shiftedDate(1), time: '18:00', duration: 60, topic: 'Past Simple vs Present Perfect', status: 'Запланирован', paid: false, homework: 'Упражнения 1–3', plan: 'Повторение правила → контролируемая практика → речь', notes: '', errors: 'Irregular verbs', mood: 'Сложно', meetingLink: 'https://meet.google.com/', reminder24h: true, reminder2h: true },
    { id: 'e5', studentId: 's1', student: 'Анна Смирнова', date: shiftedDate(-4), time: '10:00', duration: 60, topic: 'Meetings and small talk', status: 'Проведён', paid: true, homework: 'Записать голосовое', plan: '', notes: 'Хорошо использовала новую лексику.', errors: 'Articles with jobs', mood: 'Отличное' }
];
const tasksSeed = [
    { id: 't1', title: 'Проверить домашнее Анны', due: 'Сегодня', done: false, category: 'Домашнее' },
    { id: 't2', title: 'Ответить Екатерине', due: 'Сегодня', done: false, category: 'Заявка' },
    { id: 't3', title: 'Напомнить Ивану об оплате', due: 'Сегодня', done: false, category: 'Оплата' }
];
const paymentsSeed = [
    { id: 'p1', studentId: 's1', amount: 7200, dueDate: shiftedDate(5), status: 'Ожидается', comment: 'Следующая часть пакета' },
    { id: 'p2', studentId: 's2', amount: 8000, dueDate: shiftedDate(8), status: 'Ожидается', comment: 'Пакет из 4 занятий' },
    { id: 'p3', studentId: 's3', amount: 1700, dueDate: shiftedDate(-1), status: 'Просрочено', comment: 'Оплата за урок' }
];
const homeworksSeed = [
    { id: 'h1', studentId: 's1', lessonId: 'e1', title: 'Вопросы для small talk', description: 'Подготовить 5 вопросов коллеге и записать голосовое.', dueDate: shiftedDate(2), status: 'Назначено', materialIds: ['m1'] },
    { id: 'h2', studentId: 's2', lessonId: 'e2', title: 'Статья о привычках', description: 'Прочитать статью, выбрать 7 выражений и сформулировать своё мнение.', dueDate: shiftedDate(1), status: 'Назначено', materialIds: ['m3'] }
];
const notificationsSeed = [
    { id: 'n1', studentId: 's3', paymentId: 'p3', kind: 'payment_overdue', sendAt: new Date().toISOString(), status: 'Запланировано', deliveryMode: 'На проверку', title: 'Напоминание об оплате', message: 'Иван, напоминаю об оплате занятия — 1 700 ₽. Если уже оплатили, просто пришлите чек ✨', createdAt: new Date().toISOString() },
    { id: 'n2', studentId: 's1', lessonId: 'e1', kind: 'lesson_2h', sendAt: isoAt(today, '08:00'), status: 'Запланировано', deliveryMode: 'Авто', title: 'Урок через 2 часа', message: 'Анна, сегодня в 10:00 у нас английский. Ссылка на занятие будет в личном кабинете.', createdAt: new Date().toISOString() }
];
const rescheduleSeed = [];
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
function readAny(keys, fallback) { for (const key of keys) {
    try {
        const value = localStorage.getItem(key);
        if (value !== null)
            return JSON.parse(value);
    }
    catch { /* use next key */ }
} return fallback; }
function initialDark() { try {
    const saved = localStorage.getItem('ira.v6.dark') ?? localStorage.getItem('ira.v5.dark') ?? localStorage.getItem('ira.v4.dark');
    if (saved !== null)
        return JSON.parse(saved);
}
catch { /* use environment */ } return getTelegramApp()?.colorScheme === 'dark' || window.matchMedia?.('(prefers-color-scheme: dark)').matches || false; }
export function useWorkspace() {
    const [contentItems, setContentItems] = useState(() => readAny(['ira.v6.content', 'ira.v5.content', 'ira.v4.content', 'ira.v3.content'], contentSeed));
    const [touchpoints, setTouchpoints] = useState(() => readAny(['ira.v6.touchpoints', 'ira.v5.touchpoints', 'ira.v4.touchpoints', 'ira.v3.touchpoints'], touchpointsSeed));
    const [students, setStudents] = useState(() => readAny(['ira.v6.students', 'ira.v5.students', 'ira.v4.students', 'ira.v2.students'], studentsSeed).map(s => ({ ...s, accessToken: s.accessToken || createToken(), notificationsEnabled: s.notificationsEnabled !== false })));
    const [leads, setLeads] = useState(() => readAny(['ira.v6.leads', 'ira.v5.leads', 'ira.v4.leads', 'ira.v2.leads'], leadsSeed));
    const [lessons, setLessons] = useState(() => readAny(['ira.v6.lessons', 'ira.v5.lessons', 'ira.v4.lessons', 'ira.v2.lessons'], lessonsSeed));
    const [tasks, setTasks] = useState(() => readAny(['ira.v6.tasks', 'ira.v5.tasks', 'ira.v4.tasks', 'ira.v2.tasks'], tasksSeed));
    const [materials, setMaterials] = useState(() => readAny(['ira.v6.materials', 'ira.v5.materials', 'ira.v4.materials', 'ira.v2.materials'], materialsSeed));
    const [payments, setPayments] = useState(() => readAny(['ira.v6.payments', 'ira.v5.payments'], paymentsSeed));
    const [homeworks, setHomeworks] = useState(() => readAny(['ira.v6.homeworks', 'ira.v5.homeworks'], homeworksSeed));
    const [notifications, setNotifications] = useState(() => readAny(['ira.v6.notifications', 'ira.v5.notifications'], notificationsSeed).map(item => ({ ...item, deliveryMode: item.deliveryMode || (['payment_3d', 'payment_due', 'payment_overdue', 'package_low', 'custom'].includes(item.kind) ? 'На проверку' : 'Авто') })));
    const [rescheduleRequests, setRescheduleRequests] = useState(() => readAny(['ira.v6.reschedule', 'ira.v5.reschedule'], rescheduleSeed));
    const [dark, setDark] = useState(initialDark);
    const [cloudState, setCloudState] = useState('local');
    const cloudHydrated = useRef(false);
    useEffect(() => writeStorage('ira.v6.content', contentItems), [contentItems]);
    useEffect(() => writeStorage('ira.v6.touchpoints', touchpoints), [touchpoints]);
    useEffect(() => writeStorage('ira.v6.students', students), [students]);
    useEffect(() => writeStorage('ira.v6.leads', leads), [leads]);
    useEffect(() => writeStorage('ira.v6.lessons', lessons), [lessons]);
    useEffect(() => writeStorage('ira.v6.tasks', tasks), [tasks]);
    useEffect(() => writeStorage('ira.v6.materials', materials), [materials]);
    useEffect(() => writeStorage('ira.v6.payments', payments), [payments]);
    useEffect(() => writeStorage('ira.v6.homeworks', homeworks), [homeworks]);
    useEffect(() => writeStorage('ira.v6.notifications', notifications), [notifications]);
    useEffect(() => writeStorage('ira.v6.reschedule', rescheduleRequests), [rescheduleRequests]);
    useEffect(() => { writeStorage('ira.v6.dark', dark); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; applyTelegramChrome(dark); }, [dark]);
    useEffect(() => {
        let cancelled = false;
        const config = getCloudMode();
        if (!config) {
            cloudHydrated.current = true;
            return;
        }
        setCloudState('loading');
        loadTeacherSnapshot().then(data => {
            if (cancelled)
                return;
            if (data) {
                if (Array.isArray(data.students))
                    setStudents(data.students);
                if (Array.isArray(data.leads))
                    setLeads(data.leads);
                if (Array.isArray(data.lessons))
                    setLessons(data.lessons);
                if (Array.isArray(data.tasks))
                    setTasks(data.tasks);
                if (Array.isArray(data.materials))
                    setMaterials(data.materials);
                if (Array.isArray(data.touchpoints))
                    setTouchpoints(data.touchpoints);
                if (Array.isArray(data.contentItems))
                    setContentItems(data.contentItems);
                if (Array.isArray(data.payments))
                    setPayments(data.payments);
                if (Array.isArray(data.homeworks))
                    setHomeworks(data.homeworks);
                if (Array.isArray(data.notifications))
                    setNotifications(data.notifications);
                if (Array.isArray(data.rescheduleRequests))
                    setRescheduleRequests(data.rescheduleRequests);
                if (typeof data.dark === 'boolean')
                    setDark(data.dark);
            }
            cloudHydrated.current = true;
            setCloudState('connected');
        }).catch(error => { console.warn('[Ira Workspace] Cloud load failed', error); cloudHydrated.current = true; setCloudState('error'); });
        return () => { cancelled = true; };
    }, []);
    useEffect(() => {
        if (!cloudHydrated.current || cloudState !== 'connected')
            return;
        const timer = window.setTimeout(() => {
            saveTeacherSnapshot({ version: 6, students, leads, lessons, tasks, materials, touchpoints, contentItems, payments, homeworks, notifications, rescheduleRequests, dark, updatedAt: new Date().toISOString() }).catch(error => { console.warn('[Ira Workspace] Cloud save failed', error); setCloudState('error'); });
        }, 900);
        return () => window.clearTimeout(timer);
    }, [cloudState, students, leads, lessons, tasks, materials, touchpoints, contentItems, payments, homeworks, notifications, rescheduleRequests, dark]);
    useEffect(() => {
        const todayKey = localDate();
        const inThreeDays = shiftedDate(3);
        const tomorrow = shiftedDate(1);
        const createdAt = new Date().toISOString();
        setPayments(items => { let changed = false; const next = items.map(payment => { if (payment.status === 'Ожидается' && payment.dueDate < todayKey) {
            changed = true;
            return { ...payment, status: 'Просрочено' };
        } return payment; }); return changed ? next : items; });
        setNotifications(items => {
            const next = [...items];
            const has = (studentId, kind, paymentId) => next.some(item => item.studentId === studentId && item.kind === kind && item.paymentId === paymentId && item.status !== 'Отменено');
            for (const payment of payments) {
                const student = students.find(item => item.id === payment.studentId);
                if (!student || student.notificationsEnabled === false || payment.status === 'Оплачено')
                    continue;
                if (payment.dueDate === inThreeDays && !has(student.id, 'payment_3d', payment.id))
                    next.unshift({ id: createId(), studentId: student.id, paymentId: payment.id, kind: 'payment_3d', sendAt: createdAt, status: 'Запланировано', title: 'Оплата через 3 дня', message: `${student.name.split(' ')[0]}, через 3 дня плановая оплата — ${payment.amount.toLocaleString('ru-RU')} ₽.`, createdAt });
                if (payment.dueDate === todayKey && !has(student.id, 'payment_due', payment.id))
                    next.unshift({ id: createId(), studentId: student.id, paymentId: payment.id, kind: 'payment_due', sendAt: createdAt, status: 'Запланировано', title: 'Сегодня день оплаты', message: `${student.name.split(' ')[0]}, напоминаю о плановой оплате — ${payment.amount.toLocaleString('ru-RU')} ₽ ✨`, createdAt });
                if (payment.dueDate < todayKey && !has(student.id, 'payment_overdue', payment.id))
                    next.unshift({ id: createId(), studentId: student.id, paymentId: payment.id, kind: 'payment_overdue', sendAt: createdAt, status: 'Запланировано', deliveryMode: 'На проверку', title: 'Напоминание об оплате', message: `${student.name.split(' ')[0]}, мягко напоминаю об оплате — ${payment.amount.toLocaleString('ru-RU')} ₽. Если уже оплатили, просто пришлите чек.`, createdAt });
            }
            for (const student of students) {
                if (student.status !== 'Активный' || student.notificationsEnabled === false || student.packageTotal - student.packageUsed > 2 || has(student.id, 'package_low'))
                    continue;
                next.unshift({ id: createId(), studentId: student.id, kind: 'package_low', sendAt: createdAt, status: 'Запланировано', title: 'Заканчивается пакет', message: `${student.name.split(' ')[0]}, в пакете осталось ${student.packageTotal - student.packageUsed} занятия. Можно заранее продлить его, чтобы сохранить время в расписании.`, createdAt });
            }
            for (const homework of homeworks) {
                if (homework.status !== 'Назначено' || homework.dueDate !== tomorrow || has(homework.studentId, 'homework_reminder'))
                    continue;
                const student = students.find(item => item.id === homework.studentId);
                if (!student || student.notificationsEnabled === false)
                    continue;
                next.unshift({ id: createId(), studentId: student.id, kind: 'homework_reminder', sendAt: createdAt, status: 'Запланировано', title: 'Домашнее задание', message: `${student.name.split(' ')[0]}, напоминаю про домашнее «${homework.title}». Дедлайн завтра.`, createdAt });
            }
            return next.length === items.length ? items : next;
        });
    }, [payments, students, homeworks]);
    const currentToday = localDate();
    const stats = useMemo(() => ({
        activeStudents: students.filter(student => student.status === 'Активный').length,
        activeLeads: leads.filter(lead => !['Стала ученицей', 'Отказ'].includes(lead.status)).length,
        todayLessons: lessons.filter(lesson => lesson.date === currentToday && !['Отменён'].includes(lesson.status)).length,
        revenue: payments.filter(payment => payment.status === 'Оплачено').reduce((total, payment) => total + payment.amount, 0),
        debt: payments.filter(payment => payment.status === 'Просрочено').reduce((total, payment) => total + payment.amount, 0),
        conversion: leads.length ? Math.round(leads.filter(lead => lead.status === 'Стала ученицей').length / leads.length * 100) : 0
    }), [students, leads, lessons, payments, currentToday]);
    const insights = useMemo(() => {
        const result = [];
        const nextLesson = lessons.filter(l => l.date >= currentToday && l.status !== 'Отменён').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
        if (nextLesson)
            result.push(`Следующий урок — ${nextLesson.student} в ${nextLesson.time}.`);
        const lowPackage = students.find(student => student.packageTotal - student.packageUsed <= 2 && student.status === 'Активный');
        if (lowPackage)
            result.push(`У ${lowPackage.name.split(' ')[0]} осталось ${lowPackage.packageTotal - lowPackage.packageUsed} занятия в пакете.`);
        const overdue = payments.find(payment => payment.status === 'Просрочено');
        if (overdue) {
            const student = students.find(s => s.id === overdue.studentId);
            if (student)
                result.push(`${student.name.split(' ')[0]}: пора мягко напомнить об оплате ${overdue.amount.toLocaleString('ru-RU')} ₽.`);
        }
        return result;
    }, [students, lessons, payments, currentToday]);
    const queueNotification = (value) => setNotifications(items => [{ ...value, id: createId(), createdAt: new Date().toISOString(), status: 'Запланировано', deliveryMode: value.deliveryMode || 'На проверку' }, ...items]);
    return {
        students, leads, lessons, tasks, materials, touchpoints, contentItems, payments, homeworks, notifications, rescheduleRequests, dark, setDark, cloudState, stats, insights,
        addStudent: (value) => setStudents(items => [{ ...value, id: createId(), accessToken: value.accessToken || createToken() }, ...items]),
        updateStudent: (value) => setStudents(items => items.map(student => student.id === value.id ? value : student)),
        deleteStudent: (id) => setStudents(items => items.filter(student => student.id !== id)),
        regenerateStudentToken: (id) => setStudents(items => items.map(student => student.id === id ? { ...student, accessToken: createToken() } : student)),
        getStudentAccessUrl: (studentId) => { const student = students.find(s => s.id === studentId); if (!student?.accessToken)
            return ''; return `${window.location.origin}${window.location.pathname}#/student/${student.accessToken}`; },
        getStudentBotLink: (studentId) => { const student = students.find(s => s.id === studentId); if (!student?.accessToken)
            return ''; return `https://t.me/ira_workspace_bot?start=access_${student.accessToken}`; },
        addLead: (value) => setLeads(items => [{ ...value, id: createId(), createdAt: 'Только что', status: 'Новая' }, ...items]),
        updateLeadStatus: (id, status) => setLeads(items => items.map(lead => lead.id === id ? { ...lead, status } : lead)),
        deleteLead: (id) => setLeads(items => items.filter(lead => lead.id !== id)),
        addLesson: (value) => setLessons(items => [...items, { ...value, id: createId() }]),
        updateLesson: (value) => setLessons(items => items.map(lesson => lesson.id === value.id ? value : lesson)),
        deleteLesson: (id) => setLessons(items => items.filter(lesson => lesson.id !== id)),
        rescheduleLesson: (id, date, time, notify = true) => {
            const lesson = lessons.find(l => l.id === id);
            if (!lesson)
                return;
            setLessons(items => items.map(l => l.id === id ? { ...l, previousDate: l.date, previousTime: l.time, date, time, status: 'Перенесён' } : l));
            setNotifications(items => {
                const cancelled = items.map(item => item.lessonId === id && item.status === 'Запланировано' ? { ...item, status: 'Отменено' } : item);
                if (!notify || !lesson.studentId)
                    return cancelled;
                const starts = new Date(`${date}T${time}:00`).getTime();
                const now = Date.now();
                const createdAt = new Date().toISOString();
                const next = [{ id: createId(), studentId: lesson.studentId, lessonId: id, kind: 'lesson_moved', sendAt: createdAt, status: 'Запланировано', deliveryMode: 'Авто', title: 'Урок перенесён', message: `${lesson.student}, урок перенесён на ${new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} в ${time}.`, createdAt }];
                if (starts - now > 24 * 3600000)
                    next.push({ id: createId(), studentId: lesson.studentId, lessonId: id, kind: 'lesson_24h', sendAt: new Date(starts - 24 * 3600000).toISOString(), status: 'Запланировано', deliveryMode: 'Авто', title: 'Урок завтра', message: `${lesson.student.split(' ')[0]}, завтра в ${time} у нас английский ✨`, createdAt });
                if (starts - now > 2 * 3600000)
                    next.push({ id: createId(), studentId: lesson.studentId, lessonId: id, kind: 'lesson_2h', sendAt: new Date(starts - 2 * 3600000).toISOString(), status: 'Запланировано', deliveryMode: 'Авто', title: 'Урок через 2 часа', message: `${lesson.student.split(' ')[0]}, урок начнётся через 2 часа. Ссылка доступна в личном кабинете.`, createdAt });
                return [...next, ...cancelled];
            });
        },
        cancelLesson: (id, notify = true) => {
            const lesson = lessons.find(l => l.id === id);
            if (!lesson)
                return;
            setLessons(items => items.map(l => l.id === id ? { ...l, status: 'Отменён' } : l));
            setNotifications(items => {
                const cancelled = items.map(item => item.lessonId === id && item.status === 'Запланировано' ? { ...item, status: 'Отменено' } : item);
                if (!notify || !lesson.studentId)
                    return cancelled;
                const createdAt = new Date().toISOString();
                return [{ id: createId(), studentId: lesson.studentId, lessonId: id, kind: 'lesson_cancelled', sendAt: createdAt, status: 'Запланировано', deliveryMode: 'Авто', title: 'Урок отменён', message: `${lesson.student}, урок ${lesson.date} в ${lesson.time} отменён. Я свяжусь с вами, чтобы выбрать новое время.`, createdAt }, ...cancelled];
            });
        },
        addTask: (title) => setTasks(items => [{ id: createId(), title, due: 'Сегодня', done: false, category: 'Другое' }, ...items]),
        toggleTask: (id) => setTasks(items => items.map(task => task.id === id ? { ...task, done: !task.done } : task)),
        deleteTask: (id) => setTasks(items => items.filter(task => task.id !== id)),
        addPayment: (value) => setPayments(items => [{ ...value, id: createId() }, ...items]),
        updatePayment: (value) => setPayments(items => items.map(item => item.id === value.id ? value : item)),
        markPaymentPaid: (id) => setPayments(items => items.map(item => item.id === id ? { ...item, status: 'Оплачено', paidAt: localDate() } : item)),
        addHomework: (value) => setHomeworks(items => [{ ...value, id: createId() }, ...items]),
        updateHomework: (value) => setHomeworks(items => items.map(item => item.id === value.id ? value : item)),
        addContentItem: (value) => setContentItems(items => [{ ...value, id: createId() }, ...items]),
        updateContentItem: (value) => setContentItems(items => items.map(item => item.id === value.id ? value : item)),
        deleteContentItem: (id) => setContentItems(items => items.filter(item => item.id !== id)),
        addTouchpoint: (value) => setTouchpoints(items => [{ ...value, id: createId() }, ...items]),
        updateTouchpoint: (value) => setTouchpoints(items => items.map(item => item.id === value.id ? value : item)),
        deleteTouchpoint: (id) => setTouchpoints(items => items.filter(item => item.id !== id)),
        addMaterial: (value) => setMaterials(items => [{ ...value, id: createId() }, ...items]),
        deleteMaterial: (id) => setMaterials(items => items.filter(item => item.id !== id)),
        queueNotification,
        cancelNotification: (id) => setNotifications(items => items.map(item => item.id === id ? { ...item, status: 'Отменено' } : item)),
        approveNotification: (id) => setNotifications(items => items.map(item => item.id === id ? { ...item, deliveryMode: 'Авто', sendAt: new Date().toISOString(), status: 'Запланировано' } : item)),
        markNotificationSent: (id) => setNotifications(items => items.map(item => item.id === id ? { ...item, status: 'Отправлено', sentAt: new Date().toISOString() } : item)),
        requestReschedule: (value) => {
            setRescheduleRequests(items => [{ ...value, id: createId(), status: 'Новая', createdAt: new Date().toISOString() }, ...items]);
            const student = students.find(s => s.id === value.studentId);
            const lesson = lessons.find(l => l.id === value.lessonId);
            setTasks(items => [{ id: createId(), title: `Запрос переноса: ${student?.name || 'ученик'} — ${lesson?.date || ''}`, due: 'Сегодня', done: false, category: 'Урок' }, ...items]);
        },
        updateRescheduleRequest: (value) => setRescheduleRequests(items => items.map(item => item.id === value.id ? value : item)),
        exportData: () => JSON.stringify({ version: 6, exportedAt: new Date().toISOString(), students, leads, lessons, tasks, materials, touchpoints, contentItems, payments, homeworks, notifications, rescheduleRequests, dark }, null, 2),
        importData: (raw) => { const data = JSON.parse(raw); if (Array.isArray(data.students))
            setStudents(data.students); if (Array.isArray(data.leads))
            setLeads(data.leads); if (Array.isArray(data.lessons))
            setLessons(data.lessons); if (Array.isArray(data.tasks))
            setTasks(data.tasks); if (Array.isArray(data.materials))
            setMaterials(data.materials); if (Array.isArray(data.touchpoints))
            setTouchpoints(data.touchpoints); if (Array.isArray(data.contentItems))
            setContentItems(data.contentItems); if (Array.isArray(data.payments))
            setPayments(data.payments); if (Array.isArray(data.homeworks))
            setHomeworks(data.homeworks); if (Array.isArray(data.notifications))
            setNotifications(data.notifications); if (Array.isArray(data.rescheduleRequests))
            setRescheduleRequests(data.rescheduleRequests); if (typeof data.dark === 'boolean')
            setDark(data.dark); },
        reset: () => { Object.keys(localStorage).filter(key => key.startsWith('ira.')).forEach(key => localStorage.removeItem(key)); location.reload(); }
    };
}
