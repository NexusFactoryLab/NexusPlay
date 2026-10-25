import { describe, expect, it } from 'vitest';
import { normalizeDraft } from './draft-normalizers.js';
import {
  analyzeDominoQuality,
  assignDominoIcons,
  inferIconFromLabel,
  shuffleQuestionOptions,
  type Rng,
} from './domino-quality.js';

/** Generador congruencial determinista (mulberry32) para pruebas reproducibles. */
function seeded(seed: number): Rng {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('shuffleQuestionOptions', () => {
  const question = { text: 'Q', options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'e' };

  it('conserva el mismo conjunto de opciones y correctIndex apunta a la misma opción', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const out = shuffleQuestionOptions(question, seeded(seed));
      expect([...out.options].sort()).toEqual(['A', 'B', 'C', 'D']);
      expect(out.options[out.correctIndex]).toBe('A');
    }
  });

  it('no modifica la pregunta original', () => {
    shuffleQuestionOptions(question, seeded(3));
    expect(question.options).toEqual(['A', 'B', 'C', 'D']);
    expect(question.correctIndex).toBe(0);
  });

  it('con rng fijo el resultado es determinista', () => {
    // rng() = 0 => j = 0 en cada paso: rotación conocida.
    const out = shuffleQuestionOptions(question, () => 0);
    expect(out.options).toEqual(['B', 'C', 'D', 'A']);
    expect(out.correctIndex).toBe(3);
  });

  it('no sesga la posición: la correcta (siempre en 0) se reparte de forma pareja', () => {
    const rng = seeded(42);
    const counts = [0, 0, 0, 0];
    const runs = 4000;
    for (let i = 0; i < runs; i += 1) counts[shuffleQuestionOptions(question, rng).correctIndex] += 1;
    for (const count of counts) {
      expect(count).toBeGreaterThan(runs / 4 - 150);
      expect(count).toBeLessThan(runs / 4 + 150);
    }
  });

  it('funciona con 3 opciones', () => {
    const out = shuffleQuestionOptions({ options: ['x', 'y', 'z'], correctIndex: 2 }, seeded(7));
    expect(out.options[out.correctIndex]).toBe('z');
  });
});

