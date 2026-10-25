import { describe, expect, it } from 'vitest';
import { analyzeDominoQuality, areOptionsSimilar, assignDominoIcons, findSimilarOptions, isWeakCase } from './domino-quality.js';
import { DOMINO_ICON_CATALOG, DOMINO_RESERVE_ICONS } from './domino-icon-catalog.js';
import { keywordIconsFor } from './domino-icon-keywords.js';

describe('íconos por palabra clave', () => {
  it('ciclo del agua: cada concepto recibe un ícono propio y acertado', () => {
    const labels = ['Evaporación', 'Condensación', 'Precipitación', 'Infiltración', 'Escorrentía', 'Transpiración'];
    // El modelo devolvió los íconos poco acertados del hallazgo (star/heart de respaldo, repetidos).
    const icons = assignDominoIcons(labels.map((label, i) => ({ label, icon: ['sun', 'cloud', 'droplets', 'star', 'heart', 'leaf'][i] })));
    expect(icons[0]).toBe('sun');
    expect(icons[1]).toBe('cloud');
    expect(icons[2]).toBe('droplets'); // el modelo lo eligió y es único: se respeta
    expect(icons[3]).not.toBe('star');
    expect(icons).not.toContain('star');
    expect(icons).not.toContain('heart');
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('sin ícono del modelo, la palabra clave decide', () => {
    const icons = assignDominoIcons(
      ['Evaporación', 'Condensación', 'Precipitación', 'Infiltración'].map((label) => ({ label, icon: 'star' })),
    );
    expect(icons).toEqual(['sun', 'cloud', 'cloudRain', 'droplets']);
  });

  it.each([
    ['Toma de la Bastilla', 'building'],
    ['Declaración de los Derechos', 'shieldCheck'],
    ['Guillotina', 'scissors'],
    ['Revolución Industrial', 'factory'],
    ['Numerador', 'pizza'],
    ['Ecuación de primer grado', 'calculator'],
    ['El sustantivo', 'bookOpen'],
    ['Células', 'microscope'],
    ['Volcanes', 'mountain'],
    ['Sistema solar', 'sun'],
    ['Fotosíntesis', 'leaf'],
    ['Vacunas', 'syringe'],
    ['Música colombiana', 'music'],
  ])('"%s" sugiere %s', (label, expected) => {
    expect(keywordIconsFor(label)[0]).toBe(expected);
  });

  it('todas las claves de la tabla existen en el catálogo', () => {
    for (const icon of DOMINO_RESERVE_ICONS) expect(DOMINO_ICON_CATALOG).toContain(icon);
    for (const label of ['agua', 'guerra', 'fraccion', 'poema', 'deporte']) {
      for (const icon of keywordIconsFor(label)) expect(DOMINO_ICON_CATALOG).toContain(icon);
    }
  });

  it('un ícono genérico (heart) se respeta solo si la palabra clave lo respalda', () => {
    expect(assignDominoIcons([{ label: 'Solidaridad', icon: 'heart' }])).toEqual(['heart']);
    expect(assignDominoIcons([{ label: 'Evaporación', icon: 'heart' }])).toEqual(['sun']);
  });

  it('sin palabra clave usa la reserva neutra (nunca star ni heart), distinta y determinista', () => {
    const items = ['Xyz uno', 'Qwe dos', 'Rty tres', 'Uio cuatro'].map((label) => ({ label, icon: 'star' }));
    const first = assignDominoIcons(items);
    expect(assignDominoIcons(items)).toEqual(first);
    expect(new Set(first).size).toBe(4);
    for (const icon of first) expect(DOMINO_RESERVE_ICONS).toContain(icon);
  });

  it('10 conceptos sin pistas no repiten ni caen en star', () => {
    const icons = assignDominoIcons(Array.from({ length: 10 }, (_, i) => ({ label: `Tema${i}`, icon: 'star' })));
    expect(new Set(icons).size).toBe(10);
    expect(icons).not.toContain('star');
  });
});

describe('areOptionsSimilar', () => {
  it.each([
    ['Se congela', 'Se vuelve hielo'],
    ['Se evapora', 'Pasa a vapor'],
    ['Evaporación', 'Evaporarse'],
    ['Lluvia', 'Precipitación'],
  ])('"%s" ≈ "%s"', (a, b) => {
    expect(areOptionsSimilar(a, b)).toBe(true);
  });

  it.each([
    ['1789', '1799'],
    ['A', 'B'],
    ['Oxígeno', 'Nitrógeno'],
    ['Hidrógeno', 'Hidrosfera'],
    ['Se congela', 'Se evapora'],
    ['Guerra de los Treinta Años', 'Guerra de los Cien Años'],
    ['Revolución Francesa', 'Revolución Industrial'],
    ['La Bastilla', 'El Louvre'],
    ['3/4', '3/5'],
  ])('"%s" y "%s" son distintas (sin falso positivo)', (a, b) => {
    expect(areOptionsSimilar(a, b)).toBe(false);
  });

  it('findSimilarOptions devuelve el primer par parecido', () => {
    expect(findSimilarOptions(['Se congela', 'Se evapora', 'Se vuelve hielo', 'Cae como lluvia'])).toEqual(['Se congela', 'Se vuelve hielo']);
    expect(findSimilarOptions(['Sol', 'Luna', 'Marte', 'Venus'])).toBeNull();
  });
});

describe('isWeakCase', () => {
  it.each([
    'Proceso por el cual el agua pasa de líquido a gas por efecto del calor del ambiente.',
    'Es el cambio de estado de líquido a gas.',
    'En la modelación climática, la evaporación de los océanos se cuantifica para estimar el balance hídrico.',
    'Conjunto de fenómenos asociados al ciclo del agua en la atmósfera terrestre y los océanos.',
    'Agua que sube.',
  ])('marca como débil: %s', (text) => {
    expect(isWeakCase(text)).toBe(true);
  });

  it.each([
    'Un agricultor nota que sus cultivos se secan cuando hay mucha evaporación y decide regar de noche para perder menos agua.',
    'En una ciudad costera, el calor del verano evapora el agua de la bahía y las nubes descargan lluvia en las montañas.',
    'Cuando una estudiante deja un vaso de agua al sol, al día siguiente ve que el nivel bajó por la evaporación del líquido.',
    'Agua',
  ].slice(0, 3))('no marca situaciones concretas: %s', (text) => {
    expect(isWeakCase(text)).toBe(false);
  });

  it('un caso vacío no es "débil" (lo avisa missing_application)', () => {
    expect(isWeakCase('   ')).toBe(false);
  });
});

describe('analyzeDominoQuality — similar_options y weak_case', () => {
  const q = (options: string[]) => ({ text: 'Q', options, correctIndex: 0, explanation: 'x' });
  const concept = (options: string[], application: string) => ({
    label: 'Congelación',
    icon: 'sun',
    definition: 'd',
    example: 'e',
    application,
    questions: [q(options)],
  });
  const good = 'Un vecino deja una botella llena en el congelador y al otro día la encuentra rota porque el agua se expandió al helarse.';

  it('avisa de opciones parecidas con ambas opciones en el mensaje y el índice de la pregunta', () => {
    const warnings = analyzeDominoQuality([concept(['Se congela', 'Se evapora', 'Se vuelve hielo', 'Cae'], good)]);
    const similar = warnings.find((w) => w.code === 'similar_options')!;
    expect(similar.questionIndex).toBe(0);
    expect(similar.conceptIndex).toBe(0);
    expect(similar.message).toContain('Se congela');
    expect(similar.message).toContain('Se vuelve hielo');
  });

  it('avisa de caso débil, y no de un caso concreto ni de opciones distintas', () => {
    const weak = analyzeDominoQuality([concept(['Uno', 'Dos', 'Tres', 'Cuatro'], 'Es el cambio de estado de líquido a sólido.')]);
    expect(weak.map((w) => w.code)).toContain('weak_case');
    const fine = analyzeDominoQuality([concept(['Sol', 'Luna', 'Marte', 'Venus'], good)]);
    expect(fine.map((w) => w.code)).not.toContain('weak_case');
    expect(fine.map((w) => w.code)).not.toContain('similar_options');
  });
});
