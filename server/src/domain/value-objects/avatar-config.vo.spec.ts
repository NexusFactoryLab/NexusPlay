import { describe, expect, it } from 'vitest';
import { AvatarConfig } from './avatar-config.vo.js';
import { InvalidAvatarError } from '../errors/user.errors.js';

describe('AvatarConfig (issue #77)', () => {
  it('crea un avatar con sus piezas y deja en null las ranuras vacías', () => {
    const avatar = AvatarConfig.create({ skin: 'medium', hair: 'hair-03', top: 'top-01', bottom: 'bottom-02' });

    expect(avatar.toJSON()).toEqual({
      skin: 'medium',
      hair: 'hair-03',
      hat: null,
      top: 'top-01',
      outer: null,
      bottom: 'bottom-02',
      dress: null,
      shoes: null,
      portrait: null,
    });
  });

  it('rechaza un tono de piel que no existe', () => {
    expect(() => AvatarConfig.create({ skin: 'green' })).toThrow(InvalidAvatarError);
  });

  it('rechaza una pieza en la ranura equivocada o con otro formato', () => {
    expect(() => AvatarConfig.create({ skin: 'light', hair: 'hat-01' })).toThrow(InvalidAvatarError);
    expect(() => AvatarConfig.create({ skin: 'light', shoes: 'shoes-1' })).toThrow(InvalidAvatarError);
    expect(() => AvatarConfig.create({ skin: 'light', top: 42 })).toThrow(InvalidAvatarError);
  });

  it('la foto rápida usa las caras listas (face-NN)', () => {
    expect(AvatarConfig.create({ skin: 'dark', portrait: 'face-12' }).piece('portrait')).toBe('face-12');
    expect(() => AvatarConfig.create({ skin: 'dark', portrait: 'hair-12' })).toThrow(InvalidAvatarError);
  });

  it('un vestido no se combina con parte de arriba ni de abajo', () => {
    expect(() => AvatarConfig.create({ skin: 'light', dress: 'dress-01', top: 'top-02' })).toThrow(InvalidAvatarError);
    expect(() => AvatarConfig.create({ skin: 'light', dress: 'dress-01', bottom: 'bottom-02' })).toThrow(InvalidAvatarError);
    expect(AvatarConfig.create({ skin: 'light', dress: 'dress-01', outer: 'outer-03' }).piece('dress')).toBe('dress-01');
  });

  it('restore devuelve null ante datos guardados que ya no son válidos', () => {
    expect(AvatarConfig.restore(null)).toBeNull();
    expect(AvatarConfig.restore({ skin: 'azul' })).toBeNull();
    expect(AvatarConfig.restore({ skin: 'light', hat: 'hat-07' })?.piece('hat')).toBe('hat-07');
  });
});
