import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Building2, Crown, GraduationCap, School, Timer, Users } from 'lucide-react'
import type { InstitutionType } from '../../services/organization.service'
import { AvatarCircle } from '../avatar/AvatarCircle'
import { CountUp } from './CountUp'
import { GoLink } from './GoLink'
import { formatPoints, type Competitor, type LandingRanking, type UniversityEntry } from './landingData'
import {
  INSTITUTION_CHIP_LABELS,
  INSTITUTION_FILTERS,
  RANKING_VIEWS,
  describeView,
  emptyFilterMessage,
  filterByInstitutionType,
  formatCountdown,
  msUntilNextCutoff,
  studentDetail,
  type InstitutionFilter,
  type RankingView,
} from './rankingLogic'
import { useIsVisible, usePageHidden, useReducedMotion, useSeenOnce, useSpotlight } from './useLandingMotion'
import './landing-ranking.css'

/** Fondo de las fotos redondas sobre el cielo nocturno (el mismo de Fantasía/Oscuro en avatar.css). */
const AVATAR_BG = { background: 'radial-gradient(circle at 50% 30%, #4b3c86 0%, #2b2259 70%, #1d1742 100%)' }

const TYPE_ICONS: Record<InstitutionType, typeof GraduationCap> = {
  UNIVERSITY: GraduationCap,
  SCHOOL: School,
  OTHER: Building2,
}

/** Chispas alrededor del primer puesto: posición (%) y retraso propio de cada una. */
const SPARKS = [
  { x: 8, y: 22, d: 0 },
  { x: 88, y: 14, d: 0.7 },
  { x: 96, y: 58, d: 1.5 },
  { x: 2, y: 66, d: 2.1 },
  { x: 52, y: -6, d: 1.1 },
]

const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties

/** Con datos reales dice cuál es la ventana; con datos de ejemplo lo avisa. */
const liveBadge = (isSample: boolean, live: string) => (isSample ? 'Vista previa' : live)

