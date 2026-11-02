import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Brain,
  Check,
  Crown,
  GraduationCap,
  Medal,
  Swords,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { AvatarCircle } from '../avatar/AvatarCircle'
import { CHALLENGES, formatPoints, type Competitor, type LandingRanking } from './landingData'
import { useLandingRanking } from './useLandingRanking'
import './landing.css'

/** Fondo de las fotos redondas sobre el cielo nocturno (el mismo de Fantasía/Oscuro en avatar.css). */
const AVATAR_BG = { background: 'radial-gradient(circle at 50% 30%, #4b3c86 0%, #2b2259 70%, #1d1742 100%)' }

const MEDAL_CLASS = ['lp-medal-1', 'lp-medal-2', 'lp-medal-3']

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

function affiliation(person: Competitor): string | null {
  return [person.university, person.career].filter(Boolean).join(' · ') || null
}

function Header() {
  return (
    <nav className="lp-nav" aria-label="Principal">
      <div className="lp-wrap">
        <Link to="/inicio" className="lp-brand">
          <span className="lp-brand-mark" aria-hidden="true">
            <Zap size={20} fill="currentColor" strokeWidth={0} />
          </span>
          NexusPlay
        </Link>
        <div className="lp-nav-links">
          <a href="#como">Cómo funciona</a>
          <a href="#ranking">Ranking</a>
          <a href="#retos">Retos</a>
          <a href="#universidades">Universidades</a>
        </div>
        <div className="lp-nav-actions">
          <Link to="/login" className="lp-btn lp-btn-ghost lp-btn-sm">
            Iniciar sesión
          </Link>
          <Link to="/register" className="lp-btn lp-btn-main lp-btn-sm">
            Crear cuenta
          </Link>
        </div>
      </div>
    </nav>
  )
}

function Hero({ ranking }: { ranking: LandingRanking }) {
  const { students, studentsAreSample } = ranking
  return (
    <header className="lp-hero">
      <div className="lp-wrap">
        <div>
          <span className="lp-pill">
            <GraduationCap size={15} className="lp-icon" aria-hidden="true" /> Hecho para universidades
          </span>
          <h1>
            Aprende jugando.
            <br />
            <em>Compite en serio.</em>
          </h1>
          <p className="lp-sub">
            Convierte cualquier tema en un juego, rétate con tu clase y sube en el ranking de tu universidad. Todo en
            tiempo real.
          </p>
          <div className="lp-cta">
            <Link to="/register" className="lp-btn lp-btn-main">
              Crear mi cuenta gratis <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="lp-faces">
            <div className="lp-faces-stack">
              {students.map((person) => (
                <Face key={person.id} person={person} size={38} />
              ))}
            </div>
            <span>
              <b style={{ color: 'var(--lp-text-h)' }}>Reta a tu clase</b> y a toda la comunidad
            </span>
          </div>
          <div className="lp-facts">
            <div>
              <b>8</b>tipos de juego
            </div>
            <div>
              <b>Tiempo real</b>multijugador
            </div>
            <div>
              <b>Torneos</b>con podio
            </div>
          </div>
        </div>

        <aside className="lp-card" aria-label={studentsAreSample ? 'Vista previa del ranking' : 'Ranking de la semana'}>
          <h3 className="lp-card-title">
            Top de la semana <span className="lp-badge">{liveBadge(studentsAreSample, 'Últimos 7 días')}</span>
          </h3>
          {students.map((person, index) => (
            <div key={person.id} className={`lp-row ${index === 0 ? 'lp-row-top' : ''}`}>
              <span className={`lp-pos ${MEDAL_CLASS[index] ?? ''}`}>
                {index < 3 ? <Medal size={20} aria-label={`Puesto ${index + 1}`} /> : index + 1}
              </span>
              <Face person={person} />
              <span className="lp-who">
                {person.name}
                {affiliation(person) && <small>{affiliation(person)}</small>}
              </span>
              <span className="lp-pts">{formatPoints(person.points)}</span>
            </div>
          ))}
          <p className="lp-note">¿Y tú en qué puesto estarás? Crea tu cuenta y entra al ranking.</p>
        </aside>
      </div>
    </header>
  )
}

