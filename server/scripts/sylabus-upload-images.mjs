// Descarga gráficos estadísticos de Wikimedia Commons y los sube a Cloudinary para los
// juegos del Sylabus "El poder de las probabilidades" (FFPO0005).
//
// Solo descarga de commons.wikimedia.org (lista fija de archivos, nada que venga de entrada
// externa), valida que la respuesta sea una imagen y escribe un manifiesto con la URL de
// Cloudinary + autoría + licencia de cada una (las licencias CC exigen atribución).
//
// Uso: node scripts/sylabus-upload-images.mjs [--env ruta/.env] [--out prisma/sylabus-images.json]
// Es idempotente: el public_id es fijo, así que volver a correrlo sobrescribe, no duplica.
import { writeFileSync } from 'node:fs';
import { config } from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);

config({ path: option('--env', '.env') });
const outFile = option('--out', 'prisma/sylabus-images.json');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const USER_AGENT = 'NexusPlay-Sylabus/1.0 (contenido educativo; juans@nexusfactorylab)';
const MAX_BYTES = 8 * 1024 * 1024;

/** key → archivo en Commons. */
const FILES = {
  'histograma-simetrico': 'Histogram shape - symmetric, unimodal.svg',
  'histograma-bimodal': 'Histogram shape - bimodal.svg',
  'histograma-multimodal': 'Histogram shape - multimodal.svg',
  'histograma-sesgo-derecha': 'Histogram shape - skewed right.svg',
  'histograma-sesgo-izquierda': 'Histogram shape - skewed left.svg',
  'diagrama-caja-atipicos': 'Box plot with interquartile range and outliers.svg',
  'diagrama-dispersion': 'Scatter plot.jpg',
  'grafico-circular': 'Pie-chart.svg',
  'diagrama-pareto': 'Pareto Chart Example.png',
  'distribucion-normal': 'Normal Distribution PDF.svg',
  'tallo-y-hojas': 'Stem-and-leaf plot of 25 exam scores.svg',
  'diagrama-venn': 'Blank Venn diagram purple green orange 01.svg',
  'grafico-barras': 'Bar Chart Showing South African Internet Usage by Year.png',
  'arbol-probabilidad': 'Probability tree diagram.svg',
  'teorema-bayes': "Bayes' Theorem 2D.svg",
};

async function commonsInfo(title) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query',
    titles: `File:${title}`,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiextmetadatafilter: 'LicenseShortName|Artist|LicenseUrl',
    format: 'json',
  });
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Commons API ${res.status} para ${title}`);
  const page = Object.values((await res.json()).query.pages)[0];
  const info = page.imageinfo?.[0];
  if (!info) throw new Error(`No existe en Commons: ${title}`);
  const meta = info.extmetadata ?? {};
  return {
    sourceUrl: info.url,
    pageUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title.replace(/ /g, '_'))}`,
    license: meta.LicenseShortName?.value ?? 'desconocida',
    author: (meta.Artist?.value ?? 'desconocido').replace(/<[^>]*>/g, '').trim(),
  };
}

async function download(sourceUrl) {
  const host = new URL(sourceUrl).hostname;
  if (host !== 'upload.wikimedia.org') throw new Error(`Host no permitido: ${host}`);
  let res;
  // Commons responde 429 si se descarga rápido: se respeta Retry-After y se reintenta.
  for (let attempt = 1; attempt <= 6; attempt++) {
    res = await fetch(sourceUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (res.status !== 429) break;
    const wait = Number(res.headers.get('retry-after')) || 10 * attempt;
    console.log(`  429, reintento ${attempt} en ${wait}s`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  if (!res.ok) throw new Error(`Descarga ${res.status}: ${sourceUrl}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`No es una imagen (${type}): ${sourceUrl}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error(`Imagen demasiado grande (${buffer.length} bytes): ${sourceUrl}`);
  return buffer;
}

function upload(buffer, key) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: 'nexusplay/sylabus',
          public_id: key,
          overwrite: true,
          resource_type: 'image',
          // Se rasteriza a PNG (los SVG de Commons pueden traer fuentes que el navegador no tiene) y
          // se centra sobre blanco 4:3 para que todas las tarjetas se vean parejas.
          format: 'png',
          transformation: [{ width: 800, height: 600, crop: 'pad', background: 'white' }],
          tags: ['sylabus', 'ffpo0005'],
        },
        (error, result) => (error || !result ? reject(error ?? new Error('Cloudinary sin resultado')) : resolve(result)),
      )
      .end(buffer);
  });
}

const manifest = {};
for (const [key, title] of Object.entries(FILES)) {
  const info = await commonsInfo(title);
  const result = await upload(await download(info.sourceUrl), key);
  manifest[key] = { url: result.secure_url, title, ...info };
  console.log(`OK ${key} -> ${result.secure_url} (${info.license})`);
  await new Promise((r) => setTimeout(r, 4000));
}

writeFileSync(outFile, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Manifiesto escrito en ${outFile} (${Object.keys(manifest).length} imágenes).`);
