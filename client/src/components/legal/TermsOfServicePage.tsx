import { PublicPageLayout } from './PublicPageLayout'

export function TermsOfServicePage() {
  return (
    <PublicPageLayout title="Términos de Servicio">
      <p className="text-[13px] text-text">Última actualización: noviembre de 2026.</p>

      <p>
        Al usar NexusPlay ("la aplicación") aceptas los siguientes términos. Si no estás de acuerdo,
        por favor no uses la plataforma.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">Uso de la cuenta</h2>
      <p>
        Eres responsable de mantener la confidencialidad de tu cuenta y contraseña, y de toda
        actividad que ocurra bajo tu cuenta. Debes usar la plataforma solo con fines educativos y
        de buena fe, sin intentar vulnerar su seguridad ni afectar la experiencia de otros usuarios.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">Fase de prueba</h2>
      <p>
        NexusPlay se encuentra en fase de prueba (beta cerrada). Quienes participan no pueden
        divulgar, contar ni compartir nada de la plataforma (funcionalidades, juegos, contenido,
        diseño, código, marca, preguntas, resultados, capturas o grabaciones), y no pueden hacer
        ingeniería inversa ni extraer contenido de forma automatizada. Quien entra a un torneo por
        invitación lo confirma firmando el acuerdo de confidencialidad. La vigencia de esa
        confidencialidad es [POR DEFINIR: plazo]. El incumplimiento puede llevar a la exclusión de
        la prueba y a las acciones legales que correspondan [POR DEFINIR por el abogado].
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">
        Contenido y propiedad intelectual
      </h2>
      <p>
        Todos los derechos sobre NexusPlay quedan reservados (Ley 23 de 1982, Decisión Andina 351 de 1993, Ley 1915 de 2018 y, para marcas, Decisión Andina 486 de 2000). Los juegos, materiales y diseños de NexusPlay son propiedad de sus creadores, y el uso de la plataforma no cede ni licencia derecho alguno más allá de usarla. Los comentarios y sugerencias que envíes pasan a NexusPlay. El contenido
        que profesores u organizaciones creen dentro de la plataforma (juegos personalizados,
        áreas, clases) permanece bajo su responsabilidad y pueden gestionarlo o eliminarlo en
        cualquier momento.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">
        Disponibilidad del servicio
      </h2>
      <p>
        Nos esforzamos por mantener la plataforma disponible, pero no garantizamos un
        funcionamiento ininterrumpido. Podemos modificar, suspender o descontinuar funciones en
        cualquier momento, notificando cuando sea razonablemente posible.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">
        Limitación de responsabilidad
      </h2>
      <p>
        NexusPlay se ofrece "tal cual". En la medida permitida por la ley, no somos responsables
        por daños indirectos derivados del uso o la imposibilidad de uso de la plataforma.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">
        Cambios a estos términos
      </h2>
      <p>
        Podemos actualizar estos Términos de Servicio ocasionalmente. Notificaremos cambios
        importantes a través de la propia aplicación.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">Contacto</h2>
      <p>
        Para preguntas sobre estos términos, escríbenos a{' '}
        <a
          href="mailto:soporte@nexusplay.app"
          className="font-medium text-accent hover:underline"
        >
          soporte@nexusplay.app
        </a>
        .
      </p>
    </PublicPageLayout>
  )
}