const STEPS = [
  {
    icon: Brain,
    title: 'Crea o elige un juego',
    text: 'Sube tus apuntes y la IA arma el borrador, o explora los juegos que ya creó la comunidad.',
  },
  {
    icon: Swords,
    title: 'Reta a tu clase',
    text: 'Comparte un código de sala y juega en vivo con compañeros, o entra a un torneo del profesor.',
  },
  {
    icon: Trophy,
    title: 'Sube en el ranking',
    text: 'Cada partida suma puntos para ti, tu carrera y tu universidad. El podio es público.',
  },
]

function HowItWorks() {
  return (
    <section id="como" className="lp-section">
      <div className="lp-wrap">
        <p className="lp-eyebrow">Cómo funciona</p>
        <h2>De tu apunte a una partida, en tres pasos</h2>
        <p className="lp-lead">
          Sin instalar nada. Creas tu cuenta y juegas desde el navegador, en clase o por tu cuenta.
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

  return (
    <section id="ranking" className="lp-section">
      <div className="lp-wrap">
        <p className="lp-eyebrow">Competitividad</p>
        <h2>Mira quién va de primero</h2>
        <p className="lp-lead">Ranking de estudiantes y de universidades, actualizado con cada partida.</p>
        <div className="lp-rank-grid">
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
                  {formatPoints(person.points)}
                  <div className="lp-pod-bar">{place}</div>
                </div>
              ))}
            </div>
            {rest.map((person, index) => (
              <div key={person.id} className="lp-row">
                <span className="lp-pos">{index + 4}</span>
                <Face person={person} />
                <span className="lp-who">{person.name}</span>
                <span className="lp-pts">{formatPoints(person.points)}</span>
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
                <span className="lp-pts">{formatPoints(uni.points)}</span>
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
        <h2>Desafía a otras carreras y universidades</h2>
        <p className="lp-lead">
          Los retos hacen que la comunidad se invite sola: cada victoria se comparte, cada derrota pide revancha.
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
  { title: 'Juegos desde tus propios apuntes', text: 'La IA genera el borrador; tú lo revisas antes de publicar.' },
  { title: 'Clases y torneos en aula', text: 'Códigos de sala y podio para los mejores de cada partida.' },
  { title: 'Métricas por clase e institución', text: 'Puntajes, partidas y avance de cada grupo.' },
]

function Universities() {
  return (
    <section id="universidades" className="lp-section">
      <div className="lp-wrap lp-uni">
        <div>
          <p className="lp-eyebrow">Para universidades</p>
          <h2>Estudiar deja de ser un trámite</h2>
          <p className="lp-lead">
            Profesores crean la actividad, estudiantes compiten y la institución ve el progreso.
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
          <h3 style={{ fontSize: 24, margin: '10px 0 8px' }}>¿Tu universidad ya está?</h3>
          <p style={{ marginBottom: 20 }}>
            Súmala al ranking y deja que sus estudiantes compitan por el primer lugar.
          </p>
          <Link to="/register" className="lp-btn lp-btn-main">
            Registrar mi universidad
          </Link>
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
          <h2>¿Listo para subir de nivel?</h2>
          <p className="lp-lead">Crea tu cuenta en un minuto y empieza a competir con tu clase.</p>
          <div className="lp-cta">
            <Link to="/register" className="lp-btn lp-btn-main">
              ¡Empezar a jugar!
            </Link>
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
        <Hero ranking={ranking} />
        <HowItWorks />
        <Ranking ranking={ranking} />
        <Challenges />
        <Universities />
        <FinalCall />
      </main>
      <footer className="lp-footer">
        <div className="lp-wrap">
          <Link to="/privacidad">Política de Privacidad</Link> · <Link to="/terminos">Términos de Servicio</Link>
          <p className="lp-note">© 2026 NexusFactoryLab</p>
        </div>
      </footer>
    </div>
  )
}
