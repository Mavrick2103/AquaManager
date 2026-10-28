// Integration test on a fresh random database, never the application's database.
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const { DataSource, Table } = require('typeorm');
const { join } = require('node:path');
const { User } = require('../dist/src/users/user.entity');
const { GamificationProfile } = require('../dist/src/gamification/entities/gamification-profile.entity');
const { WeeklyMission } = require('../dist/src/gamification/entities/weekly-mission.entity');
const { UserAchievement } = require('../dist/src/gamification/entities/user-achievement.entity');
const { GamificationActivity } = require('../dist/src/gamification/entities/gamification-activity.entity');
const { ProgressionService } = require('../dist/src/gamification/progression.service');
const { MISSION_CATALOG } = require('../dist/src/gamification/progression-policy');
const migration = require('../migrations/managed/202610020002-gamification-activities.cjs');
const container = 'aquamanager_mysql_local';
const name = 'gamification_test_' + randomBytes(6).toString('hex');
const password = randomBytes(24).toString('hex');
function root(sql) {
  return execFileSync('docker', ['exec', '-i', container, 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --batch'],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}
async function main() {
  let db, created = false;
  try {
    const port = Number(execFileSync('docker', ['port', container, '3306/tcp'], { encoding: 'utf8' }).trim().split('\n')[0].split(':').pop());
    assert.ok(port > 0);
    root(`CREATE DATABASE ${name}; CREATE USER '${name}'@'%' IDENTIFIED BY '${password}'; GRANT ALL ON ${name}.* TO '${name}'@'%';`);
    created = true;
    db = new DataSource({ type: 'mysql', host: '127.0.0.1', port, username: name, password, database: name,
      synchronize: false, entities: [join(__dirname, '../dist/src/**/*.entity.js').replace(/\\/g, '/')] });
    await db.initialize();
    const runner = db.createQueryRunner();
    for (const entity of [User, GamificationProfile, WeeklyMission, UserAchievement]) {
      await runner.createTable(Table.create(db.getMetadata(entity), db.driver));
    }
    await runner.release();
    await migration.up(db);
    await migration.up(db);
    const users = db.getRepository(User);
    const user = await users.save(users.create({ email: 'gamification@example.test', password: 'not-used', fullName: 'Test', role: 'USER' }));
    const service = new ProgressionService(db);
    // Preserve the six missions already attributed by the first catalogue.
    for (const { kind, ...seed } of MISSION_CATALOG.slice(0, 6)) {
      await db.getRepository(WeeklyMission).save({ ...seed, userId: user.id, progress: 0, status: 'ACTIVE', weekStart: '2026-10-01', weekEnd: '2026-10-31' });
    }
    const day1 = new Date('2026-10-10T10:00:00Z');
    const day2 = new Date('2026-10-11T10:00:00Z');
    const day3 = new Date('2026-10-12T10:00:00Z');
    const record = (events, now = day1) => service.record(user.id, events, now);
    await Promise.all(Array.from({ length: 5 }, () => record([{ kind: 'VISIT', eventKey: 'visit:2026-10-10' }])));
    let state = await record([]);
    assert.equal(state.profile.currentStreak, 1);
    assert.equal(state.profile.xp, 0);
    assert.equal(state.missions.length, 6);
    await Promise.all(Array.from({ length: 5 }, () => record([{ kind: 'CARE', eventKey: 'care:1:once' }])));
    state = await record([{ kind: 'CARE', eventKey: 'care:2:once' }]);
    assert.equal(state.profile.xp, 15);
    assert.equal(state.missions.find(m => m.missionKey === 'V2_CARE').progress, 1);
    state = await record([{ kind: 'CARE', eventKey: 'care:1:once' }], day2);
    assert.equal(state.profile.xp, 15, 'Undo/redo on another day cannot award the same task twice');
    state = await record([{ kind: 'CARE', eventKey: 'care:3:2026-10-11T10:00:00.000Z' }], day2);
    assert.equal(state.profile.xp, 100, 'Second care day: 15 daily XP + one 70 XP mission');
    await record([{ kind: 'VISIT', eventKey: 'visit:2026-10-11' }], day2);
    await Promise.all(Array.from({ length: 4 }, () => record([{ kind: 'VISIT', eventKey: 'visit:2026-10-12' }], day3)));
    state = await record([], day3);
    assert.equal(state.profile.xp, 140, 'Visit mission rewarded once under concurrency');
    const earnedCount = state.achievements.length;
    assert.equal(new Set(state.achievements.map(a => a.achievementKey)).size, earnedCount);
    state = await record([], new Date('2026-11-01T10:00:00Z'));
    assert.equal(state.profile.currentStreak, 0);
    assert.equal(state.profile.xp, 140);
    assert.equal(state.achievements.length, earnedCount);
    assert.ok(state.missions.every(m => m.progress === 0));
    assert.equal(state.missions.length, 4);

    // Existing completed missions occupy their category; old badges are reused.
    const existing = await users.save(users.create({ email: 'legacy@example.test', password: 'not-used', fullName: 'Legacy', role: 'USER' }));
    await db.getRepository(GamificationProfile).save({ userId: existing.id, xp: 1100 });
    await db.getRepository(UserAchievement).save({ userId: existing.id, achievementKey: 'FIRST_MEASUREMENT', title: 'Première mesure', description: 'Ancien badge', unlockedAt: day1 });
    for (const key of ['ADD_2_MEASUREMENTS', 'ADD_5_MEASUREMENTS', 'OPEN_APP_3_DAYS', 'OPEN_APP_7_DAYS', 'CREATE_2_TASKS', 'CREATE_5_TASKS', 'COMPLETE_2_TASKS', 'COMPLETE_5_TASKS', 'USE_SOLUTIONS_TAB']) {
      await db.getRepository(WeeklyMission).save({ userId: existing.id, missionKey: key, title: key, target: 2, progress: 2,
        xpReward: 80, status: 'COMPLETED', weekStart: '2026-10-01', weekEnd: '2026-10-31', completedAt: day1 });
    }
    await db.getRepository(WeeklyMission).save({ userId: existing.id, missionKey: 'ADD_FERTILIZATION_TASK', title: 'Ancienne mission', target: 1, progress: 0,
      xpReward: 60, status: 'ACTIVE', weekStart: '2026-10-01', weekEnd: '2026-10-31' });
    state = await service.record(existing.id, [], day1);
    assert.equal(state.profile.xp, 1100);
    assert.equal(state.missions.length, 4);
    assert.equal(new Set(state.missions.map(m => MISSION_CATALOG.find(seed => seed.missionKey === m.missionKey).kind)).size, 4);
    const occupiedKeys = state.missions.map(m => m.missionKey);
    state = await service.record(existing.id, [], day2);
    assert.deepEqual(state.missions.map(m => m.missionKey), occupiedKeys);
    assert.equal(state.profile.xp, 1100, 'Imported completed slots never grant their old bonus twice');
    assert.equal(state.achievements.filter(a => a.achievementKey === 'FIRST_MEASUREMENT').length, 1);
    assert.equal(state.rewards.filter(r => r.unlocked).length, 3);
    const fresh = await users.save(users.create({ email: 'rotation@example.test', password: 'not-used', fullName: 'Rotation', role: 'USER' }));
    const october = await service.record(fresh.id, [], day1);
    const repeated = await service.record(fresh.id, [], day2);
    assert.deepEqual(repeated.missions.map(m => m.id), october.missions.map(m => m.id));
    const november = await service.record(fresh.id, [], new Date('2026-11-01T10:00:00Z'));
    assert.equal(october.missions.length, 4);
    assert.equal(november.missions.length, 4);
    assert.ok(november.missions.every(m => !october.missions.some(old => old.missionKey === m.missionKey)));
    await users.delete(user.id);
    assert.equal(await db.getRepository(GamificationActivity).countBy({ userId: user.id }), 0);
    console.log('PASS: idempotent migration, concurrent events, daily caps, task replay, monthly rotation, persisted selection, legacy deduplication, badges, titles and cascade deletion.');
  } finally {
    if (db?.isInitialized) await db.destroy();
    if (created) root(`DROP DATABASE IF EXISTS ${name}; DROP USER IF EXISTS '${name}'@'%';`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
