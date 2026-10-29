// Optional measurements: existing readings remain unknown (NULL), never zero-filled.
module.exports.up = async (db) => {
  for (const name of ['tds', 'conductivity']) {
    const [rows] = await db.execute(
      'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      ['water_measurements', name],
    );
    if (!rows.length) await db.query(`ALTER TABLE water_measurements ADD COLUMN \`${name}\` FLOAT NULL`);
  }
};
