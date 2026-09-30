module.exports.up = async (db) => {
  for (const name of ['archivedAt', 'archiveExpiresAt']) {
    const [rows] = await db.execute(
      'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      ['aquariums', name],
    );
    if (!rows.length) await db.query(`ALTER TABLE aquariums ADD COLUMN \`${name}\` DATETIME NULL`);
  }
};
