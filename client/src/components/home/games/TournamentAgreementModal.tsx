import { useEffect, useId, useRef, useState } from 'react'
import { Modal } from './Modal'
import {
  getTournamentAgreement,
  signTournamentAgreement,
  type TournamentAgreement,
} from '../../../services/tournament-agreement.service'
import {
  buildSignPayload,
  DOCUMENT_TYPES,
  EMPTY_AGREEMENT_FORM,
  ageFromBirthDate,
  validateAgreementForm,
  type AgreementFormValues,
} from './tournamentAgreementForm'

type Props = {
  code: string
  token: string
  /** La firma quedó registrada: el padre vuelve a pedir la entrada al torneo. */
  onSigned: () => void
  /** La persona decide no firmar: no entra al torneo. */
  onCancel: () => void
}

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[16px] text-text-h focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/**
 * Acuerdo de confidencialidad y autorización de datos del torneo (issue #173). Solo aparece cuando se entra
 * por el QR o el enlace de invitación y el servidor exige la firma. El texto viene del servidor (versión y
 * hash incluidos) y se puede leer completo antes de firmar. Móvil primero: una columna, campos de 16 px.
 */
export function TournamentAgreementModal({ code, token, onSigned, onCancel }: Props) {
  const titleId = useId()
  const [agreement, setAgreement] = useState<TournamentAgreement | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [values, setValues] = useState<AgreementFormValues>(EMPTY_AGREEMENT_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    let alive = true
    setLoadError(null)
    getTournamentAgreement()
      .then((value) => alive && setAgreement(value))
      .catch(() => alive && setLoadError('No se pudo cargar el acuerdo. Revisa tu conexión e intenta de nuevo.'))
    return () => {
      alive = false
    }
  }, [loadAttempt])

  const errors = validateAgreementForm(values)
  const minor = (ageFromBirthDate(values.birthDate) ?? 18) < 18
  const set = <K extends keyof AgreementFormValues>(key: K, value: AgreementFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }))
  const err = (key: keyof AgreementFormValues) =>
    submitted && errors[key] ? (
      <p role="alert" className="mt-1 text-[12px] text-danger">
        {errors[key]}
      </p>
    ) : null

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (!agreement) return
    if (Object.keys(errors).length > 0) {
      // Los errores quedan en campos que pueden estar fuera de vista: se lleva a la persona al primero.
      window.requestAnimationFrame(() => {
        const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-field-error]')
        first?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        first?.focus({ preventScroll: true })
      })
      return
    }
    setSending(true)
    try {
      await signTournamentAgreement(token, code, buildSignPayload(values, agreement))
      setDone(true)
      window.setTimeout(onSigned, 1200)
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'No se pudo registrar la firma. Intenta de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal onClose={onCancel} dismissible={false} ariaLabelledBy={titleId} maxWidthClassName="max-w-[560px]" maxHeightClassName="max-h-[92vh]">
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4 p-4 sm:p-6">
        <div>
          <h2 id={titleId} className="font-heading text-xl font-semibold text-text-h">
            Acuerdo de confidencialidad del torneo {code}
          </h2>
          <p className="mt-1 text-[13px] text-text">
            Para entrar por el QR necesitas leer y firmar este acuerdo. Es 100% virtual y queda registrado con fecha y hora.
          </p>
        </div>

        {loadError ? (
          <div role="alert" className="flex flex-col items-start gap-2 text-[14px] text-danger">
            <p>{loadError}</p>
            <button type="button" onClick={() => setLoadAttempt((n) => n + 1)} className="rounded-lg border border-border px-3 py-1.5 text-[13px] text-text-h hover:border-accent/50">
              Reintentar
            </button>
          </div>
        ) : !agreement ? (
          <p role="status" className="text-[14px] text-text">
            Cargando el acuerdo...
          </p>
        ) : (
          <section
            aria-label="Texto completo del acuerdo"
            tabIndex={0}
            className="max-h-56 overflow-y-auto rounded-lg border border-border bg-surface p-3 text-[13px] leading-relaxed text-text focus-visible:outline-2 focus-visible:outline-accent"
          >
            <p className="mb-2 text-[11px] text-text">
              Versión {agreement.version} · huella {agreement.hash.slice(0, 12)}
            </p>
            {agreement.sections.map((section) => (
              <div key={section.id} className="mb-3">
                <h3 className="font-semibold text-text-h">{section.title}</h3>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-1">
                    {paragraph}
                  </p>
                ))}
              </div>
            ))}
          </section>
        )}

        <fieldset className="flex flex-col gap-3" disabled={sending || done}>
          <legend className="mb-1 text-[13px] font-semibold text-text-h">Tus datos</legend>
          <label className="text-[13px] text-text">
            Nombre completo
            <input className={inputClass} autoComplete="name" value={values.fullName} onChange={(e) => set('fullName', e.target.value)} aria-invalid={submitted && !!errors.fullName} />
            {err('fullName')}
          </label>
          <label className="text-[13px] text-text">
            Fecha de nacimiento
            <input className={inputClass} type="date" autoComplete="bday" value={values.birthDate} onChange={(e) => set('birthDate', e.target.value)} aria-invalid={submitted && !!errors.birthDate} />
            {err('birthDate')}
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-[13px] text-text">
              Tipo de documento (opcional)
              <select className={inputClass} value={values.documentType} aria-invalid={submitted && !!errors.documentType} onChange={(e) => set('documentType', e.target.value)}>
                <option value="">Sin indicar</option>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {err('documentType')}
            </label>
            <label className="text-[13px] text-text">
              Número (opcional)
              <input className={inputClass} inputMode="numeric" value={values.documentNumber} onChange={(e) => set('documentNumber', e.target.value)} />
            </label>
          </div>
          <label className="text-[13px] text-text">
            Correo de contacto (opcional)
            <input className={inputClass} type="email" autoComplete="email" value={values.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} aria-invalid={submitted && !!errors.contactEmail} />
            {err('contactEmail')}
          </label>
        </fieldset>

        {minor && (
          <fieldset className="flex flex-col gap-3 rounded-lg border border-accent/40 p-3" disabled={sending || done}>
            <legend className="px-1 text-[13px] font-semibold text-text-h">Representante legal (eres menor de 18 años)</legend>
            <p className="text-[12px] text-text">Sin la autorización de tu madre, padre o tutor no puedes entrar al torneo.</p>
            <label className="text-[13px] text-text">
              Nombre completo del representante
              <input className={inputClass} value={values.guardianFullName} aria-invalid={submitted && !!errors.guardianFullName} onChange={(e) => set('guardianFullName', e.target.value)} />
              {err('guardianFullName')}
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-[13px] text-text">
                Tipo de documento
                <select className={inputClass} value={values.guardianDocumentType} aria-invalid={submitted && !!errors.guardianDocumentType} onChange={(e) => set('guardianDocumentType', e.target.value)}>
                  <option value="">Elige uno</option>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {err('guardianDocumentType')}
              </label>
              <label className="text-[13px] text-text">
                Número de documento
                <input className={inputClass} inputMode="numeric" value={values.guardianDocumentNumber} aria-invalid={submitted && !!errors.guardianDocumentNumber} onChange={(e) => set('guardianDocumentNumber', e.target.value)} />
                {err('guardianDocumentNumber')}
              </label>
            </div>
            <label className="text-[13px] text-text">
              Relación contigo (madre, padre, tutor...)
              <input className={inputClass} value={values.guardianRelationship} aria-invalid={submitted && !!errors.guardianRelationship} onChange={(e) => set('guardianRelationship', e.target.value)} />
              {err('guardianRelationship')}
            </label>
            <label className="flex items-start gap-2 text-[13px] text-text">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={values.guardianAccepted} aria-invalid={submitted && !!errors.guardianAccepted} onChange={(e) => set('guardianAccepted', e.target.checked)} />
              <span>Soy el representante legal y autorizo el tratamiento de los datos del menor y su participación, según el acuerdo.</span>
            </label>
            {err('guardianAccepted')}
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-2" disabled={sending || done}>
          <legend className="mb-1 text-[13px] font-semibold text-text-h">Aceptaciones (por separado)</legend>
          <label className="flex items-start gap-2 text-[13px] text-text">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={values.acceptedConfidentiality} aria-invalid={submitted && !!errors.acceptedConfidentiality} onChange={(e) => set('acceptedConfidentiality', e.target.checked)} />
            <span>He leído y acepto el acuerdo de confidencialidad y la reserva de derechos de NexusPlay.</span>
          </label>
          {err('acceptedConfidentiality')}
          <label className="flex items-start gap-2 text-[13px] text-text">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={values.acceptedDataProcessing} aria-invalid={submitted && !!errors.acceptedDataProcessing} onChange={(e) => set('acceptedDataProcessing', e.target.checked)} />
            <span>Autorizo de forma previa, expresa e informada el tratamiento de mis datos personales según este acuerdo (Ley 1581 de 2012).</span>
          </label>
          {err('acceptedDataProcessing')}
        </fieldset>

        <label className="text-[13px] text-text">
          Firma: escribe tu nombre completo
          <input className={inputClass} value={values.signatureName} onChange={(e) => set('signatureName', e.target.value)} disabled={sending || done} aria-invalid={submitted && !!errors.signatureName} />
          {err('signatureName')}
        </label>

        {submitted && !done && !serverError && Object.keys(errors).length > 0 && (
          <p role="alert" className="rounded-lg border border-danger/40 p-2 text-[13px] text-danger">
            Falta completar {Object.keys(errors).length === 1 ? 'un dato' : `${Object.keys(errors).length} datos`} para poder firmar. Revisa los campos marcados en rojo.
          </p>
        )}
        {serverError && (
          <p role="alert" className="rounded-lg border border-danger/40 p-2 text-[13px] text-danger">
            {serverError}
          </p>
        )}
        {done && (
          <p role="status" className="rounded-lg border border-accent/40 p-2 text-[13px] text-text-h">
            Firma registrada. Entrando al torneo...
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={sending || done} className="rounded-lg border border-border px-4 py-2.5 text-[14px] text-text hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            No firmar y salir
          </button>
          <button type="submit" disabled={!agreement || sending || done} className="rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            {sending ? 'Registrando...' : 'Firmar y entrar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
