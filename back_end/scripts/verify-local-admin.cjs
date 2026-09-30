// Read-only integration check; no PayPal, SMTP or remote database calls.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DataSource } = require('typeorm');
const { AdminMetricsService } = require('../dist/src/admin/admin-metrics.service');
const { AdminOperationsService } = require('../dist/src/admin/admin-operations.service');
const { PaypalAdminService } = require('../dist/src/billing/paypal/paypal-admin.service');
async function main() {
 const env = require('dotenv').parse(readFileSync(join(__dirname, '..', '.env.development')));
 if (process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)) throw new Error('Local development database required');
 const source = await new DataSource({ type: 'mysql', host: env.DB_HOST, port: Number(env.DB_PORT || 3306), username: env.DB_USER, password: env.DB_PASS, database: env.DB_NAME,
  entities: [join(__dirname, '..', 'dist/src/**/*.entity.js').replace(/\\/g, '/')], synchronize: false, migrationsRun: false,
 }).initialize();
 try {
  const repos = ['User','Aquarium','Task','WaterMeasurement','Article','FishCard','PlantCard','OperationalEvent','Settings'].map(name => source.getRepository(name));
  const metrics = new AdminMetricsService(...repos, source);
  for (const range of ['1d','7d','30d','365d','all']) {
   const result = await metrics.getMetrics(range);
   const series = await metrics.getNewUsersSeries(range);
   assert(result.users.recentRegistrations.length <= 10);
   assert(result.users.latest.length <= 10);
   assert(series.every(p => Number.isFinite(p.count)));
   assert.equal(series.reduce((total,p)=>total+p.count,0),result.users.newInRange);
   assert(JSON.parse(JSON.stringify(result.users.recentRegistrations)).every(user => !('password' in user)));
  }
  const operations = new AdminOperationsService(source.getRepository('OperationalEvent'));
  assert((await operations.list({range:'30d'})).items.length <= 25);
  const paypal = new PaypalAdminService(source, {}, {environment:'live',configured:false});
  for (const environment of ['live','sandbox']) {
   const result = await paypal.list('',1,environment);
   assert(result.items.every(s=>s.environment===environment));
   assert(result.overview.total >= result.items.length);
   await paypal.list('',1,environment,true,'CANCELLED');
  }
  const {AdminUserDossierService,DOSSIER_SECTIONS}=require('../dist/src/users/admin-user-dossier.service');
  const dossier=new AdminUserDossierService(source);
  const users=await source.getRepository('User').find({select:{id:true},take:3});
  for(const u of users){
   const summary=await dossier.overview(u.id);
   assert(!('password' in JSON.parse(JSON.stringify(summary.user))));
   assert(!('authVersion' in JSON.parse(JSON.stringify(summary.user))));
   for(const key of Object.keys(DOSSIER_SECTIONS)){
    const page=await dossier.records(u.id,key,{page:'1'});
    assert.equal(page.total,summary.counts[key]);assert(page.items.length<=25);
    assert(!JSON.stringify(page).includes('refreshHash'));
    assert(!JSON.stringify(page).includes('visitorKey'));
   }
   await assert.rejects(()=>dossier.records(u.id,'__proto__',{}));
   await assert.rejects(()=>dossier.records(u.id,'tasks',{page:'0'}));
   const empty=await dossier.records(u.id,'measurements',{aquariumId:'2147483647'});assert.equal(empty.total,0);
  }
  console.log('User dossier: all 18 sections queried for local accounts, counts, pagination, invalid filters and private fields verified.');
  console.log('MySQL local OK: overview, registration series, privacy of selected fields, event journal and PayPal filters. Read-only check.');
 } finally { await source.destroy(); }
}
main().catch(error=>{console.error('Local admin validation failed:',error.code === 'ERR_ASSERTION' ? error.stack : error.code || error.message);process.exitCode=1;});



