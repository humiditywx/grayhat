import { useId } from 'react'

const PALETTES = {
  blue: ['#BCEAFF', '#39B8FF', '#146FE8', '#083A98'],
  aqua: ['#C2FFF8', '#38E3D0', '#10A8D8', '#07628E'],
  green: ['#D7FFB7', '#60DF62', '#17A85A', '#08703E'],
  lime: ['#F1FFC4', '#9AE647', '#4FB331', '#207A25'],
  red: ['#FFD0D7', '#FF6E75', '#D92746', '#8B1230'],
  amber: ['#FFF2B7', '#FFC844', '#F0831E', '#9B4614'],
  violet: ['#EBD7FF', '#A77BFF', '#6B42D8', '#371F91'],
  pink: ['#FFD7F3', '#F579CA', '#D73791', '#8B1A61'],
  slate: ['#E6F3FF', '#8FAED1', '#486B97', '#203B61'],
}

const TONES = {
  add: 'green',
  attach: 'violet',
  back: 'blue',
  camera: 'aqua',
  chat: 'blue',
  check: 'green',
  close: 'red',
  copy: 'aqua',
  deleted: 'slate',
  display: 'blue',
  edit: 'amber',
  eye: 'violet',
  file: 'slate',
  globe: 'aqua',
  groupAdd: 'green',
  hangup: 'red',
  info: 'blue',
  lock: 'violet',
  mic: 'pink',
  micMuted: 'red',
  moon: 'violet',
  people: 'green',
  phone: 'green',
  play: 'green',
  pause: 'amber',
  qr: 'aqua',
  reply: 'blue',
  search: 'aqua',
  send: 'blue',
  settings: 'slate',
  share: 'aqua',
  shield: 'green',
  speaker: 'blue',
  speakerOff: 'slate',
  story: 'pink',
  sun: 'amber',
  trash: 'red',
  upload: 'blue',
  video: 'violet',
}

