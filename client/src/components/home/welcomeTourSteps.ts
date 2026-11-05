/**
 * Un paso del recorrido interactivo. La persona no mira una animación: HACE
 * lo que el paso enseña.
 * - `tap`: tocar el elemento señalado (o algo dentro de él, como un mundo).
 * - `type`: escribir en el buscador y pulsar Enter o la lupa.
 * - `look`: solo mirar (no hay nada que tocar); avanza con "Siguiente".
 * Si tocar lleva a otra página, `away` explica esa página en la barra de
 * "Volver a la guía" (ver tourProgress.ts y TourReturnBar).
 */
export type WelcomeStep = {
  title: string
  text: string
  target: string
  icon: 'play' | 'create' | 'explore' | 'profile'
  kind: 'tap' | 'type' | 'look'
  /** Lo que tiene que hacer, en una frase corta ("Toca «Crear juego»"). */
  task?: string
  /** Qué está viendo si el paso lo llevó a otra página. */
  away?: string
  /** Lo que se le dice al lograrlo sin salir del inicio (abrió un menú, una ventana…). */
  done?: string
  /**
   * Cómo dejar la pantalla como estaba al pasar a otro paso, si este la cambió:
   * `toggle` vuelve a tocar el elemento (el menú contraído), `clear-search`
   * borra la búsqueda. Las ventanas y menús abiertos se cierran siempre.
   */
  undo?: 'toggle' | 'clear-search'
  /** Dónde tiene que estar la pantalla para este paso (Kids: la lista de mundos o dentro de uno). */
  place?: 'world-list' | 'inside-world'
}

export type WelcomeOptions = {
  canAccessOrganization?: boolean
  canGoBackToWorlds?: boolean
}

/**
 * Velocidad del recorrido obligatorio de cuentas nuevas (issue #171):
 * 'quick' deja el texto de cada paso en lo esencial (qué es y dónde está),
 * 'complete' es el texto de siempre, más completo. Las cuentas que reabren
 * la guía manualmente (botón "Guía") siempre la ven en 'complete'.
 */
export type TutorialMode = 'quick' | 'complete'

/**
 * `isKids` (no `role === 'STUDENT'` a secas) decide el set de pasos: un
 * STUDENT de 10+ años ve el Home normal (Sidebar, no KidsHomeShell — ver
 * isKidsMode en utils/kidsMode.ts), así que necesita los pasos "normales" con
 * sus mismos `target` (data-tour) reales — los pasos de kids apuntan a
 * elementos que solo existen en KidsHomeShell y no encontrarían nada ahí.
 * Los pasos de Kids no distinguen `mode`: ya son breves.
 */
