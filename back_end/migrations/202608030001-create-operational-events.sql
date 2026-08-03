CREATE TABLE IF NOT EXISTS `operational_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` varchar(30) NOT NULL,
  `route` varchar(180) NOT NULL,
  `statusCode` smallint unsigned NOT NULL DEFAULT 500,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_operational_events_type_createdAt` (`type`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
