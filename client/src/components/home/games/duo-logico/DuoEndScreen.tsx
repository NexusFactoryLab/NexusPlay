import { DoorOpen, Heart, LogOut, RotateCcw, Sparkles, Timer } from 'lucide-react'
import { CHARACTERS } from './duoCharacters'
import type { DuoRoomView } from './shared/duoProtocol'

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Fin de la partida: victoria, derrota o compañero que se fue. */
export function DuoEndScreen({ room, onRetry, onExit }: { room: DuoRoomView; onRetry: () => void; onExit: () => void }) {
  const won = room.phase === 'VICTORY'
  const abandoned = room.phase === 'ABANDONED'
  const voted = !!room.you && room.retryVotes.includes(room.you)
  const partnerVoted = room.retryVotes.some((r) => r !== room.you)
  const duration = room.startedAt && room.finishedAt ? formatDuration(room.finishedAt - room.startedAt) : null

  return (
    <div className="absolute inset-0 z-40 flex overflow-y-auto bg-slate-950/75 p-4" role="dialog" aria-label="Fin de la partida" data-testid="duo-end">
      <div className="m-auto w-full max-w-[460px] rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl [@media(max-height:520px)]:p-4">
        <div className="mb-2 flex justify-center gap-2">
          <img src={CHARACTERS.FIRE.portrait} alt="" className={`h-20 w-20 object-contain [@media(max-height:520px)]:h-14 [@media(max-height:520px)]:w-14 ${won ? 'animate-bounce' : 'opacity-70 grayscale-[40%]'}`} />
          <img src={CHARACTERS.WATER.portrait} alt="" className={`h-20 w-20 object-contain [@media(max-height:520px)]:h-14 [@media(max-height:520px)]:w-14 ${won ? 'animate-bounce [animation-delay:150ms]' : 'opacity-70 grayscale-[40%]'}`} />
        </div>
        <h2 className="m-0 text-[26px] font-black tracking-tight text-slate-900">
          {won ? '¡Salvaron el bosque!' : abandoned ? 'Tu compañero salió' : 'Se acabaron los corazones'}
        </h2>
        <p className="mt-1 text-[15px] text-slate-600">
          {won
            ? 'Cruzaron juntos las tres Puertas del Saber. Así se trabaja en equipo.'
            : abandoned
              ? 'La partida terminó porque tu compañero se fue o no volvió a tiempo.'
              : 'Repasen las pistas y vuelvan a intentarlo: cada puerta les enseña algo nuevo.'}
        </p>

        {!abandoned && (
          <dl className="mt-4 grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
            <Stat icon={<DoorOpen className="h-4 w-4 text-violet-600" />} label="Puertas" value={`${room.gatesOpened}/${room.gatesTotal}`} />
            <Stat icon={<Sparkles className="h-4 w-4 text-amber-500" />} label="Fichas" value={`${room.coinsCollected}/${room.coinsTotal}`} />
            <Stat icon={<Heart className="h-4 w-4 text-rose-500" />} label="Corazones" value={`${room.hearts}/${room.maxHearts}`} />
            {duration && <Stat icon={<Timer className="h-4 w-4 text-sky-600" />} label="Tiempo" value={duration} />}
          </dl>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {!abandoned && (
            <button
              type="button"
              onClick={onRetry}
              disabled={voted}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-[15px] font-bold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" />
              {voted ? 'Esperando a tu compañero…' : partnerVoted ? 'Tu compañero quiere jugar otra vez' : 'Jugar otra vez'}
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 px-4 py-3 text-[15px] font-bold hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-100 px-3 py-2">
      <dt className="flex items-center gap-1 text-[11px] font-bold uppercase text-slate-500">
        {/* Sin shrink-0 el ícono se aplasta cuando la etiqueta es larga (Corazones). */}
        <span className="shrink-0">{icon}</span> {label}
      </dt>
      <dd className="text-[18px] font-black">{value}</dd>
    </div>
  )
}
