import { PublicPageLayout } from './PublicPageLayout'

export function PrivacyPolicyPage() {
  return (
    <PublicPageLayout title="Política de Privacidad">
      <p className="text-[13px] text-text">Última actualización: noviembre de 2026.</p>

      <p>
        Esta Política de Privacidad describe cómo NexusPlay ("la aplicación", "nosotros") recopila,
        usa y protege la información de las personas que usan la plataforma.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">
        Información que recopilamos
      </h2>
      <p>
        Cuando creas una cuenta recopilamos tu nombre, correo electrónico y, si eliges iniciar
        sesión con Google, la información básica de perfil que ese proveedor comparte con nuestro
        consentimiento (nombre, correo, foto de perfil). También almacenamos tu progreso dentro de
        los juegos, las clases u organizaciones a las que perteneces, y datos técnicos básicos de
        uso (fecha de último acceso, tipo de dispositivo).
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">
        Cómo usamos tu información
      </h2>
      <p>
        Usamos estos datos únicamente para operar la plataforma: autenticarte, guardar tu
        progreso, permitir que profesores gestionen sus clases, y mejorar la experiencia educativa.
        No vendemos ni compartimos tu información personal con terceros con fines publicitarios.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">
        Inicio de sesión con proveedores externos
      </h2>
      <p>
        Si inicias sesión con Google (u otro proveedor externo en el futuro), únicamente
        solicitamos los permisos mínimos necesarios para identificarte (correo, nombre, foto de
        perfil). No accedemos a tu contraseña ni a otra información de tu cuenta de Google.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">
        Conservación y eliminación de datos
      </h2>
      <p>
        Conservamos tu información mientras tu cuenta esté activa. Puedes solicitar la eliminación
        de tu cuenta y de tus datos personales en cualquier momento escribiendo al correo de
        soporte indicado abajo.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">Responsable del tratamiento</h2>
      <p>
        Los responsables del tratamiento de tus datos personales son Juan Camilo Pardo Martínez y
        Juan Sebastián López Hernández, representantes de NexusPlay. {/* TODO(legal): completar cédula o NIT, razón
        social, domicilio y correo oficial del responsable antes de producción. */}
        Identificación, domicilio y correo de contacto: [POR DEFINIR].
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">Marco legal y autorización</h2>
      <p>
        Tratamos tus datos conforme a la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el
        Decreto 1074 de 2015) y demás normas colombianas de protección de datos. La autorización es
        previa, expresa e informada y puedes revocarla cuando quieras, salvo que exista un deber
        legal o contractual de conservar el dato.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">Tus derechos</h2>
      <p>
        Puedes conocer, actualizar y rectificar tus datos; pedir prueba de la autorización; ser
        informado sobre el uso que se les da; revocar la autorización y solicitar la supresión
        cuando proceda; y presentar quejas ante la Superintendencia de Industria y Comercio (SIC)
        una vez agotado el trámite ante nosotros. Los datos sensibles son facultativos: no estás
        obligado a entregarlos.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">Niños, niñas y adolescentes</h2>
      <p>
        Según el artículo 7 de la Ley 1581 de 2012, el tratamiento de datos de menores de 18 años
        exige la autorización de su representante legal y debe respetar su interés superior. Quien
        sea menor de edad debe indicar los datos de su representante legal y este debe aceptar
        expresamente; sin esa autorización no puede entrar a los torneos por invitación.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">Firma del acuerdo de confidencialidad de los torneos</h2>
      <p>
        Quien entra a un torneo mediante el código QR o el enlace de invitación firma
        electrónicamente un acuerdo de confidencialidad y una autorización de tratamiento de datos
        (firma electrónica simple, Ley 527 de 1999 y Decreto 2364 de 2012). Guardamos: nombre
        completo, fecha de nacimiento, documento y correo (estos dos opcionales), los datos del
        representante legal si eres menor, la fecha y hora (UTC) de la firma, la versión y la huella
        SHA-256 del texto aceptado, el torneo asociado y, solo como evidencia de la firma, la
        dirección IP y el agente de usuario del navegador. El registro es de solo anexar: no se
        modifica. Estos datos no se usan para publicidad.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">Conservación, transmisión y transferencia</h2>
      <p>
        Conservamos la prueba de la firma durante [POR DEFINIR: plazo de conservación]. Podemos
        transmitir datos a proveedores de infraestructura (alojamiento y bases de datos) que actúan
        como encargados bajo nuestras instrucciones; esos servidores pueden estar fuera de Colombia.
      </p>

      <h2 className="mt-4 font-heading text-lg font-semibold text-text-h">Contacto</h2>
      <p>
        Si tienes preguntas sobre esta política o quieres ejercer tus derechos sobre tus datos,
        escríbenos a{' '}
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
