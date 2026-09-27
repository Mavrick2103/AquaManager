-- Apply once BEFORE deploying the new API. No payment credentials are stored here.
ALTER TABLE `users`
  ADD COLUMN `billingProvider` VARCHAR(12) NULL DEFAULT NULL,
  ADD COLUMN `paypalSubscriptionId` VARCHAR(64) NULL DEFAULT NULL,
  ADD COLUMN `paypalRenewalActive` TINYINT NOT NULL DEFAULT 0,
  ADD UNIQUE INDEX `UQ_users_paypal_subscription` (`paypalSubscriptionId`);

UPDATE `users` SET `billingProvider` = 'stripe' WHERE `stripeSubscriptionId` IS NOT NULL;

CREATE TABLE `paypal_subscriptions` (
  `id` VARCHAR(36) NOT NULL,
  `userId` INT NOT NULL,
  `paypalId` VARCHAR(64) NULL,
  `planId` VARCHAR(64) NOT NULL,
  `environment` VARCHAR(8) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'CREATING',
  `approvalUrl` TEXT NULL,
  `paidUntil` DATETIME NULL,
  `syncedAt` DATETIME NULL,
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`), UNIQUE KEY `UQ_paypal_remote_id` (`paypalId`),
  KEY `IDX_paypal_user` (`userId`),
  CONSTRAINT `FK_paypal_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `paypal_payments` (
  `id` VARCHAR(64) NOT NULL,
  `subscriptionKey` VARCHAR(36) NOT NULL,
  `paidAt` DATETIME NULL,
  `periodEnd` DATETIME NULL,
  `reversed` TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), KEY `IDX_paypal_payment_subscription` (`subscriptionKey`),
  CONSTRAINT `FK_paypal_payment_subscription` FOREIGN KEY (`subscriptionKey`) REFERENCES `paypal_subscriptions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
