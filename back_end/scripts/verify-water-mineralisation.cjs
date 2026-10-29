// Isolated temporary MySQL schema only; never alters the application's database.
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const mysql = require('mysql2');
const migration = require('../migrations/managed/202610300001-water-tds-conductivity.cjs');
const name = 'tds_test_' + randomBytes(6).toString('hex');
if (!/^tds_test_[a-f0-9]{12}$/.test(name)) throw new Error('Unsafe schema name');
function sql(statement) {
  return execFileSync('docker', ['exec','-i','aquamanager_mysql_local','sh','-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --batch --raw --skip-column-names'],
    {input:statement,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
}
const db = {
  execute: async (statement,params) => {
    const output=sql(`USE \`${name}\`; ${mysql.format(statement,params)};`);
    return [output ? output.split('\n').map(value=>({exists:value})) : []];
  },
  query: async statement => { sql(`USE \`${name}\`; ${statement};`); return [[]]; },
};
(async()=>{
  try {
    sql(`CREATE DATABASE \`${name}\`; USE \`${name}\`; CREATE TABLE water_measurements (id INT PRIMARY KEY, ph FLOAT NULL); INSERT INTO water_measurements VALUES (1,7.2);`);
    await migration.up(db);
    await migration.up(db);
    assert.equal(sql(`USE \`${name}\`; SELECT id,ROUND(ph,1),tds,conductivity FROM water_measurements WHERE id=1;`),'1\t7.2\tNULL\tNULL');
    sql(`USE \`${name}\`; UPDATE water_measurements SET tds=0,conductivity=324.5 WHERE id=1;`);
    assert.equal(sql(`USE \`${name}\`; SELECT tds,conductivity FROM water_measurements WHERE id=1;`),'0\t324.5');
    console.log('TDS/conductivity migration verified: historical values preserved, NULL defaults, zero and decimals retained, repeat execution safe.');
  } finally { sql(`DROP DATABASE IF EXISTS \`${name}\`;`); }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
