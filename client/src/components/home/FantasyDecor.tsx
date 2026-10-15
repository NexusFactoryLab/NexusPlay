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

/**
 * Paisaje de fondo del tema Pradera (issue #47): montañas lilas, una isla
 * flotante con árboles, colinas con árboles y nubes pastel. Va detrás de toda
 * la página (z-index -1 dentro del layout) y solo se ve con
 * [data-theme='meadow']; ver el bloque "Tema Pradera" en index.css.
 */
export function MeadowScenery() {
  return (
    <span className="mw-scenery" aria-hidden="true">
      <span className="mw-cloud mw-cloud-1" />
      <span className="mw-cloud mw-cloud-2" />
      <span className="mw-cloud mw-cloud-3" />
      <span className="mw-cloud mw-cloud-4" />
      <span className="mw-mountains" />
      <span className="mw-mountains mw-mountains-near" />
      <span className="mw-sky-island">
        <span className="mw-tree mw-tree-a">🌳</span>
        <span className="mw-tree mw-tree-b">🌲</span>
        <span className="mw-tree mw-tree-c">🌳</span>
      </span>
      <span className="mw-sky-island mw-sky-island-small">
        <span className="mw-tree mw-tree-a">🌲</span>
      </span>
      <span className="mw-hill mw-hill-back" />
      <span className="mw-hill mw-hill-front" />
      <span className="mw-tree mw-ground-tree mw-ground-1">🌳</span>
      <span className="mw-tree mw-ground-tree mw-ground-2">🌲</span>
      <span className="mw-tree mw-ground-tree mw-ground-3">🌳</span>
      <span className="mw-tree mw-ground-tree mw-ground-4">🌲</span>
      <span className="mw-cloud mw-cloud-low-1" />
      <span className="mw-cloud mw-cloud-low-2" />
    </span>
  )
}
