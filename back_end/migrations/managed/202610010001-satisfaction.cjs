module.exports.up = async (db) => {
  await db.query(`CREATE TABLE IF NOT EXISTS satisfaction_states (
    userId INT NOT NULL PRIMARY KEY,
    visitDays INT NOT NULL DEFAULT 0,
    lastVisitDay VARCHAR(10) NULL,
    lastResponseAt DATETIME NULL,
    dismissedUntil DATETIME NULL,
    CONSTRAINT FK_satisfaction_state_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
  await db.query(`CREATE TABLE IF NOT EXISTS satisfaction_responses (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    segment VARCHAR(10) NOT NULL,
    source VARCHAR(10) NOT NULL,
    rating TINYINT NOT NULL,
    premiumRating TINYINT NULL,
    comment VARCHAR(2000) NOT NULL DEFAULT '',
    status VARCHAR(10) NOT NULL DEFAULT 'NEW',
    createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX IDX_satisfaction_user (userId),
    INDEX IDX_satisfaction_segment_date (segment, createdAt),
    CONSTRAINT FK_satisfaction_response_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT CK_satisfaction_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT CK_satisfaction_premium CHECK (premiumRating IS NULL OR premiumRating BETWEEN 1 AND 5)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
};
