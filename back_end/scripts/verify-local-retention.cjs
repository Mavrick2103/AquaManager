// Only disposable fixtures on the loopback development database. No payment/SMTP/AI calls.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DataSource } = require('typeorm');
const { User } = require('../dist/src/users/user.entity');
const { Aquarium } = require('../dist/src/aquariums/aquariums.entity');
const { Task } = require('../dist/src/tasks/task.entity');
const { TaskFertilizer } = require('../dist/src/tasks/task-fertilizer.entity');
const { WaterMeasurement } = require('../dist/src/water-measurement/water-measurement.entity');
const { AquariumRetentionService } = require('../dist/src/aquariums/aquarium-retention.service');
const { AquariumsService } = require('../dist/src/aquariums/aquariums.service');
const { TaskService } = require('../dist/src/tasks/task.service');
const { WaterMeasurementService } = require('../dist/src/water-measurement/water-measurement.service');
const { AquariumItemsController } = require('../dist/src/catalog/aquarium-card-pivot/aquarium-items.controller');
const { AquariumTargetsService } = require('../dist/src/aquarium-targets/aquarium-targets.service');
const { AquariumScoreService } = require('../dist/src/gamification/score/aquarium-score.service');

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Development only');
  const env = require('dotenv').parse(readFileSync(join(__dirname, '..', '.env.development')));
  if (!['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)) throw new Error('Loopback database required');
  const source = await new DataSource({ type: 'mysql', host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
    username: env.DB_USER, password: env.DB_PASS, database: env.DB_NAME,
    entities: [join(__dirname, '..', 'dist/src/**/*.entity.js').replace(/\\/g, '/')], synchronize: false,
  }).initialize();
  const users = source.getRepository(User), aq = source.getRepository(Aquarium), tasks = source.getRepository(Task);
  const userService = { touchActivity: async () => {} };
  const retention = new AquariumRetentionService(source);
  const aquariums = new AquariumsService(aq, users, userService);
  const taskService = new TaskService(tasks, aq, source.getRepository(TaskFertilizer), userService, {});
  const measures = new WaterMeasurementService(source.getRepository(WaterMeasurement), aq, userService, {}, {});
  let user;
  try {
    const expiry = new Date('2026-10-01T12:00:00Z');
    user = await users.save(users.create({ fullName: 'Disposable retention audit', email: `retention-${randomUUID()}@example.invalid`,
      password: 'not-a-login-hash', subscriptionPlan: 'PREMIUM', subscriptionStatus: 'active', subscriptionEndsAt: expiry }));
    const ids = [];
    for (let n = 0; n < 5; n++) ids.push((await aq.save(aq.create({ name: `Retention fixture ${n}`, lengthCm: 60,
      widthCm: 30, heightCm: 30, volumeL: 54, waterType: 'EAU_DOUCE', startDate: '2026-01-01', user: { id: user.id } }))).id);
    const task = await tasks.save(tasks.create({ user: { id: user.id }, aquarium: { id: ids[2] },
      title: 'Fixture task', type: 'WATER_CHANGE', dueAt: new Date('2026-01-02') }));
    const fertilizer = await source.getRepository(TaskFertilizer).save({ taskId: task.id, name: 'Fixture', qty: 1, unit: 'ml' });
    await source.getRepository(WaterMeasurement).save({ aquariumId: ids[2], measuredAt: new Date('2026-01-03'), ph: 7 });
    // Real MySQL row locks serialize duplicate API/cron requests.
    await Promise.all([retention.reconcile(user.id, false, expiry), retention.reconcile(user.id, false, expiry)]);
    assert.deepEqual((await aquariums.findMine(user.id)).map(x => x.id).sort((a,b) => a-b), ids.slice(0, 2));
    assert.equal((await taskService.findMine(user.id)).length, 0);
    const hidden = error => error.getStatus?.() === 404;
    await assert.rejects(aquariums.findOne(user.id, ids[2]), hidden);
    await assert.rejects(measures.listForAquarium(user.id, ids[2]), hidden);
    await assert.rejects(taskService.update(user.id, String(task.id), { status: 'DONE' }), hidden);
    await assert.rejects(taskService.remove(user.id, String(task.id)), hidden);
    await assert.rejects(new AquariumItemsController(aq, {}, {}).listFish({ user: { userId: user.id } }, String(ids[2])), hidden);
    await assert.rejects(new AquariumTargetsService({}, aq).resolveTargetMapForUser(user.id, ids[2]), hidden);
    await assert.rejects(new AquariumScoreService({}, aq, {}, {}, {}).getOrCompute(user.id, ids[2]), hidden);
    console.log('MySQL: only first two visible; archived aquarium, measures, tasks, species, targets and scores inaccessible');
    await users.update(user.id, { subscriptionEndsAt: new Date('2027-04-01T12:00:00Z') });
    await retention.reconcile(user.id, false, new Date('2027-03-01'));
    assert.equal((await aquariums.findMine(user.id)).length, 5);
    assert.equal((await taskService.findMine(user.id)).length, 1);
    await retention.reconcile(user.id, false, new Date('2027-04-01T12:00:00Z'));
    assert.equal((await aquariums.retentionStatus(user.id)).nextDeletionAt.toISOString(), '2028-04-01T12:00:00.000Z');
    await retention.reconcile(user.id, true, new Date('2028-04-01T11:59:59Z'));
    assert.equal(await aq.countBy({ user: { id: user.id } }), 5);
    await retention.reconcile(user.id, true, new Date('2028-04-01T12:00:00Z'));
    assert.equal(await aq.countBy({ user: { id: user.id } }), 2);
    assert.equal(await tasks.countBy({ id: task.id }), 0);
    assert.equal(await source.getRepository(TaskFertilizer).countBy({ id: fertilizer.id }), 0);
    assert.equal(await source.getRepository(WaterMeasurement).countBy({ aquariumId: ids[2] }), 0);
    console.log('MySQL: renewal restores data; new expiry resets one year; due purge removes only archived fixture data');
  } finally {
    if (user) {
      await aq.delete({ user: { id: user.id } });
      await users.delete(user.id);
    }
    await source.destroy();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
