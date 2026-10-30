import { describe, expect, it } from 'vitest';
import { BiodiverCiudadContentValidator } from '../src/application/content-validators/biodiverciudad.content-validator.js';
import { CONFIG, CONTENT } from './biodiverciudad-content.js';

/**
 * El seed no pasa por la API, así que nada lo valida al sembrar. Esta prueba
 * garantiza que el juego de ejemplo cumple las mismas reglas que un juego
 * creado por un usuario (citas con página, un dilema con trampa, etc.).
 */
describe('contenido sembrado de BIODIVERCIUDAD', () => {
  const validator = new BiodiverCiudadContentValidator();

  it('la configuración es válida', () => {
    expect(validator.validateConfig(CONFIG)).toEqual(CONFIG);
  });

  it('las 4 estaciones pasan el validador', () => {
    expect(() => validator.validateContent(CONTENT)).not.toThrow();
    expect(CONTENT).toHaveLength(4);
  });

  it('cada estación tiene 5 preguntas, cada una con su cita', () => {
    for (const station of CONTENT) {
      expect(station.questions).toHaveLength(5);
      for (const question of station.questions) {
        expect(question.citation.author.length).toBeGreaterThan(2);
        expect(question.citation.page).toBeGreaterThan(0);
      }
    }
  });

  it('la respuesta correcta no cae siempre en la misma posición', () => {
    const positions = new Set(CONTENT.flatMap((station) => station.questions.map((q) => q.correctIndex)));
    expect(positions.size).toBeGreaterThan(1);
  });

  it('los escenarios de dilema se declaran ficticios', () => {
    expect(CONTENT.every((station) => station.dilemma.fictional)).toBe(true);
  });
});
