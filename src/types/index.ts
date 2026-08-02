export type StudentStatus='Активный'|'Пауза'|'Завершил'
export type LeadStatus='Новая'|'Связались'|'Пробный урок'|'Оплата'|'Стала ученицей'|'Отказ'
export type LessonStatus='Запланирован'|'Проведён'|'Перенесён'|'Отменён'
export type Mood='Отличное'|'Спокойное'|'Усталость'|'Сложно'

export type Student={
  id:string
  name:string
  level:string
  goal:string
  phone:string
  telegram:string
  telegramId?:string
  rate:number
  balance:number
  status:StudentStatus
  timezone:string
  interests:string
  strengths:string
  challenges:string
  note:string
  packageTotal:number
  packageUsed:number
  accessToken?:string
  paymentDay?:number
  nextPaymentDate?:string
  notificationsEnabled?:boolean
}

export type Lead={id:string;name:string;source:string;contact:string;createdAt:string;status:LeadStatus;goal:string;note:string}

export type Lesson={
  id:string
  studentId?:string
  student:string
  date:string
  time:string
  duration:number
  topic:string
  status:LessonStatus
  paid:boolean
  homework:string
  plan:string
  notes:string
  errors:string
  mood:Mood
  meetingLink?:string
  previousDate?:string
  previousTime?:string
  reminder24h?:boolean
  reminder2h?:boolean
}

export type Task={id:string;title:string;due:string;done:boolean;category:'Урок'|'Домашнее'|'Заявка'|'Оплата'|'Другое'}
export type Material={id:string;studentId:string;title:string;kind:'Статья'|'Видео'|'Рабочий лист'|'Ссылка';url:string}

export type PaymentStatus='Ожидается'|'Оплачено'|'Просрочено'
export type Payment={id:string;studentId:string;amount:number;dueDate:string;paidAt?:string;status:PaymentStatus;comment:string}

export type HomeworkStatus='Назначено'|'Выполнено'|'Просрочено'
export type Homework={id:string;studentId:string;lessonId?:string;title:string;description:string;dueDate:string;status:HomeworkStatus;materialIds:string[]}

export type NotificationKind='lesson_24h'|'lesson_2h'|'lesson_15m'|'lesson_moved'|'lesson_cancelled'|'payment_3d'|'payment_due'|'payment_overdue'|'package_low'|'homework_new'|'homework_reminder'|'custom'
export type NotificationStatus='Запланировано'|'Отправлено'|'Ошибка'|'Отменено'
export type NotificationDeliveryMode='Авто'|'На проверку'
export type Notification={id:string;studentId:string;lessonId?:string;paymentId?:string;kind:NotificationKind;sendAt:string;status:NotificationStatus;deliveryMode?:NotificationDeliveryMode;title:string;message:string;createdAt:string;sentAt?:string;lastError?:string}

export type RescheduleRequestStatus='Новая'|'Принята'|'Отклонена'
export type RescheduleRequest={id:string;studentId:string;lessonId:string;requestedDate:string;requestedTime:string;comment:string;status:RescheduleRequestStatus;createdAt:string}

export type TouchpointKind='Игра'|'Соцсеть'|'Taplink'|'Материал'|'Продукт'|'Ссылка'
export type Touchpoint={id:string;title:string;kind:TouchpointKind;url:string;description:string;clicks:number;leads:number;active:boolean;pinned:boolean}

export type ContentStage='Идея'|'Черновик'|'Готов'|'Опубликован'
export type ContentPlatform='Threads'|'Telegram'|'Instagram'
export type ContentItem={id:string;title:string;platform:ContentPlatform;stage:ContentStage;deadline:string;tags:string[];note:string}