export function getWelcomeSteps(role: string, isKids: boolean, options: WelcomeOptions = {}, mode: TutorialMode = 'complete'): WelcomeStep[] {
  const quick = mode === 'quick'
  const profile: WelcomeStep = {
    title: 'Tu espacio, a un toque',
    text: quick
      ? 'Tu avatar: tu cuenta y cerrar sesión.'
      : 'Desde tu avatar ves tu cuenta, cambias tu avatar o cierras sesión. Usa Guía cuando quieras repetir este recorrido.',
    target: 'profile', icon: 'profile', kind: 'tap',
    task: 'Toca tu avatar para abrir tu menú.',
    done: '¡Ese es tu menú!',
  }
  if (isKids) return [
    {
      title: 'Elige tu mundo', text: 'Cada mundo es un área con sus juegos. Si aún no hay mundos, pídele a tu profe que publique un juego.',
      target: 'worlds', icon: 'explore', kind: 'tap', place: 'world-list',
      task: 'Toca un mundo para entrar.',
      done: '¡Entraste a un mundo! Aquí están sus juegos.',
    },
    {
      title: '¡A jugar con tu equipo!', text: 'Si tu profe te dio un código de sala, escríbelo en el juego y toca Unirme. Para jugar por tu cuenta, toca Jugar.',
      target: 'worlds', icon: 'play', kind: 'tap', place: 'inside-world',
      task: 'Toca la portada de un juego.',
      away: 'Así se ve un juego por dentro. Aquí lees cómo se juega y empiezas la partida.',
      done: '¡Muy bien! Así se abre un juego.',
    },
    // Siempre está: el primer paso hace entrar a un mundo, así que aquí ya
    // hay botón Volver (si no lo hubiera, el recorrido deja pasar el paso).
    {
      title: 'Descubre otro mundo', text: 'Con Volver regresas a los mundos para elegir otra aventura.',
      target: 'worlds-back', icon: 'explore', kind: 'tap',
      task: 'Toca Volver.',
      done: '¡Listo! Ya puedes elegir otro mundo.',
    },
    profile,
  ]
  const steps: WelcomeStep[] = [
    {
      title: 'Entra con un código',
      text: quick ? 'Un código de sala te lleva directo a la partida.' : '¿Te invitaron a una partida? Con el código de sala que te compartieron entras directo.',
      target: 'join', icon: 'play', kind: 'tap',
      task: 'Toca «Unirme con código».',
      done: 'Aquí escribes el código que te compartan. Al tocar «Siguiente», la guía cierra esta ventana.',
    },
  ]
  if (role === 'TEACHER' || role === 'ADMIN') steps.push({
    title: 'Crea tu primera actividad',
    text: quick ? 'Elige un tipo de juego, agrega tu contenido y guárdalo.' : 'Eliges un tipo de juego, preparas el contenido y lo guardas. Desde su sala podrás invitar a jugar.',
    target: 'create', icon: 'create', kind: 'tap',
    task: 'Toca el botón de crear juego.',
    away: 'Aquí eliges el tipo de juego que quieres crear. Nada se guarda hasta que tú lo decidas.',
  })
  steps.push({
    title: 'Todo tiene su lugar',
    text: quick
      ? (role === 'TEACHER' ? 'Menú: Explorar, Mi espacio y, si tienes acceso, Administración.'
        : role === 'ADMIN' ? 'Menú: Explorar, Mi espacio y Administración.'
        : 'Menú: Explorar y Mi espacio.')
      : role === 'TEACHER'
        ? 'El menú tiene tres partes: Explorar (Áreas y Comunidad), Mi espacio (Mis clases y Mis juegos) y, si tienes acceso, Administración.'
        : role === 'ADMIN'
          ? 'El menú tiene tres partes: Explorar (Áreas y Comunidad), Mi espacio (Mis juegos) y Administración (Usuarios, Edición, Proveedores de IA y Organización).'
          : 'El menú tiene dos partes: Explorar (Áreas y Comunidad) para encontrar juegos y Mi espacio para lo tuyo, como Mis juegos.',
    target: 'navigation', icon: 'explore', kind: 'look',
  })
  steps.push(
    {
      title: 'Vuelve al inicio',
      text: quick ? 'Inicio te trae de vuelta desde cualquier sección.' : 'Inicio te trae a este panel desde cualquier sección.',
      target: 'nav-home', icon: 'explore', kind: 'tap', task: 'Toca «Inicio».', done: '¡Ya estás en el inicio!',
    },
    {
      title: 'Explora por área',
      text: quick ? 'Juegos agrupados por tema de estudio.' : 'En Áreas están los juegos organizados por lo que quieres aprender o enseñar.',
      target: 'nav-subjects', icon: 'explore', kind: 'tap', task: 'Toca «Áreas».',
      away: 'Estas son las áreas. Toca una para ver solo sus juegos.',
    },
  )
  if (role === 'TEACHER') steps.push({
    title: 'Tus grupos, en Mis clases',
    text: quick ? 'Tus grupos y sus actividades.' : 'Organiza tus grupos y abre una clase para consultar o agregar sus actividades.',
    target: 'nav-classes', icon: 'explore', kind: 'tap', task: 'Toca «Mis clases».',
    away: 'Aquí están tus clases. Abre una para ver sus actividades o crea una nueva.',
  })
  steps.push(
    {
      title: 'Descubre la Comunidad',
      text: quick ? 'Juegos que otras personas comparten; puedes filtrar por tipo.' : 'Explora los juegos que otras personas comparten en Comunidad y usa el filtro para ver solo un tipo de juego.',
      target: 'nav-community', icon: 'play', kind: 'tap', task: 'Toca «Comunidad».',
      away: 'Estos son los juegos de la comunidad. Toca uno para jugarlo o ver de qué trata, o filtra por tipo de juego.',
    },
    {
      title: 'Encuentra tus juegos',
      text: quick
        ? 'Tus juegos, publicados o no.'
        : role === 'TEACHER' ? 'En Mis juegos encuentras tus creaciones para consultarlas y seguir trabajando en ellas.' : 'En Mis juegos encuentras los juegos que creaste y que no están publicados para la comunidad.',
      target: 'nav-own-games', icon: 'create', kind: 'tap',
      task: 'Toca «Mis juegos».',
      away: 'Aquí quedan tus juegos: ábrelos para editarlos, jugarlos o compartirlos.',
    },
  )
  if (role === 'ADMIN') steps.push(
    {
      title: 'Gestiona los usuarios',
      text: quick ? 'Consulta y administra las cuentas.' : 'En Usuarios puedes consultar y administrar las cuentas de NexusPlay.',
      target: 'nav-users', icon: 'profile', kind: 'tap', task: 'Toca «Usuarios».',
      away: 'Esta es la lista de cuentas. Puedes buscar, cambiar roles o desactivar cuentas.',
    },
    {
      title: 'Edita lo que ven los demás',
      text: quick ? 'Elige los destacados del Inicio y administra los tipos de juego.' : 'En Edición eliges los juegos destacados del Inicio y archivas o renombras los tipos de juego. Quien explora los ve en Comunidad, con el filtro por tipo.',
      target: 'nav-edition', icon: 'create', kind: 'tap', task: 'Toca «Edición».',
      away: 'Aquí eliges los juegos destacados del Inicio y administras los tipos de juego.',
    },
    {
      title: 'La IA, bajo control',
      text: quick ? 'Revisa las peticiones de creación con IA.' : 'En Proveedores de IA revisas las peticiones de creación con IA y el estado de cada una.',
      target: 'nav-ai-providers', icon: 'create', kind: 'tap', task: 'Toca «Proveedores de IA».',
      away: 'Aquí ves las peticiones a la IA y configuras sus proveedores.',
    },
  )
  if (role === 'ADMIN' || options.canAccessOrganization) steps.push({
    title: 'Tu organización',
    text: quick ? 'Gestiona las organizaciones a las que tienes acceso.' : 'En Organización consultas y gestionas las organizaciones a las que tienes acceso.',
    target: 'nav-organization', icon: 'explore', kind: 'tap', task: 'Toca «Organización».',
    away: 'Este es el panel de tu organización: sus miembros, clases y métricas.',
  })
  steps.push(
    {
      title: 'Encuentra un juego',
      text: quick ? 'El buscador filtra los juegos por lo que escribes.' : 'El buscador muestra los juegos que coinciden con lo que escribes. Borra el texto para volver al listado completo.',
      target: 'search', icon: 'explore', kind: 'type', undo: 'clear-search',
      task: 'Escribe algo en «Buscar juegos» y pulsa Enter.',
      done: '¡Así se busca! Al seguir, la guía borra la búsqueda.',
    },
    {
      title: 'Más espacio para jugar',
      text: quick ? 'Contrae o expande el menú.' : 'Esta flecha contrae o expande el menú. Sus opciones siguen disponibles como iconos.',
      target: 'menu-toggle', icon: 'explore', kind: 'tap', undo: 'toggle', task: 'Toca la flecha del menú.',
      done: '¡Listo! Así ganas espacio. Al seguir, la guía deja el menú como estaba.',
    },
    {
      title: 'Hazlo a tu gusto',
      text: quick ? 'La tuerca abre tus temas: Fantasía, Pradera, Claro y Oscuro.' : 'La tuerca abre tu configuración: ahí están los temas Fantasía, Pradera, Claro y Oscuro. La elección se recuerda en este dispositivo.',
      target: 'settings', icon: 'explore', kind: 'tap', task: 'Toca la tuerca de configuración.',
      done: 'Esa es tu configuración. Al tocar «Siguiente», la guía la cierra.',
    },
    profile,
  )
  return steps
}

