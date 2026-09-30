import 'reflect-metadata';
import { DataSource, EntitySchema } from 'typeorm';
import { Aquarium } from '../../src/aquariums/aquariums.entity';
import { User } from '../../src/users/user.entity';
import { AquariumRetentionService, retentionDeadline } from '../../src/aquariums/aquarium-retention.service';
import { AquariumsService } from '../../src/aquariums/aquariums.service';

const userSchema = new EntitySchema<User>({ name: 'User', target: User, tableName: 'users', columns: {
  id: { type: Number, primary: true }, role: { type: String },
  subscriptionPlan: { type: String }, subscriptionStatus: { type: String },
  subscriptionEndsAt: { type: Date, nullable: true },
} });
const aquariumSchema = new EntitySchema<Aquarium>({ name: 'Aquarium', target: Aquarium, tableName: 'aquariums', columns: {
  id: { type: Number, primary: true }, name: { type: String }, createdAt: { type: Date },
  archivedAt: { type: Date, nullable: true }, archiveExpiresAt: { type: Date, nullable: true },
}, relations: { user: { type: 'many-to-one', target: 'User', joinColumn: { name: 'userId' } } } });
const dependentTables = ['tasks', 'water_measurements', 'aquarium_targets', 'aquarium_fish_cards',
  'aquarium_plant_cards', 'aquarium_health_scores', 'recommendations', 'ai_usage', 'feature_usage_events'];

describe('Aquarium retention lifecycle (real database)', () => {
  let db: DataSource;
  let retention: AquariumRetentionService;
  let aquariums: AquariumsService;
  const expiration = new Date('2026-10-01T12:00:00Z');
  beforeEach(async () => {
    db = await new DataSource({ type: 'sqlite', database: ':memory:', entities: [userSchema, aquariumSchema], synchronize: true }).initialize();
    // SQLite has no FOR UPDATE: only remove the lock option, retain real transactions/queries.
    const source = { transaction: (work: any) => db.transaction(async manager => {
      const getRepository = manager.getRepository.bind(manager);
      const users = getRepository(User);
      const findOne = users.findOne.bind(users);
      jest.spyOn(users, 'findOne').mockImplementation(({ lock, ...options }: any) => {
        expect(lock).toEqual({ mode: 'pessimistic_write' });
        return findOne(options);
      });
      return work(manager);
    }), query: db.query.bind(db) };
    retention = new AquariumRetentionService(source as any);
    aquariums = new AquariumsService(db.getRepository(Aquarium), db.getRepository(User), { touchActivity: async () => {} } as any);
    await db.getRepository(User).save({ id: 1, role: 'USER', subscriptionPlan: 'PREMIUM', subscriptionStatus: 'active', subscriptionEndsAt: expiration });
    await db.getRepository(User).save({ id: 2, role: 'USER', subscriptionPlan: 'CLASSIC', subscriptionStatus: 'none' });
    for (let id = 1; id <= 5; id++) await db.getRepository(Aquarium).save({ id, name: `Bac ${id}`,
      createdAt: new Date('2026-01-01'), user: { id: 1 }, archivedAt: null, archiveExpiresAt: null });
    await db.getRepository(Aquarium).save({ id: 6, name: 'Autre utilisateur', createdAt: new Date('2026-01-01'), user: { id: 2 } });
    for (const table of dependentTables) {
      await db.query(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY, aquariumId INTEGER)`);
      await db.query(`INSERT INTO ${table} (id, aquariumId) VALUES (1, 3), (2, 1), (3, 6)`);
    }
    await db.query('CREATE TABLE task_fertilizers (id INTEGER PRIMARY KEY, taskId INTEGER)');
    await db.query('INSERT INTO task_fertilizers VALUES (1, 1), (2, 2)');
  });
  afterEach(async () => { await db.destroy(); });

  it('retains all five until paid access ends, then keeps only the oldest two and hides direct access', async () => {
    await retention.reconcile(1, true, new Date(expiration.getTime() - 1));
    expect(await aquariums.findMine(1)).toHaveLength(5);
    await retention.reconcile(1, false, expiration);
    expect((await aquariums.findMine(1)).map(a => a.id).sort()).toEqual([1, 2]);
    await expect(aquariums.findOne(1, 3)).rejects.toThrow('Aquarium introuvable');
    expect(await aquariums.retentionStatus(1)).toEqual({ archivedCount: 3, nextDeletionAt: new Date('2027-10-01T12:00:00Z') });
    expect(await db.getRepository(Aquarium).count()).toBe(6);
  });

  it('does not extend the deadline on repeated requests or unlock archives after deletion of a visible aquarium', async () => {
    await retention.reconcile(1, false, expiration);
    await db.getRepository(Aquarium).delete(1);
    await retention.reconcile(1, false, new Date('2026-12-01'));
    expect((await aquariums.findMine(1)).map(a => a.id)).toEqual([2]);
    expect((await aquariums.retentionStatus(1)).nextDeletionAt).toEqual(new Date('2027-10-01T12:00:00Z'));
  });

  it('restores on renewal and starts a fresh year on the next expiration', async () => {
    await retention.reconcile(1, false, expiration);
    const nextEnd = new Date('2027-03-01T12:00:00Z');
    await db.getRepository(User).update(1, { subscriptionEndsAt: nextEnd });
    await retention.reconcile(1, true, new Date('2027-02-10'));
    expect(await aquariums.findMine(1)).toHaveLength(5);
    expect((await aquariums.retentionStatus(1)).archivedCount).toBe(0);
    await retention.reconcile(1, false, nextEnd);
    expect((await aquariums.retentionStatus(1)).nextDeletionAt).toEqual(new Date('2028-03-01T12:00:00Z'));
  });

  it('recognizes a later paid period even if there was no request during that period', async () => {
    await retention.reconcile(1, false, expiration);
    await db.getRepository(User).update(1, { subscriptionEndsAt: new Date('2027-02-01') });
    await retention.reconcile(1, true, new Date('2027-10-02'));
    expect((await aquariums.retentionStatus(1)).nextDeletionAt).toEqual(new Date('2028-02-01'));
  });

  it('purges expired archives and all related rows, preserving active and other-user data', async () => {
    await retention.reconcile(1, false, expiration);
    await retention.reconcile(1, true, new Date('2027-10-01T11:59:59Z'));
    expect(await db.getRepository(Aquarium).count()).toBe(6);
    await retention.reconcile(1, true, new Date('2027-10-01T12:00:00Z'));
    expect((await db.getRepository(Aquarium).find()).map(a => a.id).sort()).toEqual([1, 2, 6]);
    for (const table of dependentTables) expect((await db.query(`SELECT aquariumId FROM ${table} ORDER BY id`)).map(r => r.aquariumId)).toEqual([1, 6]);
    expect(await db.query('SELECT id FROM task_fertilizers')).toEqual([{ id: 2 }]);
    await retention.reconcile(1, true, new Date('2027-10-02'));
    expect(await db.getRepository(Aquarium).count()).toBe(3);
  });

  it('gives legacy over-quota accounts a full year on rollout', async () => {
    await db.getRepository(User).update(1, { subscriptionEndsAt: new Date('2024-01-01') });
    await retention.reconcile(1, true, expiration);
    expect((await aquariums.retentionStatus(1)).nextDeletionAt).toEqual(new Date('2027-10-01T12:00:00Z'));
  });

  it('handles the leap-day anniversary', () => {
    expect(retentionDeadline(new Date('2028-02-29T12:00:00Z'))).toEqual(new Date('2029-02-28T12:00:00Z'));
  });
});
