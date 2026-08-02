type MonsterProps={small?:boolean;mood?:'happy'|'thinking'|'sleepy'|'alert'}

export function RasmusMark({active=false}:{active?:boolean}){
  const fill=active?'#E8A33D':'#928C9C'
  return <svg viewBox="0 0 100 100" aria-hidden="true" className="rasmus-mark">
    <path d="M28 45 13 17l31 21Z" fill={fill}/>
    <path d="m72 45 15-28-31 21Z" fill={fill}/>
    <ellipse cx="50" cy="54" rx="31" ry="28" fill={fill}/>
    <ellipse cx="40" cy="54" rx="8" ry="10" fill={active?'#C7D97A':'#17151C'}/>
    <ellipse cx="60" cy="54" rx="8" ry="10" fill={active?'#C7D97A':'#17151C'}/>
    <circle cx="40" cy="57" r="3.6" fill="#141319"/>
    <circle cx="60" cy="57" r="3.6" fill="#141319"/>
  </svg>
}

export default function Monster({small=false,mood='happy'}:MonsterProps){
  const uid=small?'rasmus-small':'rasmus-large'
  return <div className={`rasmus ${small?'small':''} mood-${mood}`} aria-label="Расмус, умный помощник" role="img">
    <svg viewBox="0 0 210 225" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#87808D"/><stop offset="1" stopColor="#5C5663"/></linearGradient>
        <filter id={`${uid}-shadow`} x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="15" stdDeviation="12" floodColor="#000" floodOpacity=".32"/></filter>
      </defs>
      <ellipse className="rasmus-shadow" cx="103" cy="207" rx="67" ry="10" fill="#000" opacity=".2"/>
      <g filter={`url(#${uid}-shadow)`}>
        <path className="rasmus-tail" d="M151 160c46 9 52-33 27-49-15-10-32-3-31 13" fill="none" stroke="#726C79" strokeWidth="13" strokeLinecap="round"/>
        <path d="M164 116c-10-4-17 1-17 9" fill="none" stroke="#211E27" strokeWidth="13" strokeLinecap="round"/>
        <ellipse className="rasmus-body" cx="103" cy="165" rx="62" ry="47" fill={`url(#${uid}-body)`}/>
        <ellipse cx="83" cy="158" rx="18" ry="23" fill="#E9D9C8" opacity=".35"/>
        <ellipse cx="69" cy="207" rx="16" ry="11" fill="#211E27"/>
        <ellipse cx="137" cy="207" rx="16" ry="11" fill="#211E27"/>
        <path className="rasmus-ear ear-left" d="M51 75 21 10l58 50Z" fill="#211E27"/>
        <path className="rasmus-ear ear-right" d="m154 75 30-65-58 50Z" fill="#211E27"/>
        <path d="m40 52-12-28 27 24Z" fill="#C1552E" opacity=".42"/>
        <path d="m166 52 12-28-27 24Z" fill="#C1552E" opacity=".42"/>
        <ellipse cx="103" cy="97" rx="56" ry="49" fill="#211E27"/>
        <ellipse className="rasmus-eye eye-left" cx="79" cy="98" rx="16" ry="19" fill="#C7D97A"/>
        <ellipse className="rasmus-eye eye-right" cx="127" cy="98" rx="16" ry="19" fill="#C7D97A"/>
        <ellipse className="rasmus-pupil pupil-left" cx="79" cy="102" rx="6.6" ry="9" fill="#141319"/>
        <ellipse className="rasmus-pupil pupil-right" cx="127" cy="102" rx="6.6" ry="9" fill="#141319"/>
        <circle cx="76" cy="96" r="2.2" fill="#F4EFE3"/><circle cx="124" cy="96" r="2.2" fill="#F4EFE3"/>
        <path d="m98 122 10 0-5 7Z" fill="#726C79"/>
        <path className="mouth-happy" d="M103 129c0 7-8 10-13 8m13-8c0 7 8 10 13 8" fill="none" stroke="#726C79" strokeWidth="2.4" strokeLinecap="round"/>
        <path className="mouth-thinking" d="M94 136c7-4 14-4 21 0" fill="none" stroke="#726C79" strokeWidth="2.4" strokeLinecap="round"/>
        <path className="mouth-sleepy" d="M95 134h17" fill="none" stroke="#726C79" strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M55 113 26 108m30 13-31 2m126-10 29-5m-30 13 31 2" stroke="#726C79" strokeWidth="1.8" opacity=".8" strokeLinecap="round"/>
        <g className="rasmus-radar" fill="none" stroke="#E8A33D" strokeWidth="1.7" strokeDasharray="3 6" opacity=".55">
          <circle cx="36" cy="19" r="12"/><circle cx="36" cy="19" r="21"/><circle cx="170" cy="19" r="12"/><circle cx="170" cy="19" r="21"/>
        </g>
        <g className="rasmus-badge" transform="translate(130 35) rotate(7)"><rect width="46" height="35" rx="9" fill="#F4EFE3"/><path d="M10 11h27M10 18h21M10 25h16" stroke="#E8A33D" strokeWidth="2" strokeLinecap="round"/><circle cx="38" cy="7" r="5" fill="#C1552E"/></g>
      </g>
    </svg>
  </div>
}
