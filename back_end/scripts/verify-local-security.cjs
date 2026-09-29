// Opt-in integration check. Only disposable rows on a loopback database are changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { User } = require('../dist/src/users/user.entity');
const { Aquarium } = require('../dist/src/aquariums/aquariums.entity');
const { UsersService } = require('../dist/src/users/users.service');
const { AquariumsService } = require('../dist/src/aquariums/aquariums.service');
const { checkSchema } = require('./check-schema.cjs');

async function verify() {
  if (process.env.NODE_ENV === 'production') throw new Error('Local checks only');
  const env = require('dotenv').parse(fs.readFileSync(join(__dirname, '..', '.env.development')));
  if (!['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)) throw new Error('Loopback database required');
  Object.assign(process.env, env);
  const source = new DataSource({
    type: 'mysql', host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
    username: env.DB_USER, password: env.DB_PASS, database: env.DB_NAME,
    entities: [join(__dirname, '..', 'dist/src/**/*.entity.js').replace(/\\/g, '/')],
    synchronize: false, migrationsRun: false,
  });
  await source.initialize();
  const users = source.getRepository(User), aquariums = source.getRepository(Aquarium);
  const usersService = new UsersService({}, users);
  const service = new AquariumsService(aquariums, users, usersService);
  let user;
  try {
    const adapter = { query: async (sql) => [await source.query(sql)] };
    await checkSchema(adapter);
    await assert.rejects(checkSchema({ query: async sql => [(await source.query(sql)).filter(r => !(r.TABLE_NAME === 'users' && r.COLUMN_NAME === 'password'))] }, { legacy: true }), /users.password/);
    console.log('Schema complete; incomplete legacy schema rejected');
    user = await users.save(users.create({ fullName: 'Disposable security audit', email: `audit-${randomUUID()}@example.invalid`, password: 'not-a-login-hash', emailVerifiedAt: new Date() }));
    const dto = { name: 'Disposable audit', lengthCm: 60, widthCm: 30, heightCm: 30, waterType: 'EAU_DOUCE', startDate: '2026-09-29' };
    for (const [plan, limit] of [['CLASSIC', 2], ['PREMIUM', 5]]) {
      await users.update(user.id, { subscriptionPlan: plan, subscriptionStatus: 'active', subscriptionEndsAt: null });
      const results = await Promise.allSettled(Array.from({ length: 8 }, () => service.create(user.id, dto)));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, limit);
      for (const result of results.filter(r => r.status === 'rejected')) assert.equal(result.reason.getStatus(), 403);
      assert.equal(await aquariums.countBy({ user: { id: user.id } }), limit);
      console.log(`${plan}: ${limit} creations accepted out of 8 concurrent requests; all excess requests rejected`);
      await aquariums.delete({ user: { id: user.id } });
    }
    const verifiedAt = new Date();
    await users.update(user.id, { emailVerifiedAt: verifiedAt });
    assert.equal(await usersService.setEmailVerifyToken(user.id, 'a'.repeat(64), new Date(Date.now() + 60000)), false);
    assert.ok((await users.findOneByOrFail({ id: user.id })).emailVerifiedAt);
    console.log('Concurrent activation preserved');
    await users.update(user.id, { stripeSubscriptionId: 'sub_disposable_audit', subscriptionStatus: 'active' });
    await assert.rejects(usersService.deleteById(user.id), error => error.getStatus() === 409);
    await assert.rejects(usersService.adminDelete(user.id), error => error.getStatus() === 409);
    console.log('Active Stripe account deletion blocked for user and admin');
  } finally {
    if (user) {
      await users.delete({ id: user.id, email: user.email });
      assert.equal(await aquariums.countBy({ user: { id: user.id } }), 0);
      console.log('Disposable audit rows removed');
    }
    await source.destroy();
  }
}
verify().catch(error => { console.error(error.message); process.exitCode = 1; });
