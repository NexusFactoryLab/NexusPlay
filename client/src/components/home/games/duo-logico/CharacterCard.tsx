import type { DuoRole } from './shared/duoTypes'
import { CHARACTERS } from './duoCharacters'

/** Tarjeta de un personaje: retrato, su poder y su debilidad. */
export function CharacterCard({ role, selected, owner, onSelect }: { role: DuoRole; selected: boolean; owner?: string | null; onSelect?: () => void }) {
  const c = CHARACTERS[role]
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!onSelect}
      aria-pressed={selected}
      className={`flex flex-col items-center rounded-2xl border-2 bg-gradient-to-b ${c.tint} to-transparent p-3 text-center transition ${
        selected ? `${c.ring} ring-2` : 'border-border'
      } ${onSelect ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default'}`}
    >
      <img src={c.portrait} alt="" className="h-24 w-24 object-contain drop-shadow" draggable={false} />
      <span className="text-[17px] font-bold text-text-h">{c.name}</span>
      <span className="text-[13px] text-text">{c.power}</span>
      <span className="text-[13px] text-text">⚠️ {c.weakness}</span>
      {owner !== undefined && (
        <span className={`mt-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${owner ? 'bg-accent/15 text-accent' : 'bg-border/50 text-text'}`}>
          {owner ?? 'Libre'}
        </span>
      )}
    </button>
  )
}