function glyph(name, paint) {
  const { stroke, fill, line, solid } = paint

  switch (name) {
    case 'add':
      return (
        <>
          <circle cx="12" cy="12" r="5.6" {...line} />
          <path d="M12 8.8v6.4M8.8 12h6.4" {...line} />
        </>
      )
    case 'attach':
      return <path d="M8.1 12.2l4.9-4.9a3.2 3.2 0 014.6 4.6l-6.5 6.5a4.8 4.8 0 01-6.8-6.8l7.1-7.1" {...line} />
    case 'back':
      return <path d="M14.8 6.4L9.2 12l5.6 5.6" {...line} />
    case 'camera':
      return (
        <>
          <path d="M6.4 8.5h2l1.2-1.8h4.8l1.2 1.8h2A2.4 2.4 0 0120 10.9v5.3a2.4 2.4 0 01-2.4 2.4H6.4A2.4 2.4 0 014 16.2v-5.3a2.4 2.4 0 012.4-2.4z" {...solid} />
          <circle cx="12" cy="13.4" r="3.2" fill="rgba(255,255,255,.28)" stroke={stroke} strokeWidth="1.8" />
          <circle cx="12" cy="13.4" r="1.35" fill="rgba(8,45,90,.30)" />
        </>
      )
    case 'chat':
      return <path d="M5.3 7.3A4.2 4.2 0 019.5 3.8h5A4.2 4.2 0 0118.7 8v2.8a4.2 4.2 0 01-4.2 4.2H10l-4.4 3v-7.2a4 4 0 01-.3-3.5z" {...solid} />
    case 'check':
      return <path d="M6.2 12.3l3.6 3.6 8-8.1" {...line} />
    case 'close':
      return <path d="M7.4 7.4l9.2 9.2M16.6 7.4l-9.2 9.2" {...line} />
    case 'copy':
      return (
        <>
          <rect x="8.2" y="8.2" width="9.8" height="9.8" rx="2" {...line} />
          <path d="M6 14.5H5.2A1.8 1.8 0 013.4 12.7V5.2a1.8 1.8 0 011.8-1.8h7.5a1.8 1.8 0 011.8 1.8V6" {...line} />
        </>
      )
    case 'deleted':
      return (
        <>
          <circle cx="12" cy="12" r="7.2" {...line} />
          <path d="M7.3 7.3l9.4 9.4" {...line} />
        </>
      )
    case 'display':
      return (
        <>
          <rect x="4" y="5.2" width="16" height="10.8" rx="2.2" {...solid} />
          <path d="M9 19h6M12 16v3" {...line} />
        </>
      )
    case 'edit':
      return (
        <>
          <path d="M5 15.7V19h3.3L17.7 9.6l-3.3-3.3L5 15.7z" {...solid} />
          <path d="M15.4 5.3l1-1a1.7 1.7 0 012.4 2.4l-1 1" {...line} />
        </>
      )
    case 'eye':
      return (
        <>
          <path d="M3.7 12s3.1-5.7 8.3-5.7 8.3 5.7 8.3 5.7-3.1 5.7-8.3 5.7S3.7 12 3.7 12z" {...line} />
          <circle cx="12" cy="12" r="2.4" {...solid} />
        </>
      )
    case 'file':
      return (
        <>
          <path d="M7.2 3.8h6.2l4.4 4.4v10a2 2 0 01-2 2H7.2a2 2 0 01-2-2V5.8a2 2 0 012-2z" {...solid} />
          <path d="M13.4 3.9v4.4h4.4" {...line} />
        </>
      )
    case 'globe':
      return (
        <>
          <circle cx="12" cy="12" r="7.7" {...line} />
          <path d="M4.5 12h15M12 4.3c2 2.1 3 4.7 3 7.7s-1 5.6-3 7.7c-2-2.1-3-4.7-3-7.7s1-5.6 3-7.7z" {...line} />
        </>
      )
    case 'groupAdd':
      return (
        <>
          <circle cx="9" cy="8.2" r="3" {...solid} />
          <path d="M3.8 18.2c.7-2.8 2.5-4.2 5.2-4.2 1.7 0 3 .5 4 1.6" {...line} />
          <path d="M17.2 9.2v5.4M14.5 11.9h5.4" {...line} />
        </>
      )
    case 'hangup':
      return <path d="M5.2 13.7c4.2-3.4 9.4-3.4 13.6 0l-1.7 3.1a1.6 1.6 0 01-1.9.8l-2.2-.7a1.5 1.5 0 00-1 0l-2.2.7a1.6 1.6 0 01-1.9-.8l-1.7-3.1z" {...solid} />
    case 'info':
      return (
        <>
          <circle cx="12" cy="12" r="7.7" {...solid} />
          <path d="M12 10.8v5.4M12 7.6h.01" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
        </>
      )
    case 'lock':
      return (
        <>
          <rect x="5.4" y="10.2" width="13.2" height="9" rx="2.2" {...solid} />
          <path d="M8.4 10.2V7.7a3.6 3.6 0 017.2 0v2.5" {...line} />
          <circle cx="12" cy="14.7" r="1.1" fill={fill} />
        </>
      )
    case 'mic':
      return (
        <>
          <rect x="9" y="3.2" width="6" height="10.2" rx="3" {...solid} />
          <path d="M18 10.8a6 6 0 01-12 0M12 16.8v3M9.2 19.8h5.6" {...line} />
        </>
      )
    case 'micMuted':
      return (
        <>
          <path d="M4.4 4.4l15.2 15.2" {...line} />
          <path d="M9 8.7v2.1a3 3 0 004.8 2.4M15 10.1V6.2a3 3 0 00-5.3-1.9M18 11.1a6 6 0 01-1.1 3.5M6 10.8a6 6 0 006 6M12 16.8v3M9.2 19.8h5.6" {...line} />
        </>
      )
    case 'moon':
      return <path d="M16.8 15.7a7 7 0 01-8.5-8.5 7.6 7.6 0 108.5 8.5z" {...solid} />
    case 'people':
      return (
        <>
          <circle cx="8.5" cy="8.4" r="2.8" {...solid} />
          <circle cx="15.7" cy="9.4" r="2.3" {...solid} />
          <path d="M3.8 18.3c.7-2.8 2.3-4.2 4.8-4.2 2.4 0 4 1.4 4.8 4.2M13.7 14.7c2.7.2 4.2 1.4 4.5 3.6" {...line} />
        </>
      )
    case 'phone':
      return <path d="M6.5 4.4h2.4l1.2 3.7-1.5 1.5a11.8 11.8 0 005.8 5.8l1.5-1.5 3.7 1.2v2.4a2 2 0 01-2.1 2A13 13 0 014.5 6.5a2 2 0 012-2.1z" {...solid} />
    case 'play':
      return <path d="M9 6.2v11.6l9-5.8-9-5.8z" {...solid} />
    case 'pause':
      return (
        <>
          <rect x="7.5" y="6" width="3.2" height="12" rx="1.1" {...solid} />
          <rect x="13.3" y="6" width="3.2" height="12" rx="1.1" {...solid} />
        </>
      )
    case 'qr':
      return (
        <>
          <rect x="4.3" y="4.3" width="5.4" height="5.4" rx=".8" {...line} />
          <rect x="14.3" y="4.3" width="5.4" height="5.4" rx=".8" {...line} />
          <rect x="4.3" y="14.3" width="5.4" height="5.4" rx=".8" {...line} />
          <path d="M14.2 14.2h2.1v2.1h-2.1zM18 14.2h1.7V18H18M14.2 18h2.1v1.7h-2.1M17.5 19.7h2.2" {...line} />
        </>
      )
    case 'reply':
      return <path d="M9.1 7.4L4.5 12l4.6 4.6M5.1 12h7.3c3.7 0 5.8 1.6 7.1 4.4" {...line} />
    case 'search':
      return (
        <>
          <circle cx="10.6" cy="10.6" r="5.6" {...line} />
          <path d="M15 15l4.2 4.2" {...line} />
        </>
      )
    case 'send':
      return <path d="M4 5.2l16.6 6.8L4 18.8l2.1-5.4L14 12 6.1 10.6 4 5.2z" {...solid} />
    case 'settings':
      return (
        <>
          <path d="M12 8.6a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8z" {...line} />
          <path d="M19.1 13.7l1.3-1.1-1.4-2.5-1.7.6a7 7 0 00-1.4-.8L15.6 8h-3.2l-.3 1.9a7 7 0 00-1.4.8L9 10.1l-1.4 2.5 1.3 1.1a6.8 6.8 0 000 1.6l-1.3 1.1L9 18.9l1.7-.6c.4.3.9.6 1.4.8l.3 1.9h3.2l.3-1.9c.5-.2 1-.5 1.4-.8l1.7.6 1.4-2.5-1.3-1.1a6.8 6.8 0 000-1.6z" {...line} />
        </>
      )
    case 'share':
      return (
        <>
          <rect x="4.2" y="5" width="15.6" height="10.8" rx="2" {...solid} />
          <path d="M8.8 19h6.4M12 15.8V19" {...line} />
        </>
      )
    case 'shield':
      return <path d="M12 3.2l7 3.1v4.8c0 4.5-2.9 7.8-7 9.7-4.1-1.9-7-5.2-7-9.7V6.3l7-3.1z" {...solid} />
    case 'speaker':
      return (
        <>
          <path d="M4 10h3.4l4.4-3.6v11.2L7.4 14H4v-4z" {...solid} />
          <path d="M16.2 8.6a5.2 5.2 0 010 6.8M18.8 6a8.8 8.8 0 010 12" {...line} />
        </>
      )
    case 'speakerOff':
      return (
        <>
          <path d="M4 10h3.4l4.4-3.6v11.2L7.4 14H4v-4z" {...solid} />
          <path d="M17 9l4 6M21 9l-4 6" {...line} />
        </>
      )
    case 'story':
      return (
        <>
          <circle cx="12" cy="12" r="6.8" {...line} />
          <path d="M12 8.5v7M8.5 12h7" {...line} />
        </>
      )
    case 'sun':
      return (
        <>
          <circle cx="12" cy="12" r="3.5" {...solid} />
          <path d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M5.8 18.2l1.5-1.5M16.7 7.3l1.5-1.5" {...line} />
        </>
      )
    case 'trash':
      return (
        <>
          <path d="M7 8.2h10l-.8 11H7.8l-.8-11z" {...solid} />
          <path d="M5.5 7.2h13M9.4 7.2V5h5.2v2.2M10 10.8v5.2M14 10.8v5.2" {...line} />
        </>
      )
    case 'upload':
      return (
        <>
          <path d="M5 16.2v2a2 2 0 002 2h10a2 2 0 002-2v-2" {...line} />
          <path d="M12 15.2V4.2M7.7 8.5L12 4.2l4.3 4.3" {...line} />
        </>
      )
    case 'video':
      return (
        <>
          <rect x="4" y="7" width="11.8" height="10" rx="2" {...solid} />
          <path d="M15.8 10.3l4.2-2.5v8.4l-4.2-2.5v-3.4z" {...solid} />
        </>
      )
    default:
      return <path d="M12 4.5l2 5 5.3.4-4.1 3.4 1.3 5.2-4.5-2.8-4.5 2.8 1.3-5.2-4.1-3.4L10 9.5l2-5z" {...solid} />
  }
}

