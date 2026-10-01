// Isolated MySQL integration check. Never connects to an application database.
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const { DataSource, Table } = require('typeorm');
const { join } = require('node:path');
const { User } = require('../dist/src/users/user.entity');
const {
  SatisfactionResponse,
  SatisfactionState,
} = require('../dist/src/satisfaction/satisfaction.entity');
const {
  SatisfactionService,
} = require('../dist/src/satisfaction/satisfaction.service');
const migration = require('../migrations/managed/202610010001-satisfaction.cjs');
const container = 'aquamanager_mysql_local';
const name = 'sat_test_' + randomBytes(6).toString('hex');
const password = randomBytes(24).toString('hex');
function root(sql) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'sh',
      '-c',
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --batch',
    ],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
}
async function main() {
  let db;
  try {
    const ports = execFileSync('docker', ['port', container, '3306/tcp'], {
      encoding: 'utf8',
    });
    const port = Number(ports.trim().split('\n')[0].split(':').pop());
    assert.ok(port > 0);
    root(
      `CREATE DATABASE ${name}; CREATE USER '${name}'@'%' IDENTIFIED BY '${password}'; GRANT ALL ON ${name}.* TO '${name}'@'%';`,
    );
    db = new DataSource({
      type: 'mysql',
      host: '127.0.0.1',
      port,
      username: name,
      password,
      database: name,
      synchronize: false,
      entities: [
        join(__dirname, '../dist/src/**/*.entity.js').replace(/\\/g, '/'),
      ],
    });
    await db.initialize();
    const runner = db.createQueryRunner();
    await runner.createTable(Table.create(db.getMetadata(User), db.driver));
    await runner.release();
    await migration.up(db);
    await migration.up(db);
    const users = db.getRepository(User);
    const first = await users.save(
      users.create({
        email: 'classic@example.test',
        password: 'not-used',
        fullName: 'Classic test',
        role: 'USER',
        subscriptionPlan: 'CLASSIC',
        subscriptionStatus: 'none',
        createdAt: new Date('2026-01-01'),
      }),
    );
    const premium = await users.save(
      users.create({
        email: 'premium@example.test',
        password: 'not-used',
        fullName: 'Premium test',
        role: 'USER',
        subscriptionPlan: 'PREMIUM',
        subscriptionStatus: 'active',
        billingProvider: 'paypal',
        createdAt: new Date('2026-01-01'),
      }),
    );
    const staff = await users.save(
      users.create({
        email: 'staff@example.test',
        password: 'not-used',
        fullName: 'Staff test',
        role: 'ADMIN',
        subscriptionPlan: 'CLASSIC',
        subscriptionStatus: 'none',
        createdAt: new Date('2026-01-01'),
      }),
    );
    const service = new SatisfactionService(db);
    await Promise.all([service.visit(first.id), service.visit(first.id)]);
    assert.equal(
      (
        await db
          .getRepository(SatisfactionState)
          .findOneBy({ userId: first.id })
      ).visitDays,
      1,
    );
    const sends = await Promise.allSettled([
      service.submit(first.id, { rating: 4, comment: 'Utile 🐟' }),
      service.submit(first.id, { rating: 5 }),
    ]);
    assert.equal(sends.filter((r) => r.status === 'fulfilled').length, 1);
    await service.submit(premium.id, { rating: 5, premiumRating: 4 });
    await service.submit(staff.id, { rating: 1, premiumRating: 1 });
    let report = await service.list({ days: 'all' });
    assert.equal(report.total, 2);
    assert.equal(report.monthly.length, 2);
    assert.equal(
      Number(report.totals.find((r) => r.segment === 'CLASSIC').count),
      1,
    );
    assert.equal(
      Number(
        report.totals.find((r) => r.segment === 'PREMIUM').premiumSatisfied,
      ),
      1,
    );
    assert.equal(report.items[0].user.email, undefined);
    await users.update(first.id, {
      subscriptionPlan: 'PREMIUM',
      subscriptionStatus: 'active',
    });
    assert.equal(
      (
        await db
          .getRepository(SatisfactionResponse)
          .findOneBy({ userId: first.id })
      ).segment,
      'CLASSIC',
    );
    await service.review(report.items[0].id, 'READ');
    report = await service.list({ days: 'all', status: 'READ' });
    assert.equal(report.total, 1);
    assert.equal(report.totals.length, 2);
    assert.equal(
      (await service.list({ days: 'all', source: 'STAFF' })).total,
      1,
    );
    assert.equal(
      (await service.list({ days: 'all', source: 'GIFT' })).total,
      0,
    );
    await db
      .getRepository(SatisfactionState)
      .update(first.id, {
        lastResponseAt: new Date(Date.now() - 91 * 86400000),
      });
    await service.submit(first.id, { rating: 3, premiumRating: 3 });
    assert.equal(
      (await service.list({ days: 'all', source: 'GIFT' })).total,
      1,
    );
    await users.delete(first.id);
    assert.equal(
      await db
        .getRepository(SatisfactionResponse)
        .countBy({ userId: first.id }),
      0,
    );
    assert.equal(
      await db.getRepository(SatisfactionState).countBy({ userId: first.id }),
      0,
    );
    console.log(
      'PASS: migration twice, concurrent visits/submissions, snapshots, SQL metrics, filters, cooldown and cascade deletion.',
    );
  } finally {
    if (db?.isInitialized) await db.destroy();
    // Only the randomly named test resources created above are removed.
    root(`DROP DATABASE IF EXISTS ${name}; DROP USER IF EXISTS '${name}'@'%';`);
    console.log('Temporary satisfaction database and user removed.');
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
