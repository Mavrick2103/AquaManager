// Uses only a newly created random test database, removed in finally.
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const { AdminJourneyService } = require('../dist/src/admin/admin-journey.service');
const container = 'aquamanager_mysql_local';
const name = 'journey_test_' + randomBytes(6).toString('hex');
const password = randomBytes(24).toString('hex');
function root(sql) {
  return execFileSync('docker', ['exec', '-i', container, 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --batch'],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}
async function main() {
  let db, created = false;
  try {
    const port = Number(execFileSync('docker', ['port', container, '3306/tcp'], { encoding: 'utf8' }).trim().split('\n')[0].split(':').pop());
    root(`CREATE DATABASE ${name}; CREATE USER '${name}'@'%' IDENTIFIED BY '${password}'; GRANT ALL ON ${name}.* TO '${name}'@'%';`);
    created = true;
    db = new DataSource({ type: 'mysql', host: '127.0.0.1', port, username: name, password, database: name });
    await db.initialize();
    for (const sql of [
      'CREATE TABLE users (id INT PRIMARY KEY, fullName VARCHAR(100), role VARCHAR(10), createdAt DATETIME, lastActivityAt DATETIME NULL)',
      'CREATE TABLE aquariums (id INT PRIMARY KEY, userId INT, createdAt DATETIME)',
      'CREATE TABLE water_measurements (id INT PRIMARY KEY, aquariumId INT, createdAt DATETIME)',
      'CREATE TABLE tasks (id INT PRIMARY KEY, userId INT, createdAt DATETIME)',
      'CREATE TABLE feature_usage_events (id INT PRIMARY KEY, userId INT NULL, feature VARCHAR(40), createdAt DATETIME)',
      'CREATE TABLE paypal_subscriptions (id INT PRIMARY KEY, userId INT, environment VARCHAR(10), createdAt DATETIME)',
      'CREATE TABLE paypal_payments (id INT PRIMARY KEY, subscriptionKey INT, reversed BOOLEAN, paidAt DATETIME NULL)',
    ]) await db.query(sql);
    const ago = days => new Date(Date.now() - days * 86400000);
    for (let id = 1; id <= 25; id++) await db.query('INSERT INTO users VALUES (?, ?, ?, ?, NULL)', [id, `Test ${id}`, id === 25 ? 'EDITOR' : 'USER', ago(id === 24 ? 2 : 40)]);
    await db.query('INSERT INTO aquariums VALUES (1,1,?),(2,2,?),(3,24,?)', [ago(39),ago(39),ago(2)]);
    await db.query('INSERT INTO water_measurements VALUES (1,1,?),(2,1,?),(3,3,?)', [ago(30),ago(22),ago(1)]);
    await db.query('INSERT INTO tasks VALUES (1,1,?),(2,2,?),(3,25,?)', [ago(30),ago(30),ago(30)]);
    await db.query("INSERT INTO feature_usage_events VALUES (1,1,'ASSISTANT_OPEN',?),(2,NULL,'ASSISTANT_OPEN',?)", [ago(30),ago(20)]);
    await db.query("INSERT INTO paypal_subscriptions VALUES (1,1,'live',?),(2,2,'live',?),(3,24,'sandbox',?)", [ago(20),ago(20),ago(1)]);
    await db.query('INSERT INTO paypal_payments VALUES (1,1,0,?),(2,2,1,?),(3,3,0,?)', [ago(20),ago(20),ago(1)]);
    const service = new AdminJourneyService(db);
    const all = await service.report({ days: 'all' });
    assert.deepEqual(all.totals, { registered:24, aquarium:3, activated:3, measurement:2, task:2, solutions:1, returnEligible:2, returned:1, checkout:2, paid:1 });
    assert.equal(all.items.length,20);
    assert.equal((await service.report({ days:'all',page:'2' })).items.length,4);
    const unpaid = await service.report({ days:'all',stage:'unpaid' });
    assert.equal(unpaid.total,1); assert.equal(unpaid.items[0].id,2);
    const noReturn = await service.report({ days:'all',stage:'no_return' });
    assert.equal(noReturn.total,1); assert.equal(noReturn.items[0].id,2);
    const recent = await service.report({ days:'30' });
    assert.equal(recent.totals.registered,1); assert.equal(recent.totals.returnEligible,0);
    assert.equal((await service.report({ days:'all',stage:'no_action' })).total,0);
    assert.equal((await service.report({ days:'all',stage:'no_aquarium' })).total,21);
    console.log('PASS: MySQL cohort totals, deduplication, mature retention, staff exclusion, live/non-reversed payments, filters and pagination.');
  } finally {
    if (db?.isInitialized) await db.destroy();
    if (created) root(`DROP DATABASE IF EXISTS ${name}; DROP USER IF EXISTS '${name}'@'%';`);
    console.log('Temporary journey database and user removed.');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
