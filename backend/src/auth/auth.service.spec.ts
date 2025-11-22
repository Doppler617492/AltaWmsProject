import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  const repoMock = {
    findOne: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '8h' },
        }),
      ],
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: repoMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('authenticates a seeded admin user and returns a token', async () => {
    const password = 'Dekodera1989@';
    const password_hash = await bcrypt.hash(password, 10);
    repoMock.findOne.mockResolvedValue({
      id: 1,
      username: 'admin',
      role: 'ADMIN',
      password_hash,
      is_active: true,
      active: true,
      full_name: 'System Admin',
      store_id: null,
      store: null,
    });

    const result = await service.validateUser('admin', password);

    expect(result.accessToken).toBeDefined();
    expect(result.token).toEqual(result.accessToken);
    expect(result.user).toMatchObject({ username: 'admin', role: 'ADMIN' });
  });

  it('rejects invalid password', async () => {
    const password_hash = await bcrypt.hash('Dekodera1989@', 10);
    repoMock.findOne.mockResolvedValue({
      id: 1,
      username: 'admin',
      role: 'ADMIN',
      password_hash,
      is_active: true,
      active: true,
      full_name: 'System Admin',
      store_id: null,
      store: null,
    });

    await expect(service.validateUser('admin', 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
