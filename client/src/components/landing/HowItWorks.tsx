import { useRef, useState, type KeyboardEvent } from 'react'
import { Check } from 'lucide-react'
import { HOW_STEPS, nextStepIndex, type HowStepPreview } from './landingData'
import './landing-how.css'

/** Vistas previas con datos ficticios; no hay estado propio, solo ilustran cada paso. */
function Preview({ kind }: { kind: HowStepPreview }) {
  if (kind === 'material') {
    return (
      <div className="lp-pv">
        <div className="lp-pv-file">
          <span className="lp-pv-tag">PDF</span>
          <span>apuntes-celula.pdf</span>
          <em>12 págs.</em>
        </div>
        <p className="lp-pv-label">Borrador generado · 3 de 8 preguntas</p>
        <ul className="lp-pv-list">
          <li>
            <span>¿Qué organelo produce la mayor parte del ATP?</span>
            <b>Revisada</b>
          </li>
          <li>
            <span>¿En qué fase se duplica el ADN?</span>
            <b>Revisada</b>
          </li>
          <li className="is-pending">
            <span>Ordena las fases de la mitosis</span>
            <b>Por revisar</b>
          </li>
        </ul>
      </div>
    )
  }
  if (kind === 'sala') {
    return (
      <div className="lp-pv">
        <p className="lp-pv-label">Código de la sala</p>
        <p className="lp-pv-code">K7M2QX</p>
        <p className="lp-pv-label">En la sala · 4</p>
        <ul className="lp-pv-chips">
          {['Valentina', 'Andrés', 'Laura', 'Mateo'].map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
    )
  }
  if (kind === 'partida') {
    return (
      <div className="lp-pv">
        <p className="lp-pv-label">Pregunta 4 de 10</p>
        <p className="lp-pv-q">¿Qué organelo produce la mayor parte del ATP?</p>
        <div className="lp-pv-opts">
          <span>Ribosoma</span>
          <span className="is-right">Mitocondria</span>
          <span>Lisosoma</span>
          <span>Núcleo</span>
        </div>
        <p className="lp-pv-foot">+120 puntos por acertar</p>
      </div>
    )
  }
  return (
    <div className="lp-pv">
      <p className="lp-pv-label">Podio de la partida</p>
      <ol className="lp-pv-rank">
        {[
          ['Valentina C.', '2 480'],
          ['Andrés M.', '2 355'],
          ['Laura R.', '2 190'],
        ].map(([name, pts], i) => (
          <li key={name}>
            <span className="lp-pv-pos">{i + 1}</span>
            <span>{name}</span>
            <b>{pts}</b>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function HowItWorks() {
  const [active, setActive] = useState(0)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const step = HOW_STEPS[active]

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = nextStepIndex(event.key, active, HOW_STEPS.length)
    if (next === null) return
    event.preventDefault()
    setActive(next)
    tabs.current[next]?.focus()
  }

  return (
    <section id="como" className="lp-section">
      <div className="lp-wrap">
        <p className="lp-eyebrow">Cómo funciona</p>
        <h2>Del apunte a la partida en cuatro pasos</h2>
        <p className="lp-lead">Todo corre en el navegador. Elige un paso para ver qué hace cada quien.</p>

        <div className="lp-how">
          <div className="lp-how-tabs" role="tablist" aria-label="Pasos" aria-orientation="vertical" onKeyDown={onKeyDown}>
            {HOW_STEPS.map((s, index) => (
              <button
                key={s.id}
                ref={(el) => {
                  tabs.current[index] = el
                }}
                type="button"
                role="tab"
                id={`how-tab-${s.id}`}
                aria-selected={index === active}
                aria-controls="how-panel"
                tabIndex={index === active ? 0 : -1}
                className="lp-how-tab"
                onClick={() => setActive(index)}
              >
                <span className="lp-how-num">{String(index + 1).padStart(2, '0')}</span>
                <span className="lp-how-tab-text">
                  {s.label}
                  <small>{s.actor}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="lp-how-panel" role="tabpanel" id="how-panel" aria-labelledby={`how-tab-${step.id}`} tabIndex={0}>
            <div className="lp-how-copy">
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              <ul className="lp-checks lp-how-actions">
                {step.actions.map((action) => (
                  <li key={action}>
                    <span className="lp-check" aria-hidden="true">
                      <Check size={14} />
                    </span>
                    <div>{action}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-how-view" key={step.id} aria-hidden="true">
              <Preview kind={step.id} />
              <p className="lp-pv-note">Ejemplo con datos ficticios</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
