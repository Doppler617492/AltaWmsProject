import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { JwtService } from '@nestjs/jwt';

interface AuthPayloadUser {
  id: number;
  role: string;
  username: string;
  name?: string;
  store_id?: number | null;
  store_name?: string | null;
  store_code?: string | null;
}

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService, @InjectRepository(User) private readonly userRepo: Repository<User>) {}

  async validateUser(username: string, password: string): Promise<any> {
    const dbUser = await this.userRepo.findOne({ where: { username }, relations: ['store'] });
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
    const payload: AuthPayloadUser = {
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
      name: fullName,
      store_id: dbUser.store_id || null,
      store_name: dbUser.store?.name || null,
      store_code: dbUser.store?.code || null,
    };
    const accessToken = this.generateToken({ id: payload.id, username: payload.username, role: payload.role, fullName: payload.name, storeId: payload.store_id ?? null });
    return { accessToken, token: accessToken, user: payload };
  }

  async validateToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token);
      // Prefer real DB users
      const dbUser = await this.userRepo.findOne({ where: { id: payload.sub }, relations: ['store'] });
      if (!dbUser) throw new UnauthorizedException('Invalid token');
      const isActive = (dbUser.active ?? dbUser.is_active) !== false;
      if (!isActive) throw new UnauthorizedException('Nalog je deaktiviran');
      return { id: dbUser.id, username: dbUser.username, role: dbUser.role, name: (dbUser as any).full_name || (dbUser as any).name, store_id: dbUser.store_id || null, store_name: dbUser.store?.name || null, store_code: dbUser.store?.code || null };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private generateToken(user: { id: number; username: string; role: string; fullName?: string; storeId?: number | null }): string {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName || user.username,
      storeId: user.storeId ?? null,
    };
    return this.jwtService.sign(payload);
  }

  hasRole(user: any, requiredRoles: string[]): boolean {
    const normalized = (user?.role || '').toLowerCase();
    return requiredRoles.map(r => r.toLowerCase()).includes(normalized);
  }
}
