ALTER TABLE `settings`
  ADD COLUMN `notificationsEnabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `volumeUnit`,
  ADD COLUMN `taskReminders` TINYINT(1) NOT NULL DEFAULT 1 AFTER `pushNotifications`,
  ADD COLUMN `automaticNotifications` TINYINT(1) NOT NULL DEFAULT 1 AFTER `taskReminders`,
  ADD COLUMN `newsAndUpdates` TINYINT(1) NOT NULL DEFAULT 0 AFTER `automaticNotifications`;
