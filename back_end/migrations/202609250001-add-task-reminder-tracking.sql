-- Apply once before starting the API with task reminders enabled.
ALTER TABLE `settings`
  ADD COLUMN `lastTaskReminderDate` DATE NULL DEFAULT NULL AFTER `lastMeasurementReminderAt`;
