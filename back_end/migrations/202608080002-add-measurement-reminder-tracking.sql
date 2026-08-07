ALTER TABLE `settings`
  ADD COLUMN `lastMeasurementReminderAt` TIMESTAMP NULL DEFAULT NULL AFTER `newsAndUpdates`;
