// Idempotent DDL: MySQL commits ALTER TABLE even if a later statement fails.
module.exports.up = async (db) => {
  for (const [name, definition] of [
    ['authVersion', 'INT NOT NULL DEFAULT 0'],
    ['pendingEmail', 'VARCHAR(255) NULL'],
  ]) {
    const [rows] = await db.execute(
      'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      ['users', name],
    );
    if (!rows.length) await db.query(`ALTER TABLE users ADD COLUMN \`${name}\` ${definition}`);
  }
  await db.query(`CREATE TABLE IF NOT EXISTS auth_sessions (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    userId INT NOT NULL,
    refreshHash VARCHAR(64) NOT NULL,
    expiresAt DATETIME NOT NULL,
    INDEX IDX_auth_session_user (userId),
    CONSTRAINT FK_auth_session_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
};
