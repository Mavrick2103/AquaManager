import { MailService } from '../mail/mail.service';
import { createHash, randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import * as argon2 from 'argon2';
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { User, PLAN_RANK, SubscriptionPlan } from './user.entity';
import { UpdateMeDto } from './dto/update-me.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

// ⚠️ Ajuste les chemins si besoin
import { Aquarium } from '../aquariums/aquariums.entity';
import { WaterMeasurement } from '../water-measurement/water-measurement.entity';
import { Task } from '../tasks/task.entity';
import { AquariumFishCard } from '../catalog/aquarium-card-pivot/aquarium-fish-card.entity';
import { AquariumPlantCard } from '../catalog/aquarium-card-pivot/aquarium-plant-card.entity';
import { GamificationProfile } from '../gamification/entities/gamification-profile.entity';
import { Article } from '../articles/entities/article.entity';
import { FishCard } from '../catalog/fish-cards/fish-card.entity';
import { PlantCard } from '../catalog/plant-cards/plant-card.entity';
import { Settings } from '../settings/settings.entity';
import { PaypalManualGrantService } from '../billing/paypal/paypal-manual-grant.service';

type MetricsRange = '1d' | '7d' | '30d' | '365d' | 'all';
type NewUsersPoint = { label: string; count: number };

@Injectable()
export class UsersService {
  constructor(
    private readonly mail: MailService,
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(Aquarium) private readonly aqRepo: Repository<Aquarium>,
    @InjectRepository(WaterMeasurement) private readonly wmRepo: Repository<WaterMeasurement>,
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(AquariumFishCard) private readonly aqFishRepo: Repository<AquariumFishCard>,
    @InjectRepository(AquariumPlantCard) private readonly aqPlantRepo: Repository<AquariumPlantCard>,
    @InjectRepository(GamificationProfile)
    private readonly gamificationProfileRepo: Repository<GamificationProfile>,
    @InjectRepository(Article) private readonly articleRepo: Repository<Article>,
    @InjectRepository(FishCard) private readonly fishCardRepo: Repository<FishCard>,
    @InjectRepository(PlantCard) private readonly plantCardRepo: Repository<PlantCard>,
    @InjectRepository(Settings) private readonly settingsRepo: Repository<Settings>,
    private readonly paypalManualGrant: PaypalManualGrantService,
  ) {}

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  // =========================
  // Subscription helpers
  // =========================
  private normalizePlan(p?: string | null): SubscriptionPlan {
    const v = String(p ?? 'CLASSIC').toUpperCase();
    if (v === 'PRO') return 'PRO';
    if (v === 'PREMIUM') return 'PREMIUM';
    return 'CLASSIC';
  }

  async getBillingState(userId: number) {
  return this.repo.findOne({
    where: { id: userId },
    select: {
      id: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionPlan: true,
      subscriptionEndsAt: true,
      billingProvider: true,
      paypalSubscriptionId: true,
      paypalRenewalActive: true,
    } as any,
  });
}

async setStripeIds(userId: number, data: { stripeCustomerId?: string | null; stripeSubscriptionId?: string | null }) {
  await this.repo.update(
    { id: userId },
    {
      ...(data.stripeCustomerId !== undefined ? { stripeCustomerId: data.stripeCustomerId } : {}),
      ...(data.stripeSubscriptionId !== undefined ? { stripeSubscriptionId: data.stripeSubscriptionId } : {}),
    } as any,
  );
}

  /**
   * Retourne le plan "effectif" (si expiré => CLASSIC).
   */
  async getEffectivePlan(userId: number, lockedUser?: User): Promise<SubscriptionPlan> {
  const u = lockedUser ?? await this.repo.findOne({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      subscriptionPlan: true,
      subscriptionEndsAt: true,
      subscriptionStatus: true,
    } as any,
  });

  if (!u) return 'CLASSIC';

  const role = String((u as any).role ?? 'USER').toUpperCase();
  if (role === 'ADMIN' || role === 'SUPERADMIN') {
    // ✅ choix 1 : admin = premium à vie (recommandé pour debug / backoffice)
    return 'PRO'; // ou 'PREMIUM' si tu veux
  }

  const plan = this.normalizePlan((u as any).subscriptionPlan);
  const endsAt = (u as any).subscriptionEndsAt as Date | null;
  const status = String((u as any).subscriptionStatus ?? 'none');

  if (endsAt && endsAt.getTime() < Date.now()) return 'CLASSIC';
  if (!(status === 'active' || status === 'trialing')) return 'CLASSIC';

  return plan;
}

  

  async hasAtLeastPlan(userId: number, required: SubscriptionPlan): Promise<boolean> {
  const effective = await this.getEffectivePlan(userId);
  return PLAN_RANK[effective] >= PLAN_RANK[required];
}

  async setPlan(userId: number, plan: SubscriptionPlan, endsAt: Date | null = null) {
  await this.repo.update(
    { id: userId },
    {
      subscriptionPlan: this.normalizePlan(plan),
      subscriptionEndsAt: endsAt,
    } as any,
  );
}

  async updateProfile(userId: number, dto: UpdateMeDto) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const patch: Partial<User> = {};

    if (dto.fullName !== undefined) {
      const name = dto.fullName.trim();
      if (name.length > 0) patch.fullName = name;
    }

    if (dto.email !== undefined && dto.email !== user.email) {
      const exists = await this.repo.exist({ where: { email: dto.email } });
      if (exists) throw new ConflictException('Email déjà utilisé');
      const credentials = await this.findByEmailWithPassword(user.email);
      if (!dto.currentPassword || !credentials || !await argon2.verify(credentials.password, dto.currentPassword)) {
        throw new BadRequestException('Mot de passe actuel requis pour changer d’adresse e-mail');
      }
      const token = randomBytes(32).toString('hex');
      patch.pendingEmail = dto.email;
      patch.emailVerifyTokenHash = createHash('sha256').update(token).digest('hex');
      patch.emailVerifyExpiresAt = new Date(Date.now() + 86400000);
      await this.repo.update({ id: userId }, patch);
      await this.mail.sendVerifyEmail(dto.email, user.fullName, token);
      return this.findById(userId);
    }

    if (Object.keys(patch).length === 0) return user;

    await this.repo.update({ id: userId }, patch);
    return this.findById(userId);
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id: userId })
      .getOne();

    if (!user) return false;

    const ok = await argon2.verify(user.password, currentPassword);
    if (!ok) return false;

    const passwordHash = await argon2.hash(newPassword);
    await this.repo.update({ id: userId }, { password: passwordHash, authVersion: () => 'authVersion + 1', pendingEmail: null, emailVerifyTokenHash: null, emailVerifyExpiresAt: null, resetPasswordTokenHash: null, resetPasswordExpiresAt: null });
    return true;
  }

  async touchActivity(userId: number): Promise<void> {
    if (!Number.isFinite(userId)) return;
    await this.repo.update({ id: userId }, { lastActivityAt: new Date() });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.email = :email', { email })
      .getOne();
  }

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.repo.exist({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email déjà utilisé');

    const password = await argon2.hash(dto.password);

    const fullName = dto.fullName?.trim().length ? dto.fullName.trim() : dto.email.split('@')[0];

    const user = this.repo.create({
      email: dto.email,
      fullName,
      password,
    });

    if (!dto.notificationPreferences) return this.repo.save(user);

    // Account and notification choices must be persisted together.
    const preferences = dto.notificationPreferences;
    const enabled = preferences.taskReminders || preferences.automaticNotifications || preferences.newsAndUpdates;
    return this.repo.manager.transaction(async manager => {
      const saved = await manager.save(User, user);
      await manager.save(Settings, manager.create(Settings, {
        user: saved,
        notificationsEnabled: enabled,
        emailNotifications: enabled,
        pushNotifications: false,
        taskReminders: preferences.taskReminders,
        automaticNotifications: preferences.automaticNotifications,
        newsAndUpdates: preferences.newsAndUpdates,
      }));
      return saved;
    });
  }

  async deleteById(id: number) {
    const user = await this.repo.findOne({ where: { id } });
    this.assertNoLiveStripeSubscription(user);
    if (user?.paypalRenewalActive) throw new ConflictException('Résilie d’abord ton abonnement PayPal depuis ton profil, puis supprime ton compte.');
    await this.repo.delete(id);
  }

  private assertNoLiveStripeSubscription(user: User | null) {
    if (user?.stripeSubscriptionId && !['canceled', 'incomplete_expired'].includes(user.subscriptionStatus)) {
      throw new ConflictException('Résilie l’abonnement Stripe et attends la confirmation de sa fin avant de supprimer le compte ou de modifier ses droits.');
    }
  }

  async setEmailVerifyToken(userId: number, tokenHash: string, expiresAt: Date) {
    const result = await this.repo.update(
      { id: userId, emailVerifiedAt: IsNull() },
      {
        emailVerifyTokenHash: tokenHash,
        emailVerifyExpiresAt: expiresAt,
      },
    );
    return result.affected === 1;
  }

  async verifyEmailByTokenHash(tokenHash: string) {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.emailVerifyTokenHash')
      .addSelect('u.emailVerifyExpiresAt')
      .where('u.emailVerifyTokenHash = :tokenHash', { tokenHash })
      .getOne();

    if (!user) return null;

    if (!user.emailVerifyExpiresAt) return null;
    if (user.emailVerifyExpiresAt.getTime() < Date.now()) return null;

    if (user.emailVerifiedAt && !user.pendingEmail) return null;
    if (user.pendingEmail && await this.repo.existsBy({ email: user.pendingEmail })) {
      throw new ConflictException('Email déjà utilisé');
    }
    const result = await this.repo.update(
      { id: user.id, emailVerifyTokenHash: tokenHash, emailVerifyExpiresAt: MoreThan(new Date()) },
      {
        ...(user.pendingEmail ? { email: user.pendingEmail, authVersion: () => 'authVersion + 1', resetPasswordTokenHash: null, resetPasswordExpiresAt: null } : {}),
        pendingEmail: null,
        emailVerifiedAt: new Date(),
        emailVerifyTokenHash: null,
        emailVerifyExpiresAt: null,
      },
    );

    if (result.affected !== 1) return null;
    return this.findById(user.id);
  }

  // users.service.ts
async setStripeSubscriptionState(userId: number, patch: {
  plan?: SubscriptionPlan;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: 'none' | 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete';
  subscriptionEndsAt?: Date | null;
}) {
  const user = await this.repo.findOne({ where: { id: userId } });
  if (user?.billingProvider === 'paypal') return;
  await this.repo.update(
    { id: userId },
    {
      ...(patch.plan ? { subscriptionPlan: this.normalizePlan(patch.plan) } : {}),
      billingProvider: 'stripe',
      ...(patch.stripeCustomerId !== undefined ? { stripeCustomerId: patch.stripeCustomerId } : {}),
      ...(patch.stripeSubscriptionId !== undefined ? { stripeSubscriptionId: patch.stripeSubscriptionId } : {}),
      ...(patch.subscriptionStatus ? { subscriptionStatus: patch.subscriptionStatus } : {}),
      ...(patch.subscriptionEndsAt !== undefined ? { subscriptionEndsAt: patch.subscriptionEndsAt } : {}),
    } as any,
  );
}

async findUserIdByStripeSubscriptionId(stripeSubscriptionId: string): Promise<number | null> {
  const u = await this.repo.findOne({
    where: { stripeSubscriptionId } as any,
    select: { id: true } as any,
  });
  return u?.id ?? null;
}
  async setPasswordResetToken(email: string, tokenHash: string, expiresAt: Date) {
    const user = await this.repo.findOne({ where: { email } });
    if (!user) return null;

    await this.repo.update(
      { id: user.id },
      {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: expiresAt,
      },
    );

    return user;
  }

  async resetPasswordByTokenHash(tokenHash: string, newPassword: string) {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.resetPasswordTokenHash')
      .addSelect('u.resetPasswordExpiresAt')
      .addSelect('u.password')
      .where('u.resetPasswordTokenHash = :tokenHash', { tokenHash })
      .getOne();

    if (!user) return null;
    if (!user.resetPasswordExpiresAt) return null;
    if (user.resetPasswordExpiresAt.getTime() < Date.now()) return null;

    const hashed = await argon2.hash(newPassword);

    const result = await this.repo.update(
      { id: user.id, resetPasswordTokenHash: tokenHash, resetPasswordExpiresAt: MoreThan(new Date()) },
      {
        password: hashed,
        authVersion: () => 'authVersion + 1',
        pendingEmail: null,
        emailVerifyTokenHash: null,
        emailVerifyExpiresAt: null,
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
      },
    );

    if (result.affected !== 1) return null;
    return this.findById(user.id);
  }

  // ✅ ADMIN: LIST
  async adminList(search?: string) {
  const qb = this.repo.createQueryBuilder('u');

  qb.select([
    'u.id',
    'u.fullName',
    'u.email',
    'u.role',
    'u.subscriptionPlan',
    'u.subscriptionStatus',
    'u.subscriptionEndsAt',
    'u.createdAt',
    'u.emailVerifiedAt',
    'u.lastActivityAt',
  ]);

  if (search?.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    qb.andWhere('(LOWER(u.email) LIKE :q OR LOWER(u.fullName) LIKE :q)', { q });
  }

  qb.orderBy('u.createdAt', 'DESC');

  const users = await qb.getMany();

  const userIds = users.map((u) => u.id);

  const profiles = userIds.length
    ? await this.gamificationProfileRepo.find({
        where: {
          userId: In(userIds),
        },
      })
    : [];

  const profileByUserId = new Map(
    profiles.map((profile) => [profile.userId, profile]),
  );

  return users.map((user) => {
    const profile = profileByUserId.get(user.id);

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,

      subscriptionPlan: user.subscriptionPlan,
      subscriptionEndsAt: user.subscriptionEndsAt,
      subscriptionStatus: user.subscriptionStatus,

      createdAt: user.createdAt,
      lastActivityAt: user.lastActivityAt,
      emailVerifiedAt: user.emailVerifiedAt,

      level: profile?.level ?? 1,
      xp: profile?.xp ?? 0,
      currentStreak: profile?.currentStreak ?? 0,
      bestStreak: profile?.bestStreak ?? 0,
    };
  });
}

  // ✅ ADMIN: GET ONE
  async adminGetOne(id: number) {
    if (!Number.isFinite(id)) throw new BadRequestException('Id invalide');

    const user = await this.repo
      .createQueryBuilder('u')
      .select([
        'u.id',
        'u.fullName',
        'u.email',
        'u.role',
        'u.subscriptionPlan',
        'u.subscriptionStatus',
        'u.subscriptionEndsAt',
        'u.createdAt',
        'u.emailVerifiedAt',
        'u.lastActivityAt',
      ])
      .where('u.id = :id', { id })
      .getOne();

    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  // ✅ ADMIN: GET FULL
  async adminGetFull(id: number) {
    if (!Number.isFinite(id)) throw new BadRequestException('Id invalide');

    const user = await this.repo
      .createQueryBuilder('u')
      .select([
        'u.id',
        'u.fullName',
        'u.email',
        'u.role',
        'u.subscriptionPlan',
        'u.subscriptionStatus',
        'u.subscriptionEndsAt',
        'u.createdAt',
        'u.emailVerifiedAt',
        'u.lastActivityAt',
      ])
      .where('u.id = :id', { id })
      .getOne();

    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const aquariums = await this.aqRepo
      .createQueryBuilder('a')
      .leftJoin('a.user', 'u')
      .select([
        'a.id',
        'a.name',
        'a.waterType',
        'a.startDate',
        'a.createdAt',
        'a.lengthCm',
        'a.widthCm',
        'a.heightCm',
        'a.volumeL',
      ])
      .where('u.id = :id', { id })
      .orderBy('a.createdAt', 'DESC')
      .getMany();

    const aquariumIds = aquariums.map((a) => a.id);

    const measurements = aquariumIds.length
      ? await this.wmRepo.find({
          where: { aquariumId: In(aquariumIds) },
          order: { measuredAt: 'DESC' },
          take: 500,
        })
      : [];

    const tasks = await this.taskRepo.find({
      where: { user: { id } as any },
      order: { createdAt: 'DESC' },
      take: 500,
      relations: ['aquarium'],
    });

    const fish = aquariumIds.length
      ? await this.aqFishRepo.find({
          where: { aquariumId: In(aquariumIds) },
          order: { createdAt: 'DESC' },
          take: 500,
        })
      : [];

    const plants = aquariumIds.length
      ? await this.aqPlantRepo.find({
          where: { aquariumId: In(aquariumIds) },
          order: { createdAt: 'DESC' },
          take: 500,
        })
      : [];
    const gamificationProfile = await this.gamificationProfileRepo.findOne({
  where: { userId: id },
});
    const notificationSettings = await this.settingsRepo.findOne({
      where: { user: { id } },
    });

    const [editorArticles, editorFishCards, editorPlantCards] = await Promise.all([
      this.articleRepo.find({ where: { authorId: id }, order: { createdAt: 'DESC' } }),
      this.fishCardRepo.find({ where: { createdById: id }, order: { createdAt: 'DESC' } }),
      this.plantCardRepo.find({ where: { createdBy: id }, order: { createdAt: 'DESC' } }),
    ]);

return { user, aquariums, measurements, fish, plants, tasks, notificationSettings: notificationSettings ? {
    notificationsEnabled: notificationSettings.notificationsEnabled,
    emailNotifications: notificationSettings.emailNotifications,
    taskReminders: notificationSettings.taskReminders,
    automaticNotifications: notificationSettings.automaticNotifications,
    newsAndUpdates: notificationSettings.newsAndUpdates,
  } : null, gamification: {
    level: gamificationProfile?.level ?? 1,
    xp: gamificationProfile?.xp ?? 0,
    currentStreak: gamificationProfile?.currentStreak ?? 0,
    bestStreak: gamificationProfile?.bestStreak ?? 0,
  }, editor: {
    articles: editorArticles.map((article) => ({ id: article.id, title: article.title, createdAt: article.createdAt, status: article.status })),
    fishCards: editorFishCards.map((card) => ({ id: card.id, commonName: card.commonName, createdAt: card.createdAt, status: card.status })),
    plantCards: editorPlantCards.map((card) => ({ id: card.id, commonName: card.commonName, createdAt: card.createdAt, status: card.status })),
  },
};  
}

  async adminUpdate(id: number, dto: AdminUpdateUserDto) {
    if (!Number.isFinite(id)) throw new BadRequestException('Id invalide');

    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const patch: QueryDeepPartialEntity<User> = {};

    if (dto.fullName !== undefined) {
      const name = String(dto.fullName ?? '').trim();
      if (name.length < 2) throw new BadRequestException('Nom invalide');
      patch.fullName = name;
    }

    if (dto.email !== undefined) {
      const email = String(dto.email ?? '').trim().toLowerCase();
      if (!email) throw new BadRequestException('Email invalide');

      if (email !== user.email) {
        const exists = await this.repo.exist({ where: { email } });
        if (exists) throw new ConflictException('Email déjà utilisé');
        patch.email = email;
        patch.emailVerifiedAt = null;
        patch.pendingEmail = null;
        patch.emailVerifyTokenHash = null;
        patch.emailVerifyExpiresAt = null;
        patch.authVersion = () => 'authVersion + 1';
        patch.resetPasswordTokenHash = null;
        patch.resetPasswordExpiresAt = null;
      }
    }

    if (dto.role !== undefined) {
      patch.role = dto.role;
    }

    if (dto.subscriptionPlan !== undefined) {
      this.assertNoLiveStripeSubscription(user);
      if (user.paypalRenewalActive) throw new ConflictException('Résilie d’abord l’abonnement PayPal pour modifier les droits manuellement.');
      patch.billingProvider = null;
      patch.subscriptionPlan = this.normalizePlan(dto.subscriptionPlan);
    }

    if (dto.subscriptionEndsAt !== undefined) {
      this.assertNoLiveStripeSubscription(user);
      if (user.paypalRenewalActive) throw new ConflictException('Résilie d’abord l’abonnement PayPal pour modifier les droits manuellement.');
      patch.billingProvider = null;
      // string ISO -> Date (ou null si vide)
      const raw = String(dto.subscriptionEndsAt ?? '').trim();
      patch.subscriptionEndsAt = raw ? new Date(raw) : null;
    }

    if (Object.keys(patch).length === 0) {
      return this.adminGetOne(id);
    }

    await this.repo.update({ id }, patch);
    return this.adminGetOne(id);
  }

  async adminGrantSubscription(
  id: number,
  data: {
    plan: Exclude<SubscriptionPlan, 'CLASSIC'>;
    duration: '7d' | '14d' | '1m' | '3m' | '6m' | '1y' | 'lifetime';
  },
) {
  if (!Number.isFinite(id)) {
    throw new BadRequestException('Id invalide');
  }

  const user = await this.repo.findOne({ where: { id } });

  if (!user) {
    throw new NotFoundException('Utilisateur introuvable');
  }

  const plan = this.normalizePlan(data.plan);
  this.assertNoLiveStripeSubscription(user);

  if (plan === 'CLASSIC') {
    throw new BadRequestException('Le plan offert doit être PREMIUM ou PRO');
  }

  if (!['7d', '14d', '1m', '3m', '6m', '1y', 'lifetime'].includes(data.duration)) {
    throw new BadRequestException('Durée invalide');
  }
  if (user.paypalRenewalActive) {
    return this.paypalManualGrant.run(id, () => this.adminGrantSubscription(id, data));
  }

  let subscriptionEndsAt: Date | null = null;

  if (data.duration !== 'lifetime') {
    const now = new Date();

    // Si l’utilisateur a déjà une période active, on prolonge depuis sa date actuelle.
    const baseDate =
      user.subscriptionEndsAt &&
      user.subscriptionEndsAt.getTime() > now.getTime() &&
      user.subscriptionStatus === 'active'
        ? new Date(user.subscriptionEndsAt)
        : now;

    subscriptionEndsAt = new Date(baseDate);

    switch (data.duration) {
      case '7d':
        subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + 7);
        break;

      case '14d':
        subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + 14);
        break;

      case '1m':
        subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);
        break;

      case '3m':
        subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 3);
        break;

      case '6m':
        subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 6);
        break;

      case '1y':
        subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);
        break;

      default:
        throw new BadRequestException('Durée invalide');
    }
  }

  await this.repo.update(
    { id },
    {
      subscriptionPlan: plan,
      subscriptionStatus: 'active',
      subscriptionEndsAt,
      billingProvider: null,
    } as Partial<User>,
  );

  return this.adminGetOne(id);
}


