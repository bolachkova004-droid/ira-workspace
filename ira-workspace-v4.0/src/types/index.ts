export type StudentStatus='Активный'|'Пауза'|'Завершил'
export type LeadStatus='Новая'|'Связались'|'Пробный урок'|'Оплата'|'Стала ученицей'|'Отказ'
export type LessonStatus='Запланирован'|'Проведён'|'Отменён'
export type Mood='Отличное'|'Спокойное'|'Усталость'|'Сложно'
export type Student={id:string;name:string;level:string;goal:string;phone:string;telegram:string;rate:number;balance:number;status:StudentStatus;timezone:string;interests:string;strengths:string;challenges:string;note:string;packageTotal:number;packageUsed:number}
export type Lead={id:string;name:string;source:string;contact:string;createdAt:string;status:LeadStatus;goal:string;note:string}
export type Lesson={id:string;studentId?:string;student:string;date:string;time:string;duration:number;topic:string;status:LessonStatus;paid:boolean;homework:string;plan:string;notes:string;errors:string;mood:Mood}
export type Task={id:string;title:string;due:string;done:boolean;category:'Урок'|'Домашнее'|'Заявка'|'Оплата'|'Другое'}
export type Material={id:string;studentId:string;title:string;kind:'Статья'|'Видео'|'Рабочий лист'|'Ссылка';url:string}

export type TouchpointKind='Игра'|'Соцсеть'|'Taplink'|'Материал'|'Продукт'|'Ссылка'
export type Touchpoint={id:string;title:string;kind:TouchpointKind;url:string;description:string;clicks:number;leads:number;active:boolean;pinned:boolean}

export type ContentStage='Идея'|'Черновик'|'Готов'|'Опубликован'
export type ContentPlatform='Threads'|'Telegram'|'Instagram'
export type ContentItem={id:string;title:string;platform:ContentPlatform;stage:ContentStage;deadline:string;tags:string[];note:string}
