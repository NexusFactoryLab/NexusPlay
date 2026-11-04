import { useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BarChart3, Brain, Check, Crown, GraduationCap, Radio, Users } from 'lucide-react'
import { AvatarCircle } from '../avatar/AvatarCircle'
import { LogoMark, LogoWordmark } from '../BrandLogo'
import { startPageWarp } from '../PageWarp'
import { CountUp } from './CountUp'
import { CHALLENGES, formatPoints, type Competitor, type LandingRanking } from './landingData'
import { LiveMatchDemo } from './LiveMatchDemo'
import { usePointerVars, useReducedMotion, useSeenOnce } from './useLandingMotion'
import { useLandingRanking } from './useLandingRanking'
import './landing.css'
import './landing-hero.css'

/** Fondo de las fotos redondas sobre el cielo nocturno (el mismo de Fantasía/Oscuro en avatar.css). */
const AVATAR_BG = { background: 'radial-gradient(circle at 50% 30%, #4b3c86 0%, #2b2259 70%, #1d1742 100%)' }

/** Índice de la entrada escalonada del hero (ver `.lp-rise` en landing-hero.css). */
const rise = (index: number) => ({ '--i': index }) as CSSProperties

/** Con datos reales dice cuál es la ventana; con datos de ejemplo lo avisa. */
const liveBadge = (isSample: boolean, live: string) => (isSample ? 'Vista previa' : live)

function Face({ person, size = 36 }: { person: Competitor; size?: number }) {
  return (
    <AvatarCircle
      config={person.avatar}
      name={person.name}
      className="text-[13px]"
      style={{ ...AVATAR_BG, width: size, height: size }}
    />
  )
}

/**
 * Enlace a login/registro con transición (ver `PageWarp`). Con clic modificado
 * (nueva pestaña) o sin animaciones se comporta como un enlace normal.
 */
function GoLink({ to, className, children }: { to: string; className: string; children: ReactNode }) {
  const navigate = useNavigate()
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    if (!startPageWarp(to, { x: event.clientX, y: event.clientY })) navigate(to)
  }
  return (
    <Link to={to} className={className} onClick={onClick}>
      {children}
    </Link>
  )
}

/** Lleva a una sección con scroll suave dentro de la landing, sin tocar el historial del navegador. */
function SectionLink({ id, children, className = 'lp-nav-link' }: { id: string; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      {children}
    </button>
  )
}

function Header() {
  return (
    <nav className="lp-nav" aria-label="Principal">
      <div className="lp-wrap">
        <Link to="/" className="lp-brand" aria-label="NexusPlay, inicio">
          <LogoMark className="lp-logo-mark" />
          <LogoWordmark className="lp-logo-word" />
        </Link>
        <div className="lp-nav-links">
          <SectionLink id="como">Cómo funciona</SectionLink>
          <SectionLink id="ranking">Ranking</SectionLink>
          <SectionLink id="retos">Retos</SectionLink>
          <SectionLink id="universidades">Instituciones</SectionLink>
        </div>
        <div className="lp-nav-actions">
          <GoLink to="/login" className="lp-btn lp-btn-ghost lp-btn-sm">
            Iniciar sesión
          </GoLink>
          <GoLink to="/register" className="lp-btn lp-btn-main lp-btn-sm">
            Crear cuenta
          </GoLink>
        </div>
      </div>
    </nav>
  )
}

/**
 * Cielo del hero: auroras y dos capas de estrellas a distinta profundidad. Cada capa
 * se desplaza según `--px/--py` (cursor sobre el hero) multiplicado por su `--d`:
 * las lejanas se mueven poco y las cercanas más, y eso da la sensación de volumen.
 */
function HeroSky() {
  return (
    <div className="lp-sky" aria-hidden="true">
      <div className="lp-layer" style={{ '--d': 10 } as CSSProperties}>
        <span className="lp-aurora lp-aurora-1" />
        <span className="lp-aurora lp-aurora-2" />
      </div>
      <div className="lp-layer lp-stars lp-stars-far" style={{ '--d': 6 } as CSSProperties} />
      <div className="lp-layer lp-stars lp-stars-near" style={{ '--d': 18 } as CSSProperties} />
      <div className="lp-layer" style={{ '--d': 26 } as CSSProperties}>
        <span className="lp-aurora lp-aurora-3" />
      </div>
      <div className="lp-horizon" />
    </div>
  )
}

