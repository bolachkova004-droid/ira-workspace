import type {ReactNode} from 'react'
export default function PageHeader({eyebrow='Ira Workspace',title,subtitle,action}:{eyebrow?:string;title:string;subtitle?:string;action?:ReactNode}){return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle&&<p className="muted">{subtitle}</p>}</div>{action}</header>}
