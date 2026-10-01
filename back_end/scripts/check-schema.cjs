const { DataSource } = require('typeorm');
const { join } = require('node:path');

async function checkSchema(db, { legacy = false } = {}) {
  // Read-only metadata inspection: never synchronize or run migrations here.
  const source = new DataSource({
    type: 'mysql', host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME,
    entities: [join(__dirname, '..', 'dist', 'src', '**', '*.entity.js').replace(/\\/g, '/')],
    synchronize: false, migrationsRun: false,
  });
  await source.initialize();
  try {
    if (!source.entityMetadatas.length) throw new Error('No compiled entities: run npm run build first.');
    const [rows] = await db.query('SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()');
    const actual = new Set(rows.map(row => `${row.TABLE_NAME}.${row.COLUMN_NAME}`));
    const missing = [];
    for (const entity of source.entityMetadatas) {
      if (legacy && ['auth_sessions', 'satisfaction_responses', 'satisfaction_states'].includes(entity.tableName)) continue;
      for (const column of entity.columns) {
        const key = `${entity.tableName}.${column.databaseName}`;
        if (legacy && ['users.authVersion', 'users.pendingEmail', 'aquariums.archivedAt', 'aquariums.archiveExpiresAt'].includes(key)) continue;
        if (!actual.has(key)) missing.push(key);
      }
    }
    if (missing.length) throw new Error(`Incomplete ${legacy ? 'legacy ' : ''}schema: ${missing.join(', ')}`);
  } finally { await source.destroy(); }
}

module.exports = { checkSchema };
