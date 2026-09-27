-- Run once before deploying the API; existing payments must not trigger retroactive emails.
ALTER TABLE `paypal_payments`
  ADD COLUMN `confirmationEmailAttemptedAt` DATETIME NULL DEFAULT NULL,
  ADD COLUMN `confirmationEmailSentAt` DATETIME NULL DEFAULT NULL;
UPDATE `paypal_payments` SET `confirmationEmailAttemptedAt` = NOW();
