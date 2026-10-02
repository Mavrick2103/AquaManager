import { MailService } from '../../src/mail/mail.service';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { UsersService } from '../../src/users/users.service';
import { PaypalManualGrantService } from '../../src/billing/paypal/paypal-manual-grant.service';
import { User } from '../../src/users/user.entity';

// ✅ entités injectées dans UsersService
import { Aquarium } from '../../src/aquariums/aquariums.entity';
import { WaterMeasurement } from '../../src/water-measurement/water-measurement.entity';
import { Task } from '../../src/tasks/task.entity';
import { AquariumFishCard } from '../../src/catalog/aquarium-card-pivot/aquarium-fish-card.entity';
import { AquariumPlantCard } from '../../src/catalog/aquarium-card-pivot/aquarium-plant-card.entity';
import { GamificationProfile } from '../../src/gamification/entities/gamification-profile.entity';
import { Article } from '../../src/articles/entities/article.entity';
import { FishCard } from '../../src/catalog/fish-cards/fish-card.entity';
import { PlantCard } from '../../src/catalog/plant-cards/plant-card.entity';
import { Settings } from '../../src/settings/settings.entity';

jest.mock('argon2', () => ({
  hash: jest.fn(async (s: string) => 'hashed:' + s),
  verify: jest.fn(async (hash: string, plain: string) => hash === 'hashed:' + plain),
}));

