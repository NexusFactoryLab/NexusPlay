import 'dotenv/config';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { DomainExceptionFilter } from './infrastructure/http/filters/domain-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Comprime las respuestas JSON (listados de juegos y áreas): menos bytes
  // por petición y menos tráfico saliente del servidor.
  app.use(compression());
  // Los GET llevan datos por usuario: ningún proxy compartido debe
  // guardarlos, y el navegador siempre revalida con el ETag que Express ya
  // genera (si no cambió, responde 304 sin cuerpo).
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') res.setHeader('Cache-Control', 'private, no-cache');
    next();
  });
  app.use(cookieParser());
  // Sin límite explícito, Express deja pasar bodies grandes hasta agotar
  // memoria antes de que la validación de aplicación (ej. tope de 200
  // parejas en un juego) tenga oportunidad de rechazarlos.
  app.useBodyParser('json', { limit: '512kb' });

  // El cliente de Vite corre en otro origen y necesita CORS para el login.
  // El refresh token viaja en una cookie httpOnly: el navegador solo la
  // envía en peticiones cross-origin si el servidor declara credentials.
  app.enableCors({
    // Se normaliza (espacios y "/" final) porque el header Origin del
    // navegador nunca lleva barra final y la comparación es exacta.
    origin:
      process.env.CORS_ORIGIN?.split(',').map((o) =>
        o.trim().replace(/\/+$/, ''),
      ) ?? 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new DomainExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