function Hero() {
  const heroRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  usePointerVars(heroRef, 'p', !reduced)

  return (
    <header ref={heroRef} className="lp-hero">
      <HeroSky />
      <div className="lp-wrap">
        <div className="lp-hero-copy">
          <p className="lp-pill lp-rise" style={rise(0)}>
            <span className="lp-live-dot" aria-hidden="true" />
            Partidas en vivo, creadas con IA desde tus apuntes
          </p>
          <h1 className="lp-title">
            <span className="lp-rise" style={rise(1)}>
              Domina cualquier tema.
            </span>
            <em className="lp-rise" style={rise(2)}>
              Demuéstralo <span className="lp-underline">en vivo.</span>
            </em>
          </h1>
          <p className="lp-sub lp-rise" style={rise(3)}>
            Sube tus apuntes, la IA los convierte en una partida y tu clase compite en tiempo real. Cada respuesta
            cuenta.
          </p>
          <div className="lp-cta lp-rise" style={rise(4)}>
            <GoLink to="/register" className="lp-btn lp-btn-main">
              Crear cuenta gratis <ArrowRight size={16} aria-hidden="true" />
            </GoLink>
            <SectionLink id="como" className="lp-btn lp-btn-ghost">
              Ver cómo funciona
            </SectionLink>
          </div>
          <p className="lp-trust lp-rise" style={rise(5)}>
            Colegios <span aria-hidden="true">·</span> Universidades <span aria-hidden="true">·</span> Cualquier aula
          </p>
        </div>

        <div className="lp-hero-demo lp-rise" style={rise(3)}>
          <LiveMatchDemo />
          <p className="lp-demo-caption">
            Demostración con jugadores ficticios: así se ve una partida en el aula.
          </p>
        </div>
      </div>
    </header>
  )
}

const STEPS = [
  {
    icon: Brain,
    title: 'Sube tus apuntes',
    text: 'La IA arma la partida a partir de tu material; la revisas y ajustas antes de publicarla. También puedes usar las que ya creó la comunidad.',
  },
  {
    icon: Radio,
    title: 'Lanza la partida en vivo',
    text: 'Comparte un código de sala y la clase entra desde cualquier dispositivo. O arma un torneo con eliminatorias y podio.',
  },
  {
    icon: BarChart3,
    title: 'Mide lo que se domina',
    text: 'Cada respuesta suma puntos. El docente ve los resultados por clase y cada estudiante, su lugar en el ranking.',
  },
]