/**
 * Fases de la bienvenida: "greeting" es la tarjeta de bienvenida que sale en
 * TODA carga o login (sin importar si la cuenta ya vio la guía antes), "invite"
 * la invitación obligatoria de la flecha a "Guía" (primera vez de una cuenta) y
 * "tour" el recorrido paso a paso.
 */
export type WelcomePhase = 'greeting' | 'invite' | 'choose-track' | 'tour' | 'demo' | 'closed'

/**
 * El saludo solo abre si se entra directo al inicio: un enlace a una sala, un
 * juego u otra sección no se interrumpe (y tampoco se aplaza para cuando se
 * vuelva al inicio, que sería el saludo "en cada regreso", no "en cada
 * ingreso"). Fuera del inicio queda solo la invitación de la primera vez.
 *
 * `alreadyGreeted` viene de un estado solo en memoria (ver `hasGreetedThisSession`
 * más abajo): sigue en pie mientras se navega dentro de la app (salir de un
 * juego, terminar una partida y volver al lobby no debe reabrir la tarjeta),
 * pero se pierde al recargar la página o abrir una pestaña nueva — ahí sí
 * vuelve a salir, sin importar si la cuenta ya la vio antes.
 */
export function initialWelcomePhase(startsAtHome: boolean, seen: boolean, alreadyGreeted: boolean): WelcomePhase {
  if (startsAtHome) return alreadyGreeted ? phaseAfterGreeting(seen) : 'greeting'
  return seen ? 'closed' : 'invite'
}