async adminRevokeSubscription(id: number) {
  if (!Number.isFinite(id)) {
    throw new BadRequestException('Id invalide');
  }

  const user = await this.repo.findOne({ where: { id } });

  if (!user) {
    throw new NotFoundException('Utilisateur introuvable');
  }

  this.assertNoLiveStripeSubscription(user);

  if (user.paypalRenewalActive) throw new ConflictException('Résilie d’abord l’abonnement PayPal pour retirer les droits.');
  await this.repo.update(
    { id },
    {
      subscriptionPlan: 'CLASSIC',
      subscriptionStatus: 'none',
      subscriptionEndsAt: null,
      billingProvider: null,
      stripeSubscriptionId: null,
    } as Partial<User>,
  );

  return this.adminGetOne(id);
}

  async adminDelete(id: number) {
    if (!Number.isFinite(id)) throw new BadRequestException('Id invalide');

    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    this.assertNoLiveStripeSubscription(user);
    if (user.paypalRenewalActive) throw new ConflictException('Résilie d’abord l’abonnement PayPal de cet utilisateur.');

    try {
      await this.repo.delete(id);
      return { ok: true };
    } catch (e: any) {
      if (e?.code === 'ER_ROW_IS_REFERENCED_2' || e?.errno === 1451) {
        throw new ConflictException(
          'Impossible de supprimer cet utilisateur : il possède des données liées (ex: aquariums). Supprime ses aquariums avant.',
        );
      }
      throw e;
    }
  }
}