function HowItWorks() {
  return (
    <section id="como" className="lp-section">
      <div className="lp-wrap">
        <p className="lp-eyebrow">Cómo funciona</p>
        <h2>De tu apunte a una partida, en tres pasos</h2>
        <p className="lp-lead">
          Sin instalar nada: todo corre en el navegador, en el aula o a distancia.
        </p>
        <div className="lp-steps">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <div key={title} className="lp-step">
              <div className="lp-step-tile">
                <Icon size={28} aria-hidden="true" />
              </div>
              <h3>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {title}
              </h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Ranking({ ranking }: { ranking: LandingRanking }) {
  const { students, universities, studentsAreSample, universitiesAreSample } = ranking
  const [first, second, third, ...rest] = students
  // El podio se dibuja en orden visual 2 - 1 - 3 y solo con los puestos que existen.
  const podium = [
    { person: second, place: 2 },
    { person: first, place: 1 },
    { person: third, place: 3 },
  ].filter((slot): slot is { person: Competitor; place: number } => slot.person !== undefined)

  // Las cifras suben desde 0 la primera vez que el ranking entra en pantalla.
  const gridRef = useRef<HTMLDivElement>(null)
  const seen = useSeenOnce(gridRef)
  const animate = !useReducedMotion() && typeof IntersectionObserver !== 'undefined'
  const points = (value: number) => <CountUp value={value} start={seen} animate={animate} />

  return (
    <section id="ranking" className="lp-section">
      <div className="lp-wrap">
        <p className="lp-eyebrow">Ranking público</p>
        <h2>Quién lidera esta semana</h2>
        <p className="lp-lead">
          Estudiantes e instituciones, ordenados por los puntos que ganan respondiendo bien y rápido. Se actualiza
          cada día.
        </p>
        <div ref={gridRef} className="lp-rank-grid">
          <div className="lp-card">
            <h3 className="lp-card-title">
              Mejores estudiantes <span className="lp-badge">{liveBadge(studentsAreSample, 'Esta semana')}</span>
            </h3>
            <div className="lp-podium">
              {podium.map(({ person, place }) => (
                <div key={person.id} className={`lp-pod lp-pod-${place}`}>
                  <div className="lp-pod-avatar">
                    {place === 1 && <Crown size={20} fill="currentColor" className="lp-pod-crown" aria-hidden="true" />}
                    <Face person={person} size={46} />
                  </div>
                  <b>{person.name.split(' ')[0]}</b>
                  {points(person.points)}
                  <div className="lp-pod-bar">{place}</div>
                </div>
              ))}
            </div>
            {rest.map((person, index) => (
              <div key={person.id} className="lp-row">
                <span className="lp-pos">{index + 4}</span>
                <Face person={person} />
                <span className="lp-who">{person.name}</span>
                <span className="lp-pts">{points(person.points)}</span>
              </div>
            ))}
          </div>

          <div className="lp-card">
            <h3 className="lp-card-title">
              Universidades <span className="lp-badge">{liveBadge(universitiesAreSample, 'Acumulado')}</span>
            </h3>
            {universities.map((uni, index) => (
              <div key={uni.id} className={`lp-row ${index === 0 ? 'lp-row-top' : ''}`}>
                <span className={`lp-pos ${index === 0 ? 'lp-medal-1' : ''}`}>
                  {index === 0 ? <Crown size={20} aria-label="Puesto 1" /> : index + 1}
                </span>
                <span className="lp-who">
                  {uni.name}
                  <small>
                    {formatPoints(uni.players)} jugadores · {formatPoints(uni.matches)} partidas
                  </small>
                </span>
                <span className="lp-pts">{points(uni.points)}</span>
              </div>
            ))}
            <p className="lp-note">
              Puntaje por universidad = suma de los puntos de sus estudiantes.
              {universitiesAreSample && ' Datos de ejemplo.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Challenges() {
  return (
    <section id="retos" className="lp-section">
      <div className="lp-wrap">
        <p className="lp-eyebrow">Comunidad</p>
        <h2>Retos entre carreras e instituciones</h2>
        <p className="lp-lead">
          Grupo contra grupo, con marcador abierto durante días. Cada resultado queda registrado y cada derrota pide
          revancha.
        </p>
        <div className="lp-challenges">
          {CHALLENGES.map((challenge) => (
            <div key={challenge.id} className="lp-card">
              <span className="lp-badge">{challenge.status}</span>
              <div className="lp-vs">
                <span>{challenge.left}</span>
                <span>VS</span>
                <span>{challenge.right}</span>
              </div>
              <div
                className="lp-meter"
                role="img"
                aria-label={`${challenge.left} ${challenge.leftShare}% contra ${challenge.right} ${100 - challenge.leftShare}%`}
              >
                <i style={{ width: `${challenge.leftShare}%`, background: '#7b5cff' }} />
                <i style={{ width: `${100 - challenge.leftShare}%`, background: '#ff3d7f' }} />
              </div>
              <div className="lp-meta">
                <span>{challenge.leftShare}%</span>
                <span>
                  {challenge.players ? (
                    <>
                      <Users size={14} className="lp-icon" aria-hidden="true" /> {formatPoints(challenge.players)}
                    </>
                  ) : (
                    'Inscríbete'
                  )}
                </span>
                <span>{100 - challenge.leftShare}%</span>
              </div>
            </div>
          ))}
        </div>
        <p className="lp-note">Vista previa: los retos entre carreras y universidades llegan pronto.</p>
      </div>
    </section>
  )
}

const UNI_POINTS = [
  { title: 'Partidas desde su propio material', text: 'La IA genera el borrador; el docente lo revisa antes de publicar.' },
  { title: 'Clases y torneos en el aula', text: 'Códigos de sala, torneos eliminatorios y podio por partida.' },
  { title: 'Métricas por clase e institución', text: 'Puntajes, partidas y avance de cada grupo.' },
]

function Universities() {
  return (
    <section id="universidades" className="lp-section">
      <div className="lp-wrap lp-uni">
        <div>
          <p className="lp-eyebrow">Para instituciones</p>
          <h2>Evidencia de lo que tu clase domina</h2>
          <p className="lp-lead">
            El docente crea la actividad, los estudiantes compiten y la institución ve el progreso. Sirve igual en un
            colegio, una universidad o un curso libre.
          </p>
          <ul className="lp-checks">
            {UNI_POINTS.map((point) => (
              <li key={point.title}>
                <span className="lp-check" aria-hidden="true">
                  <Check size={14} />
                </span>
                <div>
                  {point.title}
                  <span>{point.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="lp-card lp-uni-card">
          <div className="lp-uni-mark" aria-hidden="true">
            <GraduationCap size={36} />
          </div>
          <h3 style={{ fontSize: 24, margin: '10px 0 8px' }}>¿Tu institución ya está?</h3>
          <p style={{ marginBottom: 20 }}>
            Súmala al ranking y deja que sus estudiantes compitan por el primer lugar.
          </p>
          <GoLink to="/register" className="lp-btn lp-btn-main">
            Registrar mi institución
          </GoLink>
        </div>
      </div>
    </section>
  )
}

function FinalCall() {
  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <div className="lp-final">
          <LogoMark className="lp-final-logo" />
          <h2>Tu próxima clase puede ser una final.</h2>
          <p className="lp-lead">
            Crea tu cuenta en un minuto, sube un apunte y lanza la primera partida hoy mismo.
          </p>
          <div className="lp-cta">
            <GoLink to="/register" className="lp-btn lp-btn-main">
              Crear cuenta gratis <ArrowRight size={16} aria-hidden="true" />
            </GoLink>
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingPage() {
  const ranking = useLandingRanking()
  return (
    <div className="landing">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Ranking ranking={ranking} />
        <Challenges />
        <Universities />
        <FinalCall />
      </main>
      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-footer-brand">
            <LogoMark className="lp-logo-mark" />
            <LogoWordmark className="lp-logo-word" />
          </div>
          <Link to="/privacidad">Política de Privacidad</Link> · <Link to="/terminos">Términos de Servicio</Link>
          <p className="lp-note">© 2026 NexusFactoryLab</p>
        </div>
      </footer>
    </div>
  )
}