describe('UsersService (unit)', () => {
  let service: UsersService;

  let repo: jest.Mocked<Repository<User>>;
  let aqRepo: jest.Mocked<Repository<Aquarium>>;
  let wmRepo: jest.Mocked<Repository<WaterMeasurement>>;
  let taskRepo: jest.Mocked<Repository<Task>>;
  let aqFishRepo: jest.Mocked<Repository<AquariumFishCard>>;
  let aqPlantRepo: jest.Mocked<Repository<AquariumPlantCard>>;

  beforeEach(async () => {
    const repoMock: Partial<jest.Mocked<Repository<User>>> = {
      findOne: jest.fn(),
      exist: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    // ✅ mocks minimalistes (suffisent pour ces tests unit)
    const aqRepoMock: Partial<jest.Mocked<Repository<Aquarium>>> = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const gamificationProfileRepoMock: Partial<jest.Mocked<Repository<GamificationProfile>>> = {
  findOne: jest.fn(),
};

    const wmRepoMock: Partial<jest.Mocked<Repository<WaterMeasurement>>> = {
      find: jest.fn(),
    };

    const taskRepoMock: Partial<jest.Mocked<Repository<Task>>> = {
      find: jest.fn(),
    };

    const aqFishRepoMock: Partial<jest.Mocked<Repository<AquariumFishCard>>> = {
      find: jest.fn(),
    };

    const aqPlantRepoMock: Partial<jest.Mocked<Repository<AquariumPlantCard>>> = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PaypalManualGrantService, useValue: { run: jest.fn() } },
        { provide: MailService, useValue: { sendVerifyEmail: jest.fn() } },

        { provide: getRepositoryToken(User), useValue: repoMock },
        { provide: getRepositoryToken(Aquarium), useValue: aqRepoMock },
        { provide: getRepositoryToken(WaterMeasurement), useValue: wmRepoMock },
        { provide: getRepositoryToken(Task), useValue: taskRepoMock },
        { provide: getRepositoryToken(AquariumFishCard), useValue: aqFishRepoMock },
        { provide: getRepositoryToken(AquariumPlantCard), useValue: aqPlantRepoMock },
        {provide: getRepositoryToken(GamificationProfile), useValue: gamificationProfileRepoMock},
        { provide: getRepositoryToken(Article), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(FishCard), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(PlantCard), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Settings), useValue: { findOne: jest.fn() } },
      ],
    }).compile();

    service = module.get(UsersService);

    repo = module.get(getRepositoryToken(User));
    aqRepo = module.get(getRepositoryToken(Aquarium));
    wmRepo = module.get(getRepositoryToken(WaterMeasurement));
    taskRepo = module.get(getRepositoryToken(Task));
    aqFishRepo = module.get(getRepositoryToken(AquariumFishCard));
    aqPlantRepo = module.get(getRepositoryToken(AquariumPlantCard));

    jest.clearAllMocks();
  });

  it('grants a manual offer only after the PayPal protection has been cleared', async () => {
    const user = { id: 1, paypalRenewalActive: true, billingProvider: 'paypal', subscriptionStatus: 'incomplete', subscriptionEndsAt: null } as User;
    repo.findOne.mockResolvedValue(user);
    jest.spyOn(service, 'adminGetOne').mockResolvedValue({ id: 1 } as any);
    const guard = (service as any).paypalManualGrant;
    guard.run.mockImplementation(async (id: number, grant: () => Promise<any>) => {
      expect(repo.update).not.toHaveBeenCalled();
      user.paypalRenewalActive = false;
      return grant();
    });
    await service.adminGrantSubscription(1, { plan: 'PREMIUM', duration: '1m' });
    expect(guard.run).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledWith({ id: 1 }, expect.objectContaining({ subscriptionPlan: 'PREMIUM', subscriptionStatus: 'active', billingProvider: null }));
  });

  it('does not grant when the PayPal protection refuses the operation', async () => {
    repo.findOne.mockResolvedValue({ id: 1, paypalRenewalActive: true } as User);
    (service as any).paypalManualGrant.run.mockRejectedValue(new ConflictException('PayPal actif'));
    await expect(service.adminGrantSubscription(1, { plan: 'PREMIUM', duration: '1m' })).rejects.toThrow('PayPal actif');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('does not invalidate an account that was activated concurrently', async () => {
    repo.update.mockResolvedValue({ affected: 0 } as any);
    const expires = new Date();
    expect(await service.setEmailVerifyToken(1, 'new-hash', expires)).toBe(false);
    expect(repo.update).toHaveBeenCalledWith({ id: 1, emailVerifiedAt: IsNull() }, {
      emailVerifyTokenHash: 'new-hash', emailVerifyExpiresAt: expires,
    });
  });

  it('revokes old sessions and reset tokens when an admin changes the email', async () => {
    repo.findOne.mockResolvedValue({ id: 1, email: 'old@example.invalid' } as any);
    repo.exist.mockResolvedValue(false);
    jest.spyOn(service, 'adminGetOne').mockResolvedValue({ id: 1 } as any);
    await service.adminUpdate(1, { email: 'new@example.invalid' });
    const patch = repo.update.mock.calls[0][1] as any;
    expect(patch.emailVerifiedAt).toBeNull();
    expect(patch.resetPasswordTokenHash).toBeNull();
    expect(patch.resetPasswordExpiresAt).toBeNull();
    expect(patch.authVersion()).toBe('authVersion + 1');
  });

  it('findById -> renvoie un user', async () => {
    repo.findOne.mockResolvedValue({ id: 1 } as any);

    const res = await service.findById(1);

    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(res).toEqual({ id: 1 });
  });

  describe('create', () => {
    it('lève Conflict si email déjà pris', async () => {
      repo.exist.mockResolvedValue(true);

      await expect(
        service.create({
          email: 'a@a.com',
          fullName: 'John',
          password: 'test123',
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('crée un utilisateur avec hash du mot de passe + trim fullName', async () => {
      repo.exist.mockResolvedValue(false);
      (repo.create as jest.Mock).mockImplementation((x: any) => x);
      (repo.save as jest.Mock).mockImplementation(async (x: any) => ({ id: 10, ...x }));

      const res = await service.create({
        email: 'a@a.com',
        fullName: '  Jane  ',
        password: 'secret123',
      } as any);

      expect(res.id).toBe(10);
      expect(res.fullName).toBe('Jane');
      expect(res.password).toBe('hashed:secret123');
      expect(argon2.hash).toHaveBeenCalledWith('secret123');
    });

    it('si fullName vide -> fallback sur email avant @', async () => {
      repo.exist.mockResolvedValue(false);
      (repo.create as jest.Mock).mockImplementation((x: any) => x);
      (repo.save as jest.Mock).mockImplementation(async (x: any) => ({ id: 11, ...x }));

      const res = await service.create({
        email: 'johnny@test.com',
        fullName: '   ',
        password: 'pw',
      } as any);

      expect(res.fullName).toBe('johnny');
      expect(res.password).toBe('hashed:pw');
    });
  });

  describe('updateProfile', () => {
    it('keeps the verified address until the new address is confirmed', async () => {
      const user = { id: 1, email: 'old@test.com', fullName: 'Test', emailVerifiedAt: new Date() };
      repo.findOne.mockResolvedValue(user as any);
      repo.exist.mockResolvedValue(false);
      jest.spyOn(service, 'findByEmailWithPassword').mockResolvedValue({ ...user, password: 'hashed:secret' } as any);
      await service.updateProfile(1, { email: 'new@test.com', currentPassword: 'secret' });
      const patch = (repo.update as jest.Mock).mock.calls[0][1];
      expect(patch.pendingEmail).toBe('new@test.com');
      expect(patch.emailVerifyTokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(patch.email).toBeUndefined();
      expect(patch.emailVerifiedAt).toBeUndefined();
    });

    it('rejects email changes without reauthentication', async () => {
      repo.findOne.mockResolvedValue({ id: 1, email: 'old@test.com' } as any);
      repo.exist.mockResolvedValue(false);
      jest.spyOn(service, 'findByEmailWithPassword').mockResolvedValue({ password: 'hashed:secret' } as any);
      await expect(service.updateProfile(1, { email: 'new@test.com' })).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('NotFound si user introuvable', async () => {
      repo.findOne.mockResolvedValue(null as any);

      await expect(service.updateProfile(1, { fullName: 'X' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('met à jour fullName (trim) et renvoie findById()', async () => {
      // 1) premier findOne : user existant
      repo.findOne.mockResolvedValueOnce({
        id: 1,
        fullName: 'Old',
        email: 'a@a.com',
      } as any);

      // 2) update ok
      (repo.update as jest.Mock).mockResolvedValue({} as any);

      // 3) findById -> findOne (deuxième appel)
      repo.findOne.mockResolvedValueOnce({
        id: 1,
        fullName: 'Updated',
        email: 'a@a.com',
      } as any);

      const res = await service.updateProfile(1, { fullName: '  Updated  ' } as any);

      expect(repo.update).toHaveBeenCalledWith({ id: 1 }, { fullName: 'Updated' });
      expect(res).toEqual({ id: 1, fullName: 'Updated', email: 'a@a.com' });
    });

    it('si email change et déjà utilisé -> Conflict', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 1,
        fullName: 'Old',
        email: 'old@test.com',
      } as any);

      repo.exist.mockResolvedValue(true);

      await expect(service.updateProfile(1, { email: 'new@test.com' } as any)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('si patch vide -> renvoie user tel quel (pas de update)', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 1,
        fullName: 'Same',
        email: 'same@test.com',
      } as any);

      const res = await service.updateProfile(1, {} as any);

      expect(repo.update).not.toHaveBeenCalled();
      expect(res).toEqual({ id: 1, fullName: 'Same', email: 'same@test.com' });
    });
  });

  describe('changePassword', () => {
    it('retourne false si user introuvable', async () => {
      const qb: any = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const res = await service.changePassword(1, 'old', 'new');

      expect(res).toBe(false);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('retourne false si mot de passe invalide', async () => {
      const qb: any = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, password: 'hashed:other' }),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const res = await service.changePassword(1, 'wrong', 'new');

      expect(res).toBe(false);
      expect(repo.update).not.toHaveBeenCalled();
      expect(argon2.verify).toHaveBeenCalled();
    });

    it('met à jour le mot de passe si valide', async () => {
      const qb: any = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, password: 'hashed:old' }),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      (repo.update as jest.Mock).mockResolvedValue({} as any);

      const ok = await service.changePassword(1, 'old', 'newpass');

      expect(ok).toBe(true);
      expect(argon2.verify).toHaveBeenCalledWith('hashed:old', 'old');
      expect(argon2.hash).toHaveBeenCalledWith('newpass');
      expect(repo.update).toHaveBeenCalledWith({ id: 1 }, expect.objectContaining({ password: 'hashed:newpass', authVersion: expect.any(Function) }));
    });
  });

  it('findByEmailWithPassword -> renvoie le user', async () => {
    const qb: any = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 1, email: 'a@a.com', password: 'hashed:123' }),
    };
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const res = await service.findByEmailWithPassword('a@a.com');

    expect(repo.createQueryBuilder).toHaveBeenCalledWith('u');
    expect(res).not.toBeNull();
    expect(res!.password).toBeDefined();
  });

  it('touchActivity -> update lastActivityAt', async () => {
    (repo.update as jest.Mock).mockResolvedValue({} as any);

    await service.touchActivity(1);

    expect(repo.update).toHaveBeenCalledWith(
      { id: 1 },
      expect.objectContaining({ lastActivityAt: expect.any(Date) }),
    );
  });

  it('deleteById -> supprime', async () => {
    (repo.delete as jest.Mock).mockResolvedValue({} as any);

    await service.deleteById(3);

    expect(repo.delete).toHaveBeenCalledWith(3);
  });

  it('confirms pending email only with an unexpired single-use token and revokes old sessions', async () => {
    const user = { id: 1, email: 'old@test.com', pendingEmail: 'new@test.com', emailVerifiedAt: new Date(), emailVerifyExpiresAt: new Date(Date.now() + 60000) };
    repo.createQueryBuilder.mockReturnValue({ addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(user) } as any);
    repo.existsBy = jest.fn().mockResolvedValue(false);
    repo.update.mockResolvedValue({ affected: 1 } as any);
    repo.findOne.mockResolvedValue({ ...user, email: user.pendingEmail, pendingEmail: null } as any);
    const result = await service.verifyEmailByTokenHash('hash');
    expect(result?.email).toBe('new@test.com');
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ emailVerifyTokenHash: 'hash' }), expect.objectContaining({
      email: 'new@test.com', pendingEmail: null, emailVerifyTokenHash: null, authVersion: expect.any(Function),
    }));
    repo.update.mockResolvedValue({ affected: 0 } as any);
    expect(await service.verifyEmailByTokenHash('hash')).toBeNull();
  });

  it('rejects an expired email confirmation without changing the address', async () => {
    repo.createQueryBuilder.mockReturnValue({ addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue({ id: 1, pendingEmail: 'new@test.com', emailVerifyExpiresAt: new Date(0) }) } as any);
    expect(await service.verifyEmailByTokenHash('hash')).toBeNull();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('password reset consumes its token atomically and revokes existing sessions', async () => {
    repo.createQueryBuilder.mockReturnValue({ addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue({ id: 1, resetPasswordExpiresAt: new Date(Date.now() + 60000) }) } as any);
    repo.update.mockResolvedValue({ affected: 1 } as any);
    repo.findOne.mockResolvedValue({ id: 1 } as any);
    await service.resetPasswordByTokenHash('reset-hash', 'newpass');
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ resetPasswordTokenHash: 'reset-hash' }), expect.objectContaining({ password: 'hashed:newpass', authVersion: expect.any(Function), resetPasswordTokenHash: null }));
    repo.update.mockResolvedValue({ affected: 0 } as any);
    expect(await service.resetPasswordByTokenHash('reset-hash', 'otherpass')).toBeNull();
  });
});
