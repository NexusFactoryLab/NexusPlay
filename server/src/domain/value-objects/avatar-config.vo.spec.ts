import { describe, expect, it } from 'vitest';
import { AvatarConfig } from './avatar-config.vo.js';
import { InvalidAvatarError } from '../errors/user.errors.js';

const VALID_AVATAR = {
  top: 'short',
  hat: null,
  hairColor: '5a3825',
  hatColor: 'e64980',
  skinColor: 'eab890',
  outfit: 'jacket',
  pants: 'jeans',
  shoes: 'sneakers',
  shirtColor: 'f2f2f2',
  jacketColor: '6b4f3a',
  pantsColor: '3b5b8c',
  shoesColor: 'e03131',
  eyes: 'open',
  eyebrows: 'soft',
  mouth: 'smile',
  nose: 'small',
  cheeks: 'blush',
  glasses: null,
  beard: null,
};

describe('AvatarConfig (issues #77 y #136, Voxel Art)', () => {
  it('acepta un avatar válido y devuelve todas sus opciones', () => {
    expect(AvatarConfig.create(VALID_AVATAR).toJSON()).toEqual(VALID_AVATAR);
  });

  it('las opciones opcionales vacías quedan en null', () => {
    const avatar = AvatarConfig.create({ ...VALID_AVATAR, top: '', eyebrows: undefined, cheeks: null });
    expect(avatar.get('top')).toBeNull();
    expect(avatar.get('eyebrows')).toBeNull();
    expect(avatar.get('cheeks')).toBeNull();
  });

  it('rechaza variantes que no existen en el estilo', () => {
    expect(() => AvatarConfig.create({ ...VALID_AVATAR, outfit: 'cape' })).toThrow(InvalidAvatarError);
    expect(() => AvatarConfig.create({ ...VALID_AVATAR, top: 'corona' })).toThrow(InvalidAvatarError);
    expect(() => AvatarConfig.create({ ...VALID_AVATAR, hat: 'afro' })).toThrow(InvalidAvatarError);
    expect(() => AvatarConfig.create({ ...VALID_AVATAR, pants: 'capa' })).toThrow(InvalidAvatarError);
    expect(() => AvatarConfig.create({ ...VALID_AVATAR, shoes: 'patines' })).toThrow(InvalidAvatarError);
    expect(() => AvatarConfig.create({ ...VALID_AVATAR, eyes: undefined })).toThrow(InvalidAvatarError);
  });

  it('rechaza colores que no son hexadecimales de 6 dígitos sin "#"', () => {
    expect(() => AvatarConfig.create({ ...VALID_AVATAR, skinColor: '#eab890' })).toThrow(InvalidAvatarError);
    expect(() => AvatarConfig.create({ ...VALID_AVATAR, shirtColor: 'red' })).toThrow(InvalidAvatarError);
    expect(() => AvatarConfig.create({ ...VALID_AVATAR, pantsColor: 'ABCDEF' })).toThrow(InvalidAvatarError);
  });

  it('el gorro va encima del pelo: se pueden tener los dos', () => {
    const avatar = AvatarConfig.create({ ...VALID_AVATAR, top: 'longWavy', hat: 'cap' });
    expect(avatar.get('top')).toBe('longWavy');
    expect(avatar.get('hat')).toBe('cap');
  });

  it('un avatar de antes de #136 se actualiza: gorro encima del peinado, pantalón y calzado por defecto', () => {
    const { hat: _hat, pants: _pants, shoes: _shoes, ...legacy } = VALID_AVATAR;
    const avatar = AvatarConfig.restore({ ...legacy, top: 'beanie' });
    expect(avatar?.toJSON()).toMatchObject({ top: 'short', hat: 'beanie', pants: 'long', shoes: 'classic' });
    expect(AvatarConfig.restore({ ...legacy, top: 'partedLong' })?.get('top')).toBe('longStraight');
    expect(AvatarConfig.restore({ ...legacy, glasses: 'square' })?.get('glasses')).toBe('round');
  });

  it('restore devuelve null ante datos guardados que ya no son válidos (formato anterior)', () => {
    expect(AvatarConfig.restore(null)).toBeNull();
    expect(AvatarConfig.restore({ skin: 'light', hair: 'hair-01' })).toBeNull();
    expect(AvatarConfig.restore(VALID_AVATAR)?.get('outfit')).toBe('jacket');
  });
});
