import type { OrganizationWithMyRole } from '../../../../services/organization.service'
import { InfoBubble } from './InfoBubble'
import { FormSelect } from './FormSelect'

type OrganizationSelectFieldProps = {
  organizations: OrganizationWithMyRole[]
  value: string
  disabled?: boolean
  onChange: (organizationId: string) => void
}

/**
 * Selector opcional de organización para los formularios de creación de
 * juego. Solo tiene sentido montarlo si `organizations` no está vacío — el
 * caller decide si renderizarlo (ver los 4 forms de `games/*Form.tsx`).
 */
export function OrganizationSelectField({
  organizations,
  value,
  disabled,
  onChange,
}: OrganizationSelectFieldProps) {
  if (organizations.length === 0) return null

  return (
    <div data-nx-field>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label className="nx-label text-[13px] font-medium text-text-h" htmlFor="game-organization">
          Organización (opcional)
        </label>
        <InfoBubble
          label="Ayuda: organización"
          text="Si eliges una organización, el juego nace institucional: cualquier miembro puede usarlo."
        />
      </div>
      <FormSelect
        id="game-organization"
        className="w-full rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[15px] text-text-h outline-none focus:border-accent"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Juego personal</option>
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </FormSelect>
    </div>
  )
}
