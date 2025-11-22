import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';

interface AuthPayloadUser {
  id: number;
  role: string;
  username: string;
  name?: string;
  store_id?: number | null;
  store_name?: string | null;
  store_code?: string | null;
  roles?: string[];
  permissions?: string[];
}

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService, @InjectRepository(User) private readonly userRepo: Repository<User>) {}

  async validateUser(username: string, password: string): Promise<any> {
    const dbUser = await this.userRepo.findOne({
      where: { username },
      relations: ['store', 'userRoles', 'userRoles.role', 'userRoles.role.rolePermissions', 'userRoles.role.rolePermissions.permission'],
    });
    if (!dbUser) {
      throw new UnauthorizedException('Pogrešno korisničko ime ili lozinka');
    }

    const isActive = (dbUser.active ?? dbUser.is_active) !== false;
    if (!isActive) throw new UnauthorizedException('Nalog je deaktiviran');

    if (!dbUser.password_hash) {
      throw new UnauthorizedException('Nalog nema postavljenu lozinku. Kontaktirajte administratora.');
    }

    // use require to avoid TS/ESM dynamic import typing issues in container
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bcrypt = require('bcryptjs');
    const ok = await bcrypt.compare(password, dbUser.password_hash);
    if (!ok) throw new UnauthorizedException('Pogrešno korisničko ime ili lozinka');

    const fullName = (dbUser as any).full_name || (dbUser as any).name || dbUser.username;
    const roles = this.extractRoles(dbUser);
    const permissions = this.extractPermissions(dbUser);
    const roleNormalized = (roles[0] || dbUser.role || 'admin').toUpperCase();
    const payload: AuthPayloadUser = {
      id: dbUser.id,
      username: dbUser.username,
      role: roleNormalized,
      name: fullName,
      store_id: dbUser.store_id || null,
      store_name: dbUser.store?.name || null,
      store_code: dbUser.store?.code || null,
      roles,
      permissions,
    };
    const accessToken = this.generateToken({
      id: payload.id,
      username: payload.username,
      role: payload.role,
      fullName: payload.name,
      storeId: payload.store_id ?? null,
      roles,
      permissions,
    });
    return { accessToken, token: accessToken, user: payload };
  }

  async validateToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token);
      // Prefer real DB users
      const dbUser = await this.userRepo.findOne({
        where: { id: payload.sub },
        relations: ['store', 'userRoles', 'userRoles.role', 'userRoles.role.rolePermissions', 'userRoles.role.rolePermissions.permission'],
      });
      if (!dbUser) throw new UnauthorizedException('Invalid token');
      const isActive = (dbUser.active ?? dbUser.is_active) !== false;
      if (!isActive) throw new UnauthorizedException('Nalog je deaktiviran');
      const roles = this.extractRoles(dbUser);
      const permissions = this.extractPermissions(dbUser);
      return {
        id: dbUser.id,
        username: dbUser.username,
        role: (roles[0] || dbUser.role || 'admin').toUpperCase(),
        roles,
        permissions,
        name: (dbUser as any).full_name || (dbUser as any).name,
        store_id: dbUser.store_id || null,
        store_name: dbUser.store?.name || null,
        store_code: dbUser.store?.code || null,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private generateToken(user: { id: number; username: string; role: string; fullName?: string; storeId?: number | null; roles?: string[]; permissions?: string[] }): string {
    const payload = {
      sub: user.id,
      username: user.username,
      role: (user.role || '').toUpperCase(),
      fullName: user.fullName || user.username,
      storeId: user.storeId ?? null,
      roles: (user.roles || []).map(r => (r || '').toUpperCase()),
      permissions: user.permissions || [],
    };
    return this.jwtService.sign(payload);
  }

  hasRole(user: any, requiredRoles: string[]): boolean {
    const normalized = (user?.role || '').toLowerCase();
    return requiredRoles.map(r => r.toLowerCase()).includes(normalized);
  }

  private extractRoles(user: User): string[] {
    const list: string[] = [];
    if (user.role) list.push(user.role);
    if (Array.isArray(user.userRoles)) {
      for (const ur of user.userRoles) {
        const r = (ur as any).role as Role | undefined;
        if (r?.name) list.push(r.name);
      }
    }
    return Array.from(new Set(list.map(r => (r || '').toUpperCase())));
  }

  private extractPermissions(user: User): string[] {
    const perms: string[] = [];
    if (Array.isArray(user.userRoles)) {
      for (const ur of user.userRoles) {
        const role = (ur as any).role as Role | undefined;
        if (role?.rolePermissions) {
          for (const rp of role.rolePermissions) {
            const p = (rp as any).permission as Permission | undefined;
            if (p?.name) perms.push(p.name);
          }
        }
      }
    }
    return Array.from(new Set(perms));
  }
}
