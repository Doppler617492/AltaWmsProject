import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { JwtService } from '@nestjs/jwt';

interface AuthPayloadUser {
  id: number;
  name: string;
  role: string;
  username: string;
}

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService, @InjectRepository(User) private readonly userRepo: Repository<User>) {}
  private users: AuthPayloadUser[] = [
    { id: 1, name: 'System Admin', role: 'admin', username: 'admin' },
    { id: 2, name: 'Magacioner', role: 'magacioner', username: 'magacioner' },
    { id: 3, name: 'Menadžer Skladišta', role: 'menadzer', username: 'menadzer' },
    { id: 4, name: 'Šef Skladišta', role: 'sef_magacina', username: 'sef' },
    { id: 5, name: 'Komercijalista', role: 'komercijalista', username: 'komercijalista' },
  ];

  async validateUser(username: string, password: string): Promise<any> {
    // Prefer DB users if present
    const dbUser = await this.userRepo.findOne({ where: { username }, relations: ['store'] });
    if (dbUser) {
      // must be active
      const isActive = (dbUser.active ?? dbUser.is_active) !== false;
      if (!isActive) throw new UnauthorizedException('Nalog je deaktiviran');
      // verify password hash if present, else accept default 'admin' only
      if (dbUser.password_hash) {
        // use require to avoid TS/ESM dynamic import typing issues in container
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const bcrypt = require('bcryptjs');
        const ok = await bcrypt.compare(password, dbUser.password_hash);
        if (!ok) throw new UnauthorizedException('Pogrešno korisničko ime ili lozinka');
      } else if (password !== 'admin') {
        throw new UnauthorizedException('Pogrešno korisničko ime ili lozinka');
      }
      const fullName = (dbUser as any).full_name || (dbUser as any).name || dbUser.username;
      const token = this.generateToken({ id: dbUser.id, role: dbUser.role as any, username: dbUser.username, fullName, storeId: dbUser.store_id || null });
      return { token, user: { id: dbUser.id, name: fullName, role: dbUser.role, username: dbUser.username, store_id: dbUser.store_id || null, store_name: dbUser.store?.name || null, store_code: dbUser.store?.code || null } };
    }
    // Fallback to built-in demo users
    const user = this.users.find(u => u.username === username);
    if (user && password === 'admin') {
      const token = this.generateToken({ id: user.id, username: user.username, role: user.role, fullName: user.name, storeId: null });
      return { token, user: { ...user, store_id: null, store_name: null, store_code: null } };
    }
    throw new UnauthorizedException('Pogrešno korisničko ime ili lozinka');
  }

  async validateToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token);
      // Prefer real DB users
      const dbUser = await this.userRepo.findOne({ where: { id: payload.sub }, relations: ['store'] });
      if (dbUser) {
        const isActive = (dbUser.active ?? dbUser.is_active) !== false;
        if (!isActive) throw new UnauthorizedException('Nalog je deaktiviran');
        return { id: dbUser.id, username: dbUser.username, role: dbUser.role, name: (dbUser as any).full_name || (dbUser as any).name, store_id: dbUser.store_id || null, store_name: dbUser.store?.name || null, store_code: dbUser.store?.code || null };
      }
      // Fallback to demo users (dev convenience)
      const user = this.users.find(u => u.id === payload.sub);
      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }
      return { ...user, store_id: null, store_name: null, store_code: null };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private generateToken(user: { id: number; username: string; role: string; fullName?: string; storeId: number | null }): string {
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
    return requiredRoles.includes((user).role);
  }
}
