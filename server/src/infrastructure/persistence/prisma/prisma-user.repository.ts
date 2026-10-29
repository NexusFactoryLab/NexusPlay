import { Injectable } from '@nestjs/common';
import type {
  FindAllUsersFilter,
  PaginatedResult,
  UserRepository,
} from '../../../domain/ports/user.repository.port.js';
import type { User } from '../../../domain/entities/user.entity.js';
import type { Email } from '../../../domain/value-objects/email.vo.js';
import { PrismaService } from './prisma.service.js';
import { UserMapper, type UserModelWithRole } from './user.mapper.js';
import { TtlCache } from '../../cache/ttl-cache.js';

/**
 * `findById` corre en cada petición autenticada (guard) y otra vez en los
 * casos de uso que resuelven el rol. Se guarda el registro crudo —no la
 * entidad, que es mutable— y se mapea a una entidad nueva en cada lectura.
 * TTL corto + invalidación en `save`/`delete`: una desactivación o cambio de
 * rol surte efecto de inmediato en este proceso.
 */
const USER_CACHE_TTL_MS = 15_000;
const userByIdCache = new TtlCache<UserModelWithRole | null>(USER_CACHE_TTL_MS, 5000);

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<void> {
    const { roleName, ...data } = UserMapper.toPersistence(user);
    const role = await this.prisma.roleModel.findUniqueOrThrow({ where: { name: roleName } });
    const payload = { ...data, roleId: role.id };

    await this.prisma.userModel.upsert({
      where: { id: payload.id },
      create: payload,
      update: payload,
    });
    userByIdCache.invalidate(payload.id);
  }

  async findById(id: string): Promise<User | null> {
    const record = await userByIdCache.getOrLoad(id, () =>
      this.prisma.userModel.findUnique({ where: { id }, include: { role: true } }),
    );
    return record ? UserMapper.toDomain(record) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const records = await this.prisma.userModel.findMany({
      where: { id: { in: ids } },
      include: { role: true },
    });
    return records.map(UserMapper.toDomain);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const record = await this.prisma.userModel.findUnique({
      where: { email: email.getValue() },
      include: { role: true },
    });
    return record ? UserMapper.toDomain(record) : null;
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const count = await this.prisma.userModel.count({
      where: { email: email.getValue() },
    });
    return count > 0;
  }

  async findAll(filter: FindAllUsersFilter): Promise<PaginatedResult<User>> {
    const where = {
      ...(filter.role ? { role: { name: filter.role } } : {}),
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.search
        ? {
            OR: [
              { displayName: { contains: filter.search, mode: 'insensitive' as const } },
              { email: { contains: filter.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [records, total] = await Promise.all([
      this.prisma.userModel.findMany({
        where,
        include: { role: true },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userModel.count({ where }),
    ]);

    return {
      items: records.map(UserMapper.toDomain),
      total,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.userModel.delete({ where: { id } });
    userByIdCache.invalidate(id);
  }
}