/** Minutos que faltan para el próximo corte; se refresca cada 30 s (texto, no animación). */
function useCountdown(): number {
  const [ms, setMs] = useState(() => msUntilNextCutoff(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setMs(msUntilNextCutoff(new Date())), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return ms
}

function TypeChip({ type }: { type: InstitutionType | null }) {
  if (!type) return null
  const Icon = TYPE_ICONS[type]
  return (
    <span className={`lp-rk-chip lp-rk-chip-${type.toLowerCase()}`}>
      <Icon size={12} strokeWidth={2.4} aria-hidden="true" />
      {INSTITUTION_CHIP_LABELS[type]}
    </span>
  )
}

function Face({ person, size }: { person: Competitor; size: number }) {
  return (
    <AvatarCircle
      config={person.avatar}
      name={person.name}
      className="lp-rk-face"
      style={{ ...AVATAR_BG, width: size, height: size, fontSize: Math.round(size * 0.34) }}
    />
  )
}

/** Escudo de una institución: el ícono de su tipo (o un edificio si no se sabe). */
function Crest({ type, size }: { type: InstitutionType | null; size: number }) {
  const Icon = type ? TYPE_ICONS[type] : Building2
  return (
    <span className="lp-rk-crest" style={{ width: size, height: size }} aria-hidden="true">
      <Icon size={Math.round(size * 0.46)} strokeWidth={2} />
    </span>
  )
}

/** Datos comunes con los que se dibuja un puesto, sea estudiante o institución. */
type Entry = {
  id: string
  name: string
  figure: (size: number) => ReactNode
  type: InstitutionType | null
  /** Líneas secundarias (programa, institución, jugadores…). */
  lines: string[]
  points: number
}

function studentEntry(person: Competitor): Entry {
  const detail = studentDetail(person)
  return {
    id: person.id,
    name: person.name,
    figure: (size) => <Face person={person} size={size} />,
    type: person.institutionType,
    lines: detail ? [detail] : [],
    points: person.points,
  }
}

function institutionEntry(uni: UniversityEntry): Entry {
  return {
    id: uni.id,
    name: uni.name,
    figure: (size) => <Crest type={uni.institutionType} size={size} />,
    type: uni.institutionType,
    lines: [`${formatPoints(uni.players)} jugadores · ${formatPoints(uni.matches)} partidas`],
    points: uni.points,
  }
}

type PointsRenderer = (value: number) => ReactNode

function Podium({ entries, points }: { entries: Entry[]; points: PointsRenderer }) {
  // Orden del DOM = orden del ranking (1, 2, 3) para lectores de pantalla; el CSS
  // los acomoda visualmente como 2 - 1 - 3.
  return (
    <ol className="lp-rk-podium" aria-label="Podio">
      {entries.slice(0, 3).map((entry, index) => {
        const place = index + 1
        return (
          <li key={entry.id} className={`lp-rk-pod lp-rk-pod-${place}`} style={cssVars({ '--i': index })}>
            <div className="lp-rk-pod-figure">
              <span className="lp-rk-halo" aria-hidden="true" />
              {place === 1 && (
                <>
                  <span className="lp-rk-crown" aria-hidden="true">
                    <Crown size={26} fill="currentColor" strokeWidth={1.6} />
                  </span>
                  {SPARKS.map((spark, sparkIndex) => (
                    <span
                      key={sparkIndex}
                      className="lp-rk-spark"
                      aria-hidden="true"
                      style={cssVars({ '--x': `${spark.x}%`, '--y': `${spark.y}%`, '--d': `${spark.d}s` })}
                    />
                  ))}
                </>
              )}
              {entry.figure(place === 1 ? 68 : 54)}
            </div>
            <p className="lp-rk-pod-name">
              <span className="lp-sr-only">Puesto {place}: </span>
              {entry.name}
            </p>
            <TypeChip type={entry.type} />
            {entry.lines.map((line) => (
              <p key={line} className="lp-rk-pod-line">
                {line}
              </p>
            ))}
            <p className="lp-rk-pod-pts">
              {points(entry.points)} <span>pts</span>
            </p>
            <div className="lp-rk-pod-bar" aria-hidden="true">
              <span>{place}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Rows({ entries, startAt, points }: { entries: Entry[]; startAt: number; points: PointsRenderer }) {
  if (entries.length === 0) return null
  return (
    <ol className="lp-rk-list" start={startAt}>
      {entries.map((entry, index) => (
        <li key={entry.id} className="lp-rk-row" data-spot style={cssVars({ '--i': index })}>
          <span className="lp-rk-pos" aria-hidden="true">
            {startAt + index}
          </span>
          {entry.figure(40)}
          <span className="lp-rk-who">
            <span className="lp-rk-name">
              <span className="lp-sr-only">Puesto {startAt + index}: </span>
              {entry.name}
            </span>
            <span className="lp-rk-meta">
              <TypeChip type={entry.type} />
              {entry.lines.map((line) => (
                <span key={line} className="lp-rk-detail">
                  {line}
                </span>
              ))}
            </span>
          </span>
          <span className="lp-rk-pts">{points(entry.points)}</span>
        </li>
      ))}
    </ol>
  )
}

function HookCard({ view }: { view: RankingView }) {
  const forStudents = view === 'students'
  return (
    <div className="lp-rk-hook">
      <span className="lp-rk-hook-pos" aria-hidden="true">
        ?
      </span>
      <div className="lp-rk-hook-copy">
        <p className="lp-rk-hook-title">{forStudents ? '¿Y tú?' : '¿Tu institución no aparece?'}</p>
        <p>
          {forStudents
            ? 'Crea tu cuenta y entra al ranking: cada partida suma puntos para ti y para tu institución.'
            : 'Regístrala y deja que sus estudiantes compitan por el primer lugar.'}
        </p>
      </div>
      <GoLink to="/register" className="lp-btn lp-btn-main lp-btn-sm lp-rk-hook-cta">
        {forStudents ? 'Crear mi cuenta' : 'Registrar mi institución'}
      </GoLink>
    </div>
  )
}

/**
 * Sección «Ranking público» de la landing: estudiantes e instituciones con su
 * tipo (universidad, colegio u otra), institución y programa; vistas en
 * pestañas, filtros por tipo, podio animado y cuenta regresiva hasta el
 * próximo corte (medianoche de Colombia). Con «reducir movimiento» todo queda
 * en su estado final, sin bucles.
 */
export function RankingSection({ ranking }: { ranking: LandingRanking }) {
  const { students, universities, studentsAreSample, universitiesAreSample } = ranking
  const [view, setView] = useState<RankingView>('students')
  const [filter, setFilter] = useState<InstitutionFilter>('ALL')
  const [announcement, setAnnouncement] = useState('')

  const sectionRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<RankingView, HTMLButtonElement | null>>({ students: null, institutions: null })

  const reduced = useReducedMotion()
  const animate = !reduced && typeof IntersectionObserver !== 'undefined'
  const seen = useSeenOnce(sectionRef, 0.15)
  // Los bucles sutiles (chispas, brillo, pulso) se pausan si nadie los ve.
  const visible = useIsVisible(sectionRef)
  const pageHidden = usePageHidden()
  const paused = !visible || pageHidden
  useSpotlight(panelRef, animate)
  const countdown = useCountdown()

  const shownStudents = useMemo(() => filterByInstitutionType(students, filter), [students, filter])
  const shownInstitutions = useMemo(() => filterByInstitutionType(universities, filter), [universities, filter])
  const entries = view === 'students' ? shownStudents.map(studentEntry) : shownInstitutions.map(institutionEntry)
  const isSample = view === 'students' ? studentsAreSample : universitiesAreSample
  const allSample = studentsAreSample && universitiesAreSample

  const points: PointsRenderer = (value) => <CountUp value={value} start={seen} animate={animate} />

  function announce(nextView: RankingView, nextFilter: InstitutionFilter) {
    const count =
      nextView === 'students'
        ? filterByInstitutionType(students, nextFilter).length
        : filterByInstitutionType(universities, nextFilter).length
    setAnnouncement(describeView(nextView, nextFilter, count))
  }

  function selectView(next: RankingView, moveFocus = false) {
    setView(next)
    announce(next, filter)
    if (moveFocus) tabRefs.current[next]?.focus()
  }

  function selectFilter(next: InstitutionFilter) {
    setFilter(next)
    announce(view, next)
  }

  // Teclado de pestañas (patrón WAI-ARIA): flechas, Inicio y Fin cambian y enfocan.
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const count = RANKING_VIEWS.length
    const index = RANKING_VIEWS.findIndex((tab) => tab.id === view)
    const targets: Record<string, number> = {
      ArrowRight: (index + 1) % count,
      ArrowLeft: (index - 1 + count) % count,
      Home: 0,
      End: count - 1,
    }
    const target = targets[event.key]
    if (target === undefined) return
    event.preventDefault()
    selectView(RANKING_VIEWS[target].id, true)
  }

  const sectionClass = [
    'lp-section',
    'lp-rk',
    animate ? 'lp-rk-animate' : '',
    seen ? 'is-seen' : '',
    paused ? 'is-paused' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section id="ranking" ref={sectionRef} className={sectionClass} aria-labelledby="lp-rk-title">
      <div className="lp-wrap">
        <div className="lp-rk-head">
          <div>
            <p className="lp-eyebrow">Ranking público</p>
            <h2 id="lp-rk-title">Quién lidera esta semana</h2>
            <p className="lp-lead">
              Estudiantes e instituciones de colegios, universidades y cualquier aula, ordenados por los puntos de sus
              partidas: se suma por jugar y por acertar, con un tope diario por juego para que gane quien domina el
              tema, no quien más repite.
            </p>
          </div>
          <p className={`lp-rk-live ${allSample ? 'is-sample' : ''}`}>
            {allSample ? (
              <>
                <Timer size={14} aria-hidden="true" /> Vista previa · se actualiza en {formatCountdown(countdown)}
              </>
            ) : (
              <>
                <span className="lp-live-dot" aria-hidden="true" /> En vivo · se actualiza en{' '}
                {formatCountdown(countdown)}
              </>
            )}
          </p>
        </div>

        <div className="lp-rk-controls">
          <div className="lp-rk-tabs" role="tablist" aria-label="Vista del ranking">
            {RANKING_VIEWS.map((tab) => {
              const selected = tab.id === view
              return (
                <button
                  key={tab.id}
                  ref={(node) => {
                    tabRefs.current[tab.id] = node
                  }}
                  type="button"
                  role="tab"
                  id={`lp-rk-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls="lp-rk-panel"
                  tabIndex={selected ? 0 : -1}
                  className={`lp-rk-tab ${selected ? 'is-active' : ''}`}
                  onClick={() => selectView(tab.id)}
                  onKeyDown={onTabKeyDown}
                >
                  {tab.id === 'students' ? <Users size={15} aria-hidden="true" /> : <Building2 size={15} aria-hidden="true" />}
                  {tab.label}
                </button>
              )
            })}
          </div>
          <div className="lp-rk-filters" role="group" aria-label="Filtrar por tipo de institución">
            {INSTITUTION_FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === filter}
                className={`lp-rk-filter ${option.id === filter ? 'is-active' : ''}`}
                onClick={() => selectFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <p className="lp-sr-only" aria-live="polite">
          {announcement}
        </p>

        <div
          ref={panelRef}
          id="lp-rk-panel"
          role="tabpanel"
          aria-labelledby={`lp-rk-tab-${view}`}
          tabIndex={0}
          className="lp-rk-panel lp-card"
        >
          <h3 className="lp-card-title">
            {view === 'students' ? 'Mejores estudiantes' : 'Mejores instituciones'}
            <span className="lp-badge">{liveBadge(isSample, view === 'students' ? 'Últimos 7 días' : 'Acumulado')}</span>
          </h3>

          {/* La clave reinicia la transición y la cascada al cambiar de vista o filtro. */}
          <div key={`${view}-${filter}`} className="lp-rk-swap">
            {entries.length === 0 ? (
              <div className="lp-rk-stage">
                <p className="lp-rk-empty">{emptyFilterMessage(view, filter)}</p>
                <HookCard view={view} />
              </div>
            ) : (
              <div className="lp-rk-stage">
                <Podium entries={entries} points={points} />
                <div className="lp-rk-side">
                  <Rows entries={entries.slice(3)} startAt={4} points={points} />
                  <HookCard view={view} />
                </div>
              </div>
            )}
          </div>

          <p className="lp-note">
            {view === 'students'
              ? 'Solo aparecen estudiantes de 14 años o más que aceptaron salir en el ranking, con su nombre abreviado.'
              : 'Puntaje de la institución = suma de los puntos de sus estudiantes.'}
            {isSample && ' Datos de ejemplo.'}
          </p>
        </div>
      </div>
    </section>
  )
}