export default function AeroIcon({
  name,
  size = 20,
  tone,
  variant = 'tile',
  title,
  className = '',
  style,
  ...props
}) {
  const rawId = useId().replace(/:/g, '')
  const id = `aero-${name || 'icon'}-${rawId}`
  const palette = PALETTES[tone || TONES[name] || 'blue'] || PALETTES.blue
  const chrome = variant !== 'glyph'
  const stroke = chrome ? '#fff' : 'currentColor'
  const fill = chrome ? 'rgba(255,255,255,.94)' : 'currentColor'
  const line = {
    fill: 'none',
    stroke,
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  const solid = {
    fill,
    stroke: chrome ? 'rgba(255,255,255,.55)' : 'currentColor',
    strokeWidth: chrome ? 0.45 : 0,
    strokeLinejoin: 'round',
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`aero-icon ${className}`.trim()}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      style={{ display: 'block', flexShrink: 0, overflow: 'visible', ...style }}
      {...props}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`${id}-base`} x1="0" y1="2" x2="0" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={palette[0]} />
          <stop offset=".48" stopColor={palette[1]} />
          <stop offset="1" stopColor={palette[2]} />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx="8" cy="5" r="13" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset=".45" stopColor="#fff" stopOpacity=".18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="190%">
          <feDropShadow dx="0" dy="1.4" stdDeviation="1.15" floodColor={palette[3]} floodOpacity=".32" />
        </filter>
        <filter id={`${id}-glyph`} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy=".7" stdDeviation=".45" floodColor="#06345f" floodOpacity={chrome ? '.34' : '.22'} />
        </filter>
      </defs>

      {chrome && (
        <g filter={`url(#${id}-shadow)`}>
          <rect x="2.2" y="2" width="19.6" height="19.6" rx="6" fill={`url(#${id}-base)`} />
          <rect x="2.9" y="2.7" width="18.2" height="18.2" rx="5.3" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".65" />
          <path d="M5 4.3c2.6-1 11.4-1.2 14 0 .7 5.3-2.4 7.5-7 7.5S4.3 9.6 5 4.3z" fill={`url(#${id}-shine)`} />
          <path d="M4.4 18.2c3.8 1.4 11.4 1.4 15.2 0-.7 1.8-2.4 3-4.4 3H8.8c-2 0-3.7-1.2-4.4-3z" fill="rgba(0,0,0,.12)" />
        </g>
      )}

      <g filter={`url(#${id}-glyph)`}>
        {glyph(name, { stroke, fill, line, solid })}
      </g>
    </svg>
  )
}
