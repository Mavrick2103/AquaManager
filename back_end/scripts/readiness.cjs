const mysql = require('mysql2/promise');
const { checkSchema } = require('./check-schema.cjs');

async function readiness() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME,
  });
  try {
    await checkSchema(db);
    await db.query('SELECT id, userId, refreshHash, expiresAt FROM auth_sessions LIMIT 0');
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        const response = await fetch('http://127.0.0.1:3000/api/fish-cards', { signal: AbortSignal.timeout(5000) });
        if (response.ok) { console.log('API and database ready'); return; }
      } catch {}
      if (attempt < 11) await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('API readiness failed');
  } finally { await db.end(); }
}
readiness().catch(error => { console.error(error.message); process.exitCode = 1; });
