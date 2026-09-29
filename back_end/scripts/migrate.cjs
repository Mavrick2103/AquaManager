const mysql = require('mysql2/promise');
const { readdir, readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const { checkSchema } = require('./check-schema.cjs');

async function migrate() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME,
  });
  let locked = false;
  try {
    const [[lock]] = await db.query("SELECT GET_LOCK('aquamanager_migrations', 60) AS acquired");
    if (Number(lock.acquired) !== 1) throw new Error('Migration lock unavailable');
    locked = true;
    // Legacy SQL scripts were applied manually. Do not silently replay data updates
    // (in particular historical payment/email and demo-article migrations).
    await checkSchema(db, { legacy: true });
    await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(190) PRIMARY KEY, checksum CHAR(64) NOT NULL,
      appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    const directory = join(__dirname, '..', 'migrations', 'managed');
    for (const name of (await readdir(directory)).filter((name) => /^\d{12,}-[\w-]+\.cjs$/.test(name)).sort()) {
      const path = join(directory, name);
      const checksum = createHash('sha256').update(await readFile(path)).digest('hex');
      const [existing] = await db.execute('SELECT checksum FROM schema_migrations WHERE name = ?', [name]);
      if (existing.length) {
        if (existing[0].checksum !== checksum) throw new Error(`Modified applied migration: ${name}`);
        continue;
      }
      await require(path).up(db);
      await db.execute('INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)', [name, checksum]);
      console.log(`Applied ${name}`);
    }
    await checkSchema(db);
  } finally {
    if (locked) await db.query("SELECT RELEASE_LOCK('aquamanager_migrations')");
    await db.end();
  }
}

if (require.main === module) migrate().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { migrate };
