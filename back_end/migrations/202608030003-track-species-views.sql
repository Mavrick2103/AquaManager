ALTER TABLE `feature_usage_events`
  MODIFY COLUMN `userId` int NULL,
  ADD COLUMN `resourceId` int NULL AFTER `feature`,
  ADD COLUMN `visitorKey` varchar(64) NULL AFTER `resourceId`,
  ADD KEY `IDX_feature_usage_events_visitorKey` (`visitorKey`);
