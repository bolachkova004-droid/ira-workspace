type TelegramWebApp={ready:()=>void;expand:()=>void;setHeaderColor?:(color:string)=>void;setBackgroundColor?:(color:string)=>void;colorScheme?:'light'|'dark'}
declare global{interface Window{Telegram?:{WebApp?:TelegramWebApp}}}
export function initTelegram(){const app=window.Telegram?.WebApp;if(!app)return;app.ready();app.expand();app.setHeaderColor?.('#fff8fb');app.setBackgroundColor?.('#fff8fb');if(app.colorScheme==='dark')document.documentElement.dataset.theme='dark'}
