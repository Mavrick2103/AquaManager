module.exports.up = async (db) => {
  await db.query(`CREATE TABLE IF NOT EXISTS gamification_activities (
    userId INT NOT NULL,
    eventKey VARCHAR(120) NOT NULL,
    kind VARCHAR(24) NOT NULL,
    activityDate DATE NOT NULL,
    PRIMARY KEY (userId, eventKey),
    INDEX IDX_gamification_activity_days (userId, kind, activityDate),
    CONSTRAINT FK_gamification_activity_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
};
