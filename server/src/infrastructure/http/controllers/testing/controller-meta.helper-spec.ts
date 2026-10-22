// Ayudas para probar controladores sin levantar Nest: el repo corre vitest sobre esbuild, que no emite la
// metadata de decoradores que necesita la inyección de dependencias de Nest. Por eso los controladores se
// instancian a mano con casos de uso falsos y se inspeccionan sus decoradores (ruta, método, código HTTP,
// guards y roles); el cuerpo se valida con el mismo `ValidationPipe` de `main.ts`, y los guards reales
// (`RolesGuard`) se ejecutan con un contexto falso.
import 'reflect-metadata';
import { RequestMethod, ValidationPipe, type ExecutionContext, type Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../guards/roles.guard.js';
import { ROLES_METADATA_KEY } from '../../decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { DomainExceptionFilter } from '../../filters/domain-exception.filter.js';

const METHOD_NAME: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
};

/** Verbo, ruta (relativa al controlador) y código HTTP de éxito declarados para un handler. */
export function routeOf(controller: Type, handler: string): { method: string; path: string; status: number | undefined } {
  const fn = controller.prototype[handler] as (...args: unknown[]) => unknown;
  const method = Reflect.getMetadata('method', fn) as number;
  return {
    method: METHOD_NAME[method],
    path: Reflect.getMetadata('path', fn) as string,
    status: Reflect.getMetadata('__httpCode__', fn) as number | undefined,
  };
}

export function controllerPath(controller: Type): string {
  return Reflect.getMetadata('path', controller) as string;
}

/** Guards declarados con `@UseGuards` a nivel de clase, en orden. */
export function guardsOf(controller: Type): unknown[] {
  return (Reflect.getMetadata('__guards__', controller) as unknown[]) ?? [];
}

export function rolesOf(controller: Type): string[] | undefined {
  return Reflect.getMetadata(ROLES_METADATA_KEY, controller) as string[] | undefined;
}

export { JwtAuthGuard };

/** Valida un cuerpo como lo haría Nest (whitelist + forbidNonWhitelisted + transform); lanza 400 si no es válido. */
export async function validateBody<T>(dto: Type<T>, body: unknown): Promise<T> {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  return (await pipe.transform(body, { type: 'body', metatype: dto })) as T;
}

/** Igual que `validateBody` pero para la query string (`@Query()`). */
export async function validateQuery<T>(dto: Type<T>, query: unknown): Promise<T> {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  return (await pipe.transform(query, { type: 'query', metatype: dto })) as T;
}

/**
 * Corre el `RolesGuard` REAL contra el handler del controlador, con un usuario del rol indicado
 * (o inexistente si `role` es `null`). Devuelve `true` si lo deja pasar y lanza `ForbiddenException` si no.
 */
export async function runRolesGuard(controller: Type, handler: string, role: string | null): Promise<boolean> {
  const users = {
    findById: async () => (role ? { role: { getName: () => role }, isAdmin: () => role === 'ADMIN' } : null),
  };
  const guard = new RolesGuard(new Reflector(), users as never, { findMembership: async () => null } as never);
  const context = {
    getHandler: () => controller.prototype[handler],
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ userId: 'u-1', params: {} }) }),
  } as unknown as ExecutionContext;
  return guard.canActivate(context);
}

/** Respuesta HTTP que produciría `DomainExceptionFilter` para un error de dominio/aplicación. */
export function filterResponse(error: Error): { status: number; body: Record<string, unknown> } {
  let status = 0;
  let body: Record<string, unknown> = {};
  const response = {
    status(code: number) {
      status = code;
      return { json: (payload: Record<string, unknown>) => (body = payload) };
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => response }) };
  new DomainExceptionFilter().catch(error as never, host as never);
  return { status, body };
}
