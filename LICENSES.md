# Licencias de terceros

NexusPlay usa las bibliotecas de código abierto listadas abajo. Cada una conserva su licencia y sus derechos de autor originales. Este archivo no cambia esas licencias.

El código propio de NexusPlay está bajo los términos descritos en el [README](README.md#aviso-legal).

> Lista basada en las dependencias directas declaradas en `client/package.json` y `server/package.json`. Las licencias son las que publica cada proyecto en npm. Verifícalas antes de cada release; el comando está al final de este archivo.

## Frontend (`client`)

| Paquete | Licencia |
|---------|----------|
| react, react-dom | MIT |
| react-router-dom | MIT |
| socket.io-client | MIT |
| pixi.js | MIT |
| matter-js | MIT |
| tailwindcss, @tailwindcss/vite | MIT |
| @vercel/analytics | MIT |
| lucide-react | ISC |
| qrcode.react | ISC |
| jsqr (desarrollo) | Apache-2.0 |
| typescript (desarrollo) | Apache-2.0 |
| vite, @vitejs/plugin-react, vitest, oxlint (desarrollo) | MIT |
| @types/* (desarrollo) | MIT |

## Backend (`server`)

| Paquete | Licencia |
|---------|----------|
| @nestjs/* (common, core, jwt, platform-express, platform-socket.io, websockets) | MIT |
| socket.io | MIT |
| @prisma/client, @prisma/adapter-pg | Apache-2.0 |
| mongodb | Apache-2.0 |
| @google/genai | Apache-2.0 |
| google-auth-library | Apache-2.0 |
| pdf-parse | Apache-2.0 |
| reflect-metadata | Apache-2.0 |
| rxjs | Apache-2.0 |
| bcrypt | MIT |
| class-transformer, class-validator | MIT |
| cloudinary | MIT |
| cookie-parser | MIT |
| csv-parse | MIT |
| exceljs | MIT |
| multer | MIT |
| dotenv | BSD-2-Clause |
| mammoth | BSD-2-Clause |

## Servicios y contenido externo

Estos servicios no se distribuyen con el código y se rigen por sus propios términos de uso:

- Google Identity Services y Google AI Studio (Gemini)
- Groq
- Cloudinary
- Wikipedia y Wikimedia Commons: cada imagen mantiene su licencia y atribución (por ejemplo, Creative Commons)
- Railway, Vercel, Neon y MongoDB Atlas (infraestructura)

## Obligaciones habituales

- **MIT, ISC y BSD:** conservar el aviso de copyright y el texto de la licencia en las copias distribuidas.
- **Apache-2.0:** conservar los avisos de licencia y `NOTICE`, e indicar los cambios hechos a los archivos.

Si distribuyes el software (por ejemplo, en una imagen Docker pública), incluye los textos completos de licencia de las dependencias.

## Regenerar y verificar esta lista

Las dependencias transitivas no están en este archivo. Para obtener el listado completo y detectar licencias problemáticas (por ejemplo GPL):

```bash
npm install
npx license-checker --production --summary
npx license-checker --production --csv > licenses-full.csv
```

## Imágenes de los juegos del Sylabus (Wikimedia Commons)

Los gráficos de los juegos «Sylabus» (`server/prisma/sylabus-games.ts`) provienen de Wikimedia Commons, se rasterizaron a PNG sobre fondo blanco y se alojan en Cloudinary. Conservan su autoría y licencia originales (el manifiesto completo está en `server/prisma/sylabus-images.json`).

| Archivo | Autoría | Licencia | Fuente |
|---|---|---|---|
| Histogram shape - symmetric, unimodal.svg | Derek Jansen | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Histogram_shape_-_symmetric%2C_unimodal.svg) |
| Histogram shape - bimodal.svg | Derek Jansen | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Histogram_shape_-_bimodal.svg) |
| Histogram shape - multimodal.svg | Derek Jansen | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Histogram_shape_-_multimodal.svg) |
| Histogram shape - skewed right.svg | Derek Jansen | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Histogram_shape_-_skewed_right.svg) |
| Histogram shape - skewed left.svg | Derek Jansen | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Histogram_shape_-_skewed_left.svg) |
| Box plot with interquartile range and outliers.svg | Derek Jansen | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Box_plot_with_interquartile_range_and_outliers.svg) |
| Ggplot2 scatter plot.svg | Colohisto | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Ggplot2_scatter_plot.svg) |
| Pie-chart.svg | Morpheus7377 | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:Pie-chart.svg) |
| Pareto Chart Example.png | Dense2013 | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Pareto_Chart_Example.png) |
| Normal Distribution PDF.svg | Inductiveload | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Normal_Distribution_PDF.svg) |
| Stem-and-leaf plot of 25 exam scores.svg | Derek Jansen | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Stem-and-leaf_plot_of_25_exam_scores.svg) |
| Blank Venn diagram purple green orange 01.svg | User:Amousey | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Blank_Venn_diagram_purple_green_orange_01.svg) |
| Three fair coin flips tree diagram.svg | TealComet | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:Three_fair_coin_flips_tree_diagram.svg) |
| Bayes' Theorem 2D.svg | Qniemiec | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Bayes'_Theorem_2D.svg) |
