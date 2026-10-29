// Genera el estilo del avatar (issue #136) a partir de Voxel Art de DiceBear (CC0):
// separa el pantalón y el calzado del lienzo en componentes propios, pasa los gorros
// a un componente aparte que va encima del pelo y agrega piezas nuevas hechas con
// las mismas cajitas del estilo. Escribe src/components/avatar/nexus-voxel.json.
//   node client/scripts/build-avatar-style.mjs
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const base = require('@dicebear/styles/voxel-art.json')
const out = fileURLToPath(new URL('../src/components/avatar/nexus-voxel.json', import.meta.url))

const style = structuredClone(base)
const color = (name) => ({ type: 'color', name })
const num = (value) => Number(value.toFixed(2))
const path = (d, fill, extra = {}) => ({ type: 'element', name: 'path', attributes: { d, fill, ...extra } })
const shade = (d, opacity, fill = '#000000') => path(d, fill, { 'fill-opacity': opacity })
const rect = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}z`

/** Una cajita como las de Voxel Art: cara de frente, tapa iluminada y costado en sombra (fondo d). */
function box(x, y, w, h, d, fill, { top = true, side = true } = {}) {
  const dx = num(d)
  const dy = num(-0.8 * d)
  let d0 = `M${x} ${y}h${w}v${h}H${x}Z`
  if (top) d0 += `m0 0h${w}l${dx} ${dy}h${-w}Z`
  if (side) d0 += `m${w} 0 ${dx} ${dy}v${h}l${-dx} ${-dy}Z`
  const elements = [path(d0, fill)]
  if (top) elements.push(shade(`M${x} ${y}h${w}l${dx} ${dy}h${-w}Z`, '.38', '#ffffff'))
  if (side) elements.push(shade(`M${num(x + w)} ${y}l${dx} ${dy}v${h}l${-dx} ${-dy}Z`, '.24'))
  return elements
}

const variant = (elements) => ({ elements })
const component = (variants) => ({ width: 128, height: 128, probability: 100, variants })

// ------------------------------------------------------------ pantalones
// En el original las piernas (y los zapatos) están fijas en el lienzo.
const LEGS = [42, 62]
const leg = (x, fill) => box(x, 103.6, 15, 15, 7, fill)
const legs = (fill) => LEGS.flatMap((x) => leg(x, fill))

const pants = {
  long: legs(color('pants')),
  jeans: [
    ...legs(color('pants')),
    ...LEGS.flatMap((x) => [
      ...box(x - 0.5, 116.1, 16, 2.5, 7, color('pants'), { top: false }),
      shade(rect(x - 0.5, 116.1, 16, 2.5), '.35', '#ffffff'),
      shade(rect(x + 7, 108.6, 0.8, 7.5), '.16'),
    ]),
  ],
  joggers: [
    ...legs(color('pants')),
    ...LEGS.flatMap((x) => [shade(rect(x + 12, 106, 1.6, 10), '.75', '#ffffff'), shade(rect(x, 116.1, 15, 2.5), '.22')]),
  ],
  cargo: [
    ...legs(color('pants')),
    ...[42, 70].flatMap((x) => [shade(rect(x, 109.6, 7, 5.5), '.16'), shade(rect(x, 109.6, 7, 1.5), '.24')]),
  ],
  shorts: LEGS.flatMap((x) => [...leg(x, color('skin')), ...box(x - 0.5, 103.6, 16, 9, 7, color('pants'))]),
  skirt: [
    ...legs(color('skin')),
    ...box(37.5, 104.6, 44, 12, 8, color('pants')),
    shade('M45 108.6h1v8h-1zm9 0h1v8h-1zm9 0h1v8h-1zm9 0h1v8h-1z', '.16'),
  ],
}

// ------------------------------------------------------------ calzado
// Va debajo de las piernas (como en el original); la caña de las botas va encima.
const FEET = [41, 61]
const sole = (x, fill) => box(x, 121.9, 15, 2.5, 8.5, fill)
const upper = (x, fill) => box(x + 0.5, 119, 15, 5, 8, fill)

const shoes = {
  classic: FEET.flatMap((x) => [...sole(x, color('shoes')), ...upper(x, color('shoes'))]),
  sneakers: FEET.flatMap((x) => [
    ...sole(x, '#f1f3f5'),
    ...upper(x, color('shoes')),
    shade(rect(x + 4.5, 119.6, 7, 1.4), '.8', '#ffffff'),
  ]),
  boots: FEET.flatMap((x) => [...sole(x, '#3b2f2f'), ...upper(x, color('shoes'))]),
  sandals: FEET.flatMap((x) => [
    ...sole(x, color('shoes')),
    ...upper(x, color('skin')),
    path(rect(x + 0.5, 120.2, 15, 1.6), color('shoes')),
  ]),
}
const shoesOver = {
  classic: [],
  sneakers: [],
  sandals: [],
  boots: LEGS.flatMap((x) => [
    ...box(x - 0.5, 111.6, 16, 7.5, 7, color('shoes'), { top: false }),
    shade(rect(x - 0.5, 111.6, 16, 1.5), '.18'),
  ]),
}

// ------------------------------------------------------------ torso
const outfit = style.components.outfit.variants
const isSleeve = (element) => typeof element.attributes?.d === 'string' && /^M(32\.5|80) 85\.7/.test(element.attributes.d)
const recolorSleeves = (elements, fill) =>
  elements.map((element) => (isSleeve(element) && element.attributes.fill?.name === 'shirt' ? { ...element, attributes: { ...element.attributes, fill } } : element))

outfit.tank = variant([
  ...recolorSleeves(structuredClone(outfit.plain.elements), color('skin')),
  path(rect(51.5, 83.6, 16, 4), color('skin')),
  shade(rect(51.5, 83.6, 16, 4), '.08'),
])
outfit.vest = variant([
  ...structuredClone(outfit.plain.elements),
  ...box(39.5, 83.6, 13, 25, 7, color('jacket'), { side: false }),
  ...box(66.5, 83.6, 13, 25, 7, color('jacket')),
  shade('M48 90h2v2h-2zm0 6h2v2h-2zm0 6h2v2h-2z', '.25'),
])
outfit.jersey = variant([
  ...recolorSleeves(structuredClone(outfit.plain.elements), color('jacket')),
  path(rect(39.5, 95, 40, 3), '#ffffff', { 'fill-opacity': '.85' }),
  path(rect(51.5, 83.6, 16, 2.5), color('jacket')),
])

// ------------------------------------------------------------ gorros
// En el original los gorros son variantes de "top" (reemplazan el pelo). Aquí
// salen a su propio componente, encima del pelo.
const top = style.components.top.variants
const FROM_TOP = ['cap', 'beanie', 'animalEars', 'bunnyEars']
const hats = Object.fromEntries(FROM_TOP.map((id) => [id, top[id].elements]))
for (const id of FROM_TOP) delete top[id]

hats.backwardsCap = [
  ...box(24.5, 23.1, 65, 12.5, 12.5, color('hat')),
  shade(rect(24.5, 33.1, 65, 2.5), '.16'),
  path(rect(51, 28.6, 16, 5), color('hair')),
  shade(rect(51, 28.6, 16, 5), '.35'),
  shade(rect(51, 27.6, 16, 1), '.25'),
]
hats.beret = [
  ...box(22, 25.1, 70, 8, 15, color('hat')),
  shade(rect(22, 31.1, 70, 2), '.14'),
  ...box(62, 10.1, 4, 3, 3, color('hat')),
]
hats.sunHat = [
  ...box(13, 34.1, 88, 3.5, 22, color('hat')),
  ...box(30.5, 17.1, 56, 17, 13, color('hat')),
  shade(rect(30.5, 28.6, 56, 4), '.3'),
]
hats.helmet = [
  shade(rect(29, 41.6, 60, 2), '.16'),
  ...box(25.5, 21.1, 67, 20.5, 13, color('hat')),
  path(rect(55, 21.1, 7, 20.5), '#ffffff', { 'fill-opacity': '.7' }),
  path('M55 21.1h7l10.4-8.32h-7z', '#ffffff', { 'fill-opacity': '.7' }),
  shade(rect(25.5, 38.1, 67, 3.5), '.22'),
]
hats.headband = [...box(28, 32.6, 62, 4, 10.5, color('hat')), shade(rect(28, 35.6, 62, 1), '.15')]
hats.crown = [
  ...box(39, 18.6, 40, 7, 10, '#f5c542'),
  ...[39, 56.5, 74].flatMap((x) => box(x, 13.6, 5, 5, 4, '#f5c542')),
  path('M45 20.6h3v3h-3zm12.5 0h3v3h-3zm12.5 0h3v3h-3z', '#e03131'),
]

const HAT_LINE = 36

// Cada peinado tiene su versión "bajo gorro": lo que asoma por los lados y por detrás.
for (const [id, value] of Object.entries({ ...top })) {
  top[`${id}UnderHat`] = variant([
    {
      type: 'element',
      name: 'defs',
      children: [
        {
          type: 'element',
          name: 'clipPath',
          attributes: { id: 'under-hat' },
          children: [{ type: 'element', name: 'path', attributes: { d: rect(0, HAT_LINE, 128, 128 - HAT_LINE) } }],
        },
      ],
    },
    { type: 'element', name: 'g', attributes: { 'clip-path': 'url(#under-hat)' }, children: structuredClone(value.elements) },
  ])
}

style.components.pants = component(Object.fromEntries(Object.entries(pants).map(([id, elements]) => [id, variant(elements)])))
style.components.shoes = component(Object.fromEntries(Object.entries(shoes).map(([id, elements]) => [id, variant(elements)])))
style.components.shoesOver = component(Object.fromEntries(Object.entries(shoesOver).map(([id, elements]) => [id, variant(elements)])))
style.components.hat = component(Object.fromEntries(Object.entries(hats).map(([id, elements]) => [id, variant(elements)])))

// Lienzo: sombra del piso, calzado, pantalón, caña de las botas y la parte de arriba;
// el gorro va después del pelo.
const elements = style.canvas.elements
const upperIndex = elements.findIndex((element) => element.attributes?.class === 'va-upper')
if (upperIndex < 0) throw new Error('No encontré el grupo va-upper de Voxel Art.')
const ref = (name) => ({ type: 'component', name })
style.canvas.elements = [elements[0], ref('shoes'), ref('pants'), ref('shoesOver'), ...elements.slice(upperIndex)]
const upperGroup = style.canvas.elements.at(-1)
const topIndex = upperGroup.children.findIndex((element) => element.type === 'component' && element.name === 'top')
upperGroup.children.splice(topIndex + 1, 0, ref('hat'))

style.$comment = 'Generado por client/scripts/build-avatar-style.mjs a partir de Voxel Art de DiceBear (CC0). No editar a mano.'
writeFileSync(out, JSON.stringify(style))
console.log(`Estilo escrito en ${out}`)
console.log('pants', Object.keys(pants).join(','))
console.log('shoes', Object.keys(shoes).join(','))
console.log('outfit', Object.keys(outfit).join(','))
console.log('hat', Object.keys(hats).join(','))
