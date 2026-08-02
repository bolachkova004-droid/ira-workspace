(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const app = document.getElementById('app');
  const VERSION = '6.0.2';
  const STORAGE = 'ira.v602.workspace';

  const pad = n => String(n).padStart(2, '0');
  const localDate = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const shiftDate = days => { const d = new Date(); d.setDate(d.getDate() + days); return localDate(d); };
  const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const money = n => `${Number(n || 0).toLocaleString('ru-RU')} ₽`;
  const fmtDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', {day:'numeric', month:'long'}) : '—';
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const initials = name => String(name || 'У').split(/\s+/).map(x => x[0]).filter(Boolean).slice(0,2).join('').toUpperCase();

  const seed = () => ({
    version: VERSION,
    reminderModes: { payment: 'review', homework: 'auto', lesson: 'auto', lead: 'review' },
    students: [
      {id:'s1',name:'Анна Смирнова',level:'B1',goal:'Уверенно говорить на работе',telegram:'@anna_s',rate:1800,balance:3600,status:'Активный',interests:'Кино, работа, путешествия',strengths:'Хорошо понимает речь на слух',challenges:'Путает времена в спонтанной речи',note:'Любит практичные темы и короткие домашние задания.',packageTotal:12,packageUsed:8,accessToken:'anna-demo-access',nextPaymentDate:shiftDate(5)},
      {id:'s2',name:'Мария Иванова',level:'B2',goal:'Свободнее обсуждать сложные темы',telegram:'@maria_i',rate:2000,balance:2000,status:'Активный',interests:'Книги, статьи, психология',strengths:'Большой словарный запас',challenges:'Хочет звучать естественнее',note:'Лучше всего вовлекается через статьи и подкасты.',packageTotal:8,packageUsed:5,accessToken:'maria-demo-access',nextPaymentDate:shiftDate(8)},
      {id:'s3',name:'Иван Петров',level:'A2',goal:'Систематизировать грамматику',telegram:'@ivan_p',rate:1700,balance:-1700,status:'Активный',interests:'Технологии, спорт',strengths:'Регулярно занимается',challenges:'Боится ошибаться',note:'Нужны понятные схемы и повторение.',packageTotal:10,packageUsed:9,accessToken:'ivan-demo-access',nextPaymentDate:shiftDate(-1)}
    ],
    lessons: [
      {id:'e1',studentId:'s1',student:'Анна Смирнова',date:localDate(),time:'10:00',duration:60,topic:'Speaking: work routines',status:'Запланирован',paid:true,meetingLink:'https://meet.google.com/'},
      {id:'e2',studentId:'s2',student:'Мария Иванова',date:localDate(),time:'12:00',duration:60,topic:'Article discussion',status:'Запланирован',paid:true,meetingLink:'https://zoom.us/'},
      {id:'e3',student:'Пробное занятие',date:localDate(),time:'18:00',duration:45,topic:'Диагностика',status:'Запланирован',paid:false,meetingLink:''},
      {id:'e4',studentId:'s3',student:'Иван Петров',date:shiftDate(1),time:'18:00',duration:60,topic:'Past Simple vs Present Perfect',status:'Запланирован',paid:false,meetingLink:'https://meet.google.com/'},
      {id:'e5',studentId:'s1',student:'Анна Смирнова',date:shiftDate(-4),time:'10:00',duration:60,topic:'Meetings and small talk',status:'Проведён',paid:true,meetingLink:''}
    ],
    tasks: [
      {id:'t1',title:'Проверить домашнее Анны',done:false,category:'Домашнее'},
      {id:'t2',title:'Ответить Екатерине',done:false,category:'Заявка'},
      {id:'t3',title:'Напомнить Ивану об оплате',done:false,category:'Оплата'}
    ],
    payments: [
      {id:'p1',studentId:'s1',amount:7200,dueDate:shiftDate(5),status:'Ожидается',comment:'Следующая часть пакета'},
      {id:'p2',studentId:'s2',amount:8000,dueDate:shiftDate(8),status:'Ожидается',comment:'Пакет из 4 занятий'},
      {id:'p3',studentId:'s3',amount:1700,dueDate:shiftDate(-1),status:'Просрочено',comment:'Оплата за урок'}
    ],
    homeworks: [
      {id:'h1',studentId:'s1',title:'Вопросы для small talk',description:'Подготовить 5 вопросов коллеге и записать голосовое.',dueDate:shiftDate(2),status:'Назначено'},
      {id:'h2',studentId:'s2',title:'Статья о привычках',description:'Прочитать статью и выбрать 7 выражений.',dueDate:shiftDate(1),status:'Назначено'},
      {id:'h3',studentId:'s3',title:'10 фраз для small talk',description:'Повторить и записать голосовое.',dueDate:shiftDate(-1),status:'Просрочено'}
    ],
    notifications: [
      {id:'n1',studentId:'s3',kind:'payment',status:'На проверку',title:'Иван · оплата',message:'Иван, у тебя осталось 1 занятие в пакете — можно оплатить следующий, чтобы не терять слот 🙂',createdAt:new Date().toISOString()},
      {id:'n2',studentId:'s1',kind:'lesson',status:'Запланировано',title:'Анна · урок',message:'Анна, сегодня в 10:00 у нас английский. Ссылка на занятие будет в личном кабинете.',createdAt:new Date().toISOString()}
    ],
    leads: [
      {id:'l1',name:'Екатерина',source:'Threads',contact:'@katya',status:'Новая',goal:'Английский для путешествий'},
      {id:'l2',name:'Ольга',source:'Telegram',contact:'@olga',status:'Пробный урок',goal:'Перейти с A2 на B1'},
      {id:'l3',name:'Алексей',source:'Instagram',contact:'@alex',status:'Связались',goal:'Английский для работы'}
    ],
    content: [
      {id:'c1',title:'Почему взрослые знают правила, но не говорят',platform:'Threads',stage:'В работе'},
      {id:'c2',title:'Разбор летней лексики из сериала',platform:'Telegram',stage:'Идея'},
      {id:'c3',title:'Как проходят мои занятия',platform:'Instagram',stage:'Готово'},
      {id:'c4',title:'Книжный клуб как игра',platform:'Threads',stage:'Опубликовано'}
    ]
  });

  function migrateLegacy() {
    const data = seed();
    const read = key => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } };
    const map = [
      ['students',['ira.v6.students','ira.v5.students','ira.v4.students']],
      ['lessons',['ira.v6.lessons','ira.v5.lessons','ira.v4.lessons']],
      ['tasks',['ira.v6.tasks','ira.v5.tasks','ira.v4.tasks']],
      ['payments',['ira.v6.payments','ira.v5.payments']],
      ['homeworks',['ira.v6.homeworks','ira.v5.homeworks']],
      ['notifications',['ira.v6.notifications','ira.v5.notifications']],
      ['leads',['ira.v6.leads','ira.v5.leads','ira.v4.leads']]
    ];
    map.forEach(([field, keys]) => {
      for (const key of keys) { const value = read(key); if (Array.isArray(value)) { data[field] = value; break; } }
    });
    return data;
  }

  function load() {
    try { const raw = localStorage.getItem(STORAGE); if (raw) return {...seed(), ...JSON.parse(raw)}; } catch {}
    return migrateLegacy();
  }

  let state = load();
  let selectedDate = localDate();
  let calendarMonth = new Date();

  const save = () => { try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch {} };
  const setState = updater => { state = typeof updater === 'function' ? updater(state) : updater; save(); render(); };
  const route = () => (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  const go = path => { location.hash = `#/${path}`; };

  function cat(size='normal') {
    return `<svg class="rasmus-cat ${size}" viewBox="0 0 200 220" aria-label="Расмус">
      <path d="M150 150 Q195 160 185 120 Q178 96 155 100" stroke="#726C79" stroke-width="11" fill="none" stroke-linecap="round"/>
      <ellipse cx="100" cy="160" rx="58" ry="46" fill="#726C79"/><ellipse cx="66" cy="200" rx="14" ry="10" fill="#211E27"/><ellipse cx="134" cy="200" rx="14" ry="10" fill="#211E27"/>
      <path d="M48 70 L20 8 L74 56 Z" fill="#211E27"/><path d="M152 70 L180 8 L126 56 Z" fill="#211E27"/><ellipse cx="100" cy="92" rx="52" ry="46" fill="#211E27"/>
      <ellipse cx="78" cy="94" rx="15" ry="17" fill="#C7D97A"/><ellipse cx="122" cy="94" rx="15" ry="17" fill="#C7D97A"/><circle cx="78" cy="97" r="6.5" fill="#141319"/><circle cx="122" cy="97" r="6.5" fill="#141319"/><circle cx="75" cy="93" r="1.8" fill="#F4EFE3"/><circle cx="119" cy="93" r="1.8" fill="#F4EFE3"/>
      <path d="M96 116 L104 116 L100 122 Z" fill="#726C79"/><path d="M100 122 Q100 128 92 130 M100 122 Q100 128 108 130" stroke="#726C79" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`;
  }

  const icon = name => {
    const paths = {
      home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
      users:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/>',
      calendar:'<rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
      content:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
      bell:'<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/>',
      back:'<path d="M15 5l-7 7 7 7"/>',
      plus:'<path d="M12 5v14M5 12h14"/>',
      more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'
    };
    return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
  };

  function shell(content, active='home', options={}) {
    const nav = options.student ? '' : `<nav class="bottom-nav">
      ${navItem('home','Главная','home',active)}${navItem('students','Ученики','users',active)}${navItem('calendar','Календарь','calendar',active)}${navItem('content','Контент','content',active)}${navItem('reminders','Расмус','cat',active)}
    </nav>`;
    return `<main class="app-shell ${options.student ? 'student-shell' : ''}">${content}${nav}</main>`;
  }

  function navItem(path,label,ico,active) {
    return `<a href="#/${path}" class="nav-item ${active===path?'active':''}">${ico==='cat'?cat('navcat'):icon(ico)}<span>${label}</span></a>`;
  }

  function topbar(title, opts={}) {
    return `<header class="topbar">${opts.back ? `<button class="icon-button" data-back>${icon('back')}</button>` : `<div class="brand-mini">${cat('tiny')}<b>${esc(title)}</b></div>`}<strong class="top-title ${opts.back?'':'hidden-title'}">${esc(title)}</strong>${opts.action || '<span class="top-spacer"></span>'}</header>`;
  }

  function homeView() {
    const today = state.lessons.filter(l => l.date === localDate() && l.status !== 'Отменён').sort((a,b)=>a.time.localeCompare(b.time));
    const activeStudents = state.students.filter(s => s.status === 'Активный');
    const debt = state.payments.filter(p => p.status === 'Просрочено').reduce((a,p)=>a+Number(p.amount||0),0);
    const pending = state.notifications.filter(n => n.status === 'На проверку');
    const primary = state.students.find(s => Number(s.balance) < 0) || activeStudents.find(s => Number(s.packageTotal)-Number(s.packageUsed)<=1);
    return shell(`
      ${topbar('Панель',{action:`<a class="icon-button bell-button" href="#/reminders">${icon('bell')}<i>${pending.length}</i></a>`})}
      <section class="page-content">
        <section class="hero-card">
          <p class="eyebrow">Расмус докладывает</p>
          <div class="hero-row">${cat()}<div class="speech">${primary ? `<b>${esc(primary.name.split(' ')[0])} ${Number(primary.balance)<0?'ждёт напоминание об оплате.':'на последнем занятии пакета.'}</b> ${Number(primary.balance)<0?`Сумма — ${money(Math.abs(primary.balance))}.`:'Лучше предложить продлить пакет заранее.'}` : '<b>Сегодня всё спокойно.</b> Можно сосредоточиться на уроках и контенте.'}</div></div>
          <div class="chips"><a href="#/reminders" class="chip danger"><i></i>${money(debt)} к оплате</a><a href="#/more" class="chip green"><i></i>${state.leads.filter(x=>x.status!=='Отказ').length} заявки</a><span class="chip"><i></i>${activeStudents.length} активных</span></div>
        </section>
        ${sectionTitle('Сегодня','Коротко')}
        <div class="stats-grid"><article><i></i><span>Уроки сегодня</span><strong>${today.length}</strong></article><article><i></i><span>Активные ученики</span><strong>${activeStudents.length}</strong></article><article><i></i><span>Заявки в работе</span><strong>${state.leads.length}</strong></article><article class="money"><i></i><span>К оплате</span><strong>${money(debt)}</strong></article></div>
        ${sectionTitle('Расписание','Сегодня',`<a href="#/calendar">Все уроки →</a>`)}
        <div class="paper-list schedule-list">${today.length ? today.map((l,i)=>`<a class="schedule-row" href="#/calendar"><time>${esc(l.time)}</time><span class="track"><i></i><b class="${i===today.length-1?'last':''}"></b></span><span class="grow"><strong>${esc(l.student)}</strong><small>${esc(l.topic)}</small></span><em>${esc(state.students.find(s=>s.id===l.studentId)?.level||'Пробный')}</em></a>`).join('') : '<div class="empty-paper">Сегодня уроков нет.</div>'}</div>
        ${sectionTitle('Фокус','На сегодня',`<button class="mini-action" data-add-task>${icon('plus')}</button>`)}
        <div class="task-list">${state.tasks.filter(t=>!t.done).slice(0,5).map(t=>`<button data-task="${t.id}"><span class="check"></span><span><strong>${esc(t.title)}</strong><small>${esc(t.category)} · Сегодня</small></span></button>`).join('') || '<p class="empty-dark">Список чист. Расмус одобряет.</p>'}</div>
      </section>`, 'home');
  }

  function sectionTitle(eyebrow,title,action='') { return `<div class="section-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2></div>${action}</div>`; }

  function studentsView() {
    return shell(`${topbar('Ученики',{action:`<button class="icon-button" data-add-student>${icon('plus')}</button>`})}<section class="page-content">${sectionTitle('База','Ученики')}<label class="search-box">⌕<input id="student-search" placeholder="Поиск по имени или уровню"></label><div class="student-list">${state.students.map(studentCard).join('')}</div></section>`, 'students');
  }

  function studentCard(s) {
    const left = Math.max(0, Number(s.packageTotal)-Number(s.packageUsed));
    return `<a class="student-card" href="#/student-profile/${encodeURIComponent(s.id)}"><span class="avatar">${initials(s.name)}</span><span class="grow"><span class="row"><strong>${esc(s.name)}</strong><em>${esc(s.level)}</em></span><small>${esc(s.goal)}</small><span class="progress"><i style="width:${Math.min(100,Number(s.packageUsed)/Math.max(1,Number(s.packageTotal))*100)}%"></i></span><small>${left} занятий осталось · ${money(s.balance)}</small></span></a>`;
  }

  function studentProfileView(id) {
    const s = state.students.find(x=>x.id===id);
    if (!s) return notFound();
    const lessons = state.lessons.filter(l=>l.studentId===id).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
    const hw = state.homeworks.filter(h=>h.studentId===id);
    const payment = state.payments.find(p=>p.studentId===id && p.status!=='Оплачено');
    const progress = Math.round(Number(s.packageUsed)/Math.max(1,Number(s.packageTotal))*100);
    return shell(`${topbar('Ученик',{back:true,action:`<button class="icon-button" data-edit-student="${s.id}">${icon('more')}</button>`})}<section class="page-content">
      <div class="profile-head"><span class="avatar large">${initials(s.name)}</span><div><h1>${esc(s.name)}</h1><p>${esc(s.level)} · ${state.lessons.filter(l=>l.studentId===id&&l.status==='Проведён').length} занятий</p></div></div>
      <div class="goal-card"><span>🎯</span><div><b>Цель</b>${esc(s.goal)}</div></div><div class="tag-row"><span class="tag active">${esc(s.status)}</span><span class="tag">Уровень ${esc(s.level)}</span></div>
      ${sectionTitle('Прогресс и цели',`${esc(s.level)} · ${progress}%`)}<div class="progress large"><i style="width:${progress}%"></i></div><div class="mistakes"><span>${esc(s.challenges||'Добавить фокус')}</span><span>${esc(s.strengths||'Добавить сильные стороны')}</span></div>
      ${sectionTitle('Дисциплина и деньги','Сейчас')}<div class="two-stats"><article><span>Занятий в пакете</span><strong>${s.packageUsed}/${s.packageTotal}</strong></article><article class="danger"><span>К оплате</span><strong>${money(payment?.amount || Math.abs(Math.min(0,s.balance)))}</strong></article></div>
      <div class="paper-list homework-list">${hw.map(h=>`<div><span class="grow"><strong>${esc(h.title)}</strong><small>к ${fmtDate(h.dueDate)}</small></span><em class="badge ${h.status==='Просрочено'?'late':''}">${esc(h.status)}</em></div>`).join('') || '<div class="empty-paper">Домашних заданий пока нет.</div>'}</div>
      <div class="rasmus-note">${cat('tiny')}<p><b>Расмус:</b> ${progress>80?'пакет почти закончился — пора обсудить продолжение.':'динамика хорошая. Сохраняй регулярность и возвращайся к сложным темам.'}</p></div>
      ${sectionTitle('Личное','Портрет ученика')}<div class="personal-card"><p><b>Интересы</b>${esc(s.interests||'Не заполнено')}</p><p><b>Заметка</b>${esc(s.note||'Нет заметки')}</p></div>
      <div class="action-grid"><button class="primary" data-queue-payment="${s.id}">Напомнить об оплате</button><button class="secondary" data-copy-access="${s.id}">Ссылка ученика</button></div>
      ${sectionTitle('История','Последние уроки')}<div class="paper-list">${lessons.slice(0,5).map(l=>`<div class="simple-row"><span><strong>${esc(l.topic)}</strong><small>${fmtDate(l.date)} · ${esc(l.time)}</small></span><em>${esc(l.status)}</em></div>`).join('') || '<div class="empty-paper">Уроков пока нет.</div>'}</div>
    </section>`, 'students');
  }

  function calendarView() {
    const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
    const first = new Date(y,m,1); const mondayOffset=(first.getDay()+6)%7; const start=new Date(y,m,1-mondayOffset);
    const cells=[]; for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);cells.push(d)}
    const selectedLessons = state.lessons.filter(l=>l.date===selectedDate).sort((a,b)=>a.time.localeCompare(b.time));
    const monthTitle = calendarMonth.toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
    return shell(`${topbar('Календарь',{action:`<button class="icon-button" data-add-lesson>${icon('plus')}</button>`})}<section class="page-content">
      <div class="sync-card"><i></i><span><b>Календарь Ira Workspace</b>Уроки и переносы сохраняются на устройстве</span><em>ON</em></div>
      <div class="month-head"><h1>${esc(monthTitle[0].toUpperCase()+monthTitle.slice(1))}</h1><div><button data-month="-1">‹</button><button data-month="1">›</button></div></div>
      <div class="weekdays">${['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map(x=>`<span>${x}</span>`).join('')}</div>
      <div class="calendar-grid">${cells.map(d=>{const key=localDate(d), count=state.lessons.filter(l=>l.date===key&&l.status!=='Отменён').length;return `<button data-date="${key}" class="${d.getMonth()!==m?'out ':''}${key===localDate()?'today ':''}${key===selectedDate?'selected':''}"><span>${d.getDate()}</span>${count?`<i>${count}</i>`:''}</button>`}).join('')}</div>
      <div class="legend"><span><i></i>Уроки</span><span><i class="green"></i>Оплачено</span></div>
      <div class="paper-list calendar-day"><header><strong>${fmtDate(selectedDate)}</strong><span>${selectedLessons.length} урока</span></header>${selectedLessons.map(l=>`<button class="lesson-row" data-lesson="${l.id}"><time>${esc(l.time)}</time><span class="grow"><strong>${esc(l.student)}</strong><small>${esc(l.topic)}</small></span><em class="badge ${l.paid?'paid':''}">${l.paid?'Оплачено':esc(l.status)}</em></button>`).join('') || '<div class="empty-paper">На этот день уроков нет.</div>'}</div>
      <div class="rasmus-note">${cat('tiny')}<p><b>Расмус:</b> нажми на урок, чтобы перенести, отменить или отметить оплату.</p></div>
    </section>`, 'calendar');
  }

  function remindersView() {
    const modes = state.reminderModes;
    const pending = state.notifications.filter(n=>n.status==='На проверку');
    const sent = state.notifications.filter(n=>n.status==='Отправлено').length;
    const type = (key,emoji,name,sub) => `<article class="reminder-type"><div><span>${emoji}</span><p><strong>${name}</strong><small>${sub}</small></p></div><div class="segments" data-mode="${key}">${[['auto','Авто'],['review','На проверку'],['off','Выкл']].map(([v,l])=>`<button data-mode-value="${v}" class="${modes[key]===v?'active '+v:''}">${l}</button>`).join('')}</div></article>`;
    return shell(`${topbar('Напоминания',{action:`<button class="icon-button" data-add-reminder>${icon('plus')}</button>`})}<section class="page-content">
      <div class="rasmus-intro">${cat('small')}<p><b>Расмус:</b> рутину беру на себя. Сообщения об оплате сначала показываю тебе — ничего личного не уйдёт без проверки.</p></div>
      ${sectionTitle('Типы напоминаний','Настрой под себя')}
      <div class="reminder-types">${type('payment','💸','Оплата','когда заканчивается пакет')}${type('homework','📝','Домашка','за день до занятия')}${type('lesson','⏰','Скоро урок','за 24 часа и за 2 часа')}${type('lead','👋','Заявка молчит','нет ответа 2 дня')}</div>
      ${sectionTitle('Ждут тебя',`На проверку · ${pending.length}`)}
      <div class="review-list">${pending.map(n=>`<article><header><span class="avatar small">${initials(state.students.find(s=>s.id===n.studentId)?.name||'У')}</span><strong>${esc(n.title)}</strong><time>${new Date(n.createdAt||Date.now()).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</time></header><p>${esc(n.message)}</p><div><button class="primary" data-send-notification="${n.id}">Отправить</button><button class="secondary" data-edit-notification="${n.id}">Изменить</button><button class="square" data-delete-notification="${n.id}">×</button></div></article>`).join('') || '<div class="empty-dark">Очередь пуста.</div>'}</div>
      <div class="foot-stats"><article><strong>${sent}</strong><span>отправлено</span></article><article><strong>${pending.length}</strong><span>ждут проверки</span></article><article><strong>~40м</strong><span>экономия времени</span></article></div>
    </section>`, 'reminders');
  }

  function contentView() {
    const stages=['Идея','В работе','Готово','Опубликовано'];
    return shell(`${topbar('Контент',{action:`<button class="icon-button" data-add-content>${icon('plus')}</button>`})}<section class="page-content">${sectionTitle('Creator OS','Контент')}<div class="content-summary"><article><strong>${state.content.length}</strong><span>материалов</span></article><article><strong>${state.content.filter(x=>x.stage==='В работе').length}</strong><span>в работе</span></article><article><strong>${state.content.filter(x=>x.stage==='Готово').length}</strong><span>готовы</span></article></div><div class="kanban">${stages.map(stage=>`<section><header><strong>${stage}</strong><b>${state.content.filter(x=>x.stage===stage).length}</b></header>${state.content.filter(x=>x.stage===stage).map(c=>`<button data-content="${c.id}"><em>${esc(c.platform)}</em><strong>${esc(c.title)}</strong><span>Нажми, чтобы передвинуть →</span></button>`).join('')||'<p>Пусто</p>'}</section>`).join('')}</div></section>`, 'content');
  }

  function analyticsView() {
    const completed=state.lessons.filter(l=>l.status==='Проведён').length;
    const revenue=state.lessons.filter(l=>l.status==='Проведён'&&l.paid).reduce((sum,l)=>sum+(state.students.find(s=>s.id===l.studentId)?.rate||0),0);
    return shell(`${topbar('Аналитика',{back:true})}<section class="page-content"><div class="periods"><button>7 дней</button><button class="active">30 дней</button><button>90 дней</button></div>${sectionTitle('Общая картина','За 30 дней')}<div class="stats-grid analytics"><article><i></i><span>Активные ученики</span><strong>${state.students.filter(s=>s.status==='Активный').length}</strong></article><article><i></i><span>Проведено уроков</span><strong>${completed}</strong></article><article><i></i><span>Доход</span><strong>${money(revenue)}</strong></article><article class="money"><i></i><span>Долги</span><strong>${money(state.payments.filter(p=>p.status==='Просрочено').reduce((a,p)=>a+p.amount,0))}</strong></article></div>${sectionTitle('Источники','Заявки')}<div class="paper-list">${['Threads','Telegram','Instagram'].map(src=>`<div class="simple-row"><span><strong>${src}</strong><small>источник заявок</small></span><em>${state.leads.filter(l=>l.source===src).length}</em></div>`).join('')}</div><div class="rasmus-note">${cat('tiny')}<p><b>Расмус:</b> следи не только за количеством заявок, но и за тем, какие из них доходят до пробного урока.</p></div></section>`, 'content');
  }

  function moreView() {
    return shell(`${topbar('Ещё',{back:true})}<section class="page-content">${sectionTitle('Управление','Дополнительно')}<div class="menu-list"><a href="#/analytics">📊 <span><strong>Аналитика</strong><small>Ученики, уроки и деньги</small></span>›</a><button data-export>💾 <span><strong>Экспорт данных</strong><small>Скачать резервную копию</small></span>›</button><label>📥 <span><strong>Импорт данных</strong><small>Восстановить резервную копию</small></span>›<input id="import-file" type="file" accept="application/json" hidden></label><button data-reset>↻ <span><strong>Сбросить демо-данные</strong><small>Вернуть начальное состояние</small></span>›</button></div>${sectionTitle('Заявки','В работе')}<div class="paper-list">${state.leads.map(l=>`<div class="simple-row"><span><strong>${esc(l.name)}</strong><small>${esc(l.source)} · ${esc(l.goal)}</small></span><em>${esc(l.status)}</em></div>`).join('')}</div><p class="version">Ira Workspace ${VERSION} · автономная сборка</p></section>`, 'content');
  }

  function studentPortalView(token) {
    const s = state.students.find(x=>x.accessToken===token);
    if (!s) return shell(`<section class="student-page"><div class="student-brand">${cat('small')}<h1>Доступ не найден</h1><p>Попросите преподавателя прислать новую персональную ссылку.</p></div></section>`,'home',{student:true});
    const lessons=state.lessons.filter(l=>l.studentId===s.id&&l.status!=='Отменён').sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    const hw=state.homeworks.filter(h=>h.studentId===s.id);
    const pay=state.payments.find(p=>p.studentId===s.id&&p.status!=='Оплачено');
    return shell(`<section class="student-page"><div class="student-brand">${cat('small')}<p>Ira Workspace</p><h1>Привет, ${esc(s.name.split(' ')[0])}!</h1><span>Здесь расписание, домашнее и оплата.</span></div><article class="student-next"><p>Ближайший урок</p>${lessons[0]?`<h2>${fmtDate(lessons[0].date)} · ${esc(lessons[0].time)}</h2><span>${esc(lessons[0].topic)}</span>${lessons[0].meetingLink?`<a href="${esc(lessons[0].meetingLink)}" target="_blank">Открыть ссылку на урок</a>`:''}`:'<h2>Пока не запланирован</h2>'}</article><div class="student-grid"><article><span>Осталось занятий</span><strong>${Math.max(0,s.packageTotal-s.packageUsed)}</strong></article><article><span>К оплате</span><strong>${pay?money(pay.amount):'Всё оплачено'}</strong></article></div>${sectionTitle('Расписание','Мои уроки')}<div class="paper-list">${lessons.slice(0,6).map(l=>`<div class="simple-row"><span><strong>${fmtDate(l.date)} · ${esc(l.time)}</strong><small>${esc(l.topic)}</small></span><em>${esc(l.status)}</em></div>`).join('')||'<div class="empty-paper">Уроков пока нет.</div>'}</div>${sectionTitle('Домашнее','Задания')}<div class="paper-list">${hw.map(h=>`<div class="simple-row"><span><strong>${esc(h.title)}</strong><small>${esc(h.description)}</small></span><em>${esc(h.status)}</em></div>`).join('')||'<div class="empty-paper">Домашнего задания нет.</div>'}</div><button class="primary wide" data-student-reschedule="${s.id}">Попросить перенос урока</button></section>`,'home',{student:true});
  }

  function notFound(){return shell(`${topbar('Не найдено',{back:true})}<section class="page-content"><div class="empty-dark">Страница не найдена.</div></section>`,'home')}

  function render() {
    const [page, id] = route();
    let html;
    if(page==='home') html=homeView();
    else if(page==='students') html=studentsView();
    else if(page==='student-profile') html=studentProfileView(decodeURIComponent(id||''));
    else if(page==='calendar') html=calendarView();
    else if(page==='reminders') html=remindersView();
    else if(page==='content') html=contentView();
    else if(page==='analytics') html=analyticsView();
    else if(page==='more') html=moreView();
    else if(page==='student') html=studentPortalView(decodeURIComponent(id||''));
    else html=notFound();
    app.innerHTML=html;
    bind();
    window.scrollTo(0,0);
  }

  function modal(title, body) {
    const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<div class="modal"><header><h2>${esc(title)}</h2><button data-close>×</button></header>${body}</div>`;document.body.appendChild(wrap);$('[data-close]',wrap).onclick=()=>wrap.remove();wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove()});return wrap;
  }

  function bind() {
    $$('[data-back]').forEach(b=>b.onclick=()=>history.back());
    $('[data-add-task]')?.addEventListener('click',()=>{const title=prompt('Новая задача');if(title?.trim())setState(s=>({...s,tasks:[{id:uid('task'),title:title.trim(),done:false,category:'Другое'},...s.tasks]}))});
    $$('[data-task]').forEach(b=>b.onclick=()=>setState(s=>({...s,tasks:s.tasks.map(t=>t.id===b.dataset.task?{...t,done:true}:t)})));

    const search=$('#student-search'); if(search) search.oninput=()=>{$$('.student-card').forEach(card=>card.hidden=!card.textContent.toLowerCase().includes(search.value.toLowerCase()))};
    $('[data-add-student]')?.addEventListener('click',openAddStudent);
    $$('[data-edit-student]').forEach(b=>b.onclick=()=>openEditStudent(b.dataset.editStudent));
    $$('[data-queue-payment]').forEach(b=>b.onclick=()=>queuePayment(b.dataset.queuePayment));
    $$('[data-copy-access]').forEach(b=>b.onclick=()=>copyAccess(b.dataset.copyAccess));

    $$('[data-month]').forEach(b=>b.onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+Number(b.dataset.month),1);render()});
    $$('[data-date]').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.date;render()});
    $('[data-add-lesson]')?.addEventListener('click',openAddLesson);
    $$('[data-lesson]').forEach(b=>b.onclick=()=>openLesson(b.dataset.lesson));

    $$('[data-mode]').forEach(group=>$$('[data-mode-value]',group).forEach(btn=>btn.onclick=()=>setState(s=>({...s,reminderModes:{...s.reminderModes,[group.dataset.mode]:btn.dataset.modeValue}}))));
    $('[data-add-reminder]')?.addEventListener('click',openAddReminder);
    $$('[data-send-notification]').forEach(b=>b.onclick=()=>setState(s=>({...s,notifications:s.notifications.map(n=>n.id===b.dataset.sendNotification?{...n,status:'Отправлено',sentAt:new Date().toISOString()}:n)})));
    $$('[data-delete-notification]').forEach(b=>b.onclick=()=>setState(s=>({...s,notifications:s.notifications.filter(n=>n.id!==b.dataset.deleteNotification)})));
    $$('[data-edit-notification]').forEach(b=>b.onclick=()=>{const n=state.notifications.find(x=>x.id===b.dataset.editNotification);const text=prompt('Текст сообщения',n?.message||'');if(text!==null)setState(s=>({...s,notifications:s.notifications.map(x=>x.id===n.id?{...x,message:text}:x)}))});

    $('[data-add-content]')?.addEventListener('click',()=>{const title=prompt('Название материала');if(title?.trim())setState(s=>({...s,content:[{id:uid('content'),title:title.trim(),platform:'Threads',stage:'Идея'},...s.content]}))});
    $$('[data-content]').forEach(b=>b.onclick=()=>{const stages=['Идея','В работе','Готово','Опубликовано'];setState(s=>({...s,content:s.content.map(c=>c.id===b.dataset.content?{...c,stage:stages[(stages.indexOf(c.stage)+1)%stages.length]}:c)}))});

    $('[data-export]')?.addEventListener('click',exportData);
    $('[data-reset]')?.addEventListener('click',()=>{if(confirm('Сбросить локальные данные и вернуть демо-версию?')){state=seed();save();render()}});
    $('#import-file')?.addEventListener('change',importData);
    $$('[data-student-reschedule]').forEach(b=>b.onclick=()=>{alert('Запрос на перенос сохранён. Преподаватель увидит его в задачах.');setState(s=>({...s,tasks:[{id:uid('task'),title:`Запрос переноса: ${state.students.find(x=>x.id===b.dataset.studentReschedule)?.name||'ученик'}`,done:false,category:'Урок'},...s.tasks]}))});
  }

  function openAddStudent(){
    const m=modal('Новый ученик',`<form id="student-form"><label>Имя<input name="name" required></label><div class="form-row"><label>Уровень<input name="level" value="A2" required></label><label>Стоимость<input name="rate" type="number" value="1800" required></label></div><label>Цель<input name="goal" required></label><label>Telegram<input name="telegram" placeholder="@username"></label><button class="primary wide">Сохранить</button></form>`);
    $('#student-form',m).onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);setState(s=>({...s,students:[{id:uid('student'),name:f.get('name'),level:f.get('level'),goal:f.get('goal'),telegram:f.get('telegram'),rate:Number(f.get('rate')),balance:0,status:'Активный',interests:'',strengths:'',challenges:'',note:'',packageTotal:8,packageUsed:0,accessToken:uid('access')},...s.students]}));m.remove()};
  }

  function openEditStudent(id){
    const s=state.students.find(x=>x.id===id);if(!s)return;
    const m=modal('Редактировать ученика',`<form id="student-edit"><label>Имя<input name="name" value="${esc(s.name)}" required></label><div class="form-row"><label>Уровень<input name="level" value="${esc(s.level)}"></label><label>Баланс<input name="balance" type="number" value="${Number(s.balance||0)}"></label></div><label>Цель<input name="goal" value="${esc(s.goal)}"></label><label>Заметка<textarea name="note">${esc(s.note||'')}</textarea></label><button class="primary wide">Сохранить</button></form>`);
    $('#student-edit',m).onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);setState(x=>({...x,students:x.students.map(v=>v.id===id?{...v,name:f.get('name'),level:f.get('level'),balance:Number(f.get('balance')),goal:f.get('goal'),note:f.get('note')}:v)}));m.remove()};
  }

  function queuePayment(id){
    const s=state.students.find(x=>x.id===id);if(!s)return;const amount=Math.abs(Number(s.balance||s.rate||0));
    setState(x=>({...x,notifications:[{id:uid('notification'),studentId:id,kind:'payment',status:'На проверку',title:`${s.name.split(' ')[0]} · оплата`,message:`${s.name.split(' ')[0]}, напоминаю об оплате — ${money(amount)}. Если уже оплатили, просто пришлите чек ✨`,createdAt:new Date().toISOString()},...x.notifications]}));go('reminders');
  }

  async function copyAccess(id){
    const s=state.students.find(x=>x.id===id);if(!s)return;const url=`${location.origin}${location.pathname}#/student/${s.accessToken}`;
    try{await navigator.clipboard.writeText(url);alert('Ссылка ученика скопирована')}catch{prompt('Скопируй ссылку',url)}
  }

  function openAddLesson(){
    const options=state.students.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
    const m=modal('Новый урок',`<form id="lesson-form"><label>Ученик<select name="studentId"><option value="">Пробное занятие</option>${options}</select></label><div class="form-row"><label>Дата<input name="date" type="date" value="${selectedDate}"></label><label>Время<input name="time" type="time" value="10:00"></label></div><label>Тема<input name="topic" required></label><button class="primary wide">Запланировать</button></form>`);
    $('#lesson-form',m).onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget), student=state.students.find(s=>s.id===f.get('studentId'));setState(s=>({...s,lessons:[...s.lessons,{id:uid('lesson'),studentId:student?.id,student:student?.name||'Пробное занятие',date:f.get('date'),time:f.get('time'),duration:60,topic:f.get('topic'),status:'Запланирован',paid:false,meetingLink:''}]}));m.remove()};
  }

  function openLesson(id){
    const l=state.lessons.find(x=>x.id===id);if(!l)return;
    const m=modal(l.student,`<div class="lesson-modal"><p><b>${fmtDate(l.date)} · ${esc(l.time)}</b></p><p>${esc(l.topic)}</p><div class="action-grid"><button class="primary" data-reschedule>Перенести</button><button class="secondary" data-paid>${l.paid?'Снять оплату':'Отметить оплату'}</button><button class="danger-button" data-cancel>Отменить</button></div></div>`);
    $('[data-reschedule]',m).onclick=()=>{const date=prompt('Новая дата ГГГГ-ММ-ДД',l.date);if(!date)return;const time=prompt('Новое время ЧЧ:ММ',l.time);if(!time)return;setState(s=>({...s,lessons:s.lessons.map(x=>x.id===id?{...x,date,time,status:'Перенесён'}:x),notifications:l.studentId?[{id:uid('notification'),studentId:l.studentId,kind:'lesson',status:'На проверку',title:`${l.student.split(' ')[0]} · перенос`,message:`${l.student.split(' ')[0]}, урок перенесён на ${fmtDate(date)} в ${time}.`,createdAt:new Date().toISOString()},...s.notifications]:s.notifications}));m.remove()};
    $('[data-paid]',m).onclick=()=>{setState(s=>({...s,lessons:s.lessons.map(x=>x.id===id?{...x,paid:!x.paid}:x)}));m.remove()};
    $('[data-cancel]',m).onclick=()=>{if(confirm('Отменить урок?'))setState(s=>({...s,lessons:s.lessons.map(x=>x.id===id?{...x,status:'Отменён'}:x)}));m.remove()};
  }

  function openAddReminder(){
    const options=state.students.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
    const m=modal('Новое сообщение',`<form id="reminder-form"><label>Ученик<select name="studentId">${options}</select></label><label>Сообщение<textarea name="message" required></textarea></label><button class="primary wide">Добавить на проверку</button></form>`);
    $('#reminder-form',m).onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget),s=state.students.find(x=>x.id===f.get('studentId'));setState(x=>({...x,notifications:[{id:uid('notification'),studentId:s.id,kind:'custom',status:'На проверку',title:`${s.name.split(' ')[0]} · сообщение`,message:f.get('message'),createdAt:new Date().toISOString()},...x.notifications]}));m.remove()};
  }

  function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ira-workspace-backup.json';a.click();URL.revokeObjectURL(a.href)}
  function importData(e){const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{state={...seed(),...JSON.parse(reader.result)};save();render();alert('Данные импортированы')}catch{alert('Не удалось прочитать файл')}};reader.readAsText(file)}

  function initTelegramOptional(){
    try {
      const script=document.createElement('script');script.src='https://telegram.org/js/telegram-web-app.js';script.async=true;script.onload=()=>{try{const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();tg?.setHeaderColor?.('#17151c');tg?.setBackgroundColor?.('#17151c')}catch{}};script.onerror=()=>{};document.head.appendChild(script);
    } catch {}
  }

  window.addEventListener('hashchange',render);
  window.addEventListener('error',e=>console.warn('[Ira Workspace]',e.message));
  render();
  setTimeout(initTelegramOptional,700);
})();
