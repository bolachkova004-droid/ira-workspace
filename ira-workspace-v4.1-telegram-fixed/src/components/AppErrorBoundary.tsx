import {Component,type ErrorInfo,type ReactNode} from 'react'

type Props={children:ReactNode}
type State={error:string|null}

export default class AppErrorBoundary extends Component<Props,State>{
  state:State={error:null}

  static getDerivedStateFromError(error:unknown):State{
    return {error:error instanceof Error?error.message:'Неизвестная ошибка запуска'}
  }

  componentDidCatch(error:unknown,info:ErrorInfo){
    console.error('[Ira Workspace] Render error',error,info)
  }

  render(){
    if(this.state.error){
      return <main className="fatal-screen">
        <div className="fatal-card">
          <div className="fatal-logo">IW</div>
          <p className="eyebrow">Ira Workspace</p>
          <h1>Не удалось открыть приложение</h1>
          <p>Обнови страницу. Если экран появится снова, открой приложение по ссылке из браузера и проверь публикацию GitHub Pages.</p>
          <button className="primary" onClick={()=>location.reload()}>Обновить</button>
          <details><summary>Техническая информация</summary><code>{this.state.error}</code></details>
        </div>
      </main>
    }
    return this.props.children
  }
}
