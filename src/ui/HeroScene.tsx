import type { DayPhase } from '../lib/format'

// The illustrated sky behind the Home greeting: a sunrise, a bright afternoon or a starry night.
// It's drawn on the right so the greeting on the left stays easy to read. On narrow screens the
// left of the drawing is cropped, never the right.

const STARS: [x: number, y: number, r: number][] = [
  [360, 28, 1.4], [412, 70, 1], [455, 22, 1.8], [500, 96, 1.1], [528, 40, 1.4], [575, 130, 1], [596, 18, 1.2],
  [640, 82, 1.6], [668, 150, 1.1], [700, 36, 1], [735, 110, 1.5], [770, 64, 1.1], [782, 170, 1], [690, 186, 1.3],
  [470, 160, 1], [545, 178, 1.2], [300, 120, 1], [250, 40, 1.1], [200, 160, 0.9], [150, 30, 1],
]

function Clouds({ y, opacity }: { y: number; opacity: number }) {
  return (
    <g className="scene-clouds" fill="#fff" opacity={opacity}>
      <g transform={`translate(470 ${y})`}>
        <ellipse cx="0" cy="0" rx="46" ry="16" />
        <ellipse cx="26" cy="-10" rx="30" ry="18" />
        <ellipse cx="-24" cy="-6" rx="24" ry="13" />
      </g>
      <g transform={`translate(700 ${y + 60})`}>
        <ellipse cx="0" cy="0" rx="38" ry="12" />
        <ellipse cx="18" cy="-9" rx="24" ry="14" />
      </g>
    </g>
  )
}

export function HeroScene({ phase }: { phase: DayPhase }) {
  return (
    <svg className="hero-scene" viewBox="0 0 800 200" preserveAspectRatio="xMaxYMid slice" aria-hidden>
      <defs>
        <radialGradient id="scene-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff7d1" />
          <stop offset="0.55" stopColor="#ffd166" />
          <stop offset="1" stopColor="#ff9f43" />
        </radialGradient>
        <radialGradient id="scene-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff3c4" stopOpacity="0.8" />
          <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="scene-moon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#c4b5fd" stopOpacity="0.55" />
          <stop offset="1" stopColor="#c4b5fd" stopOpacity="0" />
        </radialGradient>
        <mask id="scene-crescent">
          <rect width="800" height="200" fill="#fff" />
          <circle cx="672" cy="50" r="30" fill="#000" />
        </mask>
      </defs>

      {phase === 'morning' && (
        <>
          <circle className="scene-glow" cx="640" cy="160" r="120" fill="url(#scene-glow)" />
          <circle cx="640" cy="160" r="52" fill="url(#scene-sun)" />
          <Clouds y={70} opacity={0.55} />
          {/* Soft hills on the horizon */}
          <path d="M300 200 C 420 150, 520 168, 600 182 S 760 150, 800 160 L 800 200 Z" fill="#fff" opacity="0.22" />
          <path d="M420 200 C 520 172, 640 176, 720 190 S 790 182, 800 186 L 800 200 Z" fill="#fff" opacity="0.18" />
        </>
      )}

      {phase === 'afternoon' && (
        <>
          <circle className="scene-glow" cx="680" cy="56" r="90" fill="url(#scene-glow)" />
          <g className="scene-rays" style={{ transformOrigin: '680px 56px' }} stroke="#fff3c4" strokeWidth="4" strokeLinecap="round" opacity="0.7">
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i * Math.PI) / 6
              return <line key={i} x1={680 + Math.cos(a) * 44} y1={56 + Math.sin(a) * 44} x2={680 + Math.cos(a) * 58} y2={56 + Math.sin(a) * 58} />
            })}
          </g>
          <circle cx="680" cy="56" r="32" fill="url(#scene-sun)" />
          <Clouds y={120} opacity={0.75} />
        </>
      )}

      {phase === 'evening' && (
        <>
          {STARS.map(([x, y, r], i) => (
            <circle key={i} className="scene-star" cx={x} cy={y} r={r} fill="#fff" style={{ animationDelay: `${(i * 0.37) % 3}s` }} />
          ))}
          <line className="scene-shooting" x1="560" y1="30" x2="610" y2="12" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="655" cy="62" r="80" fill="url(#scene-moon-glow)" />
          <circle cx="655" cy="62" r="34" fill="#fef3c7" mask="url(#scene-crescent)" />
          {/* Distant hills */}
          <path d="M340 200 C 460 168, 560 176, 640 188 S 770 168, 800 174 L 800 200 Z" fill="#000" opacity="0.18" />
        </>
      )}
    </svg>
  )
}
