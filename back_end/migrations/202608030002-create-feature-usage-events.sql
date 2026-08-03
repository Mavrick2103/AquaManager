CREATE TABLE IF NOT EXISTS `feature_usage_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `aquariumId` int NULL,
  `feature` varchar(40) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_feature_usage_events_userId` (`userId`),
  KEY `IDX_feature_usage_events_feature_createdAt` (`feature`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
