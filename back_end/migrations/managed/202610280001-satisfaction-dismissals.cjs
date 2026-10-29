module.exports.up = async (db) => {
  await db.query(`CREATE TABLE IF NOT EXISTS satisfaction_dismissals (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    invitationUntil DATETIME NOT NULL,
    segment VARCHAR(10) NOT NULL,
    source VARCHAR(10) NOT NULL,
    createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY UQ_satisfaction_dismissal_invitation (userId, invitationUntil),
    INDEX IDX_satisfaction_dismissal_date (createdAt),
    CONSTRAINT FK_satisfaction_dismissal_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
};
