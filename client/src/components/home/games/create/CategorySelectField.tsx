import { useEffect, useMemo, useState } from 'react'
import { createSubject, type SubjectWithGameCount } from '../../../../services/subject.service'
import { ApiError } from '../../../../utils/http'
import { InfoBubble } from './InfoBubble'
import { FormSelect } from './FormSelect'

type CategorySelectFieldProps = {
  token: string | null
  categories: SubjectWithGameCount[]
  /** `categoryId` final elegido (raíz o sub-área) — el que viaja en el payload de creación del juego. */
  categoryId: string
  onCategoryIdChange: (categoryId: string) => void
  /** Se dispara tras crear una sub-área nueva, para refrescar el listado en el caller si aplica. */
  onCategoryCreated: (category: SubjectWithGameCount) => void
  disabled?: boolean
  showToast: (message: string, kind: 'success' | 'error') => void
}

/**
 * Selector de área/sub-área para los formularios de creación de juego
 * (issue #218, feedback post-PR: antes solo dejaba *crear* una sub-área
 * nueva, sin poder elegir una ya existente).
 *
 * Flujo: se elige primero un área raíz (`parentSubjectId === null`);
 * luego, si esa raíz ya tiene sub-áreas registradas, se puede elegir una
 * existente de un segundo selector, o crear una nueva con el input de abajo.
 * `categoryId` (el que se manda al backend) queda apuntando a la sub-área
 * elegida/creada, o a la raíz misma si no se eligió ninguna sub-área.
 */
export function CategorySelectField({
  token,
  categories,
  categoryId,
  onCategoryIdChange,
  onCategoryCreated,
  disabled,
  showToast,
}: CategorySelectFieldProps) {
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rootCategories = useMemo(
    () => categories.filter((category) => !category.parentSubjectId),
    [categories],
  )

  // El área raíz elegida es la raíz del categoryId actual: si categoryId
  // apunta a una sub-área, su raíz es parentSubjectId; si apunta a una
  // raíz, es el propio id.
  const selectedCategory = categories.find((category) => category.id === categoryId) ?? null
  const rootId = selectedCategory
    ? selectedCategory.parentSubjectId ?? selectedCategory.id
    : ''

  const subCategories = useMemo(
    () => (rootId ? categories.filter((category) => category.parentSubjectId === rootId) : []),
    [categories, rootId],
  )

  // Si al cambiar de raíz ya había una sub-área elegida de la raíz
  // anterior, se limpia — evita quedar con un categoryId que no corresponde
  // a la raíz visible en el primer selector.
  useEffect(() => {
    setNewCategoryName('')
  }, [rootId])

  function handleRootChange(newRootId: string) {
    onCategoryIdChange(newRootId)
  }

  function handleSubCategoryChange(subId: string) {
    onCategoryIdChange(subId || rootId)
  }

  async function handleCreateCategory() {
    if (!token || !newCategoryName.trim() || !rootId) return
    setCreatingCategory(true)
    setError(null)
    try {
      const category = await createSubject(token, newCategoryName.trim(), rootId)
      onCategoryCreated({ ...category, gameCount: 0 })
      onCategoryIdChange(category.id)
      setNewCategoryName('')
      showToast('Sub-área creada', 'success')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el área.')
    } finally {
      setCreatingCategory(false)
    }
  }

  return (
    <div data-nx-field>
      <label className="nx-label mb-1.5 block text-[13px] font-medium text-text-h" htmlFor="game-category">
        Área
      </label>
      <FormSelect
        id="game-category"
        searchable
        className="w-full rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[15px] text-text-h outline-none focus:border-accent"
        value={rootId}
        disabled={disabled}
        onChange={(event) => handleRootChange(event.target.value)}
      >
        <option value="">Elige un área…</option>
        {rootCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </FormSelect>

      <div className="nx-subbox relative mt-4 rounded-xl border-2 border-accent/40 bg-accent/5 p-4">
        <InfoBubble
          placement="corner"
          label="Ayuda: sub-área"
          text="Una sub-área es un tema dentro del área (por ejemplo, Fracciones dentro de Matemáticas). Crearla ayuda a ordenar tus juegos y a que los demás los encuentren más fácil."
        />
        <p className="text-[14px] font-semibold text-text-h">Sub-área</p>

        {!rootId ? (
          <p className="mt-2 text-[13px] text-text">Primero elige un área.</p>
        ) : subCategories.length > 0 ? (
          <div className="mt-3">
            <label className="nx-label mb-1.5 block text-[13px] font-medium text-text-h" htmlFor="game-sub-category">
              Elige una sub-área existente
            </label>
            <FormSelect
              id="game-sub-category"
              searchable
              className="w-full rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[15px] text-text-h outline-none focus:border-accent"
              value={categoryId !== rootId ? categoryId : ''}
              disabled={disabled}
              onChange={(event) => handleSubCategoryChange(event.target.value)}
            >
              <option value="">Sin sub-área (usar el área general)</option>
              {subCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </FormSelect>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-text">Aún no hay sub-áreas: crea la primera.</p>
        )}

        <label className="nx-label mb-1.5 mt-3 block text-[13px] font-medium text-text-h" htmlFor="game-new-sub-category">
          {subCategories.length > 0 ? 'O crea una sub-área nueva' : 'Nombre de la sub-área'}
        </label>
        <div className="flex flex-col gap-2">
          <input
            id="game-new-sub-category"
            type="text"
            className="min-h-[44px] flex-1 rounded-lg border border-border bg-bg px-[13px] py-2.5 text-[15px] text-text-h outline-none focus:border-accent"
            placeholder={rootId ? 'Ej. Fracciones, Reciclaje…' : 'Elige un área arriba primero'}
            value={newCategoryName}
            disabled={disabled || creatingCategory || !rootId}
            onChange={(event) => setNewCategoryName(event.target.value)}
          />
          <button
            type="button"
            className="nx-btn nx-btn-primary shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            onClick={handleCreateCategory}
            disabled={disabled || creatingCategory || !newCategoryName.trim() || !rootId}
          >
            {creatingCategory ? 'Creando…' : '+ Crear sub-área'}
          </button>
        </div>
      </div>

      {error && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
    </div>
  )
}
