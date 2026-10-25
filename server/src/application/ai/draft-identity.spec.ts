import { describe, expect, it } from 'vitest';
import { identityPromptSection, normalizeIdentity, parseCategoryOptions } from './draft-identity.js';

const AREAS = [
  { id: 'a1', name: 'Ciencias Naturales' },
  { id: 'a2', name: 'Historia' },
];

describe('normalizeIdentity', () => {
  it('acepta título, descripción y un área existente', () => {
    expect(
      normalizeIdentity({ title: ' Revolución Francesa ', description: 'Conceptos clave de la revolución.', categoryId: 'a2' }, AREAS),
    ).toEqual({ title: 'Revolución Francesa', description: 'Conceptos clave de la revolución.', categoryId: 'a2' });
  });

  it('un área inexistente da null (nunca se inventan áreas)', () => {
    expect(normalizeIdentity({ title: 'Algo', categoryId: 'no-existe' }, AREAS).categoryId).toBeNull();
    expect(normalizeIdentity({ title: 'Algo', categoryId: 'Mitología' }, AREAS).categoryId).toBeNull();
  });

  it('como respaldo casa el nombre del área sin tildes ni mayúsculas', () => {
    expect(normalizeIdentity({ categoryName: 'ciencias naturales' }, AREAS).categoryId).toBe('a1');
    expect(normalizeIdentity({ categoryId: 'HISTORIA' }, AREAS).categoryId).toBe('a2');
  });

  it('sin áreas disponibles el área es null', () => {
    expect(normalizeIdentity({ categoryId: 'a1' }, []).categoryId).toBeNull();
  });

  it('omite título (< 3) y descripción (< 10) que no cumplen el mínimo', () => {
    const out = normalizeIdentity({ title: 'ab', description: 'corta' }, AREAS);
    expect(out).toEqual({ categoryId: null });
  });

  it('acota títulos y descripciones largas y quita comillas', () => {
    const out = normalizeIdentity({ title: `"${'T'.repeat(200)}"`, description: 'd'.repeat(900) }, AREAS);
    expect(out.title!.length).toBeLessThanOrEqual(80);
    expect(out.title).not.toMatch(/^"/);
    expect(out.description!.length).toBeLessThanOrEqual(300);
  });

  it('ignora tipos que no son texto y entradas vacías', () => {
    expect(normalizeIdentity({ title: 5, description: null, categoryId: 7 }, AREAS)).toEqual({ categoryId: null });
    expect(normalizeIdentity(undefined, AREAS)).toEqual({ categoryId: null });
  });
});

describe('parseCategoryOptions', () => {
  it('lee la lista JSON, descarta inválidos y repetidos', () => {
    const raw = JSON.stringify([{ id: 'a', name: 'Arte' }, { id: 'a', name: 'Otra' }, { id: '', name: 'x' }, 3]);
    expect(parseCategoryOptions(raw)).toEqual([{ id: 'a', name: 'Arte' }]);
  });

  it('JSON roto o ausente da lista vacía', () => {
    expect(parseCategoryOptions('{no')).toEqual([]);
    expect(parseCategoryOptions(undefined)).toEqual([]);
    expect(parseCategoryOptions('{"a":1}')).toEqual([]);
  });
});

describe('identityPromptSection', () => {
  it('lista las áreas con su id y pide null si ninguna encaja', () => {
    const text = identityPromptSection(AREAS);
    expect(text).toContain('a1: Ciencias Naturales');
    expect(text).toContain('null');
    expect(text).toContain('"title"');
  });

  it('sin áreas pide categoryId null', () => {
    expect(identityPromptSection([])).toContain('"categoryId": null');
  });
});
