CREATE TABLE IF NOT EXISTS paypal_admin_actions (
  id INT NOT NULL AUTO_INCREMENT,
  subscriptionKey VARCHAR(36) NOT NULL,
  actorId INT NOT NULL,
  outcome VARCHAR(16) NOT NULL,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  INDEX IDX_paypal_admin_subscription (subscriptionKey)
);
