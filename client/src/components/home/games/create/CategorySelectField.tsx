import { useEffect, useMemo, useState } from 'react'
import { createSubject, type SubjectWithGameCount } from '../../../../services/subject.service'
import { ApiError } from '../../../../utils/http'

type CategorySelectFieldProps = {
  token: string | null
  categories: SubjectWithGameCount[]
  /** `categoryId` final elegido (raíz o sub-Ã¡rea) — el que viaja en el payload de creación del juego. */
  categoryId: string
  onCategoryIdChange: (categoryId: string) => void
  /** Se dispara tras crear una sub-Ã¡rea nueva, para refrescar el listado en el caller si aplica. */
  onCategoryCreated: (category: SubjectWithGameCount) => void
  disabled?: boolean
  showToast: (message: string, kind: 'success' | 'error') => void
}

/**
 * Selector de Ã¡rea/sub-Ã¡rea para los formularios de creación de juego
 * (issue #218, feedback post-PR: antes solo dejaba *crear* una sub-Ã¡rea
 * nueva, sin poder elegir una ya existente).
 *
 * Flujo: se elige primero un Ã¡rea raíz (`parentSubjectId === null`);
 * luego, si esa raíz ya tiene sub-Ã¡reas registradas, se puede elegir una
 * existente de un segundo selector, o crear una nueva con el input de abajo.
 * `categoryId` (el que se manda al backend) queda apuntando a la sub-Ã¡rea
 * elegida/creada, o a la raíz misma si no se eligió ninguna sub-Ã¡rea.
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

  // El Ã¡rea raíz elegida es la raíz del categoryId actual: si categoryId
  // apunta a una sub-Ã¡rea, su raíz es parentSubjectId; si apunta a una
  // raíz, es el propio id.
  const selectedCategory = categories.find((category) => category.id === categoryId) ?? null
  const rootId = selectedCategory
    ? selectedCategory.parentSubjectId ?? selectedCategory.id
    : ''

  const subCategories = useMemo(
    () => (rootId ? categories.filter((category) => category.parentSubjectId === rootId) : []),
    [categories, rootId],
  )

  // Si al cambiar de raíz ya había una sub-Ã¡rea elegida de la raíz
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
      showToast('Sub-Ã¡rea creada', 'success')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el Ã¡rea.')
    } finally {
      setCreatingCategory(false)
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-text-h" htmlFor="game-category">
        Ãrea
      </label>
      <select
        id="game-category"
        className="w-full rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[15px] text-text-h outline-none focus:border-accent"
        value={rootId}
        disabled={disabled}
        onChange={(event) => handleRootChange(event.target.value)}
      >
        <option value="">Elige un Ã¡rea…</option>
        {rootCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      <div className="mt-4 rounded-xl border-2 border-accent/40 bg-accent/5 p-4">
        <p className="text-[14px] font-semibold text-text-h">Sub-Ã¡rea</p>
        <p className="mt-0.5 text-[13px] leading-snug text-text">
          Una sub-Ã¡rea es un tema dentro del Ã¡rea (por ejemplo, Fracciones dentro de Matemáticas).
          Crearla ayuda a ordenar tus juegos y a que los demás los encuentren más fácil.
        </p>

        {!rootId ? (
          <p className="mt-3 text-[13px] font-medium text-text-h">
            Elige un Ã¡rea arriba para ver o crear sus sub-Ã¡reas.
          </p>
        ) : subCategories.length > 0 ? (
          <div className="mt-3">
            <label className="mb-1.5 block text-[13px] font-medium text-text-h" htmlFor="game-sub-category">
              Elige una sub-Ã¡rea existente
            </label>
            <select
              id="game-sub-category"
              className="w-full rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[15px] text-text-h outline-none focus:border-accent"
              value={categoryId !== rootId ? categoryId : ''}
              disabled={disabled}
              onChange={(event) => handleSubCategoryChange(event.target.value)}
            >
              <option value="">Sin sub-Ã¡rea (usar el Ã¡rea general)</option>
              {subCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="mt-3 text-[13px] font-medium text-text-h">
            Esta Ã¡rea todavía no tiene sub-Ã¡reas: crea la primera.
          </p>
        )}

        <label className="mb-1.5 mt-3 block text-[13px] font-medium text-text-h" htmlFor="game-new-sub-category">
          {subCategories.length > 0 ? 'O crea una sub-Ã¡rea nueva' : 'Nombre de la sub-Ã¡rea'}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="game-new-sub-category"
            type="text"
            className="min-h-[44px] flex-1 rounded-lg border border-border bg-bg px-[13px] py-2.5 text-[15px] text-text-h outline-none focus:border-accent"
            placeholder={rootId ? 'Ej. Fracciones, Reciclaje…' : 'Elige un Ã¡rea arriba primero'}
            value={newCategoryName}
            disabled={disabled || creatingCategory || !rootId}
            onChange={(event) => setNewCategoryName(event.target.value)}
          />
          <button
            type="button"
            className="min-h-[44px] shrink-0 rounded-lg px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_8px_20px_-10px_var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            onClick={handleCreateCategory}
            disabled={disabled || creatingCategory || !newCategoryName.trim() || !rootId}
          >
            {creatingCategory ? 'Creando…' : '+ Crear sub-Ã¡rea'}
          </button>
        </div>
      </div>

      {error && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
    </div>
  )
}