describe('íconos de Dominexo', () => {
  it('infiere el ícono por el nombre del concepto (sin tildes)', () => {
    expect(inferIconFromLabel('Sistema Solar', new Set())).toBe('sun');
    expect(inferIconFromLabel('Fotosíntesis de la hoja', new Set())).toBe('leaf');
    expect(inferIconFromLabel('Concepto sin pista', new Set())).toBeNull();
  });

  it('no repite un ícono ya usado al inferir', () => {
    expect(inferIconFromLabel('Sol', new Set(['sun']))).not.toBe('sun');
  });

  it('respeta íconos válidos y distintos', () => {
    expect(assignDominoIcons([{ label: 'A', icon: 'leaf' }, { label: 'B', icon: 'moon' }])).toEqual(['leaf', 'moon']);
  });

  it('varios "star" de respaldo: infiere por nombre y el resto recibe íconos distintos', () => {
    const icons = assignDominoIcons([
      { label: 'Sol', icon: 'star' },
      { label: 'Luna', icon: 'star' },
      { label: 'Mercurio', icon: 'star' },
      { label: 'Venus', icon: 'star' },
      { label: 'Marte', icon: 'star' },
    ]);
    expect(icons[0]).toBe('sun');
    expect(icons[1]).toBe('moon');
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('un ícono duplicado conserva el primero y reasigna el segundo', () => {
    const icons = assignDominoIcons([
      { label: 'Agua', icon: 'droplets' },
      { label: 'Lluvia', icon: 'droplets' },
    ]);
    expect(icons[0]).toBe('droplets');
    expect(icons[1]).not.toBe('droplets');
  });

  it('el normalizador entrega íconos únicos en 10 conceptos con "star" de respaldo', () => {
    const raw = Array.from({ length: 10 }, (_, i) => ({ label: `Concepto ${i}`, icon: 'star', color: '#22c55e' }));
    const { content } = normalizeDraft({ gameType: 'DOMINO' }, {}, raw);
    const icons = (content as Array<{ icon: string }>).map((c) => c.icon);
    expect(new Set(icons).size).toBe(10);
  });
});

describe('normalizeDraft DOMINO — barajado', () => {
  it('baraja las opciones con el rng inyectado y la correcta sigue siendo la misma', () => {
    const raw = [
      {
        label: 'X',
        color: '#22c55e',
        questions: [{ text: '¿Q?', options: ['Correcta', 'B', 'C', 'D'], correctIndex: 0, explanation: 'Porque sí.' }],
      },
    ];
    const rng = seeded(11);
    const { content } = normalizeDraft({ gameType: 'DOMINO', rng }, {}, raw);
    const q = (content as Array<{ questions: Array<{ options: string[]; correctIndex: number }> }>)[0].questions[0];
    expect([...q.options].sort()).toEqual(['B', 'C', 'Correcta', 'D']);
    expect(q.options[q.correctIndex]).toBe('Correcta');
  });

  it('en una muestra grande la correcta ya no se concentra en la posición B', () => {
    const rng = seeded(99);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 400; i += 1) {
      const raw = [
        {
          label: 'X',
          color: '#22c55e',
          questions: [{ text: '¿Q?', options: ['a1', 'b1', 'c1', 'd1'], correctIndex: 1, explanation: 'e' }],
        },
      ];
      const { content } = normalizeDraft({ gameType: 'DOMINO', rng }, {}, raw);
      counts[(content as Array<{ questions: Array<{ correctIndex: number }> }>)[0].questions[0].correctIndex] += 1;
    }
    expect(Math.max(...counts) / 400).toBeLessThan(0.35);
  });
});

describe('analyzeDominoQuality', () => {
  const full = {
    definition: 'd',
    example: 'e',
    application: 'a',
  };
  const q4 = { text: 'Q', options: ['uno', 'dos', 'tres', 'cuatro'], correctIndex: 0, explanation: 'x' };

  it('un concepto completo no genera advertencias', () => {
    expect(analyzeDominoQuality([{ label: 'A', icon: 'sun', ...full, questions: [q4] }])).toEqual([]);
  });

  it('avisa de campos faltantes, pocas opciones e ícono repetido', () => {
    const warnings = analyzeDominoQuality([
      { label: 'A', icon: 'sun', questions: [{ ...q4, options: ['a', 'b', 'c'] }] },
      { label: 'B', icon: 'sun', ...full, questions: [q4] },
    ]);
    const codes = warnings.map((w) => `${w.conceptIndex}:${w.code}`);
    expect(codes).toEqual(
      expect.arrayContaining([
        '0:repeated_icon',
        '1:repeated_icon',
        '0:missing_definition',
        '0:missing_example',
        '0:missing_application',
        '0:few_options',
      ]),
    );
    expect(warnings.find((w) => w.code === 'few_options')).toMatchObject({ label: 'A', questionIndex: 0 });
  });

  it('detecta opciones muy desbalanceadas en longitud', () => {
    const long = 'una opción larguísima que describe con muchísimo detalle la respuesta';
    const warnings = analyzeDominoQuality([
      { label: 'A', icon: 'sun', ...full, questions: [{ ...q4, options: [long, 'a', 'b', 'c'] }] },
    ]);
    expect(warnings.map((w) => w.code)).toEqual(['unbalanced_options']);
  });

  it('opciones de longitud parecida no se marcan', () => {
    const warnings = analyzeDominoQuality([
      { label: 'A', icon: 'sun', ...full, questions: [{ ...q4, options: ['Luna', 'Marte', 'Venus', 'Tierra'] }] },
    ]);
    expect(warnings).toEqual([]);
  });

  it('contenido que no es lista devuelve vacío', () => {
    expect(analyzeDominoQuality({ a: 1 })).toEqual([]);
  });
});