/**
 * Al cerrar la tarjeta sin abrir el recorrido, quien ya hizo la guía vuelve al
 * inicio y quien nunca la hizo sigue viendo su invitación obligatoria de
 * siempre. (Sin tratamiento especial para cuentas nuevas por ahora.)
 */
export function phaseAfterGreeting(seen: boolean): WelcomePhase {
  return seen ? 'closed' : 'invite'
}

const seenInMemory = new Set<string>()
export function welcomeStorageKey(userId: string, role: string) {
  return `nexusplay-welcome-v1:${encodeURIComponent(userId)}:${role}`
}
export function hasSeenWelcome(key: string) {
  try { return seenInMemory.has(key) || localStorage.getItem(key) === 'seen' }
  catch { return seenInMemory.has(key) }
}
export function markWelcomeSeen(key: string) {
  seenInMemory.add(key)
  try { localStorage.setItem(key, 'seen') } catch { /* La guía funciona sin almacenamiento. */ }
}

/**
 * Marca de solo memoria (nunca `localStorage`) para que la tarjeta de
 * bienvenida no se repita por navegar dentro de la misma sesión del
 * navegador, pero sí vuelva a salir en cada recarga real de la página o
 * pestaña nueva, que reinicia todo el estado de JS.
 */
const greetedThisSession = new Set<string>()
export function hasGreetedThisSession(key: string) {
  return greetedThisSession.has(key)
}
export function markGreetedThisSession(key: string) {
  greetedThisSession.add(key)
}
/** Para que la tarjeta de bienvenida salga al terminar el onboarding de avatar aunque ya se hubiera cerrado antes en esta sesión. */
export function resetGreetedThisSession(key: string) {
  greetedThisSession.delete(key)
}

/**
 * Tutorial obligatorio de cuentas nuevas (issue #171): `AvatarOnboardingGate`
 * marca esta bandera cuando detecta una cuenta que recién empieza su
 * onboarding (ver `needsAvatarOnboarding`), y `WelcomeTour` la lee para
 * forzar la elección Rápido/Completo y no dejar cerrar el recorrido hasta
 * terminarlo. Se borra solo al terminar todo (recorrido y, si aplica, la
 * simulación de crear un juego) — a diferencia de `hasSeenWelcome`, que se
 * marca apenas se abre la guía, esta bandera sigue en pie si recarga a mitad
 * de camino, así el recorrido obligatorio se retoma en vez de saltarse.
 */
const mandatoryPendingInMemory = new Set<string>()
function mandatoryTutorialKey(userId: string) {
  return `nexusplay-mandatory-tutorial-v1:${encodeURIComponent(userId)}`
}
export function markMandatoryTutorialPending(userId: string) {
  const key = mandatoryTutorialKey(userId)
  mandatoryPendingInMemory.add(key)
  try { localStorage.setItem(key, 'pending') } catch { /* Sin almacenamiento, vale hasta recargar. */ }
}
export function isMandatoryTutorialPending(userId: string) {
  const key = mandatoryTutorialKey(userId)
  try { return mandatoryPendingInMemory.has(key) || localStorage.getItem(key) === 'pending' }
  catch { return mandatoryPendingInMemory.has(key) }
}
export function clearMandatoryTutorialPending(userId: string) {
  const key = mandatoryTutorialKey(userId)
  mandatoryPendingInMemory.delete(key)
  try { localStorage.removeItem(key) } catch { /* Ya no hay nada que borrar. */ }
}
