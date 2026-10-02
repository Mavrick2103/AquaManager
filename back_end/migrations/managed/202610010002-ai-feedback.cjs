module.exports.up = async (db) => {
  const [columns] = await db.query('SHOW COLUMNS FROM ai_usage');
  const existing = new Set(columns.map(column => column.Field));
  for (const [name, definition] of [
    ['questionText', 'TEXT NULL'],
    ['feedback', 'VARCHAR(20) NULL'],
    ['feedbackAt', 'DATETIME NULL'],
  ]) {
    if (!existing.has(name)) await db.query(`ALTER TABLE ai_usage ADD COLUMN \`${name}\` ${definition}`);
  }
};
