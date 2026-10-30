import { describe, expect, it } from 'vitest';
import { InvalidGameContentError } from '../../domain/errors/game.errors.js';
import { BiodiverCiudadContentValidator } from './biodiverciudad.content-validator.js';

function question(n: number, overrides: Record<string, unknown> = {}) {
  return {
    questionId: `q${n}`,
    prompt: `Pregunta número ${n} sobre ciudades sostenibles`,
    options: ['Opción uno', 'Opción dos', 'Opción tres', 'Opción cuatro'],
    correctIndex: 1,
    explanation: 'Así lo plantea el libro guía.',
    citation: { author: 'Maddox', page: 37 },
    ...overrides,
  };
}

function station(overrides: Record<string, unknown> = {}) {
  return {
    stationId: 'amazonia',
    region: 'Amazonia y Orinoquia',
    location: 'Leticia y Puerto Asís',
    challenge: 'Crecimiento urbano y saneamiento básico',
    timeLimitMinutes: 8,
    reward: 'Certificado Amazónico',
    questions: [question(1), question(2), question(3)],
    dilemma: {
      scenario: 'El municipio dispone de un presupuesto para un proyecto turístico.',
      fictional: true,
      options: [
        { optionId: 'a', label: 'Construir un muelle de concreto', sustainable: false },
        { optionId: 'b', label: 'Humedales artificiales y senderos comunitarios', sustainable: true },
      ],
    },
    deliverable: 'Ficha de tres renglones con la opción elegida',
    ...overrides,
  };
}

describe('BiodiverCiudadContentValidator', () => {
  const validator = new BiodiverCiudadContentValidator();

  describe('validateConfig', () => {
    it('aplica los valores por defecto', () => {
      expect(validator.validateConfig(undefined)).toEqual({
        pbrPerStation: 100,
        shuffleQuestions: true,
        shuffleOptions: true,
      });
    });

    it('rechaza PBR fuera de rango', () => {
      expect(() => validator.validateConfig({ pbrPerStation: 5 })).toThrow(InvalidGameContentError);
    });
  });

  describe('validateContent', () => {
    it('acepta una estación válida y conserva la cita', () => {
      const [result] = validator.validateContent([station()]) as Array<{
        questions: Array<{ citation: { author: string; page: number } }>;
      }>;
      expect(result.questions[0].citation).toEqual({ author: 'Maddox', page: 37 });
    });

    it('rechaza una lista vacía', () => {
      expect(() => validator.validateContent([])).toThrow(/al menos 1 estación/);
    });

    it('exige la cita del libro en cada pregunta', () => {
      const bad = station({ questions: [question(1), question(2), question(3, { citation: undefined })] });
      expect(() => validator.validateContent([bad])).toThrow(/cita del libro/);
    });

    it('exige página válida en la cita', () => {
      const bad = station({
        questions: [question(1), question(2), question(3, { citation: { author: 'Maddox', page: 0 } })],
      });
      expect(() => validator.validateContent([bad])).toThrow(/página/);
    });

    it('limita el fragmento citado por la licencia CC BY-NC-ND', () => {
      const bad = station({
        questions: [
          question(1),
          question(2),
          question(3, { citation: { author: 'Maddox', page: 37, excerpt: 'x'.repeat(301) } }),
        ],
      });
      expect(() => validator.validateContent([bad])).toThrow(/CC BY-NC-ND/);
    });

    it('rechaza un índice de respuesta correcta inexistente', () => {
      const bad = station({ questions: [question(1), question(2), question(3, { correctIndex: 4 })] });
      expect(() => validator.validateContent([bad])).toThrow(/opción es la correcta/);
    });

    it('rechaza menos de 3 preguntas por estación', () => {
      expect(() => validator.validateContent([station({ questions: [question(1), question(2)] })])).toThrow(
        /al menos 3 preguntas/,
      );
    });

    it('rechaza preguntas repetidas en una estación', () => {
      const bad = station({ questions: [question(1), question(2), question(3, { prompt: question(1).prompt })] });
      expect(() => validator.validateContent([bad])).toThrow(/repite la pregunta/);
    });

    it('rechaza opciones repetidas', () => {
      const bad = station({
        questions: [question(1), question(2), question(3, { options: ['Igual', 'igual', 'Otra'] })],
      });
      expect(() => validator.validateContent([bad])).toThrow(/opciones repetidas/);
    });

    it('rechaza un dilema donde todas las decisiones son sostenibles', () => {
      const bad = station({
        dilemma: {
          scenario: 'Un escenario cualquiera con suficiente texto.',
          fictional: false,
          options: [
            { label: 'Primera decisión sostenible', sustainable: true },
            { label: 'Segunda decisión sostenible', sustainable: true },
          ],
        },
      });
      expect(() => validator.validateContent([bad])).toThrow(/sin trampa no hay dilema/);
    });

    it('obliga a declarar si el escenario del dilema es ficticio', () => {
      const bad = station({
        dilemma: { ...station().dilemma, fictional: undefined },
      });
      expect(() => validator.validateContent([bad])).toThrow(/ficticio/);
    });

    it('rechaza stationId repetidos', () => {
      expect(() => validator.validateContent([station(), station()])).toThrow(/stationId/);
    });

    it('rechaza tiempos fuera de rango', () => {
      expect(() => validator.validateContent([station({ timeLimitMinutes: 1 })])).toThrow(/minutos/);
    });
  });
});
