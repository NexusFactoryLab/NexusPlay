/**
 * Contenido de "Territorios en Juego" (BIODIVERCIUDAD). Separado del seed para
 * poder validarlo con el mismo validador que usa la API (ver
 * biodiverciudad-seed-content.spec.ts). Fuente: libro "Voces sobre Ciudades
 * Sostenibles y Resilientes" (MADS, 2019), CC BY-NC-ND: citas breves con fuente.
 */

export const CONFIG = {
  pbrPerStation: 100,
  shuffleQuestions: true,
  shuffleOptions: true,
};

export const CONTENT = [
  {
    stationId: 'amazonia',
    region: 'Amazonia y Orinoquia',
    location: 'Leticia y Puerto Asís',
    challenge: 'Crecimiento urbano en ecosistemas frágiles, biodiversidad y saneamiento básico.',
    timeLimitMinutes: 8,
    reward: 'Certificado de Respeto a la Cultura y Biodiversidad Amazónica',
    questions: [
      {
        questionId: 'amazonia-problemas',
        prompt: 'Según el ensayo sobre la Amazonia, ¿cuáles son los principales problemas ambientales urbanos de la región?',
        options: [
          'Viviendas y saneamiento básico inadecuados, localización en zonas de riesgo y falta de diseño de ciudades planificadas.',
          'El exceso de centros comerciales y de vías de alta velocidad en el centro urbano.',
          'La sustitución de selva por grandes zonas francas industriales.',
          'La falta de universidades y de oferta cultural para los jóvenes.',
        ],
        correctIndex: 0,
        explanation:
          'El texto enumera vivienda y saneamiento inadecuados, ubicación en zonas de riesgo, contaminación del aire, el agua y el suelo, y la inexistencia de diseño de ciudades planificadas.',
        citation: { author: 'Mantilla y Salazar', page: 21 },
      },
      {
        questionId: 'amazonia-modelo',
        prompt: '¿Qué implica afirmar que "no hay ciudades amazónicas ni modelos de ciudad para la Amazonia"?',
        options: [
          'Que en la Amazonia no puede haber ciudades.',
          'Que cada ciudad en la Amazonia es única y no responde a un solo modelo: depende de su entorno y de sus ciudadanos.',
          'Que las ciudades amazónicas deben copiar el modelo de las ciudades andinas.',
          'Que la urbanización de la selva es un proceso que ya terminó.',
        ],
        correctIndex: 1,
        explanation:
          'Los autores citan a Braudel: una ciudad es siempre una ciudad. Hay ciudades en la Amazonia, y cada una es tan diversa y única como el entorno donde se construye y quienes le dan vida.',
        citation: {
          author: 'Mantilla y Salazar',
          page: 21,
          excerpt: 'no hay ciudades amazónicas ni modelos de ciudad para la Amazonia. Hay ciudades en la Amazonia',
        },
      },
      {
        questionId: 'amazonia-crecimiento',
        prompt: '¿Cómo describe el libro el crecimiento actual de los centros urbanos de la región amazónica?',
        options: [
          'Planificado, con criterios coherentes con el medio natural.',
          'Desordenado, sin considerar la escala humana ni la oportunidad de participación de los habitantes.',
          'Estancado: la población urbana disminuye cada año.',
          'Concentrado únicamente en las seis capitales departamentales.',
        ],
        correctIndex: 1,
        explanation:
          'Crecen en forma desordenada, sin criterios de planificación coherentes con el medio natural ni con las necesidades de sus habitantes, que no pueden participar efectivamente en construir la ciudad deseada.',
        citation: { author: 'Mantilla y Salazar', page: 22 },
      },
      {
        questionId: 'amazonia-sostenible',
        prompt: '¿Qué caracteriza a una ciudad sostenible según el ensayo?',
        options: [
          'Que ofrece calidad de vida, reduce su impacto sobre el medio natural, tiene una economía próspera para todos y participación ciudadana activa.',
          'Que es la más grande de la región y concentra toda la actividad económica.',
          'Que prohíbe cualquier construcción nueva dentro del casco urbano.',
          'Que depende exclusivamente de la inversión extranjera.',
        ],
        correctIndex: 0,
        explanation:
          'Las ciudades sostenibles ofrecen calidad de vida, reducen sus impactos, procuran el desarrollo humano, tienen una economía próspera para todos y una participación ciudadana activa, directa y comprometida.',
        citation: { author: 'Mantilla y Salazar', page: 22 },
      },
      {
        questionId: 'amazonia-agua-lluvia',
        prompt: 'La sede del Instituto Sinchi en Leticia se cita como ejemplo de adaptación al clima amazónico. ¿Qué hace?',
        options: [
          'Bombea agua del río para refrigerar el edificio.',
          'Sus cubiertas recolectan agua lluvia para usos múltiples y tiene paneles solares para los cortes de energía.',
          'Tiene un sistema de aire acondicionado alimentado con diésel.',
          'Evacúa toda el agua lluvia al alcantarillado para evitar inundaciones.',
        ],
        correctIndex: 1,
        explanation:
          'Las cubiertas están adaptadas al clima amazónico y recolectan agua lluvia para múltiples usos; además, los paneles solares ayudan a enfrentar los frecuentes cortes de energía de la ciudad.',
        citation: { author: 'Pacheco', page: 129 },
      },
    ],
    dilemma: {
      scenario:
        'Escenario ficticio: el municipio tiene un presupuesto limitado para un proyecto turístico a orillas del río. ¿Qué decisión toma?',
      fictional: true,
      options: [
        {
          optionId: 'amazonia-a',
          label: 'Construir un muelle de concreto masivo para cruceros en el río.',
          sustainable: false,
        },
        {
          optionId: 'amazonia-b',
          label: 'Diseñar saneamiento descentralizado con humedales artificiales y senderos ecoturísticos palafíticos comunitarios.',
          sustainable: true,
        },
      ],
    },
    deliverable:
      'Ficha rápida de 3 renglones con la opción elegida, citando el principio de preservación de la oferta ecosistémica.',
  },
  {
    stationId: 'caribe',
    region: 'Caribe y Valles Interandinos',
    location: 'Barranquilla y Ciénaga de Mallorquín',
    challenge: 'Arroyos urbanos, deterioro hídrico y plásticos por escorrentía.',
    timeLimitMinutes: 9,
    reward: 'Pacto por la Gestión Hídrica y Manejo de Residuos',
    questions: [
      {
        questionId: 'caribe-cienaga',
        prompt: '¿Qué proporción de su espejo de agua perdió la Ciénaga de Mallorquín entre 1980 y 2010?',
        options: [
          'Cerca del 5 %.',
          'Aproximadamente el 43 % (unas 650 hectáreas), casi la mitad.',
          'Cerca del 80 %.',
          'No perdió espejo de agua; solo cambió su calidad.',
        ],
        correctIndex: 1,
        explanation:
          'La ciénaga perdió unas 650 hectáreas, el 43,18 % de su configuración: casi la mitad del espejo de agua, además de erosión de la ante-playa y de parches de manglar.',
        citation: { author: 'Castillo, Guerrero y Rodríguez', page: 26 },
      },
      {
        questionId: 'caribe-cultura',
        prompt:
          'Pese al programa "Barranquilla sin Arroyos", que canaliza los arroyos más peligrosos, ¿cuál se señala como un gran reto pendiente?',
        options: [
          'Que el concreto de los canales es demasiado caro de mantener.',
          'La cultura ciudadana: arrojar residuos a la calle cuando llueve tapona las canalizaciones y desborda los arroyos.',
          'Que los canales impiden el paso de embarcaciones.',
          'La falta de ingenieros para diseñar canalizaciones.',
        ],
        correctIndex: 1,
        explanation:
          'El texto indica que, en varios sectores, las personas siguen arrojando desechos sólidos a las calles cuando llueve; eso tapona las canalizaciones y genera el desbordamiento de los arroyos.',
        citation: { author: 'Castillo, Guerrero y Rodríguez', page: 28 },
      },
      {
        questionId: 'caribe-fuente',
        prompt: 'Según el estudio citado sobre residuos en Barranquilla, ¿por qué la mitad de la población no separa en la fuente?',
        options: [
          'Porque no cree que el reciclaje sea importante.',
          'Porque no sabe a quién entregarle los residuos que genera.',
          'Porque la ciudad prohíbe separar residuos en las viviendas.',
          'Porque no existen recicladores en la ciudad.',
        ],
        correctIndex: 1,
        explanation:
          'El estudio estableció que el 50 % de la población no hace separación en la fuente por no saber a quién le entrega los residuos que genera.',
        citation: { author: 'Castillo, Guerrero y Rodríguez', page: 28 },
      },
      {
        questionId: 'caribe-recicladores',
        prompt: '¿Qué hizo la autoridad ambiental con los recicladores a partir de 2017?',
        options: [
          'Los reubicó fuera de la ciudad.',
          'Mantuvo una base de datos, los capacitó y acompañó su formalización; en 2018 carnetizó a 987 en la Red de Recuperadores Ambientales.',
          'Los reemplazó por una empresa privada de aseo.',
          'Les prohibió recoger residuos eléctricos y electrónicos.',
        ],
        correctIndex: 1,
        explanation:
          'El proyecto de capacitación técnico-jurídica de los recuperadores ambientales acompaña su formalización como organizaciones de aprovechamiento; en 2018 se carnetizaron 987.',
        citation: { author: 'Castillo, Guerrero y Rodríguez', page: 29 },
      },
      {
        questionId: 'caribe-agua-sostenible',
        prompt: '¿Qué estrategias de manejo sostenible de las aguas urbanas se mencionan en el ensayo sobre paisaje y naturaleza urbana?',
        options: [
          'Pavimentos permeables para infiltrar, zonas de retención y zonas verdes que imiten la infiltración natural.',
          'Revestir de concreto todo el cauce para aumentar la velocidad del agua.',
          'Mezclar aguas servidas y pluviales en un solo colector sin tratamiento.',
          'Evacuar rápidamente toda la escorrentía hacia el mar.',
        ],
        correctIndex: 0,
        explanation:
          'Se exigen materiales permeables, direccionar la escorrentía a pavimentos que infiltren y crear zonas de retención o zonas verdes que imiten los procesos naturales de infiltración; así se mitigan inundaciones y se reduce la velocidad del agua.',
        citation: { author: 'Wiesner', page: 72 },
      },
    ],
    dilemma: {
      scenario:
        'Escenario ficticio: los arroyos urbanos arrastran toneladas de plásticos hacia la ciénaga. ¿Qué estrategia adopta el equipo?',
      fictional: true,
      options: [
        {
          optionId: 'caribe-a',
          label: 'Canalizar los arroyos con concreto y confiar en que el agua llegue más rápido al estuario.',
          sustainable: false,
        },
        {
          optionId: 'caribe-b',
          label:
            'Crear un negocio verde con recicladores formalizados que intercepte el plástico antes del estuario y lo transforme en materiales para el parque ecoturístico local.',
          sustainable: true,
        },
        {
          optionId: 'caribe-c',
          label: 'Multar a los habitantes de los barrios cercanos sin ofrecer puntos de entrega ni educación.',
          sustainable: false,
        },
      ],
    },
    deliverable:
      'Diagrama de flujo circular: origen del residuo → captura → transformación → uso en el territorio.',
  },
  {
    stationId: 'andes',
    region: 'Metrópolis y Región Andina',
    location: 'Bogotá, Medellín, Cali y Bucaramanga',
    challenge: 'Islas de calor, déficit de área verde y segregación espacial.',
    timeLimitMinutes: 10,
    reward: 'Licencia de Urbanismo Verde y Conectividad Ecológica',
    questions: [
      {
        questionId: 'andes-tamano',
        prompt: 'Según los estudios sobre deseconomías de aglomeración, ¿cuál sería el tamaño óptimo de una ciudad construida en terreno plano y cercano a la costa?',
        options: [
          'Entre uno y tres millones de habitantes.',
          'Más de diez millones: mientras más grande, más eficiente.',
          'Menos de cien mil habitantes.',
          'No existe un tamaño óptimo: los costos por persona son siempre iguales.',
        ],
        correctIndex: 0,
        explanation:
          'Los costos per cápita dibujan curvas en forma de U: empiezan a subir cuando la ciudad alcanza cierto tamaño. Los primeros análisis ubican el óptimo entre uno y tres millones de habitantes.',
        citation: { author: 'Carrizosa', page: 16 },
      },
      {
        questionId: 'andes-bogota',
        prompt: 'Según el Tercer Informe del IDEAM citado en el libro, ¿qué ciudad está en riesgo muy alto por el cambio climático y ocupa el primer puesto en vulnerabilidad?',
        options: ['Bogotá.', 'Barranquilla.', 'Leticia.', 'Cartagena.'],
        correctIndex: 0,
        explanation:
          'La capital está en riesgo muy alto y ocupa el primer puesto de vulnerabilidad, entre otras razones por la seguridad alimentaria, la salud y los posibles cambios en sus recursos hídricos.',
        citation: { author: 'Carrizosa', page: 14 },
      },
      {
        questionId: 'andes-parque-lineal',
        prompt: 'Un parque lineal de 5 x 0,5 km (2,5 km²) en una ciudad como Bogotá, ¿a cuántas personas deja a menos de 0,5 km?',
        options: [
          'A unas 81.000 personas.',
          'A unas 8.100 personas.',
          'A unas 800.000 personas.',
          'A todos los habitantes de la ciudad.',
        ],
        correctIndex: 0,
        explanation:
          'Por su mayor perímetro, el parque lineal captura más gente: unas 81.000 personas en Bogotá. Un parque cuadrado equivalente en servicio necesitaría más de 3 km por lado, espacio que casi ninguna ciudad tiene.',
        citation: { author: 'Maddox', page: 38 },
      },
      {
        questionId: 'andes-arboles',
        prompt: 'En Washington D.C., ¿qué relación encontró el estudio entre ingresos de los hogares y cobertura de árboles?',
        options: [
          'Los barrios más pobres tienen más árboles.',
          'No existe ninguna relación.',
          'Los barrios más ricos tienen más árboles, y los de menores ingresos los pierden a mayor ritmo.',
          'Los árboles solo crecen en parques públicos.',
        ],
        correctIndex: 2,
        explanation:
          'Hay una fuerte correlación: cuanto más rico es el barrio, más árboles tiene; los de ingresos más bajos son menos verdes y, además, tienden a perderlos más rápido.',
        citation: { author: 'Maddox', page: 35 },
      },
      {
        questionId: 'andes-gentrificacion',
        prompt: '¿Qué efecto no deseado puede tener la llegada de infraestructura verde a un barrio sin espacios abiertos?',
        options: [
          'Que baje el precio de la vivienda.',
          'La gentrificación: suben las rentas y el valor de la vivienda, y muchos residentes son desplazados.',
          'Que los vecinos dejen de usar el espacio público.',
          'Que desaparezca la biodiversidad del barrio.',
        ],
        correctIndex: 1,
        explanation:
          'Cuando el barrio se vuelve más deseable, las rentas y el valor de la vivienda aumentan y muchos residentes ya no pueden pagar: son desplazados por los altos precios del vecindario recién mejorado.',
        citation: { author: 'Maddox', page: 34 },
      },
    ],
    dilemma: {
      scenario:
        'Escenario ficticio: un barrio popular denso sufre isla de calor y no tiene áreas verdes. ¿Dónde y cómo se invierte el presupuesto?',
      fictional: true,
      options: [
        {
          optionId: 'andes-a',
          label: 'Pavimentar la plaza del barrio para que sea "más fácil de mantener".',
          sustainable: false,
        },
        {
          optionId: 'andes-b',
          label: 'Combinar techos verdes, jardines de lluvia y pacas digestoras en el barrio, consultando antes a la comunidad.',
          sustainable: true,
        },
        {
          optionId: 'andes-c',
          label: 'Construir un único gran parque en la zona más pudiente de la ciudad.',
          sustainable: false,
        },
      ],
    },
    deliverable:
      'Estimación del impacto social e indicador de m² de área verde por habitante a incrementar en la zona elegida.',
  },
  {
    stationId: 'gobernanza',
    region: 'Gobernanza, Bioeconomía y Cultura',
    location: 'Ecosistema nacional de emprendimiento sostenible',
    challenge: 'Desconfianza comunitaria, baja participación y consumo lineal.',
    timeLimitMinutes: 8,
    reward: 'Aprobación de Infraestructura Verde Inclusiva',
    questions: [
      {
        questionId: 'gobernanza-biodiverciudad',
        prompt: '¿Qué concepto adoptó el gobierno para representar un desarrollo urbano integral que enfatiza la conservación y el uso sostenible de la base natural?',
        options: ['Biodiverciudad.', 'Ciudad jardín.', 'Megalópolis verde.', 'Zona franca ecológica.'],
        correctIndex: 0,
        explanation:
          'El prólogo explica que el Presidente adoptó el concepto de "biodiverciudad", apoyado en la tecnología, la innovación, la cultura y la creatividad.',
        citation: { author: 'Lozano (Prólogo)', page: 8, excerpt: 'biodiverciudad' },
      },
      {
        questionId: 'gobernanza-premisa',
        prompt: '¿Qué significa la premisa "producir conservando y conservar produciendo" en las ciudades colombianas?',
        options: [
          'Detener toda la actividad industrial para reforestar el territorio.',
          'Aprovechar el potencial de negocios verdes y economía circular, produciendo sin degradar la base natural que sostiene a las ciudades.',
          'Cobrar impuestos más altos a las empresas de alimentos.',
          'Privatizar la gestión de las reservas naturales.',
        ],
        correctIndex: 1,
        explanation:
          'La premisa supone grandes desafíos y valiosas oportunidades: en las ciudades colombianas existe un enorme potencial para los negocios verdes y la economía circular.',
        citation: { author: 'Lozano (Prólogo)', page: 8, excerpt: 'producir conservando y conservar produciendo' },
      },
      {
        questionId: 'gobernanza-residuos',
        prompt: 'Colombia pasó de 20.775 a 31.000 toneladas diarias de residuos (2007-2016) y aprovecha solo el 17 %. ¿Qué indica esto?',
        options: [
          'Que el país ya adoptó plenamente la economía circular.',
          'Que persiste el modelo de economía lineal y no el de economía circular.',
          'Que el reciclaje es innecesario porque los rellenos son suficientes.',
          'Que la población disminuyó.',
        ],
        correctIndex: 1,
        explanation:
          'La disposición de residuos per cápita creció más que la población, y con apenas el 17 % de aprovechamiento el texto concluye que persiste el modelo lineal; además, la vida útil de muchos rellenos es crítica.',
        citation: { author: 'Ramírez', page: 94 },
      },
      {
        questionId: 'gobernanza-aire',
        prompt: 'En el Valle de Aburrá, ¿qué demostró la eficacia del protocolo y del plan de calidad del aire en 2017?',
        options: [
          'Que las alertas pasaron de 23 días consecutivos en 2016 a 4 días de prevención y menos de 2 de alerta roja en 2017.',
          'Que las alertas aumentaron para poder tomar medidas más fuertes.',
          'Que la contaminación desapareció por completo.',
          'Que se prohibió totalmente el transporte público.',
        ],
        correctIndex: 0,
        explanation:
          'Con el protocolo vigente y el PIGECA, se pasó de 23 días consecutivos de alerta por PM2.5 en 2016 a un estado de prevención de cuatro días y una alerta roja fase I de menos de dos días.',
        citation: { author: 'Prieto y Restrepo', page: 143 },
      },
      {
        questionId: 'gobernanza-humedal',
        prompt: '¿Qué se logró en el Humedal de Córdoba gracias al Documento de Concertación anexo al fallo de Acción Popular?',
        options: [
          'Secar el humedal para construir una ciclorruta.',
          'Proveer un caudal constante de agua limpia de la quebrada Santa Bárbara (3 litros por segundo), que oxigena el humedal.',
          'Convertir el humedal en un parque con cancha de fútbol.',
          'Trasladar a los vecinos a otro barrio.',
        ],
        correctIndex: 1,
        explanation:
          'Se logró un caudal ambiental constante de agua limpia de la quebrada Santa Bárbara, que recupera la calidad fisicoquímica del agua y mantiene altos los niveles de oxígeno disuelto.',
        citation: { author: 'Equipo Interdisciplinario del Humedal de Córdoba', page: 160 },
      },
    ],
    dilemma: {
      scenario:
        'Escenario ficticio: una comunidad se opone a un proyecto de gestión de residuos por desconfianza histórica hacia las autoridades. ¿Qué estrategia adopta el equipo?',
      fictional: true,
      options: [
        {
          optionId: 'gobernanza-a',
          label: 'Ejecutar el proyecto sin consultar: las autoridades saben lo que conviene.',
          sustainable: false,
        },
        {
          optionId: 'gobernanza-b',
          label:
            'Diseñar una gobernanza colaborativa de 3 pasos: educación ambiental, coinversión comunitaria y beneficios tangibles en servicios públicos.',
          sustainable: true,
        },
        {
          optionId: 'gobernanza-c',
          label: 'Esperar a que la comunidad cambie de opinión por su cuenta.',
          sustainable: false,
        },
      ],
    },
    deliverable:
      'Matriz de actores clave (comunidad, empresa privada, academia y Estado) con el rol concreto de cada uno en la solución.',
  },
];
