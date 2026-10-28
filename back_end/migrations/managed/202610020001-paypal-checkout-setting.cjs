module.exports.up = async (db) => {
  await db.query(`CREATE TABLE IF NOT EXISTS paypal_checkout_settings (
    id INT NOT NULL PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    updatedBy INT NULL,
    updatedAt DATETIME NULL
  ) ENGINE=InnoDB`);
  await db.query('INSERT IGNORE INTO paypal_checkout_settings (id, enabled) VALUES (1, 1)');
};
