/**
 * Adornos del tema Fantasía (issue #47): nubes, islas flotantes, enredaderas,
 * gemas, pergaminos y destellos hechos solo con CSS y emojis, sin imágenes.
 * Son puro adorno (aria-hidden, sin eventos) y fuera de
 * [data-theme='fantasy'] no se ven: ver el bloque "Tema Fantasía" en index.css.
 */

/** Marco del banner: esquinas doradas con gema, pergaminos, enredaderas, destellos, una isla y nubes. */
export function FantasyHeroDecor() {
  return (
    <span className="fx-decor" aria-hidden="true">
      <span className="fx-scroll fx-scroll-l" />
      <span className="fx-scroll fx-scroll-r" />
      <span className="fx-gem fx-corner fx-corner-tl" />
      <span className="fx-gem fx-corner fx-corner-tr" />
      <span className="fx-gem fx-corner fx-corner-bl" />
      <span className="fx-gem fx-corner fx-corner-br" />
      <span className="fx-vine fx-vine-1">🌿</span>
      <span className="fx-vine fx-vine-2">🍃</span>
      <span className="fx-vine fx-vine-3">🌿</span>
      <span className="fx-vine fx-vine-4">🍃</span>
      <span className="fx-vine fx-vine-5">🌿</span>
      <span className="fx-spark fx-spark-1">✦</span>
      <span className="fx-spark fx-spark-2">✦</span>
      <span className="fx-spark fx-spark-3">✦</span>
      <span className="fx-spark fx-spark-4">✦</span>
      <span className="fx-spark fx-spark-5">✦</span>
      <span className="fx-cloud fx-cloud-hero-l" />
      <span className="fx-cloud fx-cloud-hero-r" />
      <span className="fx-island fx-island-hero">
        <span className="fx-island-tree">🌳</span>
        <span className="fx-crystal fx-crystal-1" />
        <span className="fx-crystal fx-crystal-2" />
      </span>
    </span>
  )
}

/** Islitas flotantes entre el título "Juegos" y las tarjetas. */
export function FantasyGamesDecor() {
  return (
    <span className="fx-decor" aria-hidden="true">
      <span className="fx-island fx-island-a">
        <span className="fx-island-tree">🌲</span>
      </span>
      <span className="fx-island fx-island-b">
        <span className="fx-island-tree">🌳</span>
        <span className="fx-crystal fx-crystal-1" />
      </span>
    </span>
  )
}

/** Banco de nubes al pie del inicio: una capa detrás de las tarjetas y otra delante. */
export function FantasyCloudBank() {
  return (
    <span className="fx-decor fx-cloudbank-wrap" aria-hidden="true">
      <span className="fx-cloudbank fx-cloudbank-back" />
      <span className="fx-cloudbank fx-cloudbank-front" />
    </span>
  )
}
