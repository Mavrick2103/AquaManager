ALTER TABLE `tasks`
  ADD COLUMN `completedOccurrences` JSON NULL AFTER `repeatEndAt`;
