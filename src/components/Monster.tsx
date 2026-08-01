type MonsterProps={small?:boolean;mood?:'happy'|'thinking'|'sleepy'}

export default function Monster({small=false,mood='happy'}:MonsterProps){
  const uid=small?'ivi-pocket':'ivi-planner'
  return <div className={`mascot mascot-v5 ${small?'small':''} mood-${mood}`} aria-label="Иви, пушистый помощник" role="img">
    <svg viewBox="0 0 190 190" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-fur`} cx="38%" cy="28%" r="78%"><stop offset="0" stopColor="#fffdfd"/><stop offset=".28" stopColor="#ffdce9"/><stop offset=".68" stopColor="#f3a9ca"/><stop offset="1" stopColor="#d989b8"/></radialGradient>
        <linearGradient id={`${uid}-ear`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fbd4e5"/><stop offset="1" stopColor="#cfa7ed"/></linearGradient>
        <filter id={`${uid}-shadow`} x="-40%" y="-40%" width="180%" height="210%"><feDropShadow dx="0" dy="14" stdDeviation="11" floodColor="#8f607c" floodOpacity=".18"/></filter>
        <filter id={`${uid}-fluff`} x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation=".25"/></filter>
      </defs>
      <ellipse className="mascot-floor" cx="95" cy="166" rx="53" ry="9" fill="#765169" opacity=".12"/>
      <g filter={`url(#${uid}-shadow)`}>
        <path className="ivi-ear ear-left" d="M54 54C35 42 35 22 49 13c2 15 10 26 25 34Z" fill={`url(#${uid}-ear)`}/>
        <path className="ivi-ear ear-right" d="M136 54c19-12 19-32 5-41-2 15-10 26-25 34Z" fill={`url(#${uid}-ear)`}/>
        <g className="ivi-fluff" filter={`url(#${uid}-fluff)`}>
          <circle cx="48" cy="67" r="22" fill="#f5b3d2"/><circle cx="67" cy="48" r="25" fill="#f9c3da"/><circle cx="94" cy="42" r="28" fill="#ffe1ec"/><circle cx="122" cy="49" r="24" fill="#f7bdd9"/><circle cx="141" cy="70" r="22" fill="#eea5c9"/>
          <circle cx="43" cy="96" r="25" fill="#f2acd0"/><circle cx="146" cy="98" r="25" fill="#eaa0c5"/><circle cx="51" cy="126" r="26" fill="#efafd0"/><circle cx="137" cy="129" r="27" fill="#dc91bb"/><circle cx="76" cy="145" r="30" fill="#e8a0c6"/><circle cx="111" cy="146" r="31" fill="#dc8fb9"/>
          <ellipse cx="95" cy="98" rx="59" ry="68" fill={`url(#${uid}-fur)`}/>
        </g>
        <ellipse cx="72" cy="89" rx="19" ry="23" fill="#fff"/>
        <ellipse cx="118" cy="89" rx="19" ry="23" fill="#fff"/>
        <ellipse className="pupil pupil-left" cx="76" cy="92" rx="8" ry="11" fill="#3d3038"/>
        <ellipse className="pupil pupil-right" cx="114" cy="92" rx="8" ry="11" fill="#3d3038"/>
        <circle cx="79" cy="88" r="3" fill="#fff"/><circle cx="117" cy="88" r="3" fill="#fff"/>
        <ellipse cx="53" cy="116" rx="13" ry="6" fill="#f77fae" opacity=".22"/><ellipse cx="137" cy="116" rx="13" ry="6" fill="#f77fae" opacity=".22"/>
        <path className="mouth-happy" d="M80 118c8 10 22 10 30 0" fill="none" stroke="#78475f" strokeWidth="4" strokeLinecap="round"/>
        <path className="mouth-thinking" d="M84 122c7-4 15-4 22 0" fill="none" stroke="#78475f" strokeWidth="4" strokeLinecap="round"/>
        <path className="mouth-sleepy" d="M86 122h18" fill="none" stroke="#78475f" strokeWidth="4" strokeLinecap="round"/>
        <path className="paw-left" d="M48 124c-13 1-20 10-16 19 5 10 19 6 27-5" fill="#eda8ca"/>
        <path className="paw-right" d="M141 122c14 0 22 9 18 18-4 10-19 7-28-4" fill="#d98ab7"/>
        <g className="ivi-planner-badge"><rect x="119" y="35" width="42" height="34" rx="9" fill="#fffdf8" transform="rotate(8 119 35)"/><path d="m128 46 23 3M127 53l18 2M127 60l13 1" stroke="#e6a9c3" strokeWidth="2" strokeLinecap="round" transform="rotate(8 119 35)"/><circle cx="151" cy="42" r="5" fill="#f288b4"/></g>
      </g>
      <g className="ivi-sparkles" fill="#f5a0c4"><path d="m27 84 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/><path d="m162 104 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z"/></g>
    </svg>
  </div>
}
